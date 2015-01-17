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
import controllers.{SiteAssetBundlesController, routes}
import debiki.dao._
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import play.api.libs.json._
import requests.{DebikiRequest, PageRequest}
import SiteAssetBundlesController.{AssetBundleNameRegex, assetBundleFileName}


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


  case class ForumOrCategory(
    id: String, path: String, title: String, numTopics: Int)
    // and, in the future: num topics, num contributors and num replies?


  case class ForumTopic(id: String, path: String, title: String)


  object Page {
    def apply(page: core.Page, host: String): Page = Page(
      id = page.id,
      path = page.path.value,
      title = titleOf(page),
      creationDati = page.meta.creationDati,
      pubDati = page.meta.pubDati,
      safeBodyHtml = bodyOf(page, host))

    private def titleOf(page: core.Page): String =
      // Currently HtmlPageSerializer ignores the `.markup` for a title Post.
      page.parts.approvedTitleTextOrNoTitle

    private def bodyOf(page: core.Page, host: String): String =
      page.parts.body.map(body => {
        ReactRenderer.renderAndSanitizeCommonMark(
          body.approvedText.getOrElse("(Not yet approved"),
          allowClassIdDataAttrs = true, followLinks = true)
      }).getOrElse("")
  }


  object ForumOrCategory {
    def apply(forumPath: String, pageMeta: PageMeta, pagePath: PagePath): ForumOrCategory = {
      val path =
        if (pagePath.value == forumPath) {
          // This is the forum itself.
          forumPath
        }
        else {
          // This is a category.
          // Currently the forum React app uses hash fragment URLs for navigation
          // inside the forum, unfortunately.
          // Let's show the latest topics for this category:
          val categoryName =
            controllers.ForumController.categoryNameToSlug(pageMeta.cachedTitle getOrElse "")
          s"$forumPath#/latest/$categoryName"
        }
      ForumOrCategory(
        id = pageMeta.pageId,
        path = path,
        title = pageMeta.cachedTitle getOrElse "(Unnamed forum)",
        numTopics = pageMeta.cachedNumChildPages)
    }
  }


  object ForumTopic {
    def apply(pathAndMeta: PagePathAndMeta): ForumTopic =
      ForumTopic(
        id = pathAndMeta.id,
        path = pathAndMeta.path.value,
        title = pathAndMeta.meta.cachedTitle getOrElse "(Unnamed topic)")
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

  def siteSettings = debikiRequest.siteSettings

  def isLoggedIn = debikiRequest.user isDefined
  def isOwner = debikiRequest.user.map(_.isOwner) == Some(true)
  def isAdmin = debikiRequest.user.map(_.isAdmin) == Some(true)
  def isAuthenticated = debikiRequest.user.map(_.isAuthenticated) == Some(true)
  def userDisplayName = debikiRequest.user.map(_.displayName) getOrElse ""

  def debikiMeta = xml.Unparsed(views.html.debikiMeta().body)

  def anyCurrentPageId: Option[PageId] = None
  def anyCurrentPageRole: Option[PageRole] = None
  def anyCurrentPagePath: Option[PagePath] = None

  /** Classes for the <html> tag. */
  def debikiHtmlTagClasses = "DW dw-pri "


  def xsrfToken: String = debikiRequest.xsrfToken.value


  import TemplateProgrammingInterface._

  def debikiStyles = xml.Unparsed(
    views.html.debikiStyles(minMaxJs, minMaxCss).body)

  def debikiScripts =
    debikiScriptsCustomStartupCode("debiki.internal.startDiscussionPage();")

  def debikiScriptsCustomStartupCode(startupCode: String) = xml.Unparsed(
    views.html.debikiScripts(
      startupCode = startupCode,
      anyPageId = anyCurrentPageId,
      serverAddress = debikiRequest.request.host,
      pageUriPath = debikiRequest.request.path,
      anyPageRole = anyCurrentPageRole,
      anyPagePath = anyCurrentPagePath,
      reactStoreSafeJsonString = reactStoreSafeJsonString,
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


  def logoHtml = {
    val logoUrlOrHtml = debikiRequest.siteSettings.logoUrlOrHtml.value.toString.trim
    if (logoUrlOrHtml.headOption == Some('<')) {
      // It's HTML, use it as is
      logoUrlOrHtml
    }
    else {
      // `logoUrlOrHtml` should be an image URL, wrap in a tag.
      <img src={logoUrlOrHtml}></img>.toString
    }
  }


  def companyDomain = debikiRequest.siteSettings.companyDomain
  def companyFullName = debikiRequest.siteSettings.companyFullName
  def companyShortName = debikiRequest.siteSettings.companyShortName


  def anyGoogleUniversalAnalyticsScript = {
    val trackingId = debikiRequest.siteSettings.googleUniversalAnalyticsTrackingId.value.toString
    if (trackingId.nonEmpty) views.html.googleAnalytics(trackingId).body
    else ""
  }


  def specialContentPages = debikiRequest.dao.specialContentPages


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
        <link rel="stylesheet" href={ routes.SiteAssetBundlesController.at(fileName).url }/>
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


  /** The initial data in the React-Flux model, a.k.a. store. */
  def reactStoreSafeJsonString: String =
    ReactJson.userNoPageToJson(debikiRequest.user).toString

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
  override def anyCurrentPageRole = Some(pageRole)
  override def anyCurrentPagePath = Some(_pageReq.pagePath)

  def pageId = _pageReq.thePageId
  def pageRole = _pageReq.thePageRole

  def currentFolder = PathRanges(folders = Seq(_pageReq.pagePath.folder))
  def currentTree = PathRanges(trees = Seq(_pageReq.pagePath.folder))


  def listNewestChildPages(): Seq[tpi.Page] = {
    val pathsAndMeta: Seq[PagePathAndMeta] =
      _pageReq.dao.listChildPages(Seq(pageId), PageOrderOffset.ByPublTime, limit = 10)

    // "Access control". Filter out pages that has not yet been published.
    val pubPathsAndMeta = pathsAndMeta filter { pathAndMeta =>
      pathAndMeta.meta.pubDati.map(_.getTime < _pageReq.ctime.getTime) == Some(true)
    }

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
  def listParentForums(): Seq[tpi.ForumOrCategory] = {
    val parentPageId = _pageReq.thePageMeta.parentPageId match {
      case None => return Nil
      case Some(pageId) => pageId
    }

    val ancestorPatshAndMeta: Seq[(PagePath, PageMeta)] =
      _pageReq.dao.listAncestorsAndOwnMeta(parentPageId)

    val forumPath = ancestorPatshAndMeta.headOption match {
      case None => return Nil
      case Some((path, meta)) => path
    }

    val forumsAndCats = ancestorPatshAndMeta map { case (pagePath, pageMeta) =>
      tpi.ForumOrCategory(forumPath.value, pageMeta, pagePath)
    }

    forumsAndCats
  }


  /** Assuming the current page is a forum, lists all topics in this forum, the one
    * with the most recent posts first.
    */
  def listLatestForumTopics(limit: Int, offset: Int): Seq[tpi.ForumTopic] = {
    val topicPathsAndMeta: Seq[PagePathAndMeta] = dao.listTopicsInTree(rootPageId = pageId,
      orderOffset = PageOrderOffset.ByLikesAndBumpTime(None), limit = 50)
    val topics = topicPathsAndMeta.map(tpi.ForumTopic(_))
    topics
  }


  /* I can make these work again, later, if I implement non-Javascript version of
    the forum category list page:

  def listPublishedSubForums(): Seq[tpi.ForumOrCategory] =
    listPubSubForumsImpl(pageId)


  def listPublishedSubForumsOf(forum: tpi.ForumOrCategory): Seq[tpi.ForumOrCategory] =
    listPubSubForumsImpl(forum.id)


  private def listPubSubForumsImpl(parentPageId: String): Seq[tpi.ForumOrCategory] =
    listPublishedChildren(
      parentPageId = Some(parentPageId),
      filterPageRole = Some(PageRole.ForumCategory)) map { pathAndMeta =>
        tpi.ForumOrCategory(pathAndMeta.meta, pathAndMeta.path)
      }
  */


  def hasChildPages: Boolean = {
    // COULD make this more efficient. We already do a database roundtrip
    // via e.g. `listPublishedSubForums` — Might as well ask for all successor
    // pages from here, because if there *are* any successors, we will
    // likely list all of them.
    val pathsAndMeta = _pageReq.dao.listChildPages(
      Seq(pageId), PageOrderOffset.ByPublTime, limit = 1)
    pathsAndMeta.nonEmpty
  }


  private def listPublishedChildren(
        parentPageId: Option[String] = None,
        filterPageRole: Option[PageRole],
        limit: Int = 10,
        offset: Int = 0)
        : Seq[PagePathAndMeta] = {

    val pathsAndMeta: Seq[PagePathAndMeta] =
      _pageReq.dao.listChildPages(Seq(parentPageId getOrElse pageId), PageOrderOffset.ByPublTime,
        limit = limit, filterPageRole = filterPageRole)

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
  import TemplateProgrammingInterface._

  def pageSettings = pageReq.thePageSettings

  val horizontalComments = pageReq.thePageSettings.horizontalComments.valueAsBoolean


  override def debikiHtmlTagClasses =
    super.debikiHtmlTagClasses + (if (horizontalComments) "dw-hz " else "dw-vt ")


  override def debikiAppendToBodyTags: xml.NodeSeq = {
    // The dialog templates includes the user name and cannot currently be cached.
    val dialogTemplates: xml.NodeSeq = {
      val templateHtmlNodes = HtmlForms(pageReq.xsrfToken.value,
        pageReq.pageRoot, pageReq.permsOnPage).dialogTemplates
      xml.Unparsed(liftweb.Html5.toString(templateHtmlNodes))
    }
    dialogTemplates ++ tagsToAppendToBody
  }


  def reactTest =
    xml.Unparsed(ReactRenderer.renderPage(reactStoreSafeJsonString))


  /** Example: if this is a forum topic  in a forum  in a forum group,
    * this function would return the id of the forum group (that'd be the "root" section).
    */
  def anyRootSectionPageId: Option[PageId] =
    _pageReq.ancestorIdsParentFirst_!.lastOption orElse {
      // If this page itself is a section, its id is the root section id.
      if (pageRole.isSection) Some(pageId) else None
    }


  def pageUrlPath = pageReq.pagePath.value


  def titleText =
    pageReq.thePageParts.titlePost.map(_.currentText) getOrElse pageReq.pagePath.value


  override lazy val reactStoreSafeJsonString: String = {
    ReactJson.pageToJson(pageReq, socialLinksHtml = configValue("social-links")).toString
  }

}

