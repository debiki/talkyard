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

package debiki.dao

import akka.actor.{Actor, ActorRef, Props}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{DatabaseUtils, Globals, Nashorn}
import play.{api => p}
import scala.concurrent.duration._
import RenderContentService._
import scala.concurrent.ExecutionContext


/** Renders page contents using React.js and Nashorn. Is done in background threads
  * because rendering large pages might take a while.
  */
object RenderContentService {

  /** PERFORMANCE COULD create one thread/actor per processor instead.
    */
  def startNewActor(globals: Globals, nashorn: Nashorn): ActorRef = {
    globals.actorSystem.actorOf(
      Props(new RenderContentActor(globals, nashorn)),
      name = s"RenderContentActor")
  }

  object RegenerateStaleHtml

}


/** Send this actor a SitePageId and it'll regenerate and update cached content html
  * for that page. Otherwise, it continuously keeps looking for any out-of-date cached
  * content html and makes them up-to-date.
  */
class RenderContentActor(
  val globals: Globals,
  val nashorn: Nashorn) extends Actor {

  def execCtx: ExecutionContext = globals.executionContext


  override def receive: Receive = {
    case (sitePageId: SitePageId, customParams: Option[PageRenderParams]) =>
      // The page has been modified, or accessed and was out-of-date. [4KGJW2]
      try {
        rerenderContentHtmlUpdateCache(sitePageId, customParams)
      }
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          p.Logger.warn(o"""Cannot render a got-message-about page,
               database connection closed [DwE4YKF2]""")
        case throwable: Throwable =>
          p.Logger.error("Error rendering one got-message-about page [DwE5KGP0]", throwable)
      }
    case RegenerateStaleHtml =>
      try findAndUpdateOneOutOfDatePage()
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          p.Logger.warn("Cannot render out-of-date page, database connection closed [DwE8GK7W]")
        case throwable: Throwable =>
          if (!globals.isOrWasTest)
            p.Logger.error("Error rendering one out-of-date page [DwE6GUK02]", throwable)
      }
      finally {
        if (globals.testsDoneServerGone) {
          p.Logger.debug("Tests done, server gone. Stopping background rendering pages. [EsM5KG3]")
        }
        else {
          context.system.scheduler.scheduleOnce(100 millis, self, RegenerateStaleHtml)(execCtx)
        }
      }
  }


  private def rerenderContentHtmlUpdateCache(sitePageId: SitePageId,
        customParams: Option[PageRenderParams]) {
    try {
      renderImpl(sitePageId, customParams)
    }
    catch {
      case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
        p.Logger.warn("Cannot render page, database connection closed [DwE5YJK1]")
      case ex: Exception =>
        p.Logger.error(s"Error rerendering page $sitePageId [DwE2WKP4]", ex)
    }
  }


  private def renderImpl(sitePageId: SitePageId, anyCustomParams: Option[PageRenderParams]) {

    // COULD add Metrics that times this.

    val dao = globals.siteDao(sitePageId.siteId)
    p.Logger.debug(s"Background rendering ${sitePageId.toPrettyString} ... [TyMBGRSTART]")

    // If we got custom params, probably no need to also rerender for default params.
    anyCustomParams foreach { customParams =>
      renderIfNeeded(sitePageId, customParams, dao, isCustom = true)
      return
    }

    val isEmbedded = dao.getPageMeta(sitePageId.pageId).exists(_.pageRole == PageRole.EmbeddedComments)

    // Render for tiny width
    // A bit dupl code. [2FKBJAL3]
    // These render params must match the load-pages-to-rerender query [RERENDERQ], otherwise
    // the query will continue saying the page should be rerendered, forever.
    val renderParams = PageRenderParams(
      widthLayout = WidthLayout.Tiny,
      isEmbedded = isEmbedded,
      origin = dao.theSiteOrigin(),
      // Changing cdn origin requires restart, then mem cache disappears. So ok reuse anyCdnOrigin here.
      anyCdnOrigin = globals.anyCdnOrigin,
      // Requests with custom page root or page query, aren't cached. [5V7ZTL2]
      anyPageRoot = None,
      anyPageQuery = None)

    renderIfNeeded(sitePageId, renderParams, dao, isCustom = false)

    // Render for medium width.
    val mediumParams = renderParams.copy(widthLayout = WidthLayout.Medium)
    renderIfNeeded(sitePageId, mediumParams, dao, isCustom = false)

    // Remove cached whole-page-html, so we'll generate a new page (<html><head> etc) that
    // includes the new content we generated above. [7UWS21]
    dao.removePageFromMemCache(sitePageId)
  }


  private def renderIfNeeded(sitePageId: SitePageId, renderParams: PageRenderParams, dao: SiteDao,
      isCustom: Boolean) {

    // ----- Is still out-of-date?

    // There might be many threads and servers that re-render this page, so although it was
    // out of date a short while ago, now, fractions of a second later, maybe it's been
    // rerendered already.

    val cachedAndCurrentVersions = globals.systemDao.loadCachedPageVersion(sitePageId, renderParams)

    val isOutOfDate = cachedAndCurrentVersions match {
      case None => true
      case Some((cachedHtmlVersion, currentPageVersion)) =>
        // We don't have any hash of any up-to-date data for this page, so we cannot use
        // cachedVersion.reactStoreJsonHash. Instead, compare site and page version numbers.
        // (We might re-render a little bit too often.)
        cachedHtmlVersion.siteVersion != currentPageVersion.siteVersion ||
        cachedHtmlVersion.pageVersion != currentPageVersion.pageVersion ||
        cachedHtmlVersion.appVersion != globals.applicationVersion
    }

    if (!isOutOfDate) {
      p.Logger.debug(o"""Page ${sitePageId.pageId} site ${sitePageId.siteId}
             is up-to-date, ignoring re-render message. [DwE4KPL8]""")
      return
    }

    // ----- Do render page

    val toJsonResult = dao.jsonMaker.pageToJson(sitePageId.pageId, renderParams)
    val newHtml = nashorn.renderPage(toJsonResult.reactStoreJsonString) getOrElse {
      p.Logger.error(s"Error rendering ${sitePageId.toPrettyString} [TyEBGRERR]")
      return
    }

    dao.readWriteTransaction { tx =>
      tx.upsertCachedPageContentHtml(
        sitePageId.pageId, toJsonResult.version, toJsonResult.reactStoreJsonString, newHtml)
    }

    val whichPage = sitePageId.toPrettyString
    val width = (if (renderParams.widthLayout == WidthLayout.Tiny) "tiny" else "medium") + " width"
    val embedded = if (renderParams.isEmbedded) ", embedded" else ""
    val custom = if (isCustom) ", custom" else ""
    p.Logger.debug(o"""Background rendered $whichPage, $width$embedded$custom [TyMBGRDONE]""")
  }


  private def findAndUpdateOneOutOfDatePage() {
    val pageIdsToRerender = globals.systemDao.loadPageIdsToRerender(1)
    for (toRerender <- pageIdsToRerender) {
      rerenderContentHtmlUpdateCache(toRerender.sitePageId, customParams = None)
    }
  }

}
