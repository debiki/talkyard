/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import debiki.JsonUtils.asJsObject
import debiki.dao.SiteDao
import talkyard.server.{TyContext, TyController}
import talkyard.server.authz.Authz
import talkyard.server.http._
import talkyard.server.parser
import java.{util => ju}
import javax.inject.Inject
import play.api.libs.json.{JsArray, JsString, JsValue, Json}
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX.JsLongOrNull


/** Creates pages, toggles is-done, deletes them.
  */
class PageController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security.throwNoUnless

  def createPage: Action[JsValue] = PostJsonAction(RateLimits.CreateTopic, maxBytes = 20 * 1000) {
        request =>
    import request.{dao, theRequester => requester}

    throwForbiddenIf(requester.isGroup, "EdE3FDK7M6", "Groups may not create pages")

    val body = asJsObject(request.body, "request body")
    val anyCategoryId = (body \ "categoryId").asOpt[CategoryId]
    val pageRoleInt = (body \ "pageRole").as[Int]
    val pageRole = PageType.fromInt(pageRoleInt) getOrElse throwBadArgument("DwE3KE04", "pageRole")
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOptStringNoneIfBlank
    val anySlug = (body \ "pageSlug").asOptStringNoneIfBlank
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]
    val showId = (body \ "showId").asOpt[Boolean].getOrElse(true)
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]
    val doAsAnon: Opt[WhichAnon] = parser.parseWhichAnonJson(body) getOrIfBad { prob =>
      throwBadReq("TyE9MWG46R", s"Bad anon params: $prob")
    }
    val doAsNewAnon: Opt[WhichAnon.NewAnon] = doAsAnon map {
      case _new: WhichAnon.NewAnon => _new
      case _: WhichAnon.SameAsBefore => throwBadReq("TyE5MWE2J8", o"""Cannot keep
            reusing an old anonym, when creating a new page. Anonyms are pre page.""")
    }
    // val anonStatus = parseOptInt32(body, "anonStatus").flatMap(AnonStatus.fromInt)

    val postRenderSettings = dao.makePostRenderSettings(pageRole)
    val bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(bodyText,
      embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
      allowClassIdDataAttrs = true, followLinks = pageRole.shallFollowLinks)

    val titleSourceAndHtml = TitleSourceAndHtml(titleText)

    if (!requester.isStaff) {
      // Showing id —> page slug cannot be mistaken for forum sort order [5AQXJ2].
      throwForbiddenIf(!showId, "TyE2PKDQC", "Only staff may hide page id")
      throwForbiddenIf(anyFolder.isDefined, "TyE4GHW2", "Only staff may specify folder")
      throwForbiddenIf(pageRole.isSection, "TyE6LUMR2", "Only staff may create new site sections")
    }

    // COULD make the Dao transaction like, and run this inside the transaction. [transaction]
    // Non-staff users shouldn't be able to create anything outside the forum section(s)
    // — except for private messages.
    if (!request.theUser.isStaff && anyCategoryId.isEmpty && pageRole != PageType.FormalMessage) {
      throwForbidden("DwE8GKE4", "No category specified")
    }

    val categoriesRootLast = dao.getAncestorCategoriesRootLast(anyCategoryId)

    throwNoUnless(Authz.mayCreatePage(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theUser),
      pageRole, PostType.Normal, pinWhere = None, anySlug = anySlug, anyFolder = anyFolder,
      inCategoriesRootLast = categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categories = categoriesRootLast)),
      "EdE5KW20A")

    val pagePath = dao.createPage(pageRole, pageStatus, anyCategoryId, anyFolder,
          anySlug, titleSourceAndHtml, bodyTextAndHtml, showId, deleteDraftNr = deleteDraftNr,
          request.who, request.spamRelatedStuff, doAsAnon = doAsNewAnon)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId))
  }


  def listPageIdsUrls(pageId: Option[PageId]): Action[Unit] = AdminGetAction { request =>
    import request.dao
    import talkyard.server.JsX._

    val pageMetas = pageId match {
      case Some(id) => Seq(dao.getThePageMeta(id))
      case None => dao.readOnlyTransaction { tx =>
        tx.loadAllPageMetas(limit = Some(333)) // [333PAGES] for now. Later, use some query params / search?
      }
    }

    // Maybe should load everything from db instead? Need to edit some queries,
    // so loads all-pages-needed at once (instead of one query per page).
    //
    val idsUrlsJsonForPages = pageMetas map { pageMeta =>
      val thePageId = pageMeta.pageId
      val lookupIds = dao.getAltPageIdsForPageId(thePageId)  // slow, doesn't yet cache [306FKTGP03]
      val pagePath = dao.getPagePath(thePageId)
      val pageStuff = dao.getPageStuffById(Seq(thePageId))
      val (discussionIds, embUrls) = lookupIds.partition(_.startsWith("diid:"))
      val json = Json.obj(  // Typescript: LoadPageIdsUrlsResponse
        "pageId" -> thePageId,
        "extId" -> JsStringOrNull(pageMeta.extImpId),
        "title" -> JsStringOrNull(pageStuff.get(thePageId).map(_.title)),
        "canonUrlPath" -> JsStringOrNull(pagePath.map(_.value)),
        "redirdUrlPaths" -> Json.arr(), // later [0WSKD46] url paths that get redirected to the canon url path.
          // lookupPagePathAndRedirects(pageId: PageId): List[PagePathWithId]
          // But better do that for all pages, in one query — rather than 999 queries for 999 pages
        "canonEmbUrl" -> JsStringOrNull(pageMeta.embeddingPageUrl),
        "embeddingUrls" -> JsArray(embUrls.toSeq map JsString),
        "discussionIds" -> JsArray(
          discussionIds.toSeq.map(id => JsString(id drop "diid:".length))))
      json
    }

    OkSafeJson(JsArray(idsUrlsJsonForPages))
  }


  def savePageIdsUrls: Action[JsValue] = StaffPostJsonAction(maxBytes = 2000) { request =>
    import request.{dao, body}
    val pageId = (body \ "pageId").as[PageId]
    val extId = (body \ "extId").asOpt[String].trimNoneIfBlank
    val canonEmbUrl = (body \ "canonEmbUrl").asOpt[String].trimNoneIfBlank
    val discussionIds = (body \ "discussionIds").as[Set[String]]
    val embUrls = (body \ "embeddingUrls").as[Set[String]]

    extId.foreach(id => {
      Validation.findExtIdProblem(id) foreach { problem =>
        throwBadRequest("TyEEXTID0382", problem)
      }
    })

    discussionIds.foreach(id => {
      Validation.findDiscussionIdProblem(id) foreach { problem =>
        throwBadRequest("TyEDIID03962", problem)
      }
    })

    (embUrls ++ canonEmbUrl.toSet) foreach { url =>
      Validation.findUrlProblem(url, allowQuery = true) foreach { problem =>
        throwBadRequest("TyEURL69285", problem)
      }
    }

    val lookupKeys  = embUrls ++ discussionIds.map("diid:" + _)

    val max = Validation.MaxDiscussionIdsAndEmbUrlsPerPage
    throwForbiddenIf(lookupKeys.size > max,
      "TyE304SR5A2", s"More than $max embedding URLs and discussion ids")

    dao.readWriteTransaction { tx =>
      val pageMeta = tx.loadThePageMeta(pageId)
      val anyDupl = lookupKeys.flatMap({ key =>
        tx.loadRealPageId(key) flatMap { maybeDifferentPageId =>
          if (maybeDifferentPageId == pageId) None
          else Some(key, maybeDifferentPageId)
        }
      }).headOption
      anyDupl foreach { case (key, otherPageId) =>
        throwForbidden("TyE305KRSH2", s"Key $key maps to other page id: $otherPageId")
      }
      val oldKeys = tx.listAltPageIds(pageId)
      val deletedKeys = oldKeys -- lookupKeys
      val newKeys = lookupKeys -- oldKeys
      deletedKeys.foreach(k => {
        tx.deleteAltPageId(k)
      })
      newKeys.foreach(k => {
        tx.insertAltPageId(k, pageId)
      })

      if (pageMeta.embeddingPageUrl != canonEmbUrl || pageMeta.extImpId != extId) {
        throwForbiddenIf(pageMeta.extImpId != extId,
          "TyE052KTHW6K6",  // [205AKDNPTM3]
          o"""Changing a page's ext id is not yet supported. Please tell the
            Talkyard developers over at  www.talkyard.io  about why you need
            to do this? Thanks""")

        tx.updatePageMeta(
          pageMeta.copy(
            extImpId = extId,
            embeddingPageUrl = canonEmbUrl),
          oldMeta = pageMeta,
          markSectionPageStale = false)
      }
    }
    Ok
  }


  def pinPage: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val pinWhereInt = (request.body \ "pinWhere").as[Int]
    val pinOrder = (request.body \ "pinOrder").as[Int]

    if (!PageMeta.isOkPinOrder(pinOrder))
      throwBadReq("DwE4KEF82", o"""Bad pin order. Please enter a number
           between ${PageMeta.MinPinOrder} and ${PageMeta.MaxPinOrder}""")

    val pinWhere = PinPageWhere.fromInt(pinWhereInt) getOrElse throwBadArgument(
      "DwE4KE28", "pinWhere")

    request.dao.pinPage(pageId, pinWhere, pinOrder, request.theRequester)
    Ok
  }


  def unpinPage: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.unpinPage(pageId, request.theRequester)
    Ok
  }


  def acceptAnswer: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postUniqueId = (request.body \ "postId").as[PostId]   // id not nr
    val acceptedAt: Option[ju.Date] = request.dao.ifAuthAcceptAnswer(
          pageId, postUniqueId, request.theReqerTrueId, request.theBrowserIdData)
    OkSafeJsValue(JsLongOrNull(acceptedAt.map(_.getTime)))
  }


  def unacceptAnswer: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.ifAuthUnacceptAnswer(pageId, request.theReqerTrueId, request.theBrowserIdData)
    Ok
  }


  def togglePageClosed: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val closedAt: Option[ju.Date] = request.dao.ifAuthTogglePageClosed(
          pageId, request.reqrIds)
    OkSafeJsValue(JsLongOrNull(closedAt.map(_.getTime)))
  }

  def deletePages: Action[JsValue] = PostJsonAction(
          RateLimits.TogglePage, maxBytes = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, request.reqrIds, undelete = false)
    Ok
  }

  def undeletePages: Action[JsValue] = PostJsonAction(
          RateLimits.TogglePage, maxBytes = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, request.reqrIds, undelete = true)
    Ok
  }


  def addUsersToPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.addUsersToPage(userIds, pageId, request.who)
    Ok
  }


  def removeUsersFromPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething,
        maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.removeUsersFromPage(userIds, pageId, request.who)
    Ok
  }


  def joinPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
    joinOrLeavePage(join = true, request)
  }


  def leavePage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
    joinOrLeavePage(join = false, request)
  }


  private def joinOrLeavePage(join: Boolean, request: JsonPostRequest) = {
    import request.{dao, who}
    val pageId = (request.body \ "pageId").as[PageId]
    val anyChangedWatchbar = dao.joinOrLeavePageIfAuth(pageId, join = join, who = who)
    replyWithWatchbar(anyChangedWatchbar, dao)
  }


  private def replyWithWatchbar(watchbar: Option[BareWatchbar], dao: SiteDao) = {
    watchbar match {
      case Some(newWatchbar) =>
        val watchbarWithTitles = dao.fillInWatchbarTitlesEtc(newWatchbar)
        Ok(watchbarWithTitles.toJsonWithTitles)
      case None => Ok
    }
  }


  def configWatchbar: Action[JsValue] = PostJsonAction(RateLimits.ViewPage, maxBytes = 500) {
          request =>
    import request.{dao, theRequesterId}
    val pageId = (request.body \ "removePageIdFromRecent").as[PageId]
    val anyChangedWatchbar = dao.removeFromWatchbarRecent(Set(pageId), request.authzCtxWithReqer)
    replyWithWatchbar(anyChangedWatchbar, dao)
  }

}
