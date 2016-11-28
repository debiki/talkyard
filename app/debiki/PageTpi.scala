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
import io.efdi.server.http.DebikiRequest
import io.efdi.server.http.PageRequest
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import SiteAssetBundlesController.{AssetBundleNameRegex, assetBundleFileName}


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

  def request = debikiRequest // rename to request, later

  def siteId  = debikiRequest.siteId
  def siteSettings = debikiRequest.siteSettings

  def isLoggedIn = debikiRequest.user isDefined
  def isOwner = debikiRequest.user.map(_.isOwner) == Some(true)
  def isAdmin = debikiRequest.user.map(_.isAdmin) == Some(true)
  def isAuthenticated = debikiRequest.user.map(_.isAuthenticated) == Some(true)

  def debikiMeta = {
    xml.Unparsed(views.html.debikiMeta(anyCurrentPageMeta, pageTitle).body)
  }

  def anyCurrentPageId: Option[PageId] = None
  def anyCurrentPageRole: Option[PageRole] = None
  def anyCurrentPagePath: Option[PagePath] = None
  def anyCurrentPageMeta: Option[PageMeta] = None

  def currentVersionString = ""
  def cachedVersionString = ""


  def debikiHtmlTagClasses = {
    val chatClass = if (anyCurrentPageRole.exists(_.isChat)) "es-chat " else ""
    val forumClass = if (anyCurrentPageRole.contains(PageRole.Forum)) "es-forum " else ""
    val customClass = anyCurrentPageMeta.map(_.htmlTagCssClasses + " ") getOrElse ""
    "DW dw-pri " + chatClass + forumClass + customClass
  }

  def xsrfToken: String = debikiRequest.xsrfToken.value


  def debikiStyles = xml.Unparsed(views.html.debikiStyles(this).body)

  def debikiScriptsInHead = xml.Unparsed(
    views.html.debikiScriptsHead(
      this, // Could remove all params below, use 'this' instead in the template.
      siteId = siteId,
      anyPageId = anyCurrentPageId,
      pageUriPath = debikiRequest.request.path,
      anyPageRole = anyCurrentPageRole,
      anyPagePath = anyCurrentPagePath,
      reactStoreSafeJsonString = reactStoreSafeJsonString,
      minMaxJs = minMaxJs,
      minMaxCss = minMaxCss).body)

  def debikiScriptsEndOfBody =
    debikiScriptsEndOfBodyCustomStartupCode("debiki.internal.startDiscussionPage();")

  def debikiScriptsEndOfBodyCustomStartupCode(startupCode: String,
        loadStaffBundle: Boolean = false) = xml.Unparsed(
    views.html.debikiScriptsEndOfBody(
      this, startupCode = startupCode, loadStaffBundle = loadStaffBundle).body)


  def hostname = debikiRequest.host

  def companyDomain = {
    debikiRequest.canonicalHostname
    // was: debikiRequest.siteSettings.companyDomain
    // — but why did I make it configurable? No idea. Remove that setting? [3PU85J7]
  }
  def companyFullName = debikiRequest.siteSettings.orgFullName
  def companyShortName = debikiRequest.siteSettings.orgShortName


  def anyGoogleUniversalAnalyticsScript = {
    val trackingId = debikiRequest.siteSettings.googleUniversalAnalyticsTrackingId
    if (trackingId.nonEmpty) views.html.googleAnalytics(trackingId).body
    else ""
  }

  def minMaxCss = PageTpi.minMaxCss
  def minMaxJs = PageTpi.minMaxJs

  def stylesheetBundle(bundleName: String): xml.NodeSeq = {

    val (nameNoSuffix, suffix) = bundleName match {
      case AssetBundleNameRegex(nameNoSuffix, suffix) =>
        (nameNoSuffix, suffix)
      case _ =>
        throw DebikiException(
          "DwE13BKf8", o"""Invalid asset bundle name: '$bundleName'. Only names
          like 'some-bundle-name.css' and 'some-scripts.js' are allowed.""")
    }

    try {
      val version = debikiRequest.dao.loadAssetBundleVersion(nameNoSuffix, suffix)
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


  /** The initial data in the React-Flux model, a.k.a. store. */
  def reactStoreSafeJsonString: String =
    json getOrElse ReactJson.makeSpecialPageJson(
        debikiRequest, inclCategoriesJson = isSearchPage).toString()


  def assetUrl(fileName: String) = assetUrlPrefix + fileName

  def assetUrlPrefix =
    cdnOrServerOrigin + routes.Assets.at(path = "/public/res", "")

  def uploadsUrlPrefix =
    cdnOrServerOrigin + routes.UploadsController.servePublicFile("")

  /** Even if there's no CDN, we use the full server address so works also in
    * embedded comments iframes.
    */
  def cdnOrServerOrigin =
    Globals.config.cdn.origin.getOrElse(Globals.schemeColonSlashSlash + serverAddress)

  def serverAddress = debikiRequest.request.host

}


/** Page Template Programming Interface, used by Scala templates that render pages.
  */
class PageTpi(
  private val pageReq: PageRequest[_],
  override val reactStoreSafeJsonString: String,
  private val jsonVersion: CachedPageVersion,
  private val cachedPageHtml: String,
  private val cachedVersion: CachedPageVersion,
  private val pageTitle: Option[String])
  extends SiteTpi(pageReq, json = None, pageTitle = pageTitle) {

  override def anyCurrentPageId = Some(pageReq.thePageId)
  override def anyCurrentPageRole = Some(pageReq.thePageRole)
  override def anyCurrentPagePath = Some(pageReq.pagePath)
  override def anyCurrentPageMeta = pageReq.pageMeta

  override def currentVersionString = jsonVersion.computerString
  override def cachedVersionString = cachedVersion.computerString

  private val horizontalComments =
    pageReq.thePageRole == PageRole.MindMap || pageReq.thePageSettings.horizontalComments


  override def debikiHtmlTagClasses =
    super.debikiHtmlTagClasses + (if (horizontalComments) "dw-hz " else "dw-vt ")


  def renderedPage = xml.Unparsed(cachedPageHtml)

}

