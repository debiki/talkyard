/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.{mvc => pm}
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import PageActions._
import Prelude._
import Utils._
import Utils.ValidationImplicits._
import DbDao.PathClashException


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

    val pageId = generateNewPageId()
    val passhash = Passhasher.makePasshashQueryParam(pathIn.folder + pageId)

    val pageSlug = folderReq.queryString.getOrThrowBadReq("page-slug")
    val showId = folderReq.queryString.getBoolOrTrue("show-id")

    val newPath = folderReq.pagePath.copy(
      pageId = Some(pageId), showId = showId, pageSlug = pageSlug)

    val viewNewPageUrl = newPath.path +"?view-new-page="+ pageId +"&"+ passhash

    OkSafeJson(JsObject(Seq("viewNewPageUrl" -> JsString(viewNewPageUrl))))
  }


  def viewNewPage(pathIn: PagePath, pageId: String) =
        PageGetAction(pathIn, pageMustExist = false, fixPath = false) {
          pageReqOrig =>

    // Ensure page id generated by server. (And that folder path not changed
    // since call to `getViewNewPageUrl` — not needed but feels better.)
    Passhasher.throwIfBadPasshash(pageReqOrig, pathIn.folder + pageId)

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
        val newPageMeta = newPageMetaFromUrl(pageReqOrig, pageId)
        pageReqOrig.copyWithPreloadedPage(
          PageStuff(newPageMeta, newPagePath, Debate(newPageMeta.pageId)),
          pageExists = false)
      }
    }
    assert(pageReq.pageExists == pageReq.pageMeta.pageExists)

    val pageInfoYaml =
      if (pageReq.user.isEmpty) ""
      else Application.buildPageInfoYaml(pageReq)

    // If not logged in, then include an empty Yaml tag, so the browser
    // notices that it got that elem, and won't call GET ?page-info.
    val infoNode = <pre class='dw-data-yaml'>{pageInfoYaml}</pre>
    val pageHtml = pageReq.dao.renderTemplate(pageReq, appendToBody = infoNode)

    Ok(pageHtml) as HTML
  }


  def generateNewPageId(): String = nextRandomString()


  def newPagePathFromUrl(pageReq: PageRequest[_], pageId: String): PagePath = {
    val pageSlug = pageReq.pagePath.pageSlug
    val showId = pageReq.pagePath.showId
    pageReq.pagePath.copy(pageId = Some(pageId),
      pageSlug = pageSlug, showId = showId)
  }


  def newPageMetaFromUrl(pageReq: PageRequest[_], pageId: String): PageMeta = {
    import pageReq.queryString

    val pageRole = queryString.getEmptyAsNone("page-role").map(
      stringToPageRole _) getOrElse PageRole.Any

    val publishDirectly: Boolean = queryString.getEmptyAsNone("status").map(
      PageStatus.parse _) == Some(PageStatus.Published)

    val parentPageId: Option[String] =
      queryString.getEmptyAsNone("parent-page-id")

    // In case of a Javascript bug.
    if (parentPageId == Some("undefined"))
      throwBadReq("DwE93HF2", "Parent page id is `undefined`")

    PageMeta.forNewPage(pageId, pageReq.ctime, pageRole,
      parentPageId = parentPageId, publishDirectly = publishDirectly)
  }


  /**
   * Hmm, regrettably this breaks should I rename any case object.
   * Perhaps use a match ... case list instead?
   */
  private val _PageRoleLookup = Vector(
    PageRole.Any, PageRole.Homepage, PageRole.BlogMainPage,
    PageRole.BlogArticle, PageRole.ForumMainPage, PageRole.ForumThread,
    PageRole.WikiMainPage, PageRole.WikiPage)
    .map(x => (x, x.toString))


  // COULD replace with PageRole.fromString(): Option[PageRole]
  def stringToPageRole(pageRoleString: String): PageRole =
    _PageRoleLookup.find(_._2 == pageRoleString).map(_._1).getOrElse(
      throwBadReq("DwE930rR3", "Bad page role string: "+ pageRoleString))

}
