/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import play.api.libs.json.Json.toJson
import PageActions._
import Prelude._
import Utils._
import Utils.ValidationImplicits._


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


  def viewNewUnsavedPage(pathIn: PagePath) =
        PageGetAction(pathIn, pageMustExist = false) { pageReqOrig =>

    val (newPageMeta, newPagePath) =
      newPageDataFromUrl(pageReqOrig, pageIdOpt = None)

    val dummyActions = Debate(newPageMeta.pageId)

    val pageReq = pageReqOrig.copyWithPreloadedPage(
      PageStuff(newPageMeta, newPagePath, dummyActions),
      pageExists = false)

    val pageInfoYaml =
      if (pageReq.user.isEmpty) ""
      else Application.buildPageInfoYaml(pageReq)

    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-data-yaml'>{pageInfoYaml}</pre>

    // When rendering the page, bypass the page cache, since the page doesn't
    // exist, and thus has no id and cannot be cached (as of now).
    val pageHtml = Debiki.renderPage(pageReq, appendToBody = infoNode,
      skipCache = true)

    Ok(pageHtml) as HTML
  }


  def newPageDataFromUrl(pageReq: PageRequest[_], pageIdOpt: Option[String])
        : (PageMeta, PagePath) = {
    import pageReq.queryString

    val pageSlug =
      queryString.getEmptyAsNone("page-slug") getOrElse "unnamed-page"

    val pageRole = queryString.getEmptyAsNone("page-role").map(
      stringToPageRole _) getOrElse PageRole.Any

    val pageId = pageIdOpt getOrElse nextRandomString

    val parentPageId: Option[String] =
      queryString.getEmptyAsNone("parent-page-id")

    val meta = PageMeta(pageId = pageId, pageRole = pageRole,
        parentPageId = parentPageId)

    val hideId = queryString.getFirst("hide-id") nonEmpty

    val path = pageReq.pagePath.copy(pageId = Some(pageId),
      pageSlug = pageSlug, showId = !hideId)

    (meta, path)
  }


  def dummyTitle(request: PageRequest[_]) = Post(
    id = Page.TitleId, parent = Page.TitleId, ctime = request.ctime,
    loginId = request.loginId_!, newIp = None, text = DummyTitleText,
    markup = Markup.DefaultForPageTitle.id,
    approval = Some(Approval.Preliminary),
    tyype = PostType.Text)


  def dummyBody(request: PageRequest[_]) = dummyTitle(request).copy(
    id = Page.BodyId, parent = Page.BodyId, text = DummyPageText,
    markup = Markup.DefaultForPageBody.id)


  /**
   * Hmm, regrettably this breaks should I rename any case object.
   * Perhaps use a match ... case list instead?
   */
  private val _PageRoleLookup = Vector(
    PageRole.Any, PageRole.Homepage, PageRole.BlogMainPage,
    PageRole.BlogArticle, PageRole.ForumMainPage, PageRole.ForumThread,
    PageRole.WikiMainPage, PageRole.WikiPage)
    .map(x => (x, x.toString))


  def stringToPageRole(pageRoleString: String): PageRole =
    _PageRoleLookup.find(_._2 == pageRoleString).map(_._1).getOrElse(
      throwBadReq("DwE930rR3", "Bad page role string: "+ pageRoleString))


  private def _pageRoleToString(pageRole: PageRole): String = pageRole.toString


  val DummyTitleText =
    "New Page (click to edit)"

  val DummyPageText: String =
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
