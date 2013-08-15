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

import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.{mvc => pm}
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import Utils._
import Utils.ValidationImplicits._
import DbDao.PathClashException


/** Creates pages, or rather: sends to the browser data for a new unsaved page.
  * But this page is not saved until later on, by AppEdit, when/if the user edits
  * it and saves it.
  */
object AppCreatePage extends mvc.Controller {


    /*
    val changeShowId =
      // If the user may not hide the page id:
      if (!pageReq.permsOnPage.hidePageIdInUrl) None
      // If the user has specified a slug but no id, default to no id:
      else if (pathIn.pageSlug.nonEmpty) Some(false)
      // If the url path is a folder/index page:
      else Some(true)
    */

  def getViewNewPageUrl(pathIn: PagePath) =
        FolderGetAction(pathIn) { folderReq =>

    val anyParentPageId = folderReq.queryString.getFirst("parentPageId")
    val pageRoleStr = folderReq.queryString.getOrThrowBadReq("pageRole")
    val pageRole = PageRole.parse(pageRoleStr)
    val statusStr = folderReq.queryString.getOrThrowBadReq("status")
    val status = PageStatus.parse(statusStr)

    val approval: Approval = AutoApprover.perhapsApproveNewPage(
      folderReq, pageRole, anyParentPageId) getOrElse
        throwForbidden("DwE53KVE0", "Page creation request rejected")

    val pageId = generateNewPageId()

    val pageSlug = folderReq.queryString.getOrThrowBadReq("pageSlug")
    val showId = folderReq.queryString.getBoolOrTrue("showId")

    val passhash = makePagePasshash(
      approval, pageRole, status, folder = pathIn.folder, slug = pageSlug,
      showId = showId, pageId = pageId, parentPageId = anyParentPageId)

    val newPath = folderReq.pagePath.copy(
      pageId = Some(pageId), showId = showId, pageSlug = pageSlug)

    val viewNewPageUrl =
      s"${newPath.path}?view-new-page=$pageId" +
      s"&passhash=$passhash" +
      s"&newPageApproval=${approval}" +
      s"&pageRole=$pageRole" +
      s"&parentPageId=${anyParentPageId getOrElse ""}" +
      s"&status=$statusStr"

    OkSafeJson(JsObject(Seq("viewNewPageUrl" -> JsString(viewNewPageUrl))))
  }


  def viewNewPage(pathIn: PagePath, pageId: String) =
        PageGetAction(pathIn, pageMustExist = false, fixPath = false) {
          pageReqOrig =>

    val approval = Approval.parse(
      pageReqOrig.queryString.getOrThrowBadReq("newPageApproval"))

    val newPageMeta = newPageMetaFromUrl(pageReqOrig, pageId)

    // Ensure page creation data was generated or approved by the server.
    val passhashGiven = pageReqOrig.queryString.getOrThrowBadReq("passhash")
    val correctPasshash = makePagePasshash(
      approval, newPageMeta.pageRole, newPageMeta.status, folder = pathIn.folder,
      slug = pathIn.pageSlug, showId = pathIn.showId, pageId = pageId,
      parentPageId = newPageMeta.parentPageId)
    if (passhashGiven != correctPasshash)
      throwForbidden("DwE7Gp0W2", "Bad passhash")

    // Create a PageRequest for the new page (and be sure to use `pageId`
    // so people cannot /specify/any/-pageId).
    val pageReq = {
      val newPagePath = newPagePathFromUrl(pageReqOrig, pageId)
      val request =
        try { PageRequest(pageReqOrig, newPagePath) }
        catch {
          case ex: PathClashException =>
            val duplicateIdInfo =
              if (ex.existingPagePath.pageId.isEmpty) ""
              else ", with id " + ex.existingPagePath.pageId.get
            throwForbidden(
              "DwE17Sf3", s"Cannot create new page at ${newPagePath.path}," +
              s" with id `$pageId`: There is already another page at that" +
              " location" + duplicateIdInfo)
        }

      if (request.pageExists) {
        // The page we're supposed to create has already been created,
        // so we don't need to create any empty dummy page to show before
        // the page has actually been created. (The URL to this new
        // page is probably being reloaded, after the page was saved.)
        request
      }
      else {
        // Create empty dummy page.
        val ancestorIdsParentFirst: List[PageId] =
          newPageMeta.parentPageId map { parentId =>
            val parentsAncestors = pageReqOrig.dao.loadAncestorIdsParentFirst(parentId)
            parentId :: parentsAncestors
          } getOrElse Nil
        pageReqOrig.copyWithPreloadedPage(
          Page(newPageMeta, newPagePath, ancestorIdsParentFirst, PageParts(newPageMeta.pageId)),
          pageExists = false)
      }
    }
    assert(pageReq.pageExists == pageReq.pageMeta_!.pageExists)

    val userPageDataJson =
      if (pageReq.user.isEmpty) ""
      else AppViewPosts.buildUserPageDataJson(pageReq)

    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-user-page-data'>{userPageDataJson}</pre>
    val pageHtml = pageReq.dao.renderTemplate(pageReq, appendToBody = infoNode)

    Ok(pageHtml) as HTML
  }


  def generateNewPageId(): String = nextRandomPageId()


  private def newPagePathFromUrl(pageReq: PageRequest[_], pageId: String): PagePath = {
    val pageSlug = pageReq.pagePath.pageSlug
    val showId = pageReq.pagePath.showId
    pageReq.pagePath.copy(pageId = Some(pageId),
      pageSlug = pageSlug, showId = showId)
  }


  private def newPageMetaFromUrl(pageReq: PageRequest[_], pageId: String): PageMeta = {
    import pageReq.queryString

    val pageRole = queryString.getEmptyAsNone("pageRole").map(
      PageRole.parse _) getOrElse PageRole.Generic

    assErrIf((pageReq.pagePath.isConfigPage || pageReq.pagePath.isScriptOrStyle) &&
      pageRole != PageRole.Code, "DwE6HEr4")

    val publishDirectly: Boolean = queryString.getEmptyAsNone("status").map(
      PageStatus.parse _) == Some(PageStatus.Published)

    val parentPageId: Option[String] =
      queryString.getEmptyAsNone("parentPageId")

    // In case of a Javascript bug.
    if (parentPageId == Some("undefined"))
      throwBadReq("DwE93HF2", "Parent page id is `undefined`")

    PageMeta.forNewPage(pageRole, pageReq.user_!, PageParts(pageId), pageReq.ctime,
      parentPageId = parentPageId, publishDirectly = publishDirectly)
  }


  def makePagePasshash(
        approval: Approval,
        pageRole: PageRole,
        status: PageStatus,
        folder: String,
        slug: String,
        showId: Boolean,
        pageId: String,
        parentPageId: Option[String]) =
    Passhasher.makePasshash(
      s"$approval|$pageRole|$status|$folder|$slug|$showId|$pageId|$parentPageId")

}
