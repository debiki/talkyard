/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package debiki.onebox

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{ReactRenderer, Globals}
import debiki.onebox.engines._
import javax.{script => js}
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.util.{Try, Success, Failure}



sealed abstract class RenderOnboxResult


object RenderOnboxResult {

  /** The URL is not to a trusted site, or the HTTP request failed, or whatever went wrong.
    */
  case object NoOnebox extends RenderOnboxResult

  /** If the onebox HTML was cached already, or if no HTTP request is needed to construct
    * the onebox.
    */
  case class Done(safeHtml: String, placeholder: String) extends RenderOnboxResult

  /** If we had to start a HTTP request to fetch the linked page and extract title and excerpt.
    */
  case class Loading(futureSafeHtml: Future[String], placeholder: String)
    extends RenderOnboxResult
}



abstract class OneboxEngine {

  def regex: scala.util.matching.Regex

  def cssClassName: String

  def handles(url: String): Boolean = regex matches url

  /** If an engine needs to include an iframe, then it'll have to sanitize everything itself,
    * because Google Caja's JsHtmlSanitizer (which we use) removes iframes.
    */
  protected def alreadySanitized = false

  final def loadRenderSanitize(url: String, javascriptEngine: Option[js.Invocable])
        : Future[String] = {
    def sanitizeAndWrap(html: String): String = {
      var safeHtml =
        if (alreadySanitized) html
        else ReactRenderer.sanitizeHtmlReuseEngine(html, javascriptEngine)
      // Don't link to any HTTP resources from safe HTTPS pages, e.g. don't link
      // to <img src="http://...">, change to https instead even if the image then breaks.
      // COULD leave <a href=...> HTTP links as is so they won't break. And also leave
      // plain text as is. But for now, this is safe and simple and stupid: (?)
      if (Globals.secure) {
        safeHtml = safeHtml.replaceAllLiterally("http:", "https:")
      }
      s"""<aside class="onebox $cssClassName clearfix">$safeHtml</aside>"""
    }
    // futureHtml.map apparently isn't executed directly, even if the future has been
    // completed already.
    val futureHtml = loadAndRender(url)
    if (futureHtml.isCompleted) {
      Future.fromTry(futureHtml.value.get.map(sanitizeAndWrap))
    }
    else {
      futureHtml.map(sanitizeAndWrap)
    }
  }

  protected def loadAndRender(url: String): Future[String]

  def sanitizeUrl(url: String) = org.owasp.encoder.Encode.forHtml(url)

}


abstract class InstantOneboxEngine extends OneboxEngine {

  protected def loadAndRender(url: String) =
    Future.fromTry(renderInstantly(url))

  protected def renderInstantly(url: String): Try[String]
}


/** What is onebox? If you post a comment that contains a link in a paragraph of its own,
  * and the link is to a trusted site, onebox will create a short snippet of the linked page,
  * for example, a title and short excerpt of a Wikipedia article, or a video player
  * if you link to YouTube.
  *
  * This usually requires the server to download the linked page from the target website,
  * and extract the relevant parts. When rendering client side, the client sends a request
  * to the server and asks it to create a onebox. We create oneboxes server side, so that we'll
  * be able to re-render comments server side, should this be needed for whatever reason.
  *
  * Inspired by Discourse's onebox, see: https://meta.discourse.org/t/what-is-a-onebox/4546
  *
  * The name comes from Google's search result box in which they sometimes show a single
  * answer directly.
  */
object Onebox {

  private val logger = play.api.Logger
  private val pendingRequestsByUrl = mutable.HashMap[String, Future[String]]()
  private val oneboxHtmlByUrl = mutable.HashMap[String, String]()
  private val failedUrls = mutable.HashSet[String]()
  private val PlaceholderPrefix = "onebox-"
  private val NoEngineException = new DebikiException("DwE3KEF7", "No matching onebox engine")

  private val engines = Seq[OneboxEngine](
    new ImageOnebox,
    new VideoOnebox,
    new GiphyOnebox,
    new YouTubeOnebox)


  def loadRenderSanitize(url: String, javascriptEngine: Option[js.Invocable])
        : Future[String] = {
    for (engine <- engines) {
      if (engine.handles(url))
        return engine.loadRenderSanitize(url, javascriptEngine)
    }
    Future.failed(NoEngineException)
  }


  def loadRenderSanitizeInstantly(url: String, javascriptEngine: Option[js.Invocable])
        : RenderOnboxResult = {
    def placeholder = PlaceholderPrefix + nextRandomString()

    val futureSafeHtml = loadRenderSanitize(url, javascriptEngine)
    if (futureSafeHtml.isCompleted)
      return futureSafeHtml.value.get match {
        case Success(safeHtml) => RenderOnboxResult.Done(safeHtml, placeholder)
        case Failure(throwable) => RenderOnboxResult.NoOnebox
      }

    // Later: Have waitForDownloadsToFinish() return when all futures completed,
    // and remember the resulting html so placeholders can be replaced. And cache it.
    futureSafeHtml onComplete {
      case Success(safeHtml) =>
      case Failure(throwable) =>
    }

    RenderOnboxResult.Loading(futureSafeHtml, placeholder)
  }

}



/** Used when rendering oneboxes from inside Javascript code run by Nashorn.
  */
class InstantOneboxRendererForNashorn {

  private val pendingDownloads: ArrayBuffer[RenderOnboxResult.Loading] = ArrayBuffer()
  private val doneOneboxes: ArrayBuffer[RenderOnboxResult.Done] = ArrayBuffer()

  // Should be set to the Nashorn engine that calls this class, so that we can call
  // back out to the same engine, when sanitizing html, so we won't have to ask for
  // another engine, that'd create unnecessarily many engines.
  var javascriptEngine: Option[js.Invocable] = None

  def renderAndSanitizeOnebox(unsafeUrl: String): String = {
    lazy val safeUrl = org.owasp.encoder.Encode.forHtml(unsafeUrl)
    if (!Globals.isInitialized) {
      // Also see the comment for ReactRenderer.startCreatingRenderEngines()
      return o"""<p style="color: red; outline: 2px solid orange; padding: 1px 5px;">
           Broken onebox for: <a>$safeUrl</a>. Nashorn called out to Scala code
           that uses old stale class files and apparently the wrong classloader (?)
           so singletons are created a second time when inside Nashorn and everything
           is broken. To fix this, restart the server (CTRL+D + run), and edit and save
           this comment again. This problem happens only when Play Framework
           soft-restarts the server in development mode. [DwE4KEPF72]</p>"""
    }

    Onebox.loadRenderSanitizeInstantly(unsafeUrl, javascriptEngine) match {
      case RenderOnboxResult.NoOnebox =>
        s"""<a href="$safeUrl">$safeUrl</a>"""
      case doneOnebox: RenderOnboxResult.Done =>
        doneOneboxes.append(doneOnebox)
        // Return a placeholder because `doneOnebox.html` might be an iframe which would
        // be removed by the sanitizer. So replace the placeholder with the html later, when
        // the sanitizer has been run.
        doneOnebox.placeholder
      case pendingOnebox: RenderOnboxResult.Loading =>
        pendingDownloads.append(pendingOnebox)
        pendingOnebox.placeholder
    }
  }

  def waitForDownloadsToFinish() = ??? // and make pendingDownloads thread safe if needed
                                      // and assert javascriptEngine has been reset to None

  def replacePlaceholders(html: String): String = {
    dieIf(pendingDownloads.nonEmpty, "DwE4FKEW3", "Not implemented: Waiting for oneboxes to load")
    var htmlWithBoxes = html
    for (doneOnebox <- doneOneboxes) {
      htmlWithBoxes = htmlWithBoxes.replace(doneOnebox.placeholder, doneOnebox.safeHtml)
    }
    htmlWithBoxes
  }

}


