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

package debiki.onebox   // RENAME to talkyard.server.linkpreviews.LinkPreviewRenderer

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{Globals, TextAndHtml}
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
  case class Done(safeHtml: String, placeholder: String) extends RenderPreviewResult

  /** If we sent a HTTP request to download a preview, e.g. an oEmbed request.
    */
  case class Loading(futureSafeHtml: Future[String], placeholder: String)
    extends RenderPreviewResult
}



class RenderPreviewParams(
  val siteId: SiteId,
  val unsafeUrl: String,
  val inline: Boolean,
  val requesterId: UserId,
  val mayHttpFetch: Boolean,
  val loadPreviewFromDb: String => Option[LinkPreview],
  val savePreviewInDb: LinkPreview => Unit)



case class LinkPreviewProblem(
  unsafeProblem: String, unsafeUrl: String, errorCode: String)



/** Renders link previews for one type of links — e.g. YouTube,
  * or Reddit, or maybe generic oEmed links.
  *
  * COULD remove param globals, and incl only precisely what's needed?
  */
abstract class LinkPreviewRenderEngine(globals: Globals) extends TyLogging {  CLEAN_UP // move to its own file?

  def regex: Regex =
    die("TyE603RKDJ35", "Please implement 'handles(url): Boolean' or 'regex: Regex'")

  def providerName: Option[String]

  def extraLnPvCssClasses: String

  def handles(url: String): Boolean = regex matches url

  /** If an engine needs to include an iframe or any "uexpected thing",
    * then it'll have to sanitize everything itself, because
    * TextAndHtml.sanitizeRelaxed() removes iframes and other uexpected things.
    */
  protected def alreadySanitized = false

  /** An engine can set this to true, to get iframe-sandboxed instead of
    * html-sanitized.
    */
  protected def sandboxInIframe = false

  /** By default, we add a "View at (provider name)" link below the link preview.
    */
  protected def addViewAtLink = true

  // (?:...) is a non-capturing group.  (for local dev search: /-/u/ below.)
  private def makeUploadsLinkRegexStr(q: Char) = s"=$q" +
        """(?:(?:(?:https?:)?//[^/]+)?/-/(?:u|uploads/public)/)([a-zA-Z0-9/\._-]+)""" + q

  private val uploadsLinkRegexSingleQuote: Regex = makeUploadsLinkRegexStr('\'').r
  private val uploadsLinkRegexDoubleQuote: Regex = makeUploadsLinkRegexStr('"').r


  private def pointUrlsToCdn(safeHtml: String): String = {
    val prefix = globals.config.cdn.uploadsUrlPrefix getOrElse {
      return safeHtml
    }

    // What if this is a link to *another* Talkyard site, which uses a different
    // CDN or no CDN? Then shouldn't point the links to our CDN. Harmless today, 2020-07.
    BUG; FIX_AFTER // 2021-01 Skip links with different pub site id or origin. [cdn_nls]

    SEC_TESTS_MISSING // Better keep single / double quote style — otherwise, look:
    //    <div attr=" ='upl-url' > <script>alert(1)</script>">
    // would become:
    //    <div attr=" ="upl-url" > <script>alert(1)</script>">
    // looks as if that could have been an xss vuln?
    var result = uploadsLinkRegexSingleQuote.replaceAllIn(safeHtml, s"""='$prefix$$1'""")
    result = uploadsLinkRegexDoubleQuote.replaceAllIn(result, s"""="$prefix$$1"""")
    result
  }


  final def fetchRenderSanitize(urlAndFns: RenderPreviewParams): Future[String] = {

    // ----- Any cached preview?

    // This prevents pg storage DoS.  [ln_pv_netw_err]
    COULD_OPTIMIZE // As Redis key, use a url hash, so shorter?
    val redisCache = new RedisCache(urlAndFns.siteId, globals.redisClient, globals.now)
    redisCache.getLinkPreviewSafeHtml(urlAndFns.unsafeUrl) foreach { safeHtml =>
      SHOULD // if preview broken *and* if (urlAndFns.mayHttpFetch):
      // retry, although cache entry still here.
      // E.g. was netw err,
      // but at most X times per minute? Otherwise return the cached broken html.
      return Future.successful(safeHtml)
    }

    // ----- Http fetch preview

    // Or generate instantly.

    val futureHtml: Future[String Or LinkPreviewProblem] = loadAndRender(urlAndFns)

    // ----- Sanitize

    def sanitizeAndWrap(htmlOrError: String Or LinkPreviewProblem): String = {
      // <aside> class:    s_LnPv (-Err)    means Link Preview (Error)
      // <aside><a> class: s_LnPv_L (-Err)  means the actual <a href=..> link

      var safeHtml = htmlOrError match {
        case Bad(problem) =>
          LinkPreviewHtml.safeProblem(unsafeProblem = problem.unsafeProblem,
                unsafeUrl = urlAndFns.unsafeUrl, errorCode = problem.errorCode)
        case Good(maybeUnsafeHtml) =>
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

      // But also need to add rel="noopener" (or "noopener"), so any
      // target="_blank" linked page cannot access window.opener and change
      // it's location to e.g. a phishing site, e.g.:
      //    window.opener.location = 'https://www.example.com';
      //
      // https://web.dev/external-anchors-use-rel-noopener/
      //  when you use target="_blank", always add rel="noopener" or rel="noopener"
      //
      // Extra security check:
      DO_AFTER // 2020-11-01 remove this extra check.
      // This might break previews with '_blank' in any text / description loaded
      // via OpenGraph or html tags — but Talkyard doesn't support that yet,
      // so, for now, this is fine:
      if (!sandboxInIframe && safeHtml.contains("_blank")
            && !safeHtml.contains("noopener")
            && !this.isInstanceOf[InternalLinkPrevwRendrEng]) {
        logger.warn(s"Forgot to add noopener to _blank link: ${urlAndFns.unsafeUrl
              } [TyEFORGTNORFR]")
        return <pre>{"Talkyard bug: _blank but no 'noopener' [TyE402RKDHF46]:\n" +
                  safeHtml}</pre>.toString
      }

      SECURITY; SHOULD // do with Jsoup, from TextAndHtml.sanitizeRelaxed, [cdn_nls]
      // or a  fix-links  fn if sanitized already.

      // Don't link to any HTTP resources from safe HTTPS pages, e.g. don't link  [1BXHTTPS]
      // to <img src="http://...">, change to https instead even if the image then breaks.
      // COULD leave <a href=...> HTTP links as is so they won't break. And also leave
      // plain text as is. But for now, this is safe and simple and stupid: (?)
      if (globals.secure) {
        safeHtml = safeHtml.replaceAllLiterally("http:", "https:")
      }
      safeHtml = pointUrlsToCdn(safeHtml)

      val lnPvErr = if (htmlOrError.isBad) "s_LnPv-Err " else ""

      BUG // here urlAndFns.unsafeUrl won't point to the CDN? Doesn't really matter [cdn_nls]
      safeHtml = LinkPreviewHtml.safeAside(   // [lnpv_aside]
            safeHtml = safeHtml, extraLnPvCssClasses = lnPvErr + extraLnPvCssClasses,
            unsafeUrl = urlAndFns.unsafeUrl, unsafeProviderName = providerName,
            addViewAtLink = addViewAtLink)

      redisCache.putLinkPreviewSafeHtml(urlAndFns.unsafeUrl, safeHtml)
      safeHtml
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
        : Future[String Or LinkPreviewProblem]

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
        : Future[String Or LinkPreviewProblem] = {
    Future.successful(renderInstantly(urlAndFns.unsafeUrl))
  }

  protected def renderInstantly(unsafeUrl: String): String Or LinkPreviewProblem
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

  private val PlaceholderPrefix = "onebox-"
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

  def fetchRenderSanitize(url: String, inline: Boolean): Future[String] = {
    require(url.length <= MaxUrlLength, s"Too long url: $url TyE53RKTKDJ5")
    unimplementedIf(inline, "TyE50KSRDH7")

    def loadPreviewFromDatabase(downloadUrl: String): Option[LinkPreview] = {
      // Don't create a write tx — could cause deadlocks, because unfortunately
      // we might be inside a tx already: [nashorn_in_tx] (will fix later)
      val siteDao = globals.siteDao(siteId)
      siteDao.readTx { tx =>
        tx.loadLinkPreviewByUrl(linkUrl = url, downloadUrl = downloadUrl)
      }
    }

    for (engine <- engines) {
      if (engine.handles(url)) {
        val args = new RenderPreviewParams(
              siteId = siteId,
              unsafeUrl = url,
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


  def fetchRenderSanitizeInstantly(url: String, inline: Boolean): RenderPreviewResult = {
    // Don't throw, this might be in a background thread.

    if (url.length > MaxUrlLength)
      return RenderPreviewResult.NoPreview

    def placeholder = PlaceholderPrefix + nextRandomString()

    val futureSafeHtml = fetchRenderSanitize(url, inline)
    if (futureSafeHtml.isCompleted)
      return futureSafeHtml.value.get match {
        case Success(safeHtml) => RenderPreviewResult.Done(safeHtml, placeholder)
        case Failure(throwable) => RenderPreviewResult.NoPreview
      }

    RenderPreviewResult.Loading(futureSafeHtml, placeholder)
  }

}


object LinkPreviewRenderer {
  val MaxUrlLength = 470  // link_url_c max len is 500
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
    */
  def renderAndSanitizeOnebox(unsafeUrl: String): String = {
    lazy val safeUrl = org.owasp.encoder.Encode.forHtml(unsafeUrl)
    val inline = false // for now

    if (!globals.isInitialized) {
      // Also see the comment for Nashorn.startCreatingRenderEngines()
      return o"""<p style="color: red; outline: 2px solid orange; padding: 1px 5px;">
           Broken onebox for: <a>$safeUrl</a>. Nashorn called out to Scala code
           that uses old stale class files and apparently the wrong classloader (?)
           so singletons are created a second time when inside Nashorn and everything
           is broken. To fix this, restart the server (CTRL+D + run), and edit and save
           this comment again. This problem happens only when Play Framework
           soft-restarts the server in development mode. [DwE4KEPF72]</p>"""
    }

    linkPreviewRenderer.fetchRenderSanitizeInstantly(unsafeUrl, inline = inline) match {
      case RenderPreviewResult.NoPreview =>
        UX; COULD // target="_blank" — maybe site conf val? [site_conf_vals]
        // Then don't forget  noopener
        s"""<a href="$safeUrl" rel="nofollow">$safeUrl</a>"""
      case donePreview: RenderPreviewResult.Done =>
        donePreviews.append(donePreview)
        // Return a placeholder because `doneOnebox.html` might be an iframe which would
        // be removed by the sanitizer. So replace the placeholder with the html later, when
        // the sanitizer has been run.
        donePreview.placeholder
      case pendingPreview: RenderPreviewResult.Loading =>
        // We cannot http fetch from external servers from here. That should have been
        // done already, and the results saved in link_previews_t.
        logger.warn(s"No cached preview for: '$unsafeUrl' [TyE306KUT5]")
        i"""
          |<!-- No cached preview -->
          |<a href="$safeUrl" rel="nofollow" class="s_LnPvErr">$safeUrl</a>"""
    }
  }


  def replacePlaceholders(html: String): String = {
    var htmlWithBoxes = html
    for (donePreview <- donePreviews) {
      htmlWithBoxes = htmlWithBoxes.replace(donePreview.placeholder, donePreview.safeHtml)
    }
    htmlWithBoxes
  }

}


