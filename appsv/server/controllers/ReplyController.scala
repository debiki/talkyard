/**
 * Copyright (c) 2012-2013, 2018 Kaj Magnus Lindberg
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
import debiki.JsonUtils.{asJsObject, parseOptInt32}
import talkyard.server.{TyContext, TyController}
import talkyard.server.authz.Authz
import talkyard.server.http._

import javax.inject.Inject
import play.api._
import play.api.libs.json.{JsObject, JsValue, Json}
import play.api.mvc._
import talkyard.server.authn.MinAuthnStrength
import org.scalactic.{Bad, Good, Or}


/** Saves replies. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
class ReplyController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}


  // Move to where?
  def anonHowFromJson(jsOb: JsObject): Opt[AnonHow] Or ErrMsg = {
    import debiki.JsonUtils.parseOptInt32
    val sameAnonId = parseOptInt32(jsOb, "sameAnonId")
    val newAnonStatus = parseOptInt32(jsOb, "newAnonStatus").flatMap(AnonStatus.fromInt)
    if (sameAnonId.isDefined && newAnonStatus.isDefined) {
      Bad("Both sameAnonId and newAnonStatus specified")
    }
    else Good {
      if (sameAnonId.isDefined) {
        Some(AnonHow.AsSameAnon(sameAnonId.get))
      }
      else if (newAnonStatus.isDefined) {
        Some(AnonHow.AsNewAnon(newAnonStatus.get))
      }
      else {
        None
      }
    }
  }


  def handleReply: Action[JsValue] = PostJsonAction(RateLimits.PostReply,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    import request.{dao, theRequester => requester}
    val body = asJsObject(request.body, "request body")
    val anyPageId = (body \ "pageId").asOpt[PageId]
    val anyDiscussionId = (body \ "discussionId").asOpt[AltPageId] orElse (
          body \ "altPageId").asOpt[AltPageId] ; CLEAN_UP // deprecated name [058RKTJ64] 2020-06
    val anyEmbeddingUrl = (body \ "embeddingUrl").asOpt[String]
    val lazyCreatePageInCatId = (body \ "lazyCreatePageInCatId").asOpt[CategoryId]
    val replyToPostNrs = (body \ "postNrs").as[Set[PostNr]]
    val text = (body \ "text").as[String].trim
    val postType = PostType.fromInt((body \ "postType").as[Int]) getOrElse throwBadReq(
      "DwE6KG4", "Bad post type")
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]
    val anonHow: Opt[AnonHow] = anonHowFromJson(body) getOrIfBad { prob =>
      throwBadReq("TyE9MWG46R", s"Bad anon params: $prob")
    }

    throwBadRequestIf(text.isEmpty, "EdE85FK03", "Empty post")
    throwForbiddenIf(requester.isGroup, "EdE4GKRSR1", "Groups may not reply")

    DISCUSSION_QUALITY; COULD // require that the user has spent a reasonable time reading
    // the topic, in comparison to # posts in the topic, before allowing hen to post a reply.

    val (pageId, newEmbPage) = EmbeddedCommentsPageCreator.getOrCreatePageId(
          anyPageId = anyPageId, anyDiscussionId = anyDiscussionId,
          anyEmbeddingUrl = anyEmbeddingUrl, lazyCreatePageInCatId = lazyCreatePageInCatId,
          request)

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE5FKW20")
    val replyToPosts = dao.loadPostsAllOrError(pageId, replyToPostNrs) getOrIfBad { missingPostNr =>
      throwNotFound(s"Post nr $missingPostNr not found", "EdEW3HPY08")
    }
    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    CHECK_AUTHN_STRENGTH

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theUser),
      postType, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)),
      "TyEM0REPLY_")

    REFACTOR; COULD // intstead: [5FLK02]
    // val authzContext = dao.getPageAuthzContext(requester, pageMeta)
    // throwNoUnless(Authz.mayPostReply(authzContext, postType, "EdEZBXK3M2")

    // For now, don't follow links in replies. COULD rel=follow if all authors + editors = trusted.
    val postRenderSettings = dao.makePostRenderSettings(pageMeta.pageType)
    val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
      text,
      embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
      followLinks = false)

    val result = dao.insertReply(textAndHtml, pageId = pageId, replyToPostNrs,
      postType, deleteDraftNr, request.who, request.spamRelatedStuff, anonHow)

    var responseJson: JsObject = result.storePatchJson
    if (newEmbPage.isDefined) {
      responseJson = responseJson ++
          EmbeddedCommentsPageCreator.makeAnyNewPageJson(newEmbPage)
    }
    OkSafeJson(responseJson)
  }


  def handleChatMessage: Action[JsValue] = PostJsonAction(RateLimits.PostReply,
        maxBytes = MaxPostSize) { request =>
    import request.{body, dao}
    val pageId = (body \ "pageId").as[PageId]
    val text = (body \ "text").as[String].trim
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]


    throwBadRequestIf(text.isEmpty, "EsE0WQCB", "Empty chat message")

    val pageMeta = dao.getPageMeta(pageId) getOrElse {
      throwIndistinguishableNotFound("EdE7JS2")
    }
    val replyToPosts = Nil  // currently cannot reply to specific posts, in the chat [7YKDW3]
    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theMember),
      PostType.ChatMessage, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdEHDETG4K5")

    // Don't follow links in chat messages — chats don't work with search engines anyway.
    val postRenderSettings = dao.makePostRenderSettings(pageMeta.pageType)
    val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
      text,
      embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
      followLinks = false)
    val result = dao.insertChatMessage(
      textAndHtml, pageId = pageId, deleteDraftNr, request.who, request.spamRelatedStuff)

    OkSafeJson(result.storePatchJson)
  }


}


case class NewEmbPage(path: PagePathWithId, origPostId: PostId)


object EmbeddedCommentsPageCreator {   REFACTOR; CLEAN_UP; // moe to talkyard.server.embpages ?


  /** The browser wants to know if a new page got created.
    */
  def makeAnyNewPageJson(anyNewEmbPage: Option[NewEmbPage]): JsObject = {
    anyNewEmbPage match {
      case None => JsObject(Nil)
      case Some(newEmbPage) =>
        Json.obj(
          "newlyCreatedPageId" -> newEmbPage.path.pageId,
          "newlyCreatedOrigPostId" -> newEmbPage.origPostId)   // [NEEDEMBOP]
    }
  }


  /** Returns the id of an already existing page, or if missing, creates
    * a new — and returns its id, it's path, and its Orig Post id.
    *
    * (The OP id is hereafter needed, if continuing posting replies to
    * the orig post [NEEDEMBOP].)
    */
  def getOrCreatePageId(  // [4AMJX7]
        anyPageId: Option[PageId],
        anyDiscussionId: Option[String],
        anyEmbeddingUrl: Option[String],
        lazyCreatePageInCatId: Option[CategoryId],
        request: DebikiRequest[_]): (PageId, Option[NewEmbPage]) = {
    anyPageId foreach { pageId =>
      if (pageId != NoPageId)
        return (pageId, None)
    }

    throwBadRequestIf(anyEmbeddingUrl.exists(_ contains ' '),  // SHOULD instead, ensure no blanks? [05970KF5]
      "TyE4KLL2TJ", "Embedding url has whitespace")
    throwBadRequestIf(anyEmbeddingUrl.exists(_ contains '#'),
      "EdE0GK3P4", s"Don't include any URL #hash in the embedding page URL: ${anyEmbeddingUrl.get}")

    SHOULD // check alt page id too — no blanks allowed? [05970KF5]

    anyDiscussionId.foreach(discussionId => {
      Validation.findDiscussionIdProblem(discussionId) foreach { problem =>
        throwBadRequest("TyE205WKDH46", problem)
      }

      // Discussion ids are prefixed by 'diid:' so they have their own namespace
      // and won't clash with any url, e.g. if they start with '/' they'd be mistaken
      // for urls, without the 'diid' prefix..
      // A bit dupl knowledge. [205KST526]
      request.dao.getRealPageId("diid:" + discussionId) foreach { pageId =>
        return (pageId, None)
      }
      // Old, backw compat: Try without 'diid:' prefix [J402RKDT]. This won't be needed,
      // later after old discussion ids that aren't urls, have been migrated to
      // include the 'diid:" prefix. — This migration is a tiny bit risky, in that
      // if an id does start with '/', it'll be mistaken for being an url path, and
      // won't get migrated. Apparently not an issue, as of Sept -19 (there are no
      // such discussion ids in the hosted blog comments sites).
      DO_AFTER // 2022-01-01, prefix all discussion ids in alt_page_ids3 with 'diid:'?
      // (Skip rows that start with 'https?:' and '/' (url paths).)  [prefix_diid]
      request.dao.getRealPageId(discussionId) foreach { pageId =>
        return (pageId, None)
      }
    })

    val embeddingUrl = anyEmbeddingUrl getOrElse {
      throwNotFound("TyE0ID0EMBURL", "Page not found by id, and no embedding url specified")
    }

    // Lookup by complete url, or, if no match, url path only (not query string
    // — we don't know if a query string is related to identifying the embedding page or not).
    // [lookup_url_urlpath]
    val pageIdByUrl: Option[PageId] = request.dao.getRealPageId(embeddingUrl) orElse {
      // There could be a site setting to disable lookup by url path (without origin and
      // query params), if the same Talkyard site is used for different blogs on different
      // domains, with possibly similar url paths. [06KWDNF2] [COMCATS]
      // Or, instead,the blog can use different URL params: embeddingUrlLax=...
      // which tries with the exact url, host + path, and just path.
      // And, embeddingUrlExact=... which requiers an exact match. See
      // case class EmbeddingUrl.  [emburl_emgurl]
      val urlPath = extractUrlPath(embeddingUrl)
      request.dao.getRealPageId(urlPath)
    }

    pageIdByUrl foreach { pageId =>
      anyDiscussionId match {
        case None =>
          return (pageId, None)
        case Some(altPageId) =>
          // If page pageId has a different discussion id than altPageId,
          // then it's for a different discussion and we shouldn't use it.
          val otherAltIdsSamePage = request.dao.getAltPageIdsForPageId(pageId)
          val anyOtherIsNotUrl = otherAltIdsSamePage.exists(otherId =>
            !otherId.startsWith("http:") &&
              !otherId.startsWith("https:") &&
              !otherId.startsWith("/"))   // <—— url "/path/to/page" or "//hostname/path"?
                                          // COULD forbid discussion ids that starts with '/' ?
                                          // But that's not backw compat?

          if (anyOtherIsNotUrl) {
            // There's a page at the same url, but it has a different discussion id,
            // so it's a different discussion.
            // This means the blog uses different discussion ids for the same url
            // — then we'll create different discussions, for the same url. To make it
            // possible to embed different discussions at the same url — that was useful
            // for someone's map application; he wanted to open Javascript popups with
            // embedded comments for various locations at the map, each one with its
            // own separate discussion and discussion id (but same page and url).
            // So, proceed with calling
            //   tryCreateEmbeddedCommentsPage()
            // below.
          }
          else {
            // Fine, we found a discussion with a matching url or url path. The page
            // doesn't have a different discussion id, so it's *not* a different
            // discussion. (All its alt ids are url or url paths, one of which matches
            // the browser's current url). — So we'll use this discussion.

            // Minor BUG maybe?:
            // Shouldn't altPageId now be added to the lookup ids for this emb disc?
            // So this works:
            // 1) Create discussion, no disc id, just url.
            // 2) Edit the blog source, add ids to all discussions.
            // 3) View the discussion. Now the new lookup id (alt id) gets sent to the server,
            // which could remember it here?
            // 4) Move the blog to a different domain.
            // 5) Lookup — now, needs to have remembered the id in step 3,
            // since now new url.
            // However, 3 will happen only for blog posts one reloads, after having
            // edited the blog and added ids. So would be good to combine with: [COMCATS].

            return (pageId, None)
          }
      }
    }

    // Create a new embedded discussion page.
    // It hasn't yet been created, and is needed, so we can associate the thing
    // we're currently saving (e.g. a reply) with a page.
    val newPagePath = tryCreateEmbeddedCommentsPage(
          request, embeddingUrl, anyDiscussionId, lazyCreatePageInCatId)
    val origPost = request.dao.loadPost(newPagePath.pageId, BodyNr).getOrDie("TyE305WKTSR",
          s"s${request.siteId}: Couldn't load orig post of new page $newPagePath")
    (newPagePath.pageId, Some(NewEmbPage(newPagePath, origPost.id)))
  }


  private def tryCreateEmbeddedCommentsPage(request: DebikiRequest[_], embeddingUrl: String,
        anyDiscussionId: Option[String], lazyCreatePageInCatId: Option[CategoryId])
        : PagePathWithId = {
    import request.{dao, requester, context}

    // Later, the params above can optionally be signed with PASTEO [blog_comments_sso],
    // so end users cannot edit the page html and fake different
    // discussion ids or category ids.  Then, comments are guaranteed to get posted
    // on the right page, and pages lazy-created in the intended categories.

    val siteSettings = dao.getWholeSiteSettings()
    if (siteSettings.allowEmbeddingFrom.isEmpty) {
      SECURITY; SHOULD // Later, check that allowEmbeddingFrom origin matches... the referer? [4GUYQC0].
      // What? That' not needed — the browsers don't allow cross-origin POST requests,
      // unless the admins explicitly enable that for their Ty site.

      throwForbidden2("EdE2WTKG8", "Embedded comments allow-from origin not configured")
    }

    val slug = None
    val folder = None

    val placeInCatId = lazyCreatePageInCatId getOrElse {
      val id = siteSettings.embeddedCommentsCategoryId
      if (id != NoCategoryId) id
      else dao.getDefaultCategoryId()
    }

    val categoriesRootLast = dao.getAncestorCategoriesRootLast(placeInCatId)
    val pageRole = PageType.EmbeddedComments

    context.security.throwNoUnless(Authz.mayCreatePage(
          request.theUserAndLevels, dao.getGroupIdsOwnFirst(requester),
          pageRole, PostType.Normal, pinWhere = None, anySlug = slug, anyFolder = folder,
          inCategoriesRootLast = categoriesRootLast,
          tooManyPermissions = dao.getPermsOnPages(categories = categoriesRootLast)),
          "EdE7USC2R8")

    // This won't generate any new page notf — but the first *reply*, does. [new_emb_pg_notf]
    dao.createPage(pageRole, PageStatus.Published,
          anyCategoryId = Some(placeInCatId), anyFolder = slug, anySlug = folder,
          title = TitleSourceAndHtml(s"Comments for $embeddingUrl"),
          bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
            s"Comments for: $embeddingUrl"),
          showId = true, deleteDraftNr = None,  // later, will be a draft to delete? [BLGCMNT1]
          Who.System, request.spamRelatedStuff, discussionIds = anyDiscussionId.toSet,
          embeddingUrl = Some(embeddingUrl))
  }

}
