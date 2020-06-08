/**
 * Copyright (c) 2015, 2020 Kaj Magnus Lindberg
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
import scala.concurrent.duration._
import RenderContentService._
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import scala.concurrent.ExecutionContext
import talkyard.server.TyLogger


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

  case class RegenerateStaleHtml(
    nextPageIds: Seq[PageIdToRerender] = Nil,
    idsLoadedAt: When = When.Genesis)

  object PauseThreeSeconds

}


/** Send this actor a SitePageId and it'll regenerate and update cached content html
  * for that page. Otherwise, it continuously keeps looking for any out-of-date cached
  * content html and makes them up-to-date.
  */
class RenderContentActor(
  val globals: Globals,
  val nashorn: Nashorn) extends Actor {

  private val logger = TyLogger("RenderContentActor")

  def execCtx: ExecutionContext = globals.executionContext

  var avgMillisToBackgroundRender: Double = 50

  var pauseUntilNanos: Option[Long] = None

  var numBackgroundRenderErrorsInARow = 0

  override def receive: Receive = {
    case PauseThreeSeconds =>
      // Would be better with just [one-db-writer], then woudn't need this.
      pauseUntilNanos = Some(System.nanoTime() + 3L * 1000L * 1000L * 1000L)

    // COULD SECURITY DoS attack: Want to enqueue this case last-in-first-out, per page & params, so won't
    // rerender the page more than once, even if is in the queue many times (with different hashes).
    // Can that be done with Akka actors in some simple way?
    case (sitePageId: SitePageId, customParamsAndHash: Option[PageRenderParamsAndHash]) =>
      // The page has been modified, or accessed and was out-of-date. [4KGJW2]
      // Or edited, and uncached, and now being rerendered (no render params). [7BWTWR2]
      try {
        rerenderContentHtmlUpdateCache(sitePageId, customParamsAndHash)
      }
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          logger.warn(o"""Cannot render a got-message-about page,
               database connection closed [DwE4YKF2]""")
        case throwable: Throwable =>
          logger.error("Error rendering one got-message-about page [DwE5KGP0]", throwable)
      }

    case RegenerateStaleHtml(nextPageIds: Seq[PageIdToRerender], idsLoadedAt) =>
      val nanosBeore = System.nanoTime()
      val shallPause = pauseUntilNanos exists { untilNanos =>
        if (nanosBeore < untilNanos) true
        else {
          pauseUntilNanos = None
          false
        }
      }

      var nextRerenderMessage: Option[RegenerateStaleHtml] = None

      if (shallPause) {
        // Forget nextPageIds; we'll lookup pages again.
        context.system.scheduler.scheduleOnce(1.second, self, RegenerateStaleHtml())(execCtx)
      }
      else try {
        val (anyError, remainingIds, remainingLoadedAt) =
              findAndUpdateOneOutOfDatePage(nextPageIds, idsLoadedAt)

        nextRerenderMessage = Some(RegenerateStaleHtml(remainingIds, remainingLoadedAt))
        if (anyError.isDefined) {
          numBackgroundRenderErrorsInARow += 1
        }
        else {
          numBackgroundRenderErrorsInARow = 0
          val nanosAfter = System.nanoTime()
          val millisElapsedNow: Double = math.max(0, (nanosAfter - nanosBeore) / 1000 / 1000).toDouble
          val difference = millisElapsedNow - avgMillisToBackgroundRender
          avgMillisToBackgroundRender = avgMillisToBackgroundRender + difference * 0.15d
        }
      }
      catch {
        case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
          logger.warn("Cannot render out-of-date page, database connection closed [DwE8GK7W]")
        case throwable: Throwable =>
          if (!globals.isOrWasTest)
            logger.error("Error rendering one out-of-date page [DwE6GUK02]", throwable)
      }
      finally {
        if (globals.testsDoneServerGone) {
          logger.debug("Tests done, server gone. Stopping background rendering. [EsM5KG3]")
        }
        else {
          val message = nextRerenderMessage getOrElse RegenerateStaleHtml()
          val seemsNothingToDo = message.nextPageIds.isEmpty
          // Typically takes 5 - 50 millis to render a page (my core i7 laptop, released 2015).
          // However, a Google Compute Engine 2 vCPU VPS spiked the CPU to 80-90%, when
          // waiting 100ms between each page. Anyway, let's try to not use more than 50% of
          // the CPU by waiting with the next page, for as long as it took to render
          // the last pages, on average?
          var millisToPause = math.max(50, avgMillisToBackgroundRender.toLong)
          if (numBackgroundRenderErrorsInARow > 5) {
            // This almost certainly isn't recoverable. Source code bug.
            logger.warn(o"""Slowing down background rendering: There are errors, and
                  don't want to fill the disks with error log messages. Retrying once
                  every 30 seconds. [TyE5WKBAQ25]""")
            millisToPause = 30 * 1000
          }
          else if (seemsNothingToDo) {
            // Then wait a bit — so we won't run the find-pages-to-render query
            // so often; that could put the CPU under a bit high load (like, 40%
            // on a 2 virtual cores VPS, in Google Cloud, 2020-06). [rerndr_qry]
            // 50 ms —> 45% - 50% 1 core CPU, just to run the query, in a Docker
            // container on my core i7 (released 2015).
            // 1000 ms —> 10-13% CPU instead.
            millisToPause = 2000  // and 2000 ms —> 2-12%  [205RMTD4]
          }
          context.system.scheduler.scheduleOnce(
                millisToPause.millis, self, message)(execCtx)
        }
      }
  }


  private def rerenderContentHtmlUpdateCache(sitePageId: SitePageId,
        customParamsAndHash: Option[PageRenderParamsAndHash]): Boolean Or ErrorMessage = {
    try {
      renderImpl(sitePageId, customParamsAndHash)
    }
    catch {
      case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
        logger.warn("Cannot render page, database connection closed [DwE5YJK1]")
        Bad("Database connection closed [TyE5YJK2]")
      case ex: Exception =>
        logger.error(s"Error rerendering page $sitePageId [DwE2WKP4]", ex)
        Bad("Exception [TyE5YJK5KQ3]")
    }
  }


  private def renderImpl(sitePageId: SitePageId, anyCustomParams: Option[PageRenderParamsAndHash])
      : Boolean Or ErrorMessage = {

    // COULD add Metrics that times this.

    val dao = globals.siteDao(sitePageId.siteId)
    logger.debug(s"Background rendering ${sitePageId.toPrettyString}, $anyCustomParams... [TyMBGRSTART]")

    // If we got custom params, rerender only for those params (maybe other param combos = up-to-date).
    anyCustomParams foreach { paramsHash =>
      val result = renderIfNeeded(
        sitePageId, paramsHash.pageRenderParams, dao, Some(paramsHash.reactStoreJsonHash))
      if (result == Good(true)) {
        dao.removePageFromMemCache(sitePageId, Some(paramsHash.pageRenderParams))
      }
      return result
    }

    val isEmbedded = dao.getPageMeta(sitePageId.pageId).exists(_.pageType == PageType.EmbeddedComments)

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

    var result = renderIfNeeded(sitePageId, renderParams, dao, freshStoreJsonHash = None)
    if (result.isBad)
      return result

    // Render for medium width.
    val mediumParams = renderParams.copy(widthLayout = WidthLayout.Medium)
    result = renderIfNeeded(sitePageId, mediumParams, dao, freshStoreJsonHash = None)
    if (result.isBad)
      return result

    // Remove cached whole-page-html, so we'll generate a new page (<html><head> etc) that
    // includes the new content we generated above. [7UWS21]
    if (result == Good(true)) {
      dao.removePageFromMemCache(sitePageId)
    }

    result
  }


  /** Returns Good(true-iff-was-rerendered) or Bad(ErrorMessage).
    */
  private def renderIfNeeded(sitePageId: SitePageId, renderParams: PageRenderParams, dao: SiteDao,
      freshStoreJsonHash: Option[String]): Boolean Or ErrorMessage = {

    // ----- Is still out-of-date?

    // There might be many threads and servers that re-render this page, so although it was
    // out of date a short while ago, maybe now it's been rerendered already. [205RMTD4]

    val cachedAndCurrentVersions =
          globals.systemDao.loadCachedPageVersion(sitePageId, renderParams)

    val isOutOfDate = cachedAndCurrentVersions match {
      case None => true
      case Some((cachedHtmlVersion, currentPageVersion)) =>
        cachedHtmlVersion.siteVersion != currentPageVersion.siteVersion ||
        cachedHtmlVersion.pageVersion != currentPageVersion.pageVersion ||
        cachedHtmlVersion.appVersion != globals.applicationVersion ||
        freshStoreJsonHash.isSomethingButNot(cachedHtmlVersion.reactStoreJsonHash)
    }

    if (!isOutOfDate) {
      logger.debug(o"""Page ${sitePageId.pageId} site ${sitePageId.siteId}
             is up-to-date, ignoring re-render message. [DwE4KPL8]""")
      return Good(false)
    }

    // ----- Do render page

    val toJsonResult = dao.jsonMaker.pageToJson(sitePageId.pageId, renderParams)
    val newHtml = nashorn.renderPage(toJsonResult.reactStoreJsonString) match {
      case Good(html) => html
      case bad @ Bad(errorMessage) =>
      // The error has been logged already.
      logger.error(s"Error rendering ${sitePageId.toPrettyString} [TyEBGRERR]")
      return bad
    }

    dao.readWriteTransaction { tx =>
      tx.upsertCachedPageContentHtml(
        sitePageId.pageId, toJsonResult.version, toJsonResult.reactStoreJsonString, newHtml)
    }

    val whichPage = sitePageId.toPrettyString
    val width = (if (renderParams.widthLayout == WidthLayout.Tiny) "tiny" else "medium") + " width"
    val embedded = if (renderParams.isEmbedded) ", embedded" else ""
    val custom = if (freshStoreJsonHash.isDefined) ", custom" else ""
    logger.debug(o"""Background rendered $whichPage, $width$embedded$custom [TyMBGRDONE]""")

    Good(true)
  }


  private def findAndUpdateOneOutOfDatePage(
        remainingPageIds: Seq[PageIdToRerender], remainingLoadedAt: When)
        : (Option[ErrorMessage], Seq[PageIdToRerender], When) = {

    val now = globals.now()
    val (nextIdsToRerender: Seq[PageIdToRerender], nextLoadedAt) =
          // Refresh the pages-to-rerender after some seconds. We do an extra
          // up-to-date check anyway. [205RMTD4]
          if (remainingPageIds.nonEmpty && now.millisSince(remainingLoadedAt) < 2500) {
            (remainingPageIds, remainingLoadedAt)
          }
          else {
            // These queries are a bit slow [rerndr_qry], so find many pages at once.
            val max = 50
            val nextIds = globals.systemDao.loadPageIdsToRerender(max)
            val howMany = nextIds.length + (if (nextIds.length >= max) "+" else "")
            logger.debug(s"Found $howMany pages to rerender: $nextIds [TyMBGRFIND]")
            (nextIds, now)
          }

    if (nextIdsToRerender.isEmpty)
      return (None, Nil, now)

    val toRerender = nextIdsToRerender.head
    val result = rerenderContentHtmlUpdateCache(
          toRerender.sitePageId, customParamsAndHash = None)

    val anyError = if (result.isBad) Some(result.swap.get) else None
    (anyError, nextIdsToRerender.tail, nextLoadedAt)
  }

}
