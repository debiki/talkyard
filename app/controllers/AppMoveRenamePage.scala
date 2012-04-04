/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import Actions._
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


  def showMovePageForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
    _moveRenameGetImpl(pageReq, movePage = true)
  }


  def showRenamePageForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
     _moveRenameGetImpl(pageReq, movePage = false)
  }


  private def _moveRenameGetImpl(pageReq: PageGetRequest, movePage: Boolean)
        : mvc.PlainResult = {

    if (pageReq.queryString contains "done-path") {
      _showDone(pageReq)
    }
    else if (!pageReq.permsOnPage.moveRenamePage) {
      throwForbidden("DwE35Rk15", "You may not move or rename this page.")
    }
    else if (movePage == true) {
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


  def _showDone(pageReq: PageGetRequest): mvc.PlainResult = {
    val newPath = pageReq.queryString.getOrThrowBadReq("done-path")
    OkHtml(  // i18n
      <html><body>
        <p>Done. {/* Bad! this next line is an xss exploit!:
        Now find the page <a href={newPath}>here</a>.  */}</p>
      </body></html>)
  }


  def handleMovePageForm(pathIn: PagePath) =
        PagePostAction(maxUrlEncFormBytes = 200)(pathIn) {
        pageReq: PagePostRequest =>
    val destFolder = pageReq.getOrThrowBadReq("to-folder")
    _moveRenamePostImpl(pageReq, newFolder = Some(destFolder))
  }


  def handleRenamePageForm(pathIn: PagePath) =
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
    val newPagePath = Debiki.Dao.moveRenamePage(
      pageReq.tenantId, pageReq.pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

    /**{{{ show Done dialog -- no, xss exploit!
    // The page is now located elsewhere, so we'll show the Done dialog
    // at / instead of /old/path/to/page. Add a &done-path query string
    // param, so e.g. GET /?move-page  serves the Done page.
    val donePage =
      "/?"+ pageReq.request.rawQueryString + "&done-path="+ newPagePath.path
    // COULD add function mainFuncName, use like so:
    //   dnePage = pageReq.mainFuncName + "&done-path="...
    // No, this opens for an xss exploit, like so:
    // /?rename-page&done-path=javascript:alert('moo')
    }}}*/

    SeeOther(newPagePath.path)
  }

}


