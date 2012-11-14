/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest
import play.{api => p}
import Prelude._
import scala.Some
import controllers.PageRequest


object InternalTemplateProgrammingInterface {

  def apply(dao: TenantDao) = new InternalTemplateProgrammingInterface(dao)

}


object TinyTemplateProgrammingInterface {

  def apply(pageReq: PageRequest[_]): TinyTemplateProgrammingInterface =
    new TinyTemplateProgrammingInterface(pageReq)

  case class Page(id: String, path: String, title: String, safeBodyHtml: String)
}



object TemplateProgrammingInterface {

  val (minMax, minMaxJs, minMaxCss) = {
    // Using Play.isDev causes Could not initialize class
    // debiki.DeprecatedTemplateEngine$ error, when running unit tests. Instead:
    val isDev = p.Play.maybeApplication.map(_.mode) == Some(p.Mode.Dev)
    if (isDev) ("", "js", "css") else ("min", "min.js", "min.css")
  }

}


/**
 * Used by internal templates, e.g. /-/create-website/choose-name.
 */
class InternalTemplateProgrammingInterface protected (
  protected val dao: TenantDao) {


  def websiteConfigValue(confValName: String, or: => String = ""): String =
    _websiteConfigValueOpt(confValName) getOrElse or


  protected def _websiteConfigValueOpt(confValName: String): Option[String] =
    dao.loadWebsiteConfigMap().get(confValName).map(_.toString)

}


/**
 * Used by both Scala templates (via TemplateProgrammingInterface
 * which inherits it) and HTTP interface controllers.
 *
 * Does not provide any functionality for rendering a whole page.
 * Such stuff is placed in TemplateProgrammingInterface instead
 * (because that stuff has some more dependencies).
 */
class TinyTemplateProgrammingInterface protected (
  protected val _pageReq: PageRequest[_])
  extends InternalTemplateProgrammingInterface(_pageReq.dao) {

  import debiki.{TinyTemplateProgrammingInterface => tpi}

  def pageId = _pageReq.pageId_!
  def pageRole = _pageReq.pageRole
  def childPageRole = pageRole.childRole

  def isLoggedIn = _pageReq.loginId isDefined
  def isOwner = _pageReq.user.map(_.isOwner) == Some(true)
  def isAdmin = _pageReq.user.map(_.isAdmin) == Some(true)
  def isAuthenticated = _pageReq.user.map(_.isAuthenticated) == Some(true)
  def userDisplayName = _pageReq.user.map(_.displayName) getOrElse ""

  def currentFolder = PathRanges(folders = Seq(_pageReq.pagePath.folder))
  def currentTree = PathRanges(trees = Seq(_pageReq.pagePath.folder))


  /**
   * A website or page config value, and page specific values take precedence.
   */
  def configValue(confValName: String, or: String = ""): String = {
    _pageConfigValueOpt(confValName) orElse
       _websiteConfigValueOpt(confValName) getOrElse or
  }


  /**
   * Loads page specific data, e.g. which template to use (if we're not
   * supposed to use the default template for the folder in which the page
   * is placed) and perhaps page html keywords/title/description.
   *
   * SHOULD cache the result, otherwise we'll have to parse YAML
   * each time a page is viewed.
   */
  def pageConfigValue(confValName: String, or: String = ""): String = {
    _pageConfigValueOpt(confValName) getOrElse or
  }


  private def _pageConfigValueOpt(confValName: String): Option[String] = {
    val pageId = _pageReq.pageId.getOrElse(assErr("DwE83ZI78"))
    dao.loadPageConfigMap(pageId).get(confValName).map(_.toString)
  }


  def listNewestPages(pathRanges: PathRanges): Seq[tpi.Page] = {
    val pathsAndDetails = _pageReq.dao.listPagePaths(
      pathRanges,
      include = PageStatus.Published::Nil,
      sortBy = PageSortOrder.ByPublTime,
      limit = 10,
      offset = 0)

    // Access control.
    // Somewhat dupl code, see Application.feed.
    // ((As of now, this function is used to build blog article list pages.
    // So exclude JS and CSS and template pages and hidden pages and
    // folder/or/index/pages/, and hidden pages (even for admins).
    // In the future: Pass info via URL to `listPagePaths` on which
    // pages to include. Some PageType param? PageType.Article/Css/Js/etc.))
    val articlePaths = pathsAndDetails map (_._1) filter (
       controllers.Utils.isPublicArticlePage _)

    val pathsAndPages: Seq[(PagePath, Option[Debate])] =
      _pageReq.dao.loadPageBodiesTitles(articlePaths)

    def titleOf(page: Option[Debate]): String =
      // Currenply HtmlPageSerializer ignores the `.markup` for a title Post.
      page.flatMap(_.title).map(_.text).getOrElse("(No title)")

    def bodyOf(page: Option[Debate]): String =
      page.flatMap(_.body).map(
        HtmlPageSerializer.markupTextOf(_, _pageReq.host)).getOrElse("")

    pathsAndPages map { case (pagePath, pageOpt: Option[Debate]) =>
      val pageApproved = pageOpt map (_.approvedVersion)
      tpi.Page(id = pagePath.pageId.get, path = pagePath.path,
        title = titleOf(pageApproved), safeBodyHtml = bodyOf(pageApproved))
    }
  }


  def listNewestChildPages(): Seq[tpi.Page] = {
    val pathsAndDetails: Seq[(PagePath, PageDetails)] =
      _pageReq.dao.listChildPages(parentPageId = pageId,
          sortBy = PageSortOrder.ByPublTime, limit = 10, offset = 0)

    val articlePaths = pathsAndDetails filter {
      case (paths, details) =>
        details.cachedPublTime.map(
            _.getTime < _pageReq.ctime.getTime) == Some(true)
    } map (_._1)

    val pathsAndPages: Seq[(PagePath, Option[Debate])] =
      _pageReq.dao.loadPageBodiesTitles(articlePaths)

    def titleOf(page: Option[Debate]): String =
    // Currenply HtmlPageSerializer ignores the `.markup` for a title Post.
      page.flatMap(_.title).map(_.text).getOrElse("(No title)")

    def bodyOf(page: Option[Debate]): String =
      page.flatMap(_.body).map(
        HtmlPageSerializer.markupTextOf(_, _pageReq.host)).getOrElse("")

    pathsAndPages map { case (pagePath, pageOpt: Option[Debate]) =>
      val pageApproved = pageOpt map (_.approvedVersion)
      tpi.Page(id = pagePath.pageId.get, path = pagePath.path,
        title = titleOf(pageApproved), safeBodyHtml = bodyOf(pageApproved))
    }
  }
}


/**
 * Passed to Scala templates.
 */
class TemplateProgrammingInterface(
  private val _pageRenderer: PageRenderer,
  private val tagsToAppendToBody: xml.NodeSeq)
  extends TinyTemplateProgrammingInterface(_pageRenderer.pageReq) {

  import debiki.{TinyTemplateProgrammingInterface => tpi}
  import TinyTemplateProgrammingInterface.{Page => _, _}
  import TemplateProgrammingInterface._

  // COULD return xml.Unparsed, not String, so needn't use Html() in templates.

  def debikiHeadTags = views.html.debikiHeadTags(
    pageId, minMaxJs, minMaxCss).body


  def debikiAppendToBodyTags: xml.NodeSeq =
    PageRenderer.dialogTemplates(_pageReq) ++ tagsToAppendToBody


  val debikiHtmlTagClasses =
    "DW "+
    "dw-pri "+
    "dw-ui-simple "+
    "dw-render-actions-pending "+
    "dw-render-layout-pending "


  def debikiDashbar: String = views.html.dashbar(this).body


  def loginLinkAndUserName =
    HtmlPageSerializer.loginInfo(_pageReq.user.map(_.displayName))


  def pageTitleAndBodyNoComments =
    _pageRenderer.renderArticle(showComments = false)


  def pageTitleAndBodyAndComments =
    _pageRenderer.renderArticle(showComments = true)

}

