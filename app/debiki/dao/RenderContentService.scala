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
import debiki.{Globals, ReactJson, ReactRenderer}
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
    val actorRef = actorSystem.actorOf(
      Props(new RenderContentActor(daoFactory)),
      name = s"RenderContentActor")
    actorSystem.scheduler.scheduleOnce(5 seconds, actorRef, RegenerateStaleHtml)
    actorRef
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
      if (isOutOfDate(sitePageId))
        rerenderContentHtmlUpdateCache(sitePageId)
    case RegenerateStaleHtml =>
      try {
        findAndUpdateOneOutOfDatePage()
      }
      finally {
        context.system.scheduler.scheduleOnce(333 millis, self, RegenerateStaleHtml)
      }
  }


  private def isOutOfDate(sitePageId: SitePageId): Boolean = {
    Globals.systemDao.isCachedContentHtmlStale(sitePageId)
  }


  private def rerenderContentHtmlUpdateCache(sitePageId: SitePageId) {
    // COULD add Metrics that times this.
    p.Logger.debug(s"Background rendering ${sitePageId.toPrettyString} [DwM7KGE2]")
    val dao = daoFactory.newSiteDao(sitePageId.siteId)
    val (storeJson, pageVersion) = ReactJson.pageToJson(sitePageId.pageId, dao)
    val html = ReactRenderer.renderPage(storeJson.toString())

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
    CachingDao.removeFromCache(
      CachingRenderedPageHtmlDao.renderedPageKey(sitePageId))
  }


  private def findAndUpdateOneOutOfDatePage() {
    val pageIdsToRerender = Globals.systemDao.loadPageIdsToRerender(1)
    for (toRerender <- pageIdsToRerender) {
      rerenderContentHtmlUpdateCache(toRerender.sitePageId)
    }
  }

}
