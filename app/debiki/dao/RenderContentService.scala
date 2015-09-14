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
import debiki.{ReactJson, ReactRenderer}


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

}


class RenderContentActor(val daoFactory: SiteDaoFactory) extends Actor {

  override def receive: Receive = {
    case sitePageId: SitePageId =>
      // TODO don't rerender a page many times if it hasn't changed inbetween.
      rerenderContentHtmlUpdateCache(sitePageId)
      uncacheOldWholePageHtml(sitePageId)
  }

  private def rerenderContentHtmlUpdateCache(sitePageId: SitePageId) {
    val dao = daoFactory.newSiteDao(sitePageId.siteId)
    val storeJson = ReactJson.pageToJson(sitePageId.pageId, dao).toString()
    val contentHtml = ReactRenderer.renderPage(storeJson)
    CachingDao.putInCache(
      CachingRenderedPageHtmlDao.renderedContentKey(sitePageId),
      // TODO do uncache all cached content for the whole site if needed.
      // Use a low priority queue for this?
      CachingDao.CacheValueIgnoreVersion(contentHtml))
  }

  private def uncacheOldWholePageHtml(sitePageId: SitePageId) {
    CachingDao.removeFromCache(
      CachingRenderedPageHtmlDao.renderedPageKey(sitePageId))
  }

}
