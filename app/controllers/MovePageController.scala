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

import actions.ApiActions._
import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import play.api.libs.json.Json.toJson
import requests._
import Utils.OkSafeJson
import Utils.ValidationImplicits._


/**
 * Moves and renames pages.
 *
 * /path/to/page?move-page
 *    to-folder=/some/folder/
 *
 * /path/to/page?rename-page
 *    new-slug=
 *    show-id=t/f
 */
object MovePageController extends mvc.Controller {


  /*
  def movePages = JsonOrFormDataPostAction(maxBytes = 2000) { pageReq =>

    if (!pageReq.user_!.isAdmin) {
      // Could allow non-admins to move pages, but be sure to return
      // 403 Forbidden if attempting to move a page that ... one may not move.
      throwForbidden("DwE68Mr2", "Insufficient permissions to move pages")
    }

    val pageIds: Seq[String] = pageReq.body.listSkipEmpty("pageIds")
    val fromFolder: String = pageReq.body.getOrThrowBadReq("fromFolder")
    val toFolder: String = pageReq.body.getOrThrowBadReq("toFolder")

    // Ooops, now broken, after I've added DW1_PAGE_PATHS.CANONICAL.
    // (_movePages in RdbSiteDao throws method-not-supported)
    pageReq.dao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    Ok
  } */


  def moveRenamePage = JsonOrFormDataPostAction(RateLimits.MoveRenamePage, maxBytes = 500) {
        implicit pageReq =>

    if (!pageReq.user_!.isAdmin) {
      // For now.
      throwForbidden("DwE573IZ7", "Insufficient permissions to move page")
    }

    val pageId = pageReq.body.getOrThrowBadReq("pageId")
    val anyNewFolder = pageReq.body.getFirst("newFolder")
    //  newTitle = pageReq.body.getOrThrowBadReq("newTitle")
    val anyNewSlug = pageReq.body.getFirst("newSlug")
    val anyShowId = pageReq.body.getBool("showId")
    val pushExistingPage = pageReq.body.getBoolOrFalse(
      "pushExistingPageToPrevLoc")

    // Could: if (newFolder.isDefined || showId.isDefined ||
    //  newSlug.isDefined || anyShowId.isDefined || newTitle.isDefined) ...

    val anyPushedPagePath = moveRenamePageImpl(
      pageId, anyNewFolder, anyNewSlug = anyNewSlug,
      anyShowId = anyShowId, pushExistingPage = pushExistingPage)

    anyPushedPagePath match {
      case None => Ok
      case Some(pushedPagePath) =>
        // The Admin SPA needs to know that [a page other than the one we
        // wanted to move] has been moved.
        OkSafeJson(toJson(Map(
          "pagePushedToPrevLoc" -> ListController.jsonForPath(pushedPagePath))))
    }
  }


  def moveRenamePageImpl(pageId: String, anyNewFolder: Option[String],
        anyNewSlug: Option[String], anyShowId: Option[Boolean],
        pushExistingPage: Boolean)(implicit request: DebikiRequest[_])
        : Option[PagePath] = {
    try {
      request.dao.moveRenamePage(
        pageId, newFolder = anyNewFolder, newSlug = anyNewSlug, showId = anyShowId)
      None
    } catch {
      case ex: DbDao.PageNotFoundException =>
        throwNotFound("DwE390xH3", s"Found no page with id $pageId")
      case DbDao.PathClashException(existingPagePath, newPagePath) =>
        if (pushExistingPage) {
          // Move the page that's located at /anyNewFolder/anyNewSlug,
          // and try again (but only once).
          val anyNewLoc =
            request.dao.movePageToItsPreviousLocation(existingPagePath)
          if (anyNewLoc.isDefined) {
            moveRenamePageImpl(pageId, anyNewFolder, anyNewSlug = anyNewSlug,
              anyShowId = anyShowId, pushExistingPage = false)
            return anyNewLoc
          }
          // else: The page at `existingPagePath` hasn't been located anywhere
          // else, so it wasn't possible to push it away to any other location.
        }
        throwForbidden(
          "DwE7IK96", s"Cannot move page to ${existingPagePath.value}. " +
          "There is already another page at that location, " +
          "and I don't know to where I could move it instead " +
          "— you need to move it first yourself, please.")
    }
  }


  /**
   * @deprecated
   */
  def showMovePageForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
    _moveRenameGetImpl(pageReq, movePage = true)
  }


  /**
   * Only invoked via the browser address bar, as of now: `?rename-page`
   */
  def showRenamePageSlugForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
     _moveRenameGetImpl(pageReq, movePage = false)
  }


  private def _moveRenameGetImpl(pageReq: PageGetRequest, movePage: Boolean): mvc.Result = {

    if (!pageReq.permsOnPage.moveRenamePage)
      throwForbidden("DwE35Rk15", "You may not move or rename this page.")

    if (movePage == true) {
      val newFolder: String =
        pageReq.queryString.getEmptyAsNone("to-folder").getOrElse("/")

      Ok(views.html.moveRenamePage(pageReq.xsrfToken.value,
        moveToFolder = Some(newFolder)))
    }
    else { // rename page

      // If you are allowed to move/rename the page,
      // you may make the page ID visible in the URL.
      // Special permissions are required, however, to hide that id,
      // because hiding it might destroy automatic redirection (page path
      // lookup via page id).
      val changeShowId =
        if (!pageReq.pagePath.showId) {
          // Page ID in URL is already hidden. Since the user already may
          // rename the page, allow her to show the id.
          // (None means deny, `false' is default form input value.)
          Some(false)
        }
        else if (pageReq.permsOnPage.hidePageIdInUrl) {
          Some(true) // `true' is default form input value
        }
        else {
          // Don't allow the user to hide the page ID in the url.
          None
        }

      val newSlug = Some(pageReq.pagePath.pageSlug)

      Ok(views.html.moveRenamePage(pageReq.xsrfToken.value,
        newSlug = newSlug, changeShowId = changeShowId))
    }
  }


  /**
   * @deprecated
   */
  def handleMovePageForm(pathIn: PagePath) =
        PagePostAction(RateLimits.MoveRenamePage, maxUrlEncFormBytes = 200)(pathIn) {
        pageReq: PagePostRequest =>
    val destFolder = pageReq.getOrThrowBadReq("to-folder")
    _moveRenamePostImpl(pageReq, newFolder = Some(destFolder))
  }


  def handleRenamePageSlugForm(pathIn: PagePath) =
        PagePostAction(RateLimits.MoveRenamePage, maxUrlEncFormBytes = 200)(pathIn) {
    pageReq: PagePostRequest =>
      val newSlug = pageReq.getOrThrowBadReq("new-slug")
      val showId = pageReq.getFirst("show-id") == Some("t")
      _moveRenamePostImpl(pageReq, newSlug = Some(newSlug),
         showId = Some(showId))
  }


  def _moveRenamePostImpl(pageReq: PagePostRequest,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): mvc.Result = {

    if (!pageReq.permsOnPage.moveRenamePage)
      throwForbidden("DwE0kI35", "You may not move or rename this page.")

    if (pageReq.pagePath.showId && showId == Some(false) &&
       !pageReq.permsOnPage.hidePageIdInUrl)
      throwForbidden("DwE50IhZ4", "You may not hide the page id in the URL.")

    // SECURITY Could pass params to Dao via PagePath instead,
    // that'd implicitly validate all inputs. But then first make
    // PagePath validate all inputs (it should, but not yet implemented).
    val newPagePath = pageReq.dao.moveRenamePage(
      pageReq.thePageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

    SeeOther(newPagePath.value)
  }

}


