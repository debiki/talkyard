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

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.{SiteAssetBundlesController, routes}
import ed.server.http.{DebikiRequest, GetRequest, PageRequest}
import play.{api => p}
import play.api.Play.current
import SiteAssetBundlesController.{StylesheetAssetBundleNameRegex, assetBundleFileName}
import scala.xml.Unparsed


object PageTpi {

  val (minMax, minMaxJs, minMaxCss) = {
    // Using Play.isDev causes Could not initialize class
    // debiki.DeprecatedTemplateEngine$ error, when running unit tests. Instead:
    val isDevOrTest = p.Play.maybeApplication.map(_.mode) != Some(p.Mode.Prod)
    if (isDevOrTest) ("", "js", "css") else ("min.", "min.js", "min.css")
  }

}


object SiteTpi {

  def apply(request: DebikiRequest[_], json: Option[String] = None,
        pageTitle: Option[String] = None, isSearchPage: Boolean = false) =
    new SiteTpi(request, json, pageTitle = pageTitle, isSearchPage = isSearchPage)

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
class SiteTpi protected (
  val debikiRequest: DebikiRequest[_],
  val json: Option[String] = None,
  pageTitle: Option[String] = None,
  isSearchPage: Boolean = false) {

  def request: DebikiRequest[_] = debikiRequest // rename to request, later

  def siteId: SiteId = debikiRequest.siteId
  def siteSettings: EffectiveSettings = debikiRequest.siteSettings

  def isLoggedIn: Boolean = debikiRequest.user isDefined
  def isOwner: Boolean = debikiRequest.user.exists(_.isOwner)
  def isAdmin: Boolean = debikiRequest.user.exists(_.isAdmin)
  def isAuthenticated: Boolean = debikiRequest.user.exists(_.isAuthenticated)

  def debikiMeta =
    xml.Unparsed(views.html.debikiMeta(anyCurrentPageMeta, pageTitle).body)


  def anySafeMetaTags: Option[String] = None
  def anyCurrentPageId: Option[PageId] = None
  def anyCurrentPageRole: Option[PageRole] = None
  def anyCurrentPagePath: Option[PagePath] = None
  def anyCurrentPageMeta: Option[PageMeta] = None

  def currentVersionString = ""
  def cachedVersionString = ""


  def debikiHtmlTagClasses: String = {
    val chatClass = if (anyCurrentPageRole.exists(_.isChat)) "es-chat " else ""
    val forumClass = if (anyCurrentPageRole.contains(PageRole.Forum)) "es-forum " else ""
    val customClass = anyCurrentPageMeta.map(_.htmlTagCssClasses + " ") getOrElse ""
    "DW dw-pri " + chatClass + forumClass + customClass
  }

  def xsrfToken: String = debikiRequest.xsrfToken.value


  def debikiStyles = xml.Unparsed(views.html.debikiStyles(this).body)

  def debikiScriptsInHead(isInLoginWindow: Boolean = false) = xml.Unparsed(
    views.html.debikiScriptsHead(
      this, // Could remove all params below, use 'this' instead in the template.
      siteId = siteId,
      anyPageId = anyCurrentPageId,
      pageUriPath = debikiRequest.request.path,
      anyPageRole = anyCurrentPageRole,
      anyPagePath = anyCurrentPagePath,
      reactStoreSafeJsonString = reactStoreSafeJsonString,
      isInLoginWindow = isInLoginWindow,
      minMaxJs = minMaxJs,
      minMaxCss = minMaxCss).body)

  def debikiScriptsEndOfBody: Unparsed =
    debikiScriptsEndOfBodyCustomStartupCode("debiki.internal.startDiscussionPage();")

  def debikiScriptsEndOfBodyNoStartupCode =
    debikiScriptsEndOfBodyCustomStartupCode("")

  def debikiScriptsEndOfBodyCustomStartupCode(startupCode: String,
        loadStaffBundle: Boolean = false) = xml.Unparsed(
    views.html.debikiScriptsEndOfBody(
      this, startupCode = startupCode, loadStaffBundle = loadStaffBundle).body)


  def hostname: String = debikiRequest.host

  def companyDomain: String = {
    debikiRequest.canonicalHostname
    // was: debikiRequest.siteSettings.companyDomain
    // — but why did I make it configurable? No idea. Remove that setting? [3PU85J7]
  }
  def companyFullName: String = debikiRequest.siteSettings.orgFullName
  def companyShortName: String = debikiRequest.siteSettings.orgShortName


  def anyGoogleUniversalAnalyticsScript: String = {
    val trackingId = debikiRequest.siteSettings.googleUniversalAnalyticsTrackingId
    if (trackingId.nonEmpty) views.html.googleAnalytics(trackingId).body
    else ""
  }

  def minMaxCss: String = PageTpi.minMaxCss
  def minMaxJs: String = PageTpi.minMaxJs

  def stylesheetBundle(bundleName: String): xml.NodeSeq = {

    val (nameNoSuffix, suffix) = bundleName match {
      case StylesheetAssetBundleNameRegex(nameNoSuffix, suffix) =>
        (nameNoSuffix, suffix)
      case _ =>
        throw DebikiException(
          "DwE13BKf8", o"""Invalid asset bundle name: '$bundleName'. Only names
          like 'some-bundle-name.css' and 'some-scripts.js' are allowed.""")
    }

    try {
      val version = debikiRequest.dao.getAssetBundleVersion(nameNoSuffix, suffix) getOrElse {
        return <link/>
      }
      val fileName = assetBundleFileName(nameNoSuffix, version, suffix)
      <link rel="stylesheet" href={
        cdnOrServerOrigin + routes.SiteAssetBundlesController.customAsset(siteId, fileName).url
      }/>
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

  def anyScriptsBundle(): xml.NodeSeq = {
    val version = debikiRequest.dao.getAssetBundleVersion("scripts", "js") getOrElse {
      return <span></span>
    }
    val fileName = assetBundleFileName("scripts", version, "js")
    <script src={
      cdnOrServerOrigin + routes.SiteAssetBundlesController.customAsset(siteId, fileName).url
    }></script>
  }

  /** The initial data in the React-Flux model, a.k.a. store. */
  def reactStoreSafeJsonString: String =
    json getOrElse ReactJson.makeSpecialPageJson(
        debikiRequest, inclCategoriesJson = isSearchPage).toString()


  def assetUrl(fileName: String): String = assetUrlPrefix + fileName

  def assetUrlPrefix: String =
    cdnOrServerOrigin + routes.Assets.at(path = "/public/res", "")

  def uploadsUrlPrefix: String =
    cdnOrServerOrigin + routes.UploadsController.servePublicFile("")

  /** Even if there's no CDN, we use the full server address so works also in
    * embedded comments iframes.
    */
  def cdnOrServerOrigin: String =
    Globals.config.cdn.origin.getOrElse(Globals.schemeColonSlashSlash + serverAddress)

  def serverAddress: String = debikiRequest.request.host

}


class EditPageTpi(request: GetRequest, val pageMeta: PageMeta) extends SiteTpi(request) {
  override def anyCurrentPageId = Some(pageMeta.pageId)
  override def anyCurrentPageRole = Some(pageMeta.pageRole)
  override def anyCurrentPageMeta: Option[PageMeta] = Some(pageMeta)
}


/** Page Template Programming Interface, used by Scala templates that render pages.
  */
class PageTpi(
  private val pageReq: PageRequest[_],
  override val reactStoreSafeJsonString: String,
  private val jsonVersion: CachedPageVersion,
  private val cachedPageHtml: String,
  private val cachedVersion: CachedPageVersion,
  private val pageTitle: Option[String],
  private val safeMetaTags: String)
  extends SiteTpi(pageReq, json = None, pageTitle = pageTitle) {

  override def anySafeMetaTags = Some(safeMetaTags)
  override def anyCurrentPageId = Some(pageReq.thePageId)
  override def anyCurrentPageRole = Some(pageReq.thePageRole)
  override def anyCurrentPagePath = Some(pageReq.pagePath)
  override def anyCurrentPageMeta: Option[PageMeta] = pageReq.pageMeta

  override def currentVersionString: String = jsonVersion.computerString
  override def cachedVersionString: String = cachedVersion.computerString

  private val horizontalComments =
    pageReq.thePageRole == PageRole.MindMap || pageReq.thePageSettings.horizontalComments


  override def debikiHtmlTagClasses: String =
    super.debikiHtmlTagClasses + (if (horizontalComments) "dw-hz " else "dw-vt ")


  def renderedPage = xml.Unparsed(cachedPageHtml)

}

