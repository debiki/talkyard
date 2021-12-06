/**
 * Copyright (c) 2013 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import debiki.dao.{NotYetCreatedEmbeddedPage, SiteDao}
import talkyard.server.{TyContext, TyController, RenderedPage}
import talkyard.server.http._
import talkyard.server.security.EdSecurity
import javax.inject.Inject
import play.api.libs.json.JsValue
import play.api.mvc.{Action, ControllerComponents}


/** Shows embedded comments.
  */
class EmbeddedTopicsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.globals
  import context.security
  import EmbeddedTopicsController._


  def createEmbeddedCommentsForum: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    val settings = request.siteSettings
    val origin = settings.anyMainEmbeddingDomain.getOrElse("Unknown [4BR12A0]")
    val title = "Comments for " + origin.replaceFirst("https?://", "")
    request.dao.createForum(title, folder = "/", isForEmbCmts = true, request.who)
    Ok
  }


  /** If in iframe, either no cookies get included, or all — so won't
    * run into problems with just parts of the session id being present,
    * and we can leave the authn strength at the default, MinAuthnStrength.Normal.
    *
    * Might need to ask the user to click a button in the iframe, triggering
    * iOS to show a dialog where the user can let the iframe use cookies.  [ios_itp]
    */
  def showTopic(embeddingUrl: String, discussionId: Option[AltPageId],   // [5BRW02]
          edPageId: Option[PageId], category: Option[Ref], scriptV: Opt[St]): Action[U] =
      AsyncGetActionMaybeSkipCookies(avoidCookies = true) { request =>

    import request.dao

    // Later, the params can optionally be signed with PASTEO,  [blog_comments_sso]
    // for those who are worried that end users edit the html and type their own
    // category or discussion ids. (There's always access control though.)

    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl,
          category, dao)

    val (renderedPage, pageRequest) = anyRealPageId match {
      case None =>
        // Embedded comments page not yet created. Return a dummy page; we'll create a real one,
        // later when the first reply gets posted.
        val pageRequest = ViewPageController.makeEmptyPageRequest(
              request, EmptyPageId, showId = true,
              PageType.EmbeddedComments, globals.now())

        // In which category should the page get lazy-created?
        val lazyCreatePageInCat = category.map(dao.getOrThrowAnyCategoryByRef)
        val lazyCreateInCatId =
                lazyCreatePageInCat.map(_.id) getOrElse dao.getDefaultCategoryId()

        BUG // this'll use the default settings [04MDKG356] — which means the Like
        // button will always be visible, for an empty blog comments page.
        // Need to pass the settings to NotYetCreatedEmbeddedPage somehow, but it's in ty-core
        // which doesn't know about that class.
        val lazyPage = NotYetCreatedEmbeddedPage(
              dao.siteId, PageType.EmbeddedComments, anyCategoryId = Some(lazyCreateInCatId),
              embeddingUrl = embeddingUrl, globals.now())

        val pageCtx = dao.maySeePageUseCache(lazyPage.meta, request.requester) ifMayNot { debugCode =>
          // Happens e.g. if placed in an access restricted category.
          security.throwIndistinguishableNotFound(debugCode)
        }

        val siteSettings = dao.getWholeSiteSettings()
        val discProps = DiscProps.derive(selfSource = None, pageCtx.ancCatsRootLast, siteSettings)

        val pageRenderParams = PageRenderParams(
              comtOrder = discProps.comtOrder,
              widthLayout = if (request.isMobile) WidthLayout.Tiny else WidthLayout.Medium,
              isEmbedded = true,
              origin = request.origin,
              anyCdnOrigin = globals.anyCdnOrigin,
              anyPageRoot = None,
              anyPageQuery = None)

        val jsonStuff = dao.jsonMaker.notYetCreatedPageToJson(lazyPage, pageRenderParams)

        // Don't render server side, render client side only. Search engines shouldn't see it anyway,
        // because it doesn't exist.
        // So skip: Nashorn.renderPage(jsonStuff.reactStoreJsonString)
        val tpi = new PageTpi(pageRequest, jsonStuff.reactStoreJsonString, jsonStuff.version,
              "Lazy page [TyMLAZYPAGE]", WrongCachedPageVersion,
              jsonStuff.pageTitleUnsafe, jsonStuff.customHeadTags,
              anyDiscussionId = discussionId, anyEmbeddingUrl = Some(embeddingUrl),
              lazyCreatePageInCatId = Some(lazyCreateInCatId))
        val htmlString = views.html.templates.page(tpi).body
        val renderedPage = RenderedPage(htmlString, "NoJson-1WB4Z6",
              unapprovedPostAuthorIds = Set.empty, anonsByRealId = Map.empty)

        (renderedPage, pageRequest)

      case Some(realId) =>
        // (For now, ignore `category` here. Or, some time later, would an admin setting
        // to move move the page to that category make sense?

        val pageMeta = dao.getThePageMeta(realId)
        if (pageMeta.pageType != PageType.EmbeddedComments)
          throwForbidden("EdE2F6UHY3", "Not an embedded comments page",
          o"""You cannot embed any type of page — only pages of type EmbeddedComments.
          They get created automatically by Talkyard, when someone posts the first
          comment on a blog post of yours. — If you want to give such a page
          a specific id, you can use the data-discussion-id="..." html attribute in
          the Talkyard html code snippet in your blog.""")

        CHECK_AUTHN_STRENGTH // done just above. Some time later, maybe also
        // some per category checks?
        // Apparently Safari can pop up a dialog where the user can let the iframe
        // use cookies, if hen interacts with the iframe. So, if a blog comments
        // discussion requires authn to read, Ty could show a button in the iframe,
        // like, "Click to authenticate"?
        // Then, if clicking, Safari would ask if the iframe was allowed to use cookies,
        // and (if answering Yes), one would get logged in directly, if there were
        // cookies already?  [ios_itp]

        val pageCtx = dao.maySeePageUseCache(pageMeta, request.requester) ifMayNot { debugCode =>
          security.throwIndistinguishableNotFound(debugCode)
        }

        val pagePath = PagePath(siteId = request.siteId, folder = "/", pageId = Some(realId),
          showId = true, pageSlug = "")

        val pageRequest = new PageRequest[Unit](
          request.site,
          request.anyTySession,
          sid = request.sid,
          xsrfToken = request.xsrfToken,
          browserId = request.browserId,
          user = request.user,
          pageExists = true,
          pagePath = pagePath,
          pageMeta = Some(pageMeta),
          ancCatsRootLast = pageCtx.ancCatsRootLast,
          embeddingUrl = Some(embeddingUrl),
          altPageId = discussionId,
          dao = dao,
          request = request.request)

        (request.dao.renderWholePageHtmlMaybeUseMemCache(pageRequest), pageRequest)
    }

    // Privacy tools and settings might break cookies. If we may not use cookies,  [NOCOOKIES]
    // then include a xsrf token in the html instead.
    // (Cannot use a response header for this, because in the browser, one cannot access
    // the current page's headers, see e.g.:  https://stackoverflow.com/a/4881836/694469 )
    val hasXsrfTokenAlready = request.xsrfToken.value.nonEmpty
    val newXsrfToken: Option[String] =
      if (hasXsrfTokenAlready) None
      else {
        Some(security.createXsrfToken().value)
      }

    val futureResponse = ViewPageController.addVolatileJsonAndPreventClickjacking(
      renderedPage,
      pageRequest,
      embeddingUrl = Some(embeddingUrl),
      // Users online not shown anywhere anyway, for embedded comments.
      skipUsersOnline = true,
      // This'll insert a noCookieXsrfToken JSON field, so the browser will remember
      // to not use cookies.
      xsrfTokenIfNoCookies = newXsrfToken)

    futureResponse
  }


  def showEmbeddedEditor(embeddingUrl: St, embeddingScriptV: Opt[i32]): Action[U] =
        AsyncGetActionMaybeSkipCookies(avoidCookies = true) { request =>

    val tpi = new EditPageTpi(request, anyEmbeddingUrl = Some(embeddingUrl))
    val htmlStr = views.html.embeddedEditor(tpi, embeddingScriptV = embeddingScriptV).body

    // (The callee needs to know the embedding origin, so the callee can know if
    // the request is to localhost — then we allow embedding (from localhost),
    // so techies can test on localhost.)
    UX; SHOULD // not auto allow localhost. Add it explicitly instead.
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
        unapprovedPostAuthorIds = Set.empty, request, embeddingUrl = Some(embeddingUrl))
  }
}



object EmbeddedTopicsController {

  REFACTOR // Move to PagePathMetaDao.getRealPageIdByDiidOrEmbUrl() instead? [emb_pg_lookup]
  def getAnyRealPageId(tyPageId: Opt[PageId], discussionId: Opt[DiscId],
        embeddingUrl: St, categoryRef: Opt[Ref], dao: SiteDao): Opt[PageId] = {

    // Lookup the page by Talkyard page id, if specified, otherwise
    // use the discussion id, or the embedding url, or, if no match,
    // the embedding url path (so works across all origins).
    // Trying with the full url (incl origin) before the url path only, can be good
    // if the same Talkyard site provides comments for two different blogs?
    // Then later there could be a config value that says the 2nd blog should
    // lookup discussions by full url origin + path.

    // If looking up by url path only, then, look only in any category [emb_disc_cat]
    // specified by categoryRef.  This'd make it possible for blogs
    // at different origins, to share the same Talkayrd site, but different
    // categories. And if a blog gets moved to a new origin — Talkyard
    // would still find the correct embedded page, thanks to looking in
    // the correct category — *also* if both blogs have pages with that
    // same url path.

    // This'd require embedded page url paths to be unique *per category*.
    // (And, the root category, could be used, when no specific category specified.)

    // And:
    //    The cateory needs a way to construct urls back to the blog. So there needs to
    //    be a per category embeddingOrigin setting?
    //    when generating links in notification emails.
    //
    // Old comments, a bit good ideas? -------------------------
    // Per category embedding-origins give people a simple way to move a blog to a new domain,
    // and tell Talkyard about the change once and only once — by updating the category
    // and change its embedding domain.
    //
    // So, maybe add a new category setting? Namely embeddingDomain?
    // Which must be one of the allowEmbeddingFrom domains.
    // Maybe the extId isn't needed? Instead,
    // if there's a multi-blog Talkyard site (i.e. a blog comments site that stores
    // comments for many different blogs), then, a requirement can be that each blog
    // stores comments in a different category? (could be sub categories) and
    // each such category has an embeddingOrigin setting, and url paths need to be
    // unique only within a category?
    //
    // 2020-06: No. Turns out the same website sometimes wants to create embedded
    //     discussions *in different categories*, one for each section of their website.
    //
    // Old comment:
    // I think a per category embeddingOrigin setting is all that's needed —
    // the  data-category="extid:category_ext_id" would only be needed if one
    // wants to store comments for many different blogs in the same category?
    // Or comments for different parts of the same domain, in different categories?
    // ... but that sounds like a valid use case (!). So, maybe both
    // embeddingOrigin and data-category-ref makes sense then.
    // ---------------------------------------------------------
    //
    tyPageId orElse {
      discussionId.trimNoneIfBlank match {
        case Some(id) =>
          // If this finds nothing, then, don't try matching by embeddingUrl. — If the
          //  discussion id is different, it's a different discussion, regardless of
          // if the embedding url matches something or not.
          // A bit dupl knowledge. [205KST526]
          dao.getRealPageId("diid:" + id) orElse {
            // Backw compat: Old ids weren't prefixed with 'diid:'.
            // Can remove this, after 'diid:' prefixed in all of alt_page_ids3.  [prefix_diid]
            dao.getRealPageId(id)
          }
        case None =>
          dao.getRealPageId(embeddingUrl) orElse {
            val urlPath = extractUrlPath(embeddingUrl)
            dao.getRealPageId(urlPath)
          }
      }
    }
  }

}
