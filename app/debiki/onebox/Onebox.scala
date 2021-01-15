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

package debiki.onebox   // RENAME QUICK to talkyard.server.linkpreviews.LinkPreviewRenderer

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml, TextAndHtmlMaker, JsoupLinkElems}
import debiki.onebox.engines._
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
  case object NoPreview extends RenderPreviewResult

  /** If a preview was cached already (in link_previews_t),
    * or no external HTTP request needed.
    */
  case class Done(result: PreviewResult, placeholder: String) extends RenderPreviewResult

  /** If we sent a HTTP request to download a preview, e.g. an oEmbed request.
    */
  case class Loading(futureSafeHtml: Future[PreviewResult], placeholder: String)
    extends RenderPreviewResult
}



class RenderPreviewParams(
  val siteId: SiteId,
  val fromPageId: PageId,
  val unsafeUri: j_URI,
  val inline: Bo,
  val requesterId: UserId,
  val mayHttpFetch: Bo,
  val loadPreviewFromDb: St => Opt[LinkPreview],
  val savePreviewInDb: LinkPreview => U) {

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


object PreviewResult {
  val Nothing: PreviewResult = PreviewResult(safeHtml = "")
  def error(errCode: St): PreviewResult = Nothing.copy(errCode = Some(errCode))
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
  unsafeUrl: St,
  errorCode: St)



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
  def tweakLinks(htmlSt: St, toHttps: Bo, uploadsUrlCdnPrefix: Opt[St],
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
      tweakedUrl = uploadsUrlCdnPrefix match {
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


  final def fetchRenderSanitize(urlAndFns: RenderPreviewParams): Future[PreviewResult] = {

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
        return Future.successful(PreviewResult(safeHtml = safeHtml))
      }
      redisCache
    }

    // ----- Http fetch preview

    // Or generate instantly.

    val futureHtml: Future[PreviewTitleHtml Or LinkPreviewProblem] =
          loadAndRender(urlAndFns)

    // ----- Sanitize

    def sanitizeAndWrap(previewOrProblem: PreviewTitleHtml Or LinkPreviewProblem)
          : PreviewResult = {

      // <aside> class:    s_LnPv (-Err)    means Link Preview (Error)
      // <aside><a> class: s_LnPv_L (-Err)  means the actual <a href=..> link
      var anyErrCode: Opt[ErrCode] = None
      var followLinksSkipNoopener = false

      val safeHtmlMaybeBadLinks = previewOrProblem match {
        case Bad(problem) =>
          anyErrCode = Some(problem.errorCode)
          LinkPreviewHtml.safeProblem(unsafeProblem = problem.unsafeProblem,
                unsafeUrl = urlAndFns.unsafeUrl, errorCode = problem.errorCode)
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

      // Don't link to insecure HTTP resources from safe HTTPS pages,  [no_insec_emb]
      // e.g. don't link to <img src="http://...">. Change to https instead — even if
      // the image/whatever then breaks; security is more important, plus, browsers
      // show security warnings if there are insecure http resources in an
      // https-secure page.
      // And make uploaded files links point to any CDN, and add 'noopener' if needed.
      val safeHtmlOkLinks = LinkPreviewRenderer.tweakLinks(
            safeHtmlMaybeBadLinks,
            toHttps = globals.secure,
            uploadsUrlCdnPrefix = globals.config.cdn.uploadsUrlPrefix,
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

      PreviewResult(
            safeTitleCont = previewOrProblem.toOption.flatMap(_.safeTitleCont),
            classAtr = inlineClasses,
            safeHtml = safeHtmlWrapped,
            errCode = anyErrCode)
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
  val siteId: SiteId,
  val mayHttpFetch: Boolean,
  val requesterId: UserId) extends TyLogging {

  import LinkPreviewRenderer._

  private val PlaceholderPrefix = "c_LnPv-"
  private val NoEngineException = new DebikiException("DwE3KEF7", "No matching preview engine")

  COULD_OPTIMIZE // These are, or can be made thread safe — no need to recreate all the time.
  private val engines = Seq[LinkPreviewRenderEngine](
    new InternalLinkPrevwRendrEng(globals, siteId),
    new ImagePrevwRendrEng(globals),
    new VideoPrevwRendrEng(globals),
    new GiphyPrevwRendrEng(globals),
    new YouTubePrevwRendrEng(globals),
    new TelegramPrevwRendrEng(globals),
    new TikTokPrevwRendrEng(globals, siteId, mayHttpFetch),
    new TwitterPrevwRendrEng(globals, siteId, mayHttpFetch),

    // After 2020-10-24, Facebook requires an API access key to link to Facebook
    // via OEmbed. Short of time, will need to disable Facebook   [fb_insta_dis]
    // for now then:  (incl Instagram)
    // See https://developers.facebook.com/docs/plugins/oembed
    // and https://developers.facebook.com/docs/instagram/oembed
    /*
    new FacebookPostPrevwRendrEng(globals, siteId, mayHttpFetch),
    new FacebookVideoPrevwRendrEng(globals, siteId, mayHttpFetch),
    new InstagramPrevwRendrEng(globals, siteId, mayHttpFetch),
    */
    new RedditPrevwRendrEng(globals, siteId, mayHttpFetch),
    )

  def fetchRenderSanitize(uri: j_URI, inline: Bo): Future[PreviewResult] = {
    val url = uri.toString
    require(url.length <= MaxUrlLength, s"Too long url: $url TyE53RKTKDJ5")

    def loadPreviewFromDatabase(downloadUrl: String): Option[LinkPreview] = {
      // Don't create a write tx — could cause deadlocks, because unfortunately
      // we might be inside a tx already: [nashorn_in_tx] (will fix later)
      val siteDao = globals.siteDao(siteId)
      siteDao.readTx { tx =>
        tx.loadLinkPreviewByUrl(linkUrl = url, downloadUrl = downloadUrl)
      }
    }

    for (engine <- engines) {
      if (engine.handles(uri, inline = inline)) {
        val args = new RenderPreviewParams(
              siteId = siteId,
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
    val siteDao = globals.siteDao(siteId)
    siteDao.writeTx { (tx, _) =>
      COULD // refresh pages that include this link preview, add to [staleStuff].
      tx.upsertLinkPreview(linkPreview)
    }
  }


  def fetchRenderSanitizeInstantly(uri: j_URI, inline: Bo): RenderPreviewResult = {
    // Don't throw, this might be in a background thread.

    if (uri.toString.length > MaxUrlLength)
      return RenderPreviewResult.NoPreview

    def placeholder: St = PlaceholderPrefix + nextRandomString()

    val result: Future[PreviewResult] = fetchRenderSanitize(uri, inline = inline)
    if (result.isCompleted)
      return result.value.get match {
        case Success(safeHtml) => RenderPreviewResult.Done(safeHtml, placeholder)
        case Failure(throwable) => RenderPreviewResult.NoPreview
      }

    RenderPreviewResult.Loading(result, placeholder)
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
  def renderAndSanitizeInlineLinkPreview(unsafeUrl: St): St = {
    import play.api.libs.json.{Json, JsString}

    // Allow hash frag, so can #post-123 link to specific posts. [int_ln_hash]
    val unsafeUri = Validation.parseUri(unsafeUrl, allowQuery = true, allowHash = true)
          .getOrIfBad { _ =>
      return Json.obj("errCode" -> JsString("TyELNPVURL")).toString
    }

    val result = linkPreviewRenderer.fetchRenderSanitizeInstantly(
          unsafeUri, inline = true) match {
      case RenderPreviewResult.NoPreview =>
        // Fine.
        PreviewResult.Nothing
      case donePreview: RenderPreviewResult.Done =>
        donePreview.result
      case _: RenderPreviewResult.Loading =>
        PreviewResult.error(errCode = "TyELNPV0CACH1")
    }

    val resultSt = Json.obj(  // ts: InlineLinkPreview
          "safeTitleCont" -> JsString(result.safeTitleCont.getOrElse("")),
          "classAtr" -> JsString(result.classAtr)).toString
          // Not needed here:  safeHtml, errCode

    resultSt
  }


  def renderAndSanitizeBlockLinkPreview(unsafeUrl: St): St = {
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
      case RenderPreviewResult.NoPreview =>
        noPreviewHtmlSt()
      case donePreview: RenderPreviewResult.Done =>
        donePreviews.append(donePreview)
        // Return a placeholder because `doneOnebox.html` might be an iframe which would
        // be removed by the sanitizer. So replace the placeholder with the html later, when
        // the sanitizer has been run.
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
      htmlWithBoxes = htmlWithBoxes.replace(
            donePreview.placeholder, donePreview.result.safeHtml)
    }
    htmlWithBoxes
  }

}


