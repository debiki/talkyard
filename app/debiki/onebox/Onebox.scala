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
import debiki.Globals
import debiki.onebox.engines.VideoOnebox
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.util.{Success, Failure}



sealed abstract class RenderOnboxResult


object RenderOnboxResult {

  /** The URL is not to a trusted site, or the HTTP request failed, or whatever went wrong.
    */
  case object NoOnebox extends RenderOnboxResult

  /** If the onebox HTML was cached already, or if no HTTP request is needed to construct
    * the onebox.
    */
  case class DoneDirectly(html: String) extends RenderOnboxResult

  /** If we had to start a HTTP request to fetch the linked page and extract title and excerpt.
    */
  case class Loading(futureHtml: Future[String], placeholder: String)
    extends RenderOnboxResult
}



abstract class OneboxEngine {
  def regex: scala.util.matching.Regex
  def handles(url: String): Boolean = regex matches url
  def downloadAndRender(url: String): Future[String]
}


abstract class InstantOneboxEngine extends OneboxEngine{
  def downloadAndRender(url: String) = Future.successful(renderInstantly(url))
  def renderInstantly(url: String): String
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
  */
object Onebox {

  private val logger = play.api.Logger
  private val pendingRequestsByUrl = mutable.HashMap[String, Future[String]]()
  private val oneboxHtmlByUrl = mutable.HashMap[String, String]()
  private val failedUrls = mutable.HashSet[String]()
  private val PlaceholderPrefix = "onebox-"
  private val NoEngineException = new DebikiException("DwE3KEF7", "No onebox engine")

  private val engines = Seq[OneboxEngine](
    new VideoOnebox)


  def loadAndRender(url: String): Future[String] = {
    for (engine <- engines) {
      if (engine.handles(url))
        return engine.downloadAndRender(url)
    }
    /*
    // For now:
    Future.successful(
      s"<div style='background:cyan;'>inited: ${debiki.Globals.isInitialized} Java_Onebox: $url</div>")
      */
    Future.failed(NoEngineException)
  }


  def loadAndRenderInstantly(url: String): RenderOnboxResult = {
    val futureResult = loadAndRender(url)
    if (futureResult.isCompleted)
      return futureResult.value.get match {
        case Success(html) => RenderOnboxResult.DoneDirectly(html)
        case Failure(throwable) => RenderOnboxResult.NoOnebox
      }

    val placeholder = PlaceholderPrefix + nextRandomString()

    futureResult onComplete {
      case Success(html) =>
      case Failure(html) =>
    }

    RenderOnboxResult.Loading(futureResult, placeholder)
  }

}



/** Used when rendering oneboxes from inside Javascript code run by Nashorn.
  */
class InstantOneboxRendererForNashorn {

  private val pendingDownloads: ArrayBuffer[RenderOnboxResult.Loading] = ArrayBuffer()

  /** The returned HTML is sanitized in `sanitizeOneboxHtml` in onebox-markdown-it-plugin.js.
    */
  def renderOnebox(url: String): String = {
    if (!Globals.isInitialized) {
      // Also see the comment for ReactRenderer.startCreatingRenderEngines()
      return o"""<p style="color: red; outline: 2px solid orange; padding: 1px 5px;">
           Broken onebox for: <a>$url</a>. Nashorn called out to Scala code
           that uses old stale class files and apparently the wrong classloader (?)
           so singletons are created a second time when inside Nashorn and everything
           is broken. To fix this, restart the server (CTRL+D + run), and edit and save
           this comment again. This problem happens only when Play Framework
           soft-restarts the server in development mode. [DwE4KEPF72]</p>"""
    }

    Onebox.loadAndRenderInstantly(url) match {
      case RenderOnboxResult.NoOnebox =>
        // Return null, we're in Javascript land.
        null
      case RenderOnboxResult.DoneDirectly(oneboxHtml) =>
        oneboxHtml
      case pendingDownload @ RenderOnboxResult.Loading(futureHtml, placeholder) =>
        pendingDownloads.append(pendingDownload)
        placeholder
    }
  }

  def waitForDownloadsToFinish() = ???

  def replacePlaceholders(html: String): String = {
    dieIf(pendingDownloads.nonEmpty, "DwE4FKEW3", "Not implemented: Replacing Onebox placeholders")
    html
  }

}


