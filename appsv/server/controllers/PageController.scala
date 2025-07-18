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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.CreatePageResult
import debiki.EdHttp._
import debiki.JsonUtils._
import debiki.dao.SiteDao
import talkyard.server.{TyContext, TyController}
import talkyard.server.authn.MinAuthnStrength
import talkyard.server.authz.Authz
import talkyard.server.http._
import talkyard.server.parser
import talkyard.server.JsX.JsTagTypeArray
import java.{util => ju}
import javax.inject.Inject
import play.api.libs.json.{JsObject, JsArray, JsString, JsNumber, JsValue, Json}
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX.JsLongOrNull


/** Creates pages, toggles is-done, deletes them.
  */
class PageController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.security.throwNoUnless


  def createPage: Action[JsValue] = PostJsonAction(
        RateLimits.CreateTopic, MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 20 * 1000, canUseAlias = true) {
        request =>
    import request.{dao, theRequester => requester}
    // Similar to Do API with CreatePageParams. [create_page]

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
    val asAlias: Opt[WhichAliasPat] =
            SiteDao.checkAliasOrThrowForbidden(body, requester, request.anyAliasPat,
                mayReuseAnon = false)(dao)

    val postRenderSettings = dao.makePostRenderSettings(pageRole)
    val bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(bodyText,
      embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
      allowClassIdDataAttrs = true, relFollowTo = postRenderSettings.relFollowTo)

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

    val res: CreatePageResult = dao.createPageIfAuZ(
          pageRole,
          pageStatus,
          inCatId = anyCategoryId,
          withTags = Nil, // later
          anyFolder = anyFolder,
          anySlug = anySlug,
          title = titleSourceAndHtml,
          bodyTextAndHtml = bodyTextAndHtml,
          showId = showId,
          deleteDraftNr = deleteDraftNr,
          reqrAndCreator = request.reqrTargetSelf, // [alias_4_principal]
          spamRelReqStuff = request.spamRelatedStuff,
          asAlias = asAlias,
          discussionIds = Set.empty,
          embeddingUrl = None,
          refId = None)

    OkSafeJson(Json.obj("newPageId" -> res.path.pageId))
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

    OkSafeJsonArr(JsArray(idsUrlsJsonForPages))
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


  MOVE // to UserController maybe?
  def changePatNodeRels: Action[JsValue] = PostJsonAction(
          RateLimits.JoinSomething,
          MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
          maxBytes = 200) { req =>
    import req.dao
    val bodyJo: JsObject = asJsObject(req.body, "the request body")
    val addPatIds = parseOptInt32Array(bodyJo, "addPatIds").getOrElse(Nil).toSet
    val removePatIds = parseOptInt32Array(bodyJo, "removePatIds").getOrElse(Nil).toSet
    val postId = parseInt32(bodyJo, "postId")
    val relType = parsePatPostRelType(bodyJo, "relType")
    val storePatch = dao.addRemovePatNodeRelsIfAuZ(
          addPatIds = addPatIds, removePatIds = removePatIds,
          postId = postId, relType = relType,
          generateMetaComt = true, notifyPats = true,
          req.who, IfBadAbortReq)
    OkSafeJson(storePatch)
  }

  /* Later?:  For now, part of  DraftsController.listDrafts
  def listPatNodeRels: Action[JsValue] = ...
  */


  def acceptAnswer: Action[JsValue] = PostJsonAction(
        RateLimits.TogglePage,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100,
        canUseAlias = true) { request =>
    import request.{dao, reqr}
    val body = asJsObject(request.body, "acceptAnswer request body")
    val pageId = parseSt(body, "pageId")
    val postId = parseInt32(body, "postId")   // id not nr
    val asAlias: Opt[WhichAliasPat] =
          SiteDao.checkAliasOrThrowForbidden(body, reqr, request.anyAliasPat,
                mayCreateAnon = false)(dao)

    val acceptedAt: Option[ju.Date] = request.dao.ifAuthAcceptAnswer(
          pageId, postId, request.theReqrTargetSelf, // [alias_4_principal]
          request.theBrowserIdData, asAlias)
    OkSafeJsValue(JsLongOrNull(acceptedAt.map(_.getTime)))
  }


  def unacceptAnswer: Action[JsValue] = PostJsonAction(
        RateLimits.TogglePage,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100, canUseAlias = true) { request =>
    import request.{dao, reqr}
    val body = asJsObject(request.body, "unacceptAnswer request body")
    val pageId = parseSt(body, "pageId")
    val asAlias: Opt[WhichAliasPat] =
          SiteDao.checkAliasOrThrowForbidden(body, reqr, request.anyAliasPat,
              mayCreateAnon = false)(dao)

    dao.ifAuthUnacceptAnswer(
            pageId, request.theReqrTargetSelf, // [alias_4_principal]
            request.theBrowserIdData, asAlias)
    Ok
  }


  def togglePageClosed: Action[JsValue] = PostJsonAction(
          RateLimits.TogglePage,
          MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
          maxBytes = 100,
          canUseAlias = true) { request =>
    import request.{dao, reqr}
    val body = asJsObject(request.body, "Page-closed request body")
    val pageId = parseSt(body, "pageId")
    val asAlias: Opt[WhichAliasPat] =
          SiteDao.checkAliasOrThrowForbidden(body, reqr, request.anyAliasPat,
              mayCreateAnon = false)(dao)

    val closedAt: Opt[ju.Date] =
          dao.ifAuthTogglePageClosed(pageId, request.reqrIds, asAlias) // [alias_4_principal]

    OkSafeJsValue(JsLongOrNull(closedAt.map(_.getTime)))
  }


  def deletePages: Action[JsValue] = PostJsonAction(
          RateLimits.TogglePage,
          MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
          maxBytes = 1000, canUseAlias = true) { req =>
    import req.dao
    val body = asJsObject(req.body, "Delete pages request body")
    val pageIds = (body \ "pageIds").as[Seq[PageId]]
    val asAlias = SiteDao.checkAliasOrThrowForbidden(
          body, req.reqr, req.anyAliasPat, mayCreateAnon = false)(dao)
    dao.deletePagesIfAuth(pageIds, req.reqrIds, asAlias, undelete = false)
    Ok
  }


  def undeletePages: Action[JsValue] = PostJsonAction(
          RateLimits.TogglePage,
          MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
          maxBytes = 1000, canUseAlias = true) { req =>
    import req.dao
    val body = asJsObject(req.body, "Undelete pages request body")
    val pageIds = (body \ "pageIds").as[Seq[PageId]]
    val asAlias = SiteDao.checkAliasOrThrowForbidden(
          body, req.reqr, req.anyAliasPat, mayCreateAnon = false)(dao)
    dao.deletePagesIfAuth(pageIds, req.reqrIds, asAlias, undelete = true)
    Ok
  }


  def addUsersToPage: Action[JsValue] = PostJsonAction(
        RateLimits.JoinSomething,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    // Later, also:  SiteDao.checkAliasOrThrowForbidden ?  [anon_priv_msgs]
    request.dao.addUsersToPageIfAuZ(userIds, pageId, request.who)
    val respJson = _makePageMembersResponse(pageId, request.theUser, request.dao)
    OkSafeJson(respJson)
  }


  def removeUsersFromPage: Action[JsValue] = PostJsonAction(
        RateLimits.JoinSomething,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    // Later, also: SiteDao.checkAliasOrThrowForbidden ?  [anon_priv_msgs]
    request.dao.removeUsersFromPageIfAuZ(userIds, pageId, request.who)
    val respJson = _makePageMembersResponse(pageId, request.theUser, request.dao)
    OkSafeJson(respJson)
  }


  /** Note: The caller should have verified that `reqr` may see `pageId`.
    */
  private def _makePageMembersResponse(pageId: PageId, reqr: Pat, dao: SiteDao): JsObject = {

    val membIds: Set[PatId] = dao.readTx { tx =>
      // Double check if reqr may see page.  Already checked here: [reqr_see_join_page].
      // (A race: If an admin revokes reqr's access to pageId, this might fail,
      // although the changes to the page have alraedy been made. — The fix would be
      // to remove this double check, which runs in its own tx.)
      val pageMeta = tx.loadThePageMeta(pageId)
      dao.throwIfMayNotSeePage(pageMeta, Some(reqr))(tx)

      tx.loadMessageMembers(pageId)
    }

    // Bit dupl code. [pats_by_id_json]
    val patsById: Map[PatId, Pat] = dao.getParticipantsAsMap(membIds)

    // Currently, [badges_not_shown_in_user_lists], so, None.
    val tagsAndBadges: TagsAndBadges = TagsAndBadges.None
    val tagTypes = dao.getTagTypes(tagsAndBadges.tagTypeIds)

    val patsJsArr = JsArray(patsById.values.toSeq map { pat =>
      talkyard.server.JsX.JsPat(pat, tagsAndBadges)
    })

    val membIdsArr: JsArray = JsArray(membIds.toSeq.map(id => JsNumber(id)))

    Json.obj(  // Typescript: PageMembersStorePatch
        "storePatch" -> Json.obj(
            "patsBrief" -> patsJsArr,
            "tagTypes" -> JsTagTypeArray(tagTypes, inclRefId = reqr.isStaff),
            "pageMemberIdsByPageId" ->
                Json.obj(pageId -> membIdsArr)))
  }


  def joinPage: Action[JsValue] = PostJsonAction(
        RateLimits.JoinSomething,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100) { request =>
    joinOrLeavePage(join = true, request)
  }


  def leavePage: Action[JsValue] = PostJsonAction(
        RateLimits.JoinSomething,
        MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
        maxBytes = 100) {
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


  def configWatchbar: Action[JsValue] = PostJsonAction(
          RateLimits.ViewPage,
          MinAuthnStrength.EmbeddingStorageSid12, // [if_emb_forum]
          maxBytes = 500) {
          request =>
    import request.{dao, theRequesterId}
    val pageId = (request.body \ "removePageIdFromRecent").as[PageId]
    val anyChangedWatchbar = dao.removeFromWatchbarRecent(Set(pageId), request.authzCtxWithReqer)
    replyWithWatchbar(anyChangedWatchbar, dao)
  }

}
