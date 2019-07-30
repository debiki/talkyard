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
import debiki.dao.{NonExistingPage, SiteDao}
import ed.server.{EdContext, EdController, RenderedPage}
import ed.server.http._
import ed.server.security.EdSecurity
import javax.inject.Inject
import play.api.libs.json.JsValue
import play.api.mvc.{Action, ControllerComponents}


/** Shows embedded comments.
  */
class EmbeddedTopicsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security


  def createEmbeddedCommentsForum: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    val settings = request.siteSettings
    val origin = settings.anyMainEmbeddingDomain.getOrElse("Unknown [4BR12A0]")
    val title = "Comments for " + origin.replaceFirst("https?://", "")
    request.dao.createForum(title, folder = "/", isForEmbCmts = true, request.who)
    Ok
  }


  def showTopic(embeddingUrl: String, discussionId: Option[AltPageId],   // [5BRW02]
        edPageId: Option[PageId]): Action[Unit] =
      AsyncGetActionMaybeSkipCookies(avoidCookies = true) { request =>

    import request.dao

    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, dao)
    val (renderedPage, pageRequest) = anyRealPageId match {
      case None =>
        // Embedded comments page not yet created. Return a dummy page; we'll create a real one,
        // later when the first reply gets posted.
        val pageRequest = ViewPageController.makeEmptyPageRequest(request, EmptyPageId, showId = true,
            PageType.EmbeddedComments, globals.now())
        val categoryId = dao.getDefaultCategoryId()

        val dummyPage = NonExistingPage(
          dao.siteId, PageType.EmbeddedComments, Some(categoryId), embeddingUrl, globals.now())

        val (maySee, debugCode) = dao.maySeePageUseCache(dummyPage.meta, request.requester)
        if (!maySee)
          security.throwIndistinguishableNotFound(debugCode)

        val pageRenderParams = PageRenderParams(
          widthLayout = if (request.isMobile) WidthLayout.Tiny else WidthLayout.Medium,
          isEmbedded = true,
          origin = request.origin,
          anyCdnOrigin = globals.anyCdnOrigin,
          anyPageRoot = None,
          anyPageQuery = None)

        val jsonStuff = dao.jsonMaker.pageThatDoesNotExistsToJson(dummyPage, pageRenderParams)

        // Don't render server side, render client side only. Search engines shouldn't see it anyway,
        // because it doesn't exist.
        // So skip: Nashorn.renderPage(jsonStuff.reactStoreJsonString)
        val tpi = new PageTpi(pageRequest, jsonStuff.reactStoreJsonString, jsonStuff.version,
          "Dummy cached html [EdM2GRVUF05]", WrongCachedPageVersion,
          jsonStuff.pageTitleUnsafe, jsonStuff.customHeadTags, anyAltPageId = discussionId,
          anyEmbeddingUrl = Some(embeddingUrl))
        val htmlString = views.html.templates.page(tpi).body

        (RenderedPage(htmlString, "NoJson-1WB4Z6", unapprovedPostAuthorIds = Set.empty), pageRequest)

      case Some(realId) =>
        val pageMeta = dao.getThePageMeta(realId)
        if (pageMeta.pageType != PageType.EmbeddedComments)
          throwForbidden("EdE2F6UHY3", "Not an embedded comments page")

        val (maySee, debugCode) = dao.maySeePageUseCache(pageMeta, request.requester)
        if (!maySee)
          security.throwIndistinguishableNotFound(debugCode)

        val pagePath = PagePath(siteId = request.siteId, folder = "/", pageId = Some(realId),
          showId = true, pageSlug = "")

        val pageRequest = new PageRequest[Unit](
          request.site,
          sid = request.sid,
          xsrfToken = request.xsrfToken,
          browserId = request.browserId,
          user = request.user,
          pageExists = true,
          pagePath = pagePath,
          pageMeta = Some(pageMeta),
          embeddingUrl = Some(embeddingUrl),
          altPageId = discussionId,
          dao = dao,
          request = request.request)

        (request.dao.renderPageMaybeUseMemCache(pageRequest), pageRequest)
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


  def showEmbeddedEditor(embeddingUrl: String, discussionId: Option[AltPageId],
        edPageId: Option[PageId]): Action[Unit] = AsyncGetActionMaybeSkipCookies(avoidCookies = true) {
        request =>
    val anyRealPageId = getAnyRealPageId(edPageId, discussionId, embeddingUrl, request.dao)
    val tpi = new EditPageTpi(request, PageType.EmbeddedComments, anyEmbeddedPageId = anyRealPageId,
      anyAltPageId = discussionId, anyEmbeddingUrl = Some(embeddingUrl))
    val htmlStr = views.html.embeddedEditor(tpi).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
      unapprovedPostAuthorIds = Set.empty, request, embeddingUrl = Some(embeddingUrl))
  }


  private def getAnyRealPageId(edPageId: Option[PageId], discussionId: Option[String],
        embeddingUrl: String, dao: SiteDao): Option[PageId] = {
    // Lookup the page by Talkyard page id, if specified, otherwise
    // use the discussion id, or the embedding url, or, if no match,
    // the embedding url path (so works across all origins).
    // Trying with the full url (incl origin) before the url path only, can be good
    // if the same Talkyard site provides comments for two different blogs?
    // Then later there could be a config value that says the 2nd blog should
    // lookup discussions by full url origin + path. [06KWDNF2]
    //
    // **Or** better? [COMCATS] The embeddeing page specifies a
    // data-category-ref="extid:blog_cat_name"
    // ??? what:\
    //    and then Talkyard looks up the *per category* embedding origins for the blog
    //    with ext id 'blog_cat_name', and in that category finds the
    //    embeddded comments topic with a matching url path?
    // Intsead:
    //    and then Talkyard looks at all topics in that category, and finds the one
    //    with a matching url path. Meaning, emb comments url paths would be unique
    //    per category?
    // And:
    //    The cateory needs a way to construct urls back to the blog. So there needs to
    //    be a per category embeddingOrigin setting?
    ///   when generating links in notifiation emails.
    //
    // Per category embedding-origins give people a simple way to move a blog to a new domain,
    // and tell Talkyard about the change once and only once — by updating the category
    // and change its embedding domain.
    // So, maybe add a new category setting? Namely embeddingDomain?
    // Which must be one of the allowEmbeddingFrom domains.
    // Maybe the extId isn't needed? Instead,
    // if there's a multi-blog Talkyard site (i.e. a blog comments site that stores
    // comments for many different blogs), then, a requirement can be that each blog
    // stores comments in a different category? (could be sub categories) and
    // each such category has an embeddingOrigin setting, and url paths need to be
    // unique only within a category?
    // I think a per category embeddingOrigin setting is all that's needed —
    // the  data-category-ref="extid:category_ext_id" would only be needed if one
    // wants to store comments for many different blogs in the same category?
    // Or comments for different parts of the same domain, in different categories?
    // ... but that sounds like a valid use case (!). So, maybe both
    // embeddingOrigin and data-category-ref makes sense then.
    //
    edPageId orElse {
      discussionId.trimNoneIfBlank match {
        case Some(id) =>
          // If this finds nothing, then, don't try matching by embeddingUrl. — If the
          //  discussion id is different, it's a different discussion, regardless of
          // if the embedding url matches something or not.
          dao.getRealPageId(id)
        case None =>
          dao.getRealPageId(embeddingUrl) orElse {
            val urlPath = extractUrlPath(embeddingUrl)
            dao.getRealPageId(urlPath)
          }
      }
    }
  }

}
