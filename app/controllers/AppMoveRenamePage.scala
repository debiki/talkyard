/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import PageActions._
import ApiActions._
import Prelude._
import Utils.OkHtml
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
object AppMoveRenamePage extends mvc.Controller {


  /**
   * This is the only function in this class that's actually needed
   * (it's used by the Admin SPA). All other functions are invoked manually
   * from a browser's URL, for debugging mostly (should I remove them?).
   *
   * However, ?rename-page via the URL is still useful.
   */
  def movePages = JsonOrFormDataPostAction(maxBytes = 2000) { pageReq =>

    if (!pageReq.user_!.isAdmin) {
      // Could allow non-admins to move pages, but be sure to return
      // 403 Forbidden if attempting to move a page that ... one may not move.
      throwForbidden("DwE84Zi31", "Insufficient permissions to list pages")
    }

    val pageIds: Seq[String] = pageReq.body.listSkipEmpty("pageIds")
    val fromFolder: String = pageReq.body.getOrThrowBadReq("fromFolder")
    val toFolder: String = pageReq.body.getOrThrowBadReq("toFolder")

    pageReq.dao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    Ok
  }


  def renamePage = JsonOrFormDataPostAction(maxBytes = 500) { pageReq =>

    if (!pageReq.user_!.isAdmin) {
      // For now.
      throwForbidden("DwE84Zi31", "Insufficient permissions to list pages")
    }

    val pageId: String = pageReq.body.getOrThrowBadReq("pageId")
    //val newTitle: String = pageReq.body.getOrThrowBadReq("newTitle")
    val newSlug: String = pageReq.body.getOrThrowBadReq("newSlug")

    try {
      pageReq.dao.moveRenamePage(pageId, newSlug = Some(newSlug))
      Ok
    } catch {
      case ex: DbDao.PageNotFoundException =>
        NotFoundResult("DwE390xH3", s"Found no page with id $pageId")
    }
  }


  /**
   * @deprecated
   */
  def showMovePageForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
    _moveRenameGetImpl(pageReq, movePage = true)
  }


  def showRenamePageSlugForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
     _moveRenameGetImpl(pageReq, movePage = false)
  }


  private def _moveRenameGetImpl(pageReq: PageGetRequest, movePage: Boolean)
        : mvc.PlainResult = {

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
        PagePostAction(maxUrlEncFormBytes = 200)(pathIn) {
        pageReq: PagePostRequest =>
    val destFolder = pageReq.getOrThrowBadReq("to-folder")
    _moveRenamePostImpl(pageReq, newFolder = Some(destFolder))
  }


  def handleRenamePageSlugForm(pathIn: PagePath) =
        PagePostAction(maxUrlEncFormBytes = 200)(pathIn) {
    pageReq: PagePostRequest =>
      val newSlug = pageReq.getOrThrowBadReq("new-slug")
      val showId = pageReq.getFirst("show-id") == Some("t")
      _moveRenamePostImpl(pageReq, newSlug = Some(newSlug),
         showId = Some(showId))
  }


  def _moveRenamePostImpl(pageReq: PagePostRequest,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): mvc.PlainResult = {

    if (!pageReq.permsOnPage.moveRenamePage)
      throwForbidden("DwE0kI35", "You may not move or rename this page.")

    if (pageReq.pagePath.showId && showId == Some(false) &&
       !pageReq.permsOnPage.hidePageIdInUrl)
      throwForbidden("DwE50IhZ4", "You may not hide the page id in the URL.")

    // SECURITY Could pass params to Dao via PagePath instead,
    // that'd implicitly validate all inputs. But then first make
    // PagePath validate all inputs (it should, but not yet implemented).
    val newPagePath = pageReq.dao.moveRenamePage(
      pageReq.pageId_!, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

    SeeOther(newPagePath.path)
  }

}


