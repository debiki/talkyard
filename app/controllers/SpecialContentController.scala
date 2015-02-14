/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions._
import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import debiki._
import debiki.dao.SiteDao
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json.{Json, JsString}
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import requests._
import scala.collection.{mutable => mut}
import Utils.{OkSafeJson, OkHtml, parseIntOrThrowBadReq}
import Utils.ValidationImplicits._



/** Edits special content pages, e.g. a page with a content-license text that
  * is automatically included on the terms-of-use page.
  */
object SpecialContentController extends mvc.Controller {


  /** If the special content has not yet been edited, returns a default text (depending
    * on the page id). For example, if the forum owner hasn't edited the content license
    * special-content text, then a default content license is returned if you request
    * the contentId = "_tou_content_license" special content.
    */
  def loadContent(rootPageId: PageId, contentId: PageId) = GetAction { request: GetRequest =>
    if (!request.theUser.isAdmin)
      throwForbidden("DwE55RK0", "Please login as admin")

    val pageId = s"$rootPageId$contentId"
    val anyContent = loadContentPage(request.dao, pageId)
    val defaultContent = SpecialContentPages.lookup(contentId) getOrElse throwBadReq(
      "DwE77GHE0", s"Bad content id: `$contentId'")

    var json = Json.obj(
      "rootPageId" -> rootPageId,
      "contentId" -> contentId,
      "defaultText" -> defaultContent.text)

    anyContent foreach { content =>
      if (content.text == SpecialContentPages.UseDefaultContentMark) {
        // Let the browser fallback to the default text.
      }
      else {
        json += "anyCustomText" -> JsString(content.text)
      }
    }

    OkSafeJson(json)
  }


  /**
    * Expected JOSN format, illustrated in Yaml:
    *   rootPageId
    *   contentId
    *   useDefaultText: Boolean
    *   anyCustomText
    */
  def saveContent = AdminPostJsonAction(maxLength = MaxPostSize) { request: JsonPostRequest =>
    val rootPageId = (request.body \ "rootPageId").as[PageId]
    val contentId = (request.body \ "contentId").as[PageId]
    val pageId = s"$rootPageId$contentId"
    val useDefaultText = (request.body \ "useDefaultText").as[Boolean]
    val anyNewText = (request.body \ "anyCustomText").asOpt[String]

    if (anyNewText.isDefined && useDefaultText)
      throwBadReq("DwE5FSW0", "Both anyNewText and useDefaultText specified")

    val newText = anyNewText getOrElse {
      if (useDefaultText) SpecialContentPages.UseDefaultContentMark
      else throwBadReq("DwE2GY05", "No new text specified")
    }

    // Verify that root page id exists and is a section.
    if (rootPageId.nonEmpty) {
      def theRootPage = s"Root page `$rootPageId', site `${request.dao.siteId}',"
      val meta = request.dao.loadPageMeta(rootPageId) getOrElse
        throwForbidden("Dw0FfR1", s"$theRootPage does not exist")
      if (!meta.pageRole.isSection)
        throwForbidden("Dw7GBR8", s"$theRootPage is not a section")
    }

    // Check that the content id is valid.
    if (SpecialContentPages.lookup(contentId).isEmpty)
      throwBadReq("DwE44RF8", s"Bad special content page id: `$contentId'")

    // BUG: Race conditon, but it's mostly harmless, admins will be active only one at a time?

    val anyOldContent = loadContentPage(request.dao, pageId)
    if (anyOldContent.isEmpty) {
      createEmptyPage(request, rootPageId, contentId = contentId)
    }

    updatePage(request, pageId, newText)
    Ok
  }


  private def createEmptyPage(request: DebikiRequest[_], rootPageId: PageId, contentId: PageId) {
    val defaultContent = SpecialContentPages.lookup(contentId) getOrDie "Dw53Rf1"
    val emptyBody = RawPostAction(
        id = PageParts.BodyId,
        postId = PageParts.BodyId,
        userIdData = SystemUser.UserIdData,
        creationDati = request.ctime,
        payload = PostActionPayload.CreatePost(
          parentPostId = None,
          text = "",
          approval = Some(Approval.AuthoritativeUser)))

    val pageId = s"$rootPageId$contentId"
    val pageParts = PageParts(pageId, people = SystemUser.Person, rawActions = emptyBody::Nil)

    val newPage = Page(
      PageMeta.forNewPage(
        PageRole.SpecialContent, SystemUser.User, pageParts, request.ctime,
        parentPageId = None, publishDirectly = true),
      PagePath(
        tenantId = request.siteId, folder = "/",
        pageId = Some(pageId), showId = true, pageSlug = ""),
      ancestorIdsParentFirst = Nil,
      pageParts)

    request.dao.createPage(newPage)
  }


  private def updatePage(request: DebikiRequest[_], pageId: PageId, newText: String) {
    val page: PageParts = request.dao.loadPageParts(pageId) getOrDie "DwE52FY6"
    val body: Post = page.body getOrDie "DwE10fF8"

    if (newText == body.currentText)
      return

    val patchText = makePatch(from = body.currentText, to = newText)

    var edit = RawPostAction.toEditPost(
      id = PageParts.UnassignedId,
      postId = body.id,
      ctime = request.ctime,
      userIdData = request.userIdData,
      text = patchText,
      approval = Some(Approval.AuthoritativeUser),
      autoApplied = true)

    var actions = edit::Nil
    request.dao.savePageActionsGenNotfs(pageId, actions, request.meAsPeople_!)
  }


  private def loadContentPage(dao: SiteDao, pageId: PageId): Option[SpecialContentPages.Content] = {
    val anyPageParts = dao.loadPageParts(pageId)
    val anyContent = anyPageParts flatMap { pageParts =>
      pageParts.body map { body =>
        // (It's okay to use `currentText` here, rather than `approvedText`
        // — special content pages are edited by admins, and always auto approved.)
        SpecialContentPages.Content(text = body.currentText)
      }
    }
    anyContent
  }

}

