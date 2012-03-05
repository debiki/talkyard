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

object AppCreatePage extends mvc.Controller {


  def showForm(pathIn: PagePath) = PageGetAction(pathIn) {
        pageReq: PageGetRequest =>
    _throwIfMayNotCreate(pathIn, pageReq)
    Ok(views.html.createPageForm(
      userName = pageReq.displayName_!,
      xsrfToken = pageReq.xsrfToken.value))
  }


  def handleForm(pathIn: PagePath) = PagePostAction(MaxCommentSize)(pathIn) {
        pageReq: PagePostRequest =>
    import pageReq.{pagePath}
    _throwIfMayNotCreate(pathIn, pageReq)

    val (pageMarkup: Markup, pageText: String) =
      if (pagePath.isCodePage) (Markup.Code, "")
      else (Markup.DefaultForPageBody, DefaultPageText)

    val rootPost = Post(id = Page.BodyId,
      parent = Page.BodyId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, newIp = pageReq.newIp,
      text = pageText, markup = pageMarkup.id,
      tyype = PostType.Text, where = None)

    val debateNoId = Debate(guid = "?", posts = rootPost::Nil)
    val newPage: Debate =
      Debiki.Dao.createPage(where = pagePath, debate = debateNoId) match {
        case Full(page) => page
        case x => throwInternalError("DwE039k3", "Could not create page," +
          " error:\n"+ x)
      }

    Redirect(pagePath.folder + newPage.guidd)
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
        pageReq.page_?.isDefined)
      assErr("DwE87Pr2", "Page already exists")
  }


  val DefaultPageText: String =
    """|Title
       |============
       |
       |Subtitle
       |-------------
       |
       |To edit this page, click this text, then select Edit in the
       |menu that appears.
       |
       |[Example link, to nowhere](http://example.com/does/not/exist)
       |
       |""".stripMargin

}
