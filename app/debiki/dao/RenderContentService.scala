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

import akka.actor.{Actor, Props, ActorRef, ActorSystem}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{DatabaseUtils, Globals, ReactJson, ReactRenderer}
import debiki.Globals.{testsDoneServerGone, wasTest}
import play.{api => p}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global
import RenderContentService._


/** Renders page contents using React.js and Nashorn. Is done in background threads
  * because rendering large pages might take many seconds.
  */
object RenderContentService {

  /** PERFORMANCE COULD create one thread/actor per processor instead.
    */
  def startNewActor(actorSystem: ActorSystem, daoFactory: SiteDaoFactory): ActorRef = {
    actorSystem.actorOf(
      Props(new RenderContentActor(daoFactory)),
      name = s"RenderContentActor")
  }

  object RegenerateStaleHtml

}


/** Send this actor a SitePageId and it'll regenerate and update cached content html
  * for that page. Otherwise, it continuously keeps looking for any out-of-date cached
  * content html and makes them up-to-date.
  */
class RenderContentActor(val daoFactory: SiteDaoFactory) extends Actor {

  override def receive: Receive = {
    case sitePageId: SitePageId =>
      // The page has been modified, or accessed and was out-of-date. [4KGJW2]
      // There might be many threads and servers that re-render this page.
      try {
        if (isStillOutOfDate(sitePageId)) {
          rerenderContentHtmlUpdateCache(sitePageId)
        }
        else {
          p.Logger.debug(o"""Page ${sitePageId.pageId} site ${sitePageId.siteId}
             is up-to-date, ignoring re-render message. [DwE4KPL8]""")
        }
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
          if (!wasTest)
            p.Logger.error("Error rendering one out-of-date page [DwE6GUK02]", throwable)
      }
      finally {
        if (testsDoneServerGone) {
          p.Logger.debug("Tests done, server gone. Stopping background rendering pages. [EsM5KG3]")
        }
        else {
          context.system.scheduler.scheduleOnce(333 millis, self, RegenerateStaleHtml)
        }
      }
  }


  private def isStillOutOfDate(sitePageId: SitePageId): Boolean = {
    val (cachedVersion, currentVersion) =
      Globals.systemDao.loadCachedPageVersion(sitePageId) getOrElse {
        return true
      }
    // We don't have any hash of any up-to-date data for this page, so we cannot use
    // cachedVersion.dataHash. Instead, compare site and page version numbers.
    // (We might re-render a little bit too often.)
    cachedVersion.siteVersion != currentVersion.siteVersion ||
      cachedVersion.pageVersion != currentVersion.pageVersion ||
      cachedVersion.appVersion != Globals.applicationVersion
  }


  private def rerenderContentHtmlUpdateCache(sitePageId: SitePageId) {
    try doRerenderContentHtmlUpdateCache(sitePageId)
    catch {
      case ex: java.sql.SQLException if DatabaseUtils.isConnectionClosed(ex) =>
        p.Logger.warn("Cannot render page, database connection closed [DwE5YJK1]")
      case ex: Exception =>
        p.Logger.error(s"Error rerendering page $sitePageId [DwE2WKP4]", ex)
    }
  }


  private def doRerenderContentHtmlUpdateCache(sitePageId: SitePageId) {
    // COULD add Metrics that times this.
    p.Logger.debug(s"Background rendering ${sitePageId.toPrettyString} [DwM7KGE2]")
    val dao = daoFactory.newSiteDao(sitePageId.siteId)
    val (json, pageVersion, _) = ReactJson.pageToJson(sitePageId.pageId, dao)
    val html = ReactRenderer.renderPage(json) getOrElse {
      p.Logger.error(s"Error rendering ${sitePageId.toPrettyString} [DwE5KJG2]")
      return
    }

    val wasSaved = dao.readWriteTransaction { transaction =>
      transaction.saveCachedPageContentHtmlPerhapsBreakTransaction(
        sitePageId.pageId, pageVersion, html)
    }

    var message = s"...Done background rendering ${sitePageId.toPrettyString}. [DwM2YGH9]"
    if (!wasSaved) {
      message += " Couldn't save it though — something else saved it first."
    }
    p.Logger.debug(message)

    // Remove cached whole-page-html, so we'll generate a new page with the new content.
    dao.removeFromMemCache(
      RenderedPageHtmlDao.renderedPageKey(sitePageId))
  }


  private def findAndUpdateOneOutOfDatePage() {
    val pageIdsToRerender = Globals.systemDao.loadPageIdsToRerender(1)
    for (toRerender <- pageIdsToRerender) {
      rerenderContentHtmlUpdateCache(toRerender.sitePageId)
    }
  }

}
