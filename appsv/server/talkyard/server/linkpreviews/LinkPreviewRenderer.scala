/**
 * Copyright (C) 2015, 2020 Kaj Magnus Lindberg
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

package talkyard.server.linkpreviews

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml, TextAndHtmlMaker, JsoupLinkElems}
import engines._
import debiki.TextAndHtml.safeEncodeForHtml
import debiki.dao.RedisCache
import org.scalactic.{Bad, ErrorMessage, Good, Or}

import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.{ExecutionContext, Future}
import scala.util.matching.Regex
import scala.util.{Failure, Success}
import talkyard.server.TyLogging



sealed abstract class RenderPreviewResult


object RenderPreviewResult {

  /** The URL is not to a trusted site, or the HTTP request failed, or whatever went wrong.
    */
  case class NoPreview(errCode: St = "") extends RenderPreviewResult

  /** If a preview was cached already (in link_previews_t),
    * or no external HTTP request needed.
    */
  case class Done(result: PreviewResult, placeholder: String) extends RenderPreviewResult

  /** If we sent a HTTP request to download a preview, e.g. an oEmbed request.
    */
  case class Loading(futureSafeHtml: Future[PreviewResult Or LinkPreviewProblem],
        placeholder: String)
    extends RenderPreviewResult
}



class RenderPreviewParams(
  val site: SiteIdHostnames,
  val fromPageId: PageId,
  val unsafeUri: j_URI,
  val inline: Bo,
  val requesterId: UserId,
  val mayHttpFetch: Bo,
  val loadPreviewFromDb: St => Opt[LinkPreview],
  val savePreviewInDb: LinkPreview => U) {

  def siteId: SiteId = site.id
  def unsafeUrl: St = unsafeUri.toString
}


case class PreviewResult(
  safeTitleCont: Opt[St] = None,
  classAtr: St = "",
  errCode: Opt[ErrCode] = None,
  safeHtml: St,
) {
  // Some previews have an unknown title. But there cannot be both a title
  // (indicating that fetching the preview went fine) and an error code.
  require(safeTitleCont.isEmpty || errCode.isEmpty, "TyE60TFRM5")
}


/**
*
* @param safeTitleCont — cannot be used in an attribute value though.
* @param maybeUnsafeHtml
*/
case class PreviewTitleHtml(
  safeTitleCont: Opt[St] = None,
  maybeUnsafeHtml: St,
  // alreadySanitized: Bo,  use instead of LinkPreviewRenderEngine.sandboxInIframe  ?
  followLinksSkipNoopener: Bo = false,
  )


case class LinkPreviewProblem(
  unsafeProblem: St,
  unsafeUrl: St, // remove? only inited, but then never used
  errorCode: St,
  isInternalLinkNotFoundOrMayNotSee: Bo = false)



object LinkPreviewRenderer {

  val MaxUrlLength = 470  // link_url_c max len is 500


  // What if this is a link to *another* Talkyard site, which uses a different
  // CDN or no CDN? Then shouldn't point the links to the current server's CDN.
  // Harmless today, 2020-07 and today 2021-03.
  BUG; FIX_AFTER // 2021-07-01 Skip links with different pub site id or origin. [cdn_nls]
  //
  // (?:...) is a non-capturing group.  (for local dev search: /-/u/ below.)
  private val uplLinkRegex: Regex =
    """(?:(?:(?:https?:)?//[^/]+)?/-/(?:u|uploads/public)/)([a-zA-Z0-9/\._-]+)""".r

  private val noOpenerRegex: Regex =
    """^(.* )?noopener( .*)?$""".r

  /** Changes links to https:, if server uses https.
    * This might break some links, but that's better than http-not-secure
    * linking to resources, in the cases where https would have worked
    * — which is nowadays close to always? (thanks to LetsEncrypt)
    *
    * Also rewrites any links to images etc on the same site,
    * so they'll point to any CDN in use.
    *
    * And adds 'noopener' if target is _blank.
    */
  def tweakLinks(htmlSt: St, toHttps: Bo, uploadsUrlUgcPrefix: Opt[St],
          followLinksSkipNoopener: Bo = false,
          siteId_unused: SiteId, sitePubId_unused: PubSiteId): St = {
    // Tests: LinkPreviewRendererSpec

    val doc = org.jsoup.Jsoup.parse(htmlSt)
    val JsoupLinkElems(
          hrefAttrElems,
          srcAttrElems) = TextAndHtmlMaker.jsoupFindLinks(doc)

    def tweak(url: St): St = {
      var tweakedUrl = url.trim
      if (toHttps && tweakedUrl.startsWith("http:")) {
        tweakedUrl = "https" + tweakedUrl.drop("http".length)
      }
      tweakedUrl = uploadsUrlUgcPrefix match {
        case None => tweakedUrl
        case Some(prefix) =>
          uplLinkRegex.replaceAllIn(tweakedUrl, s"$prefix$$1")
      }
      tweakedUrl
    }

    var anyTweaked = false

    for (elem: org.jsoup.nodes.Element <- hrefAttrElems) {
      // attr() returns "" not null.
      val origUrl = elem.attr("href")
      val tweakedUrl = tweak(origUrl)
      if (tweakedUrl != origUrl) {
        elem.attr("href", tweakedUrl)
        anyTweaked = true
      }

      // Add rel="noopener" if target is _blank [reverse_tabnabbing], so any
      // target="_blank" linked page cannot access window.opener and change
      // it's location to e.g. a phishing site, e.g.:
      //    window.opener.location = 'https://www.example.com';
      // See: https://web.dev/external-anchors-use-rel-noopener/
      // > when you use target="_blank", always add rel="noopener" or rel="noreferrer"
      //
      if (!followLinksSkipNoopener) {
        val isAreaOrA = elem.tagName == "a" || elem.tagName == "area"
        if (isAreaOrA && elem.attr("target").contains("_blank")) {
          val relAtrVal = elem.attr("rel")
          if (!noOpenerRegex.matches(relAtrVal)) {
            val space = if (relAtrVal.isEmpty) "" else " "
            elem.attr("rel", relAtrVal + space + "noopener")
            anyTweaked = true
          }
        }
      }
    }

    for (elem: org.jsoup.nodes.Element <- srcAttrElems) {
      // attr() returns "" not null.
      val origUrl = elem.attr("src")
      val tweakedUrl = tweak(origUrl)
      if (tweakedUrl != origUrl) {
        elem.attr("src", tweakedUrl)
        anyTweaked = true
      }
    }

    val result = if (!anyTweaked) htmlSt else {
      doc.outputSettings(TextAndHtml.compactJsoupOutputSettings)
      doc.body.html
    }
    result
  }
}


/** Renders link previews for one type of links — e.g. YouTube,
  * or Reddit, or maybe generic oEmed links.
  *
  * COULD remove param globals, and incl only precisely what's needed?
  */
abstract class LinkPreviewRenderEngine(globals: Globals) extends TyLogging {  CLEAN_UP // move to its own file?

  def regex: Regex =
    die("TyE603RKDJ35", "Please implement 'handles(url): Boolean' or 'regex: Regex'")

  def providerName: Opt[St]

  def extraLnPvCssClasses: St

  def handles(uri: j_URI, inline: Bo): Bo = !inline && handles(uri.toString)
  def handles(url: St): Bo = regex.matches(url)

  /** If an engine needs to include an iframe or any "uexpected thing",
    * then it'll have to sanitize everything itself, because
    * TextAndHtml.sanitizeRelaxed() removes iframes and other uexpected things.
    */
  protected def alreadySanitized = false  ; REMOVE // use PreviewTitleHtml.alreadySanitized instead

  /** An engine can set this to true, to get iframe-sandboxed instead of
    * html-sanitized.
    */
  protected def sandboxInIframe = false

  /** By default, we add a "View at (provider name)" link below the link preview.
    */
  protected def addViewAtLink = true

  protected def cachePreview = true


  final def fetchRenderSanitize(urlAndFns: RenderPreviewParams)
        : Future[PreviewResult Or LinkPreviewProblem] = {

    // ----- Any cached preview?

    // This prevents pg storage DoS.  [ln_pv_netw_err]

    unimplIf(cachePreview && urlAndFns.inline, "TyE592MSRHG2")
    val anyRedisCache = if (!cachePreview) None else Some {
      COULD_OPTIMIZE // As Redis key, use a url hash, so shorter?
      val redisCache = new RedisCache(urlAndFns.siteId, globals.redisClient, globals.now)
      redisCache.getLinkPreviewSafeHtml(urlAndFns.unsafeUrl) foreach { safeHtml =>
        SHOULD // if preview broken *and* if (urlAndFns.mayHttpFetch):
        // retry, although cache entry still here.
        // E.g. was netw err,
        // but at most X times per minute? Otherwise return the cached broken html.
        return Future.successful(Good(PreviewResult(safeHtml = safeHtml)))
      }
      redisCache
    }

    // ----- Http fetch preview

    // Or generate instantly.

    val futureHtml: Future[PreviewTitleHtml Or LinkPreviewProblem] =
          loadAndRender(urlAndFns)

    // ----- Sanitize

    def sanitizeAndWrap(previewOrProblem: PreviewTitleHtml Or LinkPreviewProblem)
          : PreviewResult Or LinkPreviewProblem = {

      // <aside> class:    s_LnPv (-Err)    means Link Preview (Error)
      // <aside><a> class: s_LnPv_L (-Err)  means the actual <a href=..> link
      var anyErrCode: Opt[ErrCode] = None
      var followLinksSkipNoopener = false

      val safeHtmlMaybeBadLinks = previewOrProblem match {
        case Bad(problem) =>
          // Internal link? Then just return the problem; this will make it render
          // as a plain link, without showing any error — it'd be confusing,
          // if linking from a public topic to an access restricted topic,
          // and there was a "Not found: ..." error, although the link works
          // for those with access.  [brkn_int_ln_pv]
          if (problem.isInternalLinkNotFoundOrMayNotSee) {
            return Bad(problem)
          }
          // A bit weird to sometimes return Bad, above, but Good(broken-preview-html)
          // below. Oh well.
          anyErrCode = Some(problem.errorCode)
          LinkPreviewHtml.safeProblem(problem, unsafeUrl = urlAndFns.unsafeUrl)
        case Good(previewTitleHtml) =>
          import previewTitleHtml.maybeUnsafeHtml
          followLinksSkipNoopener = previewTitleHtml.followLinksSkipNoopener
          if (alreadySanitized) {
            maybeUnsafeHtml
          }
          else if (sandboxInIframe) {
            LinkPreviewHtml.sandboxedIframe(maybeUnsafeHtml)
          }
          else {
            // COULD pass info to here so can follow links sometimes? [WHENFOLLOW]
            TextAndHtml.sanitizeRelaxed(maybeUnsafeHtml)
          }
      }

      val uploadsUrlUgcPrefix =
            globals.anyUgcOrCdnOriginFor(urlAndFns.site)
                .map(_ + talkyard.server.UploadsUrlBasePath)

      // Don't link to insecure HTTP resources from safe HTTPS pages,  [no_insec_emb]
      // e.g. don't link to <img src="http://...">. Change to https instead — even if
      // the image/whatever then breaks; security is more important, plus, browsers
      // show security warnings if there are insecure http resources in an
      // https-secure page.
      // And make uploaded files links point to any CDN, and add 'noopener' if needed.
      val safeHtmlOkLinks = LinkPreviewRenderer.tweakLinks(
            safeHtmlMaybeBadLinks,
            toHttps = globals.secure,
            // What about embedded comments — if there's no CDN, then, shouldn't we
            // incl the site origin, so the links won't be relative the blog? UI BUG?
            uploadsUrlUgcPrefix = uploadsUrlUgcPrefix,
            followLinksSkipNoopener = followLinksSkipNoopener,
            siteId_unused = urlAndFns.siteId,
            sitePubId_unused = "") // later
            // Maybe a follow-links param?  [WHENFOLLOW]

      val lnPvErr = if (previewOrProblem.isBad) "s_LnPv-Err " else ""

      val inlineClasses = s"s_LnPv s_LnPv-Inl $lnPvErr$extraLnPvCssClasses"

      BUG // here urlAndFns.unsafeUrl won't point to the CDN? Doesn't really matter [cdn_nls]
      val safeHtmlWrapped = LinkPreviewHtml.wrapInSafeAside(   // [lnpv_aside]
            safeHtml = safeHtmlOkLinks,
            extraLnPvCssClasses = lnPvErr + extraLnPvCssClasses,
            unsafeUrl = urlAndFns.unsafeUrl,
            unsafeProviderName = providerName,
            addViewAtLink = addViewAtLink)

      anyRedisCache.foreach(
            _.putLinkPreviewSafeHtml(urlAndFns.unsafeUrl, safeHtmlWrapped))

      Good(PreviewResult(
            safeTitleCont = previewOrProblem.toOption.flatMap(_.safeTitleCont),
            classAtr = inlineClasses,
            safeHtml = safeHtmlWrapped,
            errCode = anyErrCode))
    }

    // Use if-isCompleted to get an instant result, if possible — Future.map()
    // apparently isn't executed directly, even if the future is completed.
    if (futureHtml.isCompleted) {
      Future.fromTry(futureHtml.value.get.map(sanitizeAndWrap))
    }
    else {
      futureHtml.map(sanitizeAndWrap)(globals.executionContext)
    }
  }


  protected def loadAndRender(urlAndFns: RenderPreviewParams)
        : Future[PreviewTitleHtml Or LinkPreviewProblem]

}



abstract class ExternalFetchLinkPrevwRendrEng(globals: Globals, siteId: SiteId,
        mayHttpFetch: Boolean)
  extends LinkPreviewRenderEngine(globals) {
}


/** Later, this preview engine will *also* try to fetch the remote things,
  * and maybe create a thumbnail for a very large external image.
  * Then we'll also notice if the links are maybe in fact broken.  [srvr_fetch_ln_pv]
  * And can optionally scan the content, find out if it's not allowed  [content_filter]
  * as per the community rules & guidelines.
  */
abstract class InstantLinkPrevwRendrEng(globals: Globals)
  extends LinkPreviewRenderEngine(globals) {

  val extraLnPvCssClasses: String = providerLnPvCssClassName

  def providerName: Option[String] = None

  def providerLnPvCssClassName: String

  protected final def loadAndRender(urlAndFns: RenderPreviewParams)
        : Future[PreviewTitleHtml Or LinkPreviewProblem] = {
    Future.successful(renderInstantly2(urlAndFns))
  }

  protected def renderInstantly2(linkToRender: RenderPreviewParams)
        : PreviewTitleHtml Or LinkPreviewProblem = {
    renderInstantly(linkToRender).map((maybeUnsafeHtml: St) =>
          PreviewTitleHtml(maybeUnsafeHtml = maybeUnsafeHtml))
  }

  // REMOVE
  protected def renderInstantly(linkToRender: RenderPreviewParams)
        : St Or LinkPreviewProblem
}


/** What is a link preview? If you type a link to a Twitter tweet or Wikipedia page,
  * Talkyard might download some html from that page, e.g. title, image, description,
  * or oEmbed html.
  *
  * This usually requires the server to http fetch the linked page,
  * and extract the relevant parts. When rendering client side, the client sends a request
  * to the Talkyard server and asks it to create a preview. This needs to be done
  * server side, e.g. for security reasons (cannot trust the client to provide
  * the correct html preview).
  *
  * If !mayHttpFetch, only creates previews if link preview data has been
  * downloaded and saved already in link_previews_t, or if can be constructed
  * without any external fetch (e.g. well known url patterns, like YouTue video links).
  */
class LinkPreviewRenderer(
  val globals: Globals,
  val site: SiteIdHostnames,
  val mayHttpFetch: Boolean,
  val requesterId: UserId) extends TyLogging {

  import LinkPreviewRenderer._

  private val PlaceholderPrefix = "c_LnPv-"
  private val NoEngineException = new DebikiException("DwE3KEF7", "No matching preview engine")

  COULD_OPTIMIZE // These are, or can be made thread safe — no need to recreate all the time.
  private val engines = Seq[LinkPreviewRenderEngine](
    new InternalLinkPrevwRendrEng(globals, site),
    new ImagePrevwRendrEng(globals),
    new VideoPrevwRendrEng(globals),
    new GiphyPrevwRendrEng(globals),
    new YouTubePrevwRendrEng(globals),
    new TelegramPrevwRendrEng(globals),
    new TikTokPrevwRendrEng(globals, site.id, mayHttpFetch),
    new TwitterPrevwRendrEng(globals, site.id, mayHttpFetch),

    // After 2020-10-24, Facebook requires an API access key to link to Facebook
    // via OEmbed. Short of time, will need to disable Facebook   [fb_insta_dis]
    // for now then:  (incl Instagram)
    // See https://developers.facebook.com/docs/plugins/oembed
    // and https://developers.facebook.com/docs/instagram/oembed
    /*
    new FacebookPostPrevwRendrEng(globals, site.id, mayHttpFetch),
    new FacebookVideoPrevwRendrEng(globals, site.id, mayHttpFetch),
    new InstagramPrevwRendrEng(globals, site.id, mayHttpFetch),
    */
    new RedditPrevwRendrEng(globals, site.id, mayHttpFetch),
    )

  def fetchRenderSanitize(uri: j_URI, inline: Bo)
        : Future[PreviewResult Or LinkPreviewProblem] = {
    val url = uri.toString
    require(url.length <= MaxUrlLength, s"Too long url: $url TyE53RKTKDJ5")

    def loadPreviewFromDatabase(downloadUrl: String): Option[LinkPreview] = {
      // Don't create a write tx — could cause deadlocks, because unfortunately
      // we might be inside a tx already: [nashorn_in_tx] (will fix later)
      val siteDao = globals.siteDao(site.id)
      siteDao.readTx { tx =>
        tx.loadLinkPreviewByUrl(linkUrl = url, downloadUrl = downloadUrl)
      }
    }

    for (engine <- engines) {
      if (engine.handles(uri, inline = inline)) {
        val args = new RenderPreviewParams(
              site = site,
              fromPageId = NoPageId, // later  [ln_pv_az]
              unsafeUri = uri,
              inline = inline,
              requesterId = requesterId,
              mayHttpFetch = mayHttpFetch,
              loadPreviewFromDb = loadPreviewFromDatabase,
              savePreviewInDb = savePreviewInDatabase)
        return engine.fetchRenderSanitize(args)
      }
    }

    Future.failed(NoEngineException)
  }


  private def savePreviewInDatabase(linkPreview: LinkPreview): Unit = {
    dieIf(!mayHttpFetch, "TyE305KSHW2",
          s"Trying to save link preview, when may not fetch: ${linkPreview.linkUrl}")
    val siteDao = globals.siteDao(site.id)
    siteDao.writeTx { (tx, _) =>
      COULD // refresh pages that include this link preview, add to [staleStuff].
      tx.upsertLinkPreview(linkPreview)
    }
  }


  def fetchRenderSanitizeInstantly(uri: j_URI, inline: Bo): RenderPreviewResult = {
    // Don't throw, this might be in a background thread.

    if (uri.toString.length > MaxUrlLength)
      return RenderPreviewResult.NoPreview()

    def placeholder: St = PlaceholderPrefix + nextRandomString()

    val futureResult: Future[PreviewResult Or LinkPreviewProblem] =
          fetchRenderSanitize(uri, inline = inline)

    if (futureResult.isCompleted)
      return futureResult.value.get match {
        case Success(result) =>
          result match {
            case Bad(problem) =>
              // [brkn_int_ln_pv]
              RenderPreviewResult.NoPreview(errCode = problem.errorCode)
            case Good(preview) =>
              RenderPreviewResult.Done(preview, placeholder)
          }
        case Failure(throwable) =>
          RenderPreviewResult.NoPreview()
      }

    RenderPreviewResult.Loading(futureResult, placeholder)
  }

}



/** Used when rendering link previwes from inside Javascript code run by Nashorn.
  */
// CHANGE to  LinkPreviewCache(siteTx: ReadOnlySiteTransaction) ?
// But sometimes Nashorn is used inside a tx — would mean we'd open a *read-only*
// tx inside a possibly write tx. Should be fine, right.
// Or construct the LinkPreviewCache outside Nashorn, with any tx already in use,
// and give to Nashorn?
class LinkPreviewRendererForNashorn(val linkPreviewRenderer: LinkPreviewRenderer)
  extends TyLogging {

  private val donePreviews: ArrayBuffer[RenderPreviewResult.Done] = ArrayBuffer()
  private def globals = linkPreviewRenderer.globals


  /** Called from javascript running server side in Nashorn.  [js_scala_interop]
    *
    * Returns a json string.
    */
  def renderAndSanitizeInlineLinkPreview(
          unsafeUrl: St, preGendPlaceholder: Opt[St] = None): St = {
    import play.api.libs.json.{Json, JsString}

    // Allow hash frag, so can #post-123 link to specific posts. [int_ln_hash]
    val unsafeUri = Validation.parseUri(unsafeUrl, allowQuery = true, allowHash = true)
          .getOrIfBad { _ =>
      return Json.obj("errCode" -> JsString("TyELNPVURL")).toString
    } /// oops!

    lazy val safeUrlInTag = org.owasp.encoder.Encode.forHtmlContent(unsafeUrl)

    val result = linkPreviewRenderer.fetchRenderSanitizeInstantly(
          unsafeUri, inline = true) match {
      case RenderPreviewResult.NoPreview(errCode) =>
        // Fine.
        val res = PreviewResult(safeHtml = "", errCode = errCode.noneIfEmpty,
              safeTitleCont = Some(safeUrlInTag))
        preGendPlaceholder foreach { plh =>
          donePreviews.append(
                RenderPreviewResult.Done(res, plh))
        }
        res
      case donePreview0: RenderPreviewResult.Done =>
        // For Deno:
        val donePreview = preGendPlaceholder match {
          case Some(plh) => donePreview0.copy(placeholder = plh)
          case None => donePreview0
        }
        donePreviews.append(donePreview)
        // For the browser, and Nashorn:
        donePreview.result
      case _: RenderPreviewResult.Loading =>
        PreviewResult(safeHtml = "", errCode = Some("TyELNPV0CACH1"))
    }

    // TESTS_MISSING: Could incl a class="c_LnPvNone-$errCode" and in
    // the e2e tests verify we got the correct error code.  [brkn_int_ln_pv]
    // Not needed here:  safeHtml.
    val resultSt = Json.obj(  // ts: InlineLinkPreview
          "safeTitleCont" -> JsString(result.safeTitleCont.getOrElse("")),
          "classAtr" -> JsString(result.classAtr)).toString

    resultSt
  }


  def renderAndSanitizeBlockLinkPreview(unsafeUrl: St,
          // New, for Deno. HACK. Will later always be specified?
          // When Nashorn gone.
          preGendPlaceholder: Opt[St] = None): St = {
    lazy val safeUrlInAtr = org.owasp.encoder.Encode.forHtmlAttribute(unsafeUrl)
    lazy val safeUrlInTag = org.owasp.encoder.Encode.forHtmlContent(unsafeUrl)

    if (!globals.isInitialized) {
      // Also see the comment for Nashorn.startCreatingRenderEngines()
      return o"""<p style="color: red; outline: 2px solid orange; padding: 1px 5px;">
           Broken link preview for: <a>$safeUrlInTag</a>. Nashorn called out to Scala code
           that uses old stale class files and apparently the wrong classloader (?)
           so singletons are created a second time when inside Nashorn and everything
           is broken. To fix this, restart the server (CTRL+D + run), and edit and save
           this comment again. This problem happens only when Play Framework
           soft-restarts the server in development mode. [DwE4KEPF72]</p>"""
    }

    UX; COULD // target="_blank" — maybe site conf val? [site_conf_vals]
    // Then don't forget  noopener
    // Sync w browser side code [0PVLN].
    def noPreviewHtmlSt(classAtrVal: St = ""): St =
      s"""<p><a href="$safeUrlInAtr" rel="nofollow"$classAtrVal>$safeUrlInTag</a></p>"""

    // Allow hash frag, so can #post-123 link to specific posts. [int_ln_hash]
    val unsafeUri = Validation.parseUri(unsafeUrl, allowQuery = true, allowHash = true)
          .getOrIfBad { _ =>
      return noPreviewHtmlSt()
    }

    linkPreviewRenderer.fetchRenderSanitizeInstantly(unsafeUri, inline = false) match {
      case RenderPreviewResult.NoPreview(errCode) =>
        // Incl any error code in a class="...", for the e2e testss.  [brkn_int_ln_pv]
        var cssClass = "c_LnPvNone"
        if (errCode.nonEmpty) cssClass += s"-$errCode"
        require(cssClass == safeEncodeForHtml(cssClass), "TyE52RAMDJ72")
        // This: s"...\"$var\"" results in a weird "value $ is not a member of String"
        // compilation error. So `+` instead.
        val safeHtml = noPreviewHtmlSt(" class=\"" + cssClass + "\"")
        preGendPlaceholder foreach { plh =>
          donePreviews.append(
                RenderPreviewResult.Done(PreviewResult(safeHtml = safeHtml), plh))
        }
        safeHtml
      case donePreview0: RenderPreviewResult.Done =>
        // Later, this will always (?) be the case, with Deno. But not Nashorn.
        val donePreview = preGendPlaceholder match {
          case Some(plh) => donePreview0.copy(placeholder = plh)
          case None => donePreview0
        }

        donePreviews.append(donePreview)
        // Return a placeholder because `donePreview.html` might be an iframe which would
        // be removed by the sanitizer. So replace the placeholder with the html later, when
        // the sanitizer has been run.  [block_ln_pvw_placeholder]
        donePreview.placeholder
      case pendingPreview: RenderPreviewResult.Loading =>
        // We cannot http fetch from external servers from here. That should have been
        // done already, and the results saved in link_previews_t.
        logger.warn(s"No cached preview for: '$unsafeUrl' [TyELNPV0CACH2]")
        noPreviewHtmlSt(" class=\"s_LnPvErr-NotCached\"")
    }
  }


  def replacePlaceholders(html: String): String = {
    var htmlWithBoxes = html
    for (donePreview <- donePreviews) {
      val isInline = donePreview.placeholder startsWith "LnPvId_Inl_"
      // The title placeholder ends with "_Ttl", the class attr with "_Cls".
      val titleSuffix = if (isInline) "_Ttl" else ""
      htmlWithBoxes = htmlWithBoxes.replace(
            donePreview.placeholder + titleSuffix,
            // Replace link title inside an <a>, or replace a whole
            // line with an <aside>....<a href=...>...:
            if (isInline)
              donePreview.result.safeTitleCont.getOrElse("TyELNPV_0TTL")
            else
              donePreview.result.safeHtml)
      if (isInline) {
        // Then also add a html class showing what happened. (If it's a block
        // link preiew, then that class is included inside the block already.)
        htmlWithBoxes = htmlWithBoxes.replace(
              donePreview.placeholder + "_Cls",
              donePreview.result.errCode.map("c_LnPvNone-" + _).getOrElse("c_LnPv-Inl"))
      }
    }
    htmlWithBoxes
  }

}


