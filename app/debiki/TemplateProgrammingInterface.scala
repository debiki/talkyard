/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers.PageRequest


object TemplateProgrammingInterface {

  case class Page(id: String, path: String, title: String, safeBodyHtml: String)

  def apply(pageReq: PageRequest[_]) = new TemplateProgrammingInterface(pageReq)

}


/**
 * Passed to Scala templates.
 */
class TemplateProgrammingInterface(private val _pageReq: PageRequest[_]) {

  import TemplateProgrammingInterface._


  def currentFolder = PathRanges(folders = Seq(_pageReq.pagePath.folder))
  def currentTree = PathRanges(trees = Seq(_pageReq.pagePath.folder))


  def listNewestPages(pathRanges: PathRanges): Seq[Page] = {
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
    // Currenply HtmlSerializer ignores the `.markup` for a title Post.
      page.flatMap(_.title).map(_.text).getOrElse("(No title)")

    def bodyOf(page: Option[Debate]): String =
      page.flatMap(_.body).map(
        HtmlSerializer.markupTextOf(_, _pageReq.host)).getOrElse("")

    pathsAndPages map { case (pagePath, pageOpt: Option[Debate]) =>
      val pageApproved = pageOpt map (_.approvedVersion)
      Page(id = pagePath.pageId.get, path = pagePath.path,
        title = titleOf(pageApproved), safeBodyHtml = bodyOf(pageApproved))
    }
  }

}

