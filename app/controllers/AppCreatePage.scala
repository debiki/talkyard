/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc.{Action => _}
import Actions._
import Prelude._
import Utils.ValidationImplicits._


object AppCreatePage extends mvc.Controller {


  def showForm(pathIn: PagePath) =
        PageGetAction(pathIn, pageMustExist = false) {
          pageReq: PageGetRequest =>

    _throwIfMayNotCreate(pathIn, pageReq)

    val changeShowId =
      // If the user may not hide the page id:
      if (!pageReq.permsOnPage.hidePageIdInUrl) None
      // If the user has specified a slug but no id, default to no id:
      else if (pathIn.pageSlug.nonEmpty) Some(false)
      // If the url path is a folder/index page:
      else Some(true)

    Ok(views.html.createPageForm(
      userName = pageReq.displayName_!,
      xsrfToken = pageReq.xsrfToken.value,
      changeShowId = changeShowId))
  }


  def handleForm(pathIn: PagePath) =
        PagePostAction(MaxCommentSize)(pathIn, pageMustExist = false) {
          pageReq: PagePostRequest =>
    _throwIfMayNotCreate(pathIn, pageReq)

    val pageTitle = pageReq.body.getOrThrowBadReq("page-title")
    val pageSlug = pageReq.body.getOrThrowBadReq("page-slug")
    val showId = pageReq.body.getFirst("show-id") == Some("t")

    val newPagePath = pageReq.pagePath.copy(
      pageSlug = pageSlug, showId = showId)

    val (pageMarkup: Markup, pageText: String) =
      if (newPagePath.isCodePage) (Markup.Code, "")
      else (Markup.DefaultForPageBody, DefaultPageText)

    val rootPost = Post(id = Page.BodyId,
      parent = Page.BodyId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp,
      text = pageText, markup = pageMarkup.id,
      tyype = PostType.Text, where = None)

    // (A page title and template (and body) is its own parent.
    // Dupl knowledge! see AppEdit._getOrCreatePostToEdit.)
    val titlePost = rootPost.copy(id = Page.TitleId,
      parent = Page.TitleId, text = pageTitle,
      markup = Markup.DefaultForPageTitle.id)

    val debateNoId = Debate(guid = "?", posts = rootPost::titlePost::Nil)
    val newPage: Debate =
      Debiki.Dao.createPage(where = newPagePath, debate = debateNoId) match {
        case Full(page) => page
        case x => throwInternalError("DwE039k3", "Could not create page," +
          " error:\n"+ x)
      }

    Redirect(newPagePath.path)
  }


  /**
   * Throws something, if the page may not be created.
   */
  private def _throwIfMayNotCreate(pathIn: PagePath, pageReq: PageRequest[_]) {
    if (pathIn.pageId.isDefined)
      throwBadReq("DwE40Ju3", "Page ID specified. Do not start"+
         " the page name with '-' because that means the page ID follows.")

    // hmm. If page exists, guid non-empty and page_? defined
    // Not this, but something like??:
    // assert(pageReq.page_?.isDefined == pageReq.pagePath.isFolderPath ...

    if (!pageReq.permsOnPage.createPage)
      throwForbidden("DwE01rsk351", "You may not create that page")

    // Specifying a page slug in the URL, when calling ?create-page,
    // means that a page with that slug, and no visible id, should be
    // created. If however such a page already exists, the access
    // controller shouldn't have granted createPage permissions (see above).
    if (!pageReq.pagePath.isFolderPath && // then page slug was specified
        pageReq.pageExists)
      throwForbidden("DwE87Pr2", "Page already exists")
  }


  val DefaultPageText: String =
    """|**To edit this page:**
       |
       |  - Click this text, anywhere.
       |  - Then select *Improve* in the menu that appears.
       |
       |## Example Subtitle
       |
       |### Example Sub Subtitle
       |
       |[Example link, to nowhere](http://example.com/does/not/exist)
       |
       |""".stripMargin

}
