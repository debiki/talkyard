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
import debiki.dao._
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import play.api.libs.json._
import requests.{DebikiRequest, PageRequest}
import SiteAssetBundlesController.{AssetBundleNameRegex, assetBundleFileName}


object TemplateProgrammingInterface {

  val (minMax, minMaxJs, minMaxCss) = {
    // Using Play.isDev causes Could not initialize class
    // debiki.DeprecatedTemplateEngine$ error, when running unit tests. Instead:
    val isDevOrTest = p.Play.maybeApplication.map(_.mode) != Some(p.Mode.Prod)
    if (isDevOrTest) ("", "js", "css") else ("min.", "min.js", "min.css")
  }

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
class SiteTpi protected (val debikiRequest: DebikiRequest[_]) {

  def siteId  = debikiRequest.siteId
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

  def debikiScriptsInHead = xml.Unparsed(
    views.html.debikiScriptsHead( // Could pass `this` to the template instead of all these params?
      siteId = siteId,
      anyPageId = anyCurrentPageId,
      serverAddress = debikiRequest.request.host,
      pageUriPath = debikiRequest.request.path,
      anyPageRole = anyCurrentPageRole,
      anyPagePath = anyCurrentPagePath,
      reactStoreSafeJsonString = reactStoreSafeJsonString,
      minMaxJs = minMaxJs,
      minMaxCss = minMaxCss).body)

  def debikiScriptsEndOfBody =
    debikiScriptsEndOfBodyCustomStartupCode("debiki.internal.startDiscussionPage();")

  def debikiScriptsEndOfBodyCustomStartupCode(startupCode: String) = xml.Unparsed(
    views.html.debikiScriptsEndOfBody(
      startupCode = startupCode, minMaxJs = minMaxJs).body)


  /* Perhaps I'll add this back later, or use it in the topbar.
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
  } */

  def hostname = debikiRequest.host

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
        throw DebikiException(
          "DwE13BKf8", o"""Invalid asset bundle name: '$bundleName'. Only names
          like 'some-bundle-name.css' and 'some-scripts.js' are allowed.""")
    }

    try {
      val version = debikiRequest.dao.loadAssetBundleVersion(nameNoSuffix, suffix)
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
    Json.obj("user" -> ReactJson.userNoPageToJson(debikiRequest.user)).toString

  def debikiAppendToBodyTags: xml.NodeSeq = Nil

}


/**
 * Passed to Scala templates.
 */
class TemplateProgrammingInterface(
  private val pageReq: PageRequest[_],
  private val tagsToAppendToBody: xml.NodeSeq)
  extends SiteTpi(pageReq) {

  override def anyCurrentPageId = Some(pageId)
  override def anyCurrentPageRole = Some(pageRole)
  override def anyCurrentPagePath = Some(pageReq.pagePath)

  def pageId = pageReq.thePageId
  def pageRole = pageReq.thePageRole

  def currentFolder = PathRanges(folders = Seq(pageReq.pagePath.folder))
  def currentTree = PathRanges(trees = Seq(pageReq.pagePath.folder))

  def pageSettings = pageReq.thePageSettings

  val horizontalComments = pageReq.thePageRole == PageRole.MindMap ||
    pageReq.thePageSettings.horizontalComments.valueAsBoolean


  override def debikiHtmlTagClasses =
    super.debikiHtmlTagClasses + (if (horizontalComments) "dw-hz " else "dw-vt ")


  override def debikiAppendToBodyTags: xml.NodeSeq = {
    tagsToAppendToBody
  }


  def reactTest =
    xml.Unparsed(ReactRenderer.renderPage(reactStoreSafeJsonString))


  /** Example: if this is a forum topic  in a forum  in a forum group,
    * this function would return the id of the forum group (that'd be the "root" section).
    */
  def anyRootSectionPageId: Option[PageId] =
    pageReq.ancestorIdsParentFirst_!.lastOption orElse {
      // If this page itself is a section, its id is the root section id.
      if (pageRole.isSection) Some(pageId) else None
    }


  def pageUrlPath = pageReq.pagePath.value


  override lazy val reactStoreSafeJsonString: String = {
    ReactJson.pageToJson(pageReq, socialLinksHtml =
        siteSettings.socialLinksHtml.valueAsString).toString

  }

}

