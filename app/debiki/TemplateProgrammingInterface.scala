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

package debiki

import com.debiki.core
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.{SiteAssetBundles, routes}
import debiki.dao._
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import requests.{DebikiRequest, PageRequest}
import SiteAssetBundles.{AssetBundleNameRegex, assetBundleFileName}


object InternalTemplateProgrammingInterface {

  def apply(dao: SiteDao) = new InternalTemplateProgrammingInterface(dao)

}


object InternalPageTpi {


  case class Page(
    id: String,
    path: String,
    title: String,
    creationDati: ju.Date,
    pubDati: Option[ju.Date],
    safeBodyHtml: String)


  case class Forum(
    id: String, path: String, title: String, numTopics: Int)
    // and, in the future: num topics, num contributors and num replies?



  case class ForumTopic(
    id: String,
    path: String,
    title: String,
    excerpt: String,
    authorDisplayName: String,
    authorUserId: String,
    numRepliesApproved: Int,
    numRepliesRejected: Int,
    numRepliesPendingReview: Int,
    numRepliesFlagged: Int,
    numRepliesDeleted: Int,
    numContributors: Int,
    pubDati: Option[ju.Date],
    lastReplyDati: Option[ju.Date])


  object Page {
    def apply(page: core.Page, host: String): Page = Page(
      id = page.id,
      path = page.path.path,
      title = titleOf(page),
      creationDati = page.meta.creationDati,
      pubDati = page.meta.pubDati,
      safeBodyHtml = bodyOf(page, host))

    private def titleOf(page: core.Page): String =
      // Currently HtmlPageSerializer ignores the `.markup` for a title Post.
      page.parts.approvedTitleTextOrNoTitle

    private def bodyOf(page: core.Page, host: String): String =
      page.parts.body.map(
        HtmlPageSerializer.markupTextOf(_, host)).getOrElse("")
  }


  object Forum {
    def apply(pageMeta: PageMeta, pagePath: PagePath): Forum = Forum(
      id = pageMeta.pageId,
      path = pagePath.path,
      title = pageMeta.cachedTitle getOrElse "(Unnamed forum)",
      numTopics = pageMeta.cachedNumChildPages)
  }


  object ForumTopic {
    def apply(pageMeta: PageMeta, pagePath: PagePath, pageSummary: PageSummary)
          : ForumTopic =
      ForumTopic(
        id = pageMeta.pageId,
        path = pagePath.path,
        title = pageMeta.cachedTitle getOrElse "(Unnamed topic)",
        excerpt = pageSummary.textExcerpt,
        authorDisplayName = pageSummary.authorDisplayName,
        authorUserId = pageSummary.authorUserId,
        numRepliesApproved = pageSummary.numPostsApproved,
        numRepliesRejected = pageSummary.numPostsRejected,
        numRepliesPendingReview = pageSummary.numPostsPendingReview,
        numRepliesFlagged = pageSummary.numPostsFlagged,
        numRepliesDeleted = pageSummary.numPostsDeleted,
        numContributors = pageSummary.numContributors,
        pubDati = pageMeta.pubDati,
        lastReplyDati = pageSummary.lastApprovedPostDati)
  }

}



object TemplateProgrammingInterface {

  val (minMax, minMaxJs, minMaxCss) = {
    // Using Play.isDev causes Could not initialize class
    // debiki.DeprecatedTemplateEngine$ error, when running unit tests. Instead:
    val isDevOrTest = p.Play.maybeApplication.map(_.mode) != Some(p.Mode.Prod)
    if (isDevOrTest) ("", "js", "css") else ("min", "min.js", "min.css")
  }

}


/**
 * Used by internal templates, e.g. /-/create-website/choose-name.
 */
class InternalTemplateProgrammingInterface protected (
  protected val dao: SiteDao) {


  def websiteConfigValue(confValName: String, or: => String = ""): String =
    anyWebsiteConfigValue(confValName) getOrElse or


  protected def anyWebsiteConfigValue(confValName: String): Option[String] =
    dao.loadWebsiteConfig().getText(confValName)

}



object SiteTpi {

  def apply(request: DebikiRequest[_]) = new SiteTpi(request)

}


/** The Site Template Programming Interface is used when rendering stuff that
  * is specific to a certain website, but does not depend on which page is being
  * viewed.
  *
  * The SiteTpi is currently used when rendering generic HTML that wraps all
  * page contents — e.g. when rendering the dashbar and the top navbar.
  * And also for the search results page.
  *
  * There is also a Page Template Programming Interface which is used
  * when rendering e.g. blog and forum pages.
  */
class SiteTpi protected (val debikiRequest: DebikiRequest[_])
  extends InternalTemplateProgrammingInterface(debikiRequest.dao) {

  def isLoggedIn = debikiRequest.loginId isDefined
  def isOwner = debikiRequest.user.map(_.isOwner) == Some(true)
  def isAdmin = debikiRequest.user.map(_.isAdmin) == Some(true)
  def isAuthenticated = debikiRequest.user.map(_.isAuthenticated) == Some(true)
  def userDisplayName = debikiRequest.user.map(_.displayName) getOrElse ""

  def debikiMeta = xml.Unparsed(views.html.debikiMeta().body)

  def anyCurrentPageId: Option[PageId] = None

  /** Classes for the <html> tag. */
  val debikiHtmlTagClasses =
    "DW dw-pri dw-ui-simple dw-render-actions-pending "

  def debikiDashbar = xml.Unparsed(views.html.dashbar().body)

  def loginLinkAndUserName =
    HtmlPageSerializer.loginInfo(debikiRequest.user.map(_.displayName))


  def xsrfToken: String = debikiRequest.xsrfToken.value


  import TemplateProgrammingInterface._

  def debikiStyles = xml.Unparsed(
    views.html.debikiStyles(minMaxJs, minMaxCss).body)

  def debikiScripts = xml.Unparsed(
    views.html.debikiScripts(
      anyPageId = anyCurrentPageId,
      serverAddress = debikiRequest.request.host,
      minMaxJs = minMaxJs,
      minMaxCss = minMaxCss).body)


  /** A website or page config value, and page specific values take precedence.
   */
  def anyConfigValue(confValName: String, pageId: Option[String] = None): Option[String] =
    anyPageConfigValue(confValName, pageId) orElse
      anyWebsiteConfigValue(confValName)


  def configValue(confValName: String, pageId: Option[String] = None, or: String = ""): String =
    anyConfigValue(confValName, pageId) getOrElse or


  /** Loads page specific data, e.g. which template to use (if we're not
    * supposed to use the default template for the folder in which the page
    * is placed) and perhaps page html keywords/title/description.
    *
    * SHOULD cache the result, otherwise we'll have to parse YAML
    * each time a page is viewed.
    */
  def pageConfigValue(confValName: String, pageId: Option[String] = None, or: String = "")
        : String = {
    anyPageConfigValue(confValName, pageId) getOrElse or
  }


  private def anyPageConfigValue(confValName: String, pageId: Option[String]): Option[String] = {
    val thePageId = pageId orElse anyCurrentPageId getOrElse {
      return None
    }
    try {
      dao.loadPageConfigMap(thePageId).get(confValName) match {
        case None => None
        case Some(null) => Some("") // SnakeYaml is Java and uses `null`.
        case Some(x) => Some(x.toString)
      }
    }
    catch {
      case ex: DebikiException =>
        throw TemplateRenderer.PageConfigException(
          "DwE63D8", s"Error loading page config value '$confValName': ${ex.getMessage}")
    }
  }


  def stylesheetBundle(bundleName: String): xml.NodeSeq = {

    val (nameNoSuffix, suffix) = bundleName match {
      case AssetBundleNameRegex(nameNoSuffix, suffix) =>
        (nameNoSuffix, suffix)
      case _ =>
        throw TemplateRenderer.BadTemplateException(
          "DwE13BKf8", o"""Invalid asset bundle name: '$bundleName'. Only names
          like 'some-bundle-name.css' and 'some-scripts.js' are allowed.""")
    }

    try {
      val version = dao.loadAssetBundleVersion(nameNoSuffix, suffix)
      val fileName = assetBundleFileName(nameNoSuffix, version, suffix)
        <link rel="stylesheet" href={ routes.SiteAssetBundles.at(fileName).url }/>
    }
    catch {
      case ex: DebikiException =>
        // The bundle is broken somehow. Don't fail the whole page because of this?
        // E.g. search engines should work fine although the bundle is broken.
        // Instead, indicate to designers/developers that it's broken, via
        // a Javascript console log message.
        val messEscaped = ex.getMessage.replaceAllLiterally("'", """\'""")
        <script>{o"""throw new Error(
          'Asset-bundle \'$bundleName\' is broken and was therefore not included
           on the page. Details: $messEscaped');"""
          }</script>
    }
  }


  def debikiAppendToBodyTags: xml.NodeSeq = Nil

}



/**
 * Used by both Scala templates (via TemplateProgrammingInterface
 * which inherits it) and HTTP interface controllers.
 *
 * Does not provide any functionality for rendering a whole page.
 * Such stuff is placed in TemplateProgrammingInterface instead
 * (because that stuff has some more dependencies).
 */
class InternalPageTpi protected (protected val _pageReq: PageRequest[_]) extends SiteTpi(_pageReq) {

  import debiki.{InternalPageTpi => tpi}

  override def anyCurrentPageId = Some(pageId)
  def pageId = _pageReq.pageId_!
  def pageRole = _pageReq.pageRole_!
  def childPageRole = pageRole.childRole

  def currentFolder = PathRanges(folders = Seq(_pageReq.pagePath.folder))
  def currentTree = PathRanges(trees = Seq(_pageReq.pagePath.folder))


  def listNewestPages(pathRanges: PathRanges): Seq[tpi.Page] = {
    val pathsAndMeta = _pageReq.dao.listPagePaths(
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
    val articlePaths = pathsAndMeta map (_.path) filter (
       controllers.Utils.isPublicArticlePage _)

    // ----- Dupl code! See listNewestChildPages() below.

    val pagesById: Map[String, PageParts] =
      _pageReq.dao.loadPageBodiesTitles(
        articlePaths.map(_.pageId getOrDie "DwE82AJ7"))

    for {
      pathAndMeta <- pathsAndMeta
      pageParts <- pagesById.get(pathAndMeta.pageId)
    } yield {
      tpi.Page(
        Page(pathAndMeta, pageParts), host = _pageReq.host)
    }
  }


  def listNewestChildPages(): Seq[tpi.Page] = {
    val pathsAndMeta: Seq[PagePathAndMeta] =
      _pageReq.dao.listChildPages(parentPageId = pageId,
          sortBy = PageSortOrder.ByPublTime, limit = 10, offset = 0)

    // "Access control". Filter out pages that has not yet been published.
    val pubPathsAndMeta = pathsAndMeta filter { pathAndMeta =>
      pathAndMeta.meta.pubDati.map(_.getTime < _pageReq.ctime.getTime) == Some(true)
    }

    // ----- Dupl code! See listNewestPages() above.

    val pagesById: Map[String, PageParts] =
      _pageReq.dao.loadPageBodiesTitles(pubPathsAndMeta.map(_.pageId))

    for {
      pathAndMeta <- pubPathsAndMeta
      pageActions <- pagesById.get(pathAndMeta.pageId)
    } yield {
      tpi.Page(
        Page(pathAndMeta, pageActions), host = _pageReq.host)
    }
  }


  /**
   * Returns any parent forums, e.g.: grandparent-forum :: parent-forum :: Nil.
   */
  def listParentForums(): Seq[tpi.Forum] = {
    _pageReq.pageMeta_!.parentPageId match {
      case None => Nil
      case Some(pageId) =>
        _pageReq.dao.listAncestorsAndOwnMeta(pageId) map { case (pagePath, pageMeta) =>
          tpi.Forum(pageMeta, pagePath)
        }
    }
  }


  def listPublishedSubForums(): Seq[tpi.Forum] =
    listPubSubForumsImpl(pageId)


  def listPublishedSubForumsOf(forum: tpi.Forum): Seq[tpi.Forum] =
    listPubSubForumsImpl(forum.id)


  private def listPubSubForumsImpl(parentPageId: String): Seq[tpi.Forum] =
    listPublishedChildren(
      parentPageId = Some(parentPageId),
      filterPageRole = Some(PageRole.Forum)) map { pathAndMeta =>
        tpi.Forum(pathAndMeta.meta, pathAndMeta.path)
      }


  def hasChildPages: Boolean = {
    // COULD make this more efficient. We already do a database roundtrip
    // via e.g. `listPublishedSubForums` — Might as well ask for all successor
    // pages from here, because if there *are* any successors, we will
    // likely list all of them.
    val pathsAndMeta = _pageReq.dao.listChildPages(parentPageId = pageId,
      sortBy = PageSortOrder.ByPublTime, limit = 1, offset = 0)
    pathsAndMeta.nonEmpty
  }


  def listRecentForumTopics(limit: Int): Seq[tpi.ForumTopic] =
    listRecentForumTopicsImpl(pageId, limit = limit)


  def listRecentForumTopicsIn(forum: tpi.Forum, limit: Int): Seq[tpi.ForumTopic] =
    listRecentForumTopicsImpl(forum.id, limit = limit)


  private def listRecentForumTopicsImpl(parentForumId: String, limit: Int)
        : Seq[tpi.ForumTopic] = {
    val topicPathsAndMeta: Seq[PagePathAndMeta] =
      listPublishedChildren(
        parentPageId = Some(parentForumId),
        filterPageRole = Some(PageRole.ForumTopic),
        limit = limit)

    val topicSummaries: Map[String, PageSummary] =
      _pageReq.dao.loadPageSummaries(topicPathsAndMeta.map(_.pageId))

    for {
      pathAndMeta <- topicPathsAndMeta
      summary <- topicSummaries.get(pathAndMeta.pageId)
    }
    yield {
      tpi.ForumTopic(pathAndMeta.meta, pathAndMeta.path, summary)
    }
  }


  private def listPublishedChildren(
        parentPageId: Option[String] = None,
        filterPageRole: Option[PageRole],
        limit: Int = 10,
        offset: Int = 0)
        : Seq[PagePathAndMeta] = {

    val pathsAndMeta: Seq[PagePathAndMeta] =
      _pageReq.dao.listChildPages(parentPageId = parentPageId getOrElse pageId,
        sortBy = PageSortOrder.ByPublTime, limit = limit, offset = offset,
        filterPageRole = filterPageRole)

    // BUG This might result in fewer than `limit` pages being returned.
    // In the future, move filtering to `pageReq.dao` instead?
    val publishedPathsAndMeta = pathsAndMeta filter { pathAndMeta =>
      pathAndMeta.meta.pubDati.map(_.getTime < _pageReq.ctime.getTime) == Some(true)
    }
    publishedPathsAndMeta
  }

}


/**
 * Passed to Scala templates.
 */
class TemplateProgrammingInterface(
  private val pageReq: PageRequest[_],
  private val tagsToAppendToBody: xml.NodeSeq)
  extends InternalPageTpi(pageReq) {

  import debiki.{InternalPageTpi => tpi}
  import InternalPageTpi.{Page => _, _}

  var renderPageSettings: Option[RenderPageSettings] = None

  lazy val renderedPage: RenderedPage =
    dao.renderPage(
      pageReq,
      renderPageSettings getOrElse {
        throw TemplateRenderer.BadTemplateException(
          "DwE3KR58", "Please wrap @tpi.title, @tpi.body etcerera inside a @tpi.page tag")
      })


  override def debikiAppendToBodyTags: xml.NodeSeq = {
    // The dialog templates includes the user name and cannot currently be cached.
    val dialogTemplates: xml.NodeSeq = {
      val templateHtmlNodes = HtmlForms(pageReq.xsrfToken.value,
        pageReq.pageRoot, pageReq.permsOnPage).dialogTemplates
      xml.Unparsed(liftweb.Html5.toString(templateHtmlNodes))
    }
    dialogTemplates ++ tagsToAppendToBody
  }


  def page(contents: => play.api.templates.Html): xml.NodeSeq = page()(contents)


  def page(
    showTitle: Boolean = true,
    showAuthorAndDate: Boolean = !isHomepage,
    showBody: Boolean = true,
    showComments: Boolean = !isHomepage)(
    contents: => play.api.templates.Html): xml.NodeSeq = {

    renderPageSettings =
      if (pageReq.pageRoot.isPageConfigPost || pageReq.pagePath.isConfigPage) {
        // Don't load any config values in case the config post/page is corrupt — otherwise
        // it wouldn't be possible to edit the config file and fix the errors.
        Some(RenderPageSettings(
          showTitle = true, showAuthorAndDate = false, showBody = true, showComments = true))
      }
      else {
        Some(RenderPageSettings(
          showTitle = shall("show-title", showTitle),
          showAuthorAndDate = shall("show-author-and-date", showAuthorAndDate),
          showBody = shall("show-body", showBody),
          showComments = shall("show-comments", showComments)))
      }

    HtmlPageSerializer.wrapInPageTag(pageReq.pathAndMeta_!) {
      xml.Unparsed(contents.body)
    }
  }


  /** Example: if this is a forum topic  in a forum  in a forum group,
    * this function would return the id of the forum group (that'd be the "root" section).
    */
  def anyRootSectionPageId: Option[PageId] =
    _pageReq.ancestorIdsParentFirst_!.lastOption orElse {
      // If this page itself is a section, its id is the root section id.
      val isSection = pageRole.childRole.isDefined
      if (isSection) Some(pageId) else None
    }


  def pageMeta = dao.renderPageMeta(pageReq)


  def pageUrlPath = pageReq.pagePath.path


  def isHomepage = pageUrlPath == "/"


  def title = renderedPage.title


  def titleText = renderedPage.titleText


  def authorAndDate = renderedPage.authorAndDate


  def bodyAndComments = renderedPage.bodyAndComments


  /**
   * Use in templates, e.g. like so: `@if(shall("show-title")) { @title }`
   */
  def shall(confValName: String, default: Boolean = false): Boolean =
    anyConfigValue(confValName).getOrElse(default) match {
      case b: Boolean => b
      case s: String => s.toLowerCase == "true"
      case x => throw TemplateRenderer.PageConfigException(
        "DwE1W840", s"""Don't know how to convert config value `$confValName' = `$x',
        which is a ${classNameOf(x)}, to a Boolean""")
    }

}

