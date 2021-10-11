/**
 * Copyright (c) 2012, 2017 Kaj Magnus Lindberg
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
import SiteAssetBundlesController.{StylesheetAssetBundleNameRegex, assetBundleFileName}
import scala.xml.Unparsed


object PageTpi {

  val (minMax, minMaxJs, minMaxCss) = {
    // Using Play.isDev causes Could not initialize class
    // debiki.DeprecatedTemplateEngine$ error, when running unit tests. Instead:
    val isDevOrTest = !Globals.isProd
    if (isDevOrTest) ("", "js", "css") else ("min.", "min.js", "min.css")
  }

}


object SiteTpi {

  def apply(request: DebikiRequest[_], json: Option[String] = None,
        pageTitleUnsafe: Option[String] = None, isAdminArea: Boolean = false) =
    new SiteTpi(request, json, pageTitleUnsafe = pageTitleUnsafe, isAdminArea = isAdminArea)

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
  val json: Opt[St] = None,
  pageTitleUnsafe: Opt[St] = None,
  val isAdminArea: Bo = false) {

  def globals: Globals = debikiRequest.context.globals

  def request: DebikiRequest[_] = debikiRequest // rename to request, later

  def anyTestNowMs: Option[UnixMillis] = {
    if (globals.mayFastForwardTime) Some(globals.now().millis)
    else None
  }

  def site: SiteBrief = debikiRequest.site
  def pubSiteId: PubSiteId = debikiRequest.site.pubId
  def siteId: SiteId = debikiRequest.siteId
  def siteSettings: EffectiveSettings = debikiRequest.siteSettings

  def languageCode: String = siteSettings.languageCode

  def isLoggedIn: Boolean = debikiRequest.user isDefined
  def isOwner: Boolean = debikiRequest.user.exists(_.isOwner)
  def isAdmin: Boolean = debikiRequest.user.exists(_.isAdmin)
  def isAuthenticated: Boolean = debikiRequest.user.exists(_.isAuthenticated)


  def debikiMeta: xml.Unparsed = {
    // At UTX, the page title is the website being tested — which is confusing. Instead, always
    // show the UTX website title.
    val pageRole = anyCurrentPageRole orElse anyCurrentPageMeta.map(_.pageType)
    val thePageTitleUnsafe =
      if (anyCustomMetaTags.includesTitleTag) None
      else if (pageRole is PageType.UsabilityTesting) { // [plugin]
        Some("Usability Testing Exchange")
      }
      else anyCurrentPageMeta.map(_.htmlHeadTitle) match {
        case t @ Some(title) if title.length > 0 => t
        case _ => pageTitleUnsafe
      }
    val theDescription =
      if (anyCustomMetaTags.includesDescription) None
      else anyCurrentPageMeta.map(_.htmlHeadDescription)
    xml.Unparsed(views.html.debikiMeta(
      this, thePageTitleUnsafe, description = theDescription, faviconUrl = siteSettings.faviconUrl).body)
  }


  def anyCustomMetaTags: FindHeadTagsResult = FindHeadTagsResult.None
  def anySafeMetaTags: String = anyCustomMetaTags.allTags  // only admin can edit right now [2GKW0M]

  def anyCurrentPageRole: Option[PageType] = None
  def anyCurrentPageLayout: Option[PageLayout] = None
  def anyCurrentPageMeta: Option[PageMeta] = None

  def anyDiscussionId: Option[AltPageId] = None
  def anyEmbeddingUrl: Option[String] = None
  def lazyCreatePageInCatId: Option[CategoryId] = None

  def anyEmbeddingOrigin: Option[String] = anyEmbeddingUrl map { url =>
    var numSlashes = 0
    url.takeWhile(c => {
      if (c == '/') numSlashes += 1
      // The 3rd slash ends the origin in: 'https://serveraddress/url/path/etc'.
      numSlashes <= 2
    })
  }

  def currentVersionString = ""
  def cachedVersionString = ""

  def noPolyfillDotIo: Bo =
    globals.config.featureFlags.contains("ffNoPolyfillDotIo")

  def avoidPolyfillDotIo: Bo =
    globals.config.featureFlags.contains("ffAvoidPolyfillDotIo")

  def debikiHtmlTagClasses: String = {
    // Sync with js [4JXW5I2].
    val chatClass = if (anyCurrentPageRole.exists(_.isChat)) " es-chat" else ""
    val forumClass = if (anyCurrentPageRole.contains(PageType.Forum)) " es-forum" else ""
    val customClass = anyCurrentPageMeta.map(" " + _.htmlTagCssClasses) getOrElse ""
    val pageTypeClass = anyCurrentPageRole.map(" s_PT-" + _.toInt) getOrElse ""     // [5J7KTW2]
    val pageLayoutClass = anyCurrentPageLayout.map(" s_PL-" + _.toInt) getOrElse ""
    "DW dw-pri" + pageTypeClass + pageLayoutClass + chatClass + forumClass + customClass + " "
  }

  def xsrfToken: String = debikiRequest.xsrfToken.value


  def debikiStyles: xml.Unparsed =
    xml.Unparsed(views.html.debikiStyles(this).body)

  CLEAN_UP // isAdminApp not needed? already has isAdminArea.
  def debikiScriptsInHead(
        isCreateSitePage: Bo = false,
        isInLoginWindow: Bo = false,
        isInLoginPopup: Bo = false,
        isAdminApp: Bo = false,
        isInEmbeddedEditor: Bo = false,
        anyEmbeddedPageId: Opt[PageId] = None,
        embeddingScriptV: Opt[i32] = None,
        resetPasswordPageData: Option[(User, EmailId)] = None,
        ): xml.Unparsed = {

    import play.api.libs.json.{Json, JsString, JsNumber}
    import talkyard.server.JsX.{JsStringOrNull, JsLongOrNull, JsNumberOrNull}

    val doWhat = {
      if (isInEmbeddedEditor) "Noop"
      else if (resetPasswordPageData.isDefined) "ResetPwd"
      else "StartPage"
    }

    var safeStaticJson = Json.obj(
          "doWhat" -> doWhat,
          "siteId" -> siteId,
          "currentVersion" -> currentVersionString,
          "cachedVersion" -> cachedVersionString,
          "wantsServiceWorker" -> globals.config.useServiceWorker,
          "secure" -> globals.secure,
          "isDev" -> globals.isDev,

          "testNowMs" -> JsLongOrNull(anyTestNowMs),   // or undef
          "minMaxJs" -> minMaxJs,
          "debugOrigin" -> s"$httpsColonOrEmpty//$serverAddress", // [INLTAGORIG]
          "cdnOriginOrEmpty" -> JsString(cdnOrigin.getOrElse("")),
          "cdnOrServerOrigin" -> cdnOrServerOrigin, // for admin page embedded comments code
          "pubSiteIdOrigin" -> pubSiteIdOrigin,
          "isInLoginWindow" -> isInLoginWindow, // @isInLoginWindowBoolStr,
          "isInLoginPopup" -> isInLoginPopup,  // @isInLoginPopupBoolStr,
          "isInAdminArea" -> isAdminApp, // @{ if (isAdminApp) "true" else "false" },
          "isInEmbeddedEditor" -> isInEmbeddedEditor,
          "isRtl" -> isRtlLanguage, // @{ if (tpi.isRtlLanguage) "true" else "false" },

          "embeddingOrigin" -> JsStringOrNull(anyEmbeddingOrigin), //  @Html(embeddingOriginOrUndefined),
          "embeddingScriptV" -> JsNumberOrNull(embeddingScriptV),
          // These are changed dynamically in an editor iframe, [many_embcom_iframes].
          // to match the embedded comments iframe pat is replying / editing in.
          "embeddingUrl" -> JsStringOrNull(anyEmbeddingUrl),  //  @Html(embeddingUrlOrUndefined),
          "embeddedPageId" -> JsStringOrNull(anyEmbeddedPageId),
          "embeddedPageAltId" -> JsStringOrNull(anyDiscussionId), // @Html(discussionIdOrUndefined),
          "lazyCreatePageInCatId" -> JsNumberOrNull(lazyCreatePageInCatId), //@Html(lazyCreatePageInCatId),
          // ----------------------

          "assetUrlPrefix" -> assetUrlPrefix,
          "uploadsUrlPrefixCommonmark" -> uploadsUrlPrefix,
          "isTestSite" -> site.isTestSite,  // .toString },
          "loadGlobalAdminScript" -> globals.loadGlobalAdminScript, // .toString },
          "loadGlobalStaffScript" -> globals.loadGlobalStaffScript, // .toString },
          "mainWorkUntilSecs" -> {
            // Extra line to avoid weird compil err.
            val s: Long = globals.maintWorkUntilSecs.getOrElse(0L)
            JsNumber(s)
          })

    if (isCreateSitePage) {
      safeStaticJson += "baseDomain" -> JsString(globals.baseDomainNoPort)
    }

    resetPasswordPageData foreach { patAndEmailId =>
      val pat = patAndEmailId._1
      val anyResetPasswordEmailId = patAndEmailId._2
      safeStaticJson += "newPasswordData" -> Json.obj(  // ts: NewPasswordData
        "fullName" -> JsString(pat.fullName.getOrElse("")),
        "username" -> JsString(pat.theUsername),
        "email" -> JsString(pat.email),
        "minLength" -> JsNumber(globals.minPasswordLengthAllSites),
        "resetPasswordEmailId" -> JsString(anyResetPasswordEmailId))
    }

    xml.Unparsed(views.html.debikiScriptsHead(
          tpi = this,
          safeStaticJsonSt = safeStaticJson.toString,
          reactStoreSafeJsonString = reactStoreSafeJsonString).body)
  }


  def scriptBundlesEndOfBody(loadStaffBundle: Bo = false): xml.Unparsed =
    xml.Unparsed(
          views.html.debikiScriptsEndOfBody(
              this, loadStaffBundle = loadStaffBundle).body)


  /** Resources starting with '//' should be prefixed with this, so they'll be fetched via https,
    * even if there is a {{{<base href='http://...>}}} tag (i.e. not https).
    */
  def httpsColonOrEmpty: String = if (globals.secure) "https:" else ""

  def hostname: String = debikiRequest.host  // dont_use_req_host

  def companyDomain: String = {
    debikiRequest.canonicalHostname.getOrElse(
      globals.siteByIdHostnamePort(debikiRequest.siteId))
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

  def isRtlLanguage: Boolean = {
    // For now, just inline this knowledge here. Refactor-move elsewhere later. [5JUKQR2]
    // The admin area is English only — so, no RTL, there.
    siteSettings.languageCode == "he_IL" && !isAdminArea
  }

  def dotRtl: String = if (isRtlLanguage) ".rtl" else ""

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
        cdnOrServerOrigin + routes.SiteAssetBundlesController.customAsset(pubSiteId, fileName).url
      }/>
    }
    catch {
      case ex: DebikiException =>
        // The bundle is broken somehow. Don't fail the whole page because of this?
        // E.g. search engines should work fine although the bundle is broken.
        // Instead, indicate to designers/developers that it's broken, via
        // a Javascript console log message.
        val messEscaped = org.owasp.encoder.Encode.forJavaScript(ex.getMessage)
        <script>{o"""throw new Error(
          'Asset-bundle \'$bundleName\' is broken and was therefore not included
           on the page. Details: $messEscaped');"""
          }</script>
    }
  }

  RENAME // to anySiteCustomScriptsBundle
  def anyScriptsBundle(): xml.NodeSeq = {
    val version = debikiRequest.dao.getAssetBundleVersion("scripts", "js") getOrElse {
      return <span></span>
    }
    val fileName = assetBundleFileName("scripts", version, "js")
    <script src={
      cdnOrServerOrigin + routes.SiteAssetBundlesController.customAsset(pubSiteId, fileName).url
    }></script>
  }

  /** The initial data in the React-Flux model, a.k.a. store. */
  def reactStoreSafeJsonString: String =
    json getOrElse debikiRequest.dao.jsonMaker.makeSpecialPageJson(debikiRequest).toString()


  def assetUrl(fileName: String): String = assetUrlPrefix + fileName

  def assetUrlPrefix: String =
    s"$cdnOrServerOrigin/-/assets/${globals.talkyardVersion}/"   // sync with Nginx [NGXSTC]


  def mediaUrl(fileName: String): String = mediaUrlPrefix + fileName

  // (No automatic asset versioning here — instead, do manually: append a digit,
  // like 2, 3, 4..., to the sub folders in module ty-media, if modifying
  // images etc there, to change the URL. Only needed every few years? anyway.)
  def mediaUrlPrefix: String =
    s"$cdnOrServerOrigin/-/media/"   // sync with Nginx [NGXSTC]

  def fontUrl(fileName: St): St =
    s"$cdnOrServerOrigin/-/fonts/$fileName"   // sync w Nginx [NGXSTC]

  def uploadsUrlPrefix: St =
    cdnOrServerOrigin + ed.server.UploadsUrlBasePath + pubSiteId + '/'

  def pubSiteIdOrigin: St =
    globals.siteByPubIdOrigin(pubSiteId)

  /** Even if there's no CDN, we use the full server address so works also in
    * embedded comments iframes.
    */
  def cdnOrServerOrigin: St =
    globals.cdnOrSiteOrigin(serverAddress)

  def cdnOrigin: Opt[St] =
    globals.anyCdnOrigin

  RENAME // to siteAdr
  def serverAddress: String = debikiRequest.request.host

}


/** For the editor, on embedded comments discussions.
  */
class EditPageTpi(
  request: GetRequest,
  override val anyEmbeddingUrl: Option[String],
) extends SiteTpi(request) {
  override def anyCurrentPageRole: Opt[PageType] = Some(PageType.EmbeddedComments)
}


/** Page Template Programming Interface, used by Scala templates that render pages.
  */
class PageTpi(
  private val pageReq: PageRequest[_],
  override val reactStoreSafeJsonString: String,
  private val jsonVersion: CachedPageVersion,
  private val cachedPageHtml: String,
  private val cachedVersion: CachedPageVersion,
  private val pageTitleUnsafe: Option[String],
  override val anyCustomMetaTags: FindHeadTagsResult,
  override val anyDiscussionId: Option[AltPageId],
  override val anyEmbeddingUrl: Option[String],
  override val lazyCreatePageInCatId: Option[CategoryId],
) extends
    SiteTpi(pageReq, json = None, pageTitleUnsafe = pageTitleUnsafe) {

  override def anyCurrentPageLayout = Some(pageReq.thePageMeta.layout)
  override def anyCurrentPageRole = Some(pageReq.thePageRole)
  override def anyCurrentPageMeta: Option[PageMeta] = pageReq.pageMeta

  override def currentVersionString: String = jsonVersion.computerString
  override def cachedVersionString: String = cachedVersion.computerString

  private val horizontalComments =
    pageReq.thePageRole == PageType.MindMap || pageReq.thePageSettings.horizontalComments


  override def debikiHtmlTagClasses: String =
    super.debikiHtmlTagClasses + (if (horizontalComments) "dw-hz " else "dw-vt ")


  def renderedPage = xml.Unparsed(cachedPageHtml)

}

