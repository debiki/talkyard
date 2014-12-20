/**
 * Copyright (C) 2012-2014 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{util => ju}
import requests._
import scala.xml.NodeSeq
import CachingDao._



trait RenderedPageHtmlDao {
  self: SiteDao =>

  def renderTemplate(pageReq: PageRequest[_], appendToBody: NodeSeq = Nil): String =
    TemplateRenderer.renderTemplate(pageReq, appendToBody)

}



trait CachingRenderedPageHtmlDao extends RenderedPageHtmlDao {
  self: CachingSiteDao =>


  onPageSaved { sitePageId =>
    uncacheRenderedPage(sitePageId)
  }


  override def renderTemplate(pageReq: PageRequest[_], appendToBody: NodeSeq = Nil): String = {
    // Bypass the cache if the page doesn't yet exist (it's being created),
    // because in the past there was some error because non-existing pages
    // had no ids (so feels safer to bypass).
    var useCache = pageReq.pageExists
    useCache &= pageReq.pageRoot == Some(PageParts.BodyId)
    useCache &= pageReq.oldPageVersion.isEmpty
    useCache &= !pageReq.debugStats

    if (!useCache)
      return super.renderTemplate(pageReq)

    val key = _pageHtmlKey(SitePageId(siteId, pageReq.thePageId), origin = pageReq.host)
    lookupInCache(key, orCacheAndReturn = {
      rememberOrigin(pageReq.host)
      Some(super.renderTemplate(pageReq))
    }) getOrDie "DwE93IB7"
  }


  /**
   * Remembers (caches) origins via which this server has been accessed.
   * Sometimes a server is accessed via many addresses/origins,
   * e.g. www.debiki.com and localhost:9003 (SSH tunnel),
   * or https://www.debiki.com and http://www.debiki.com.
   */
  private def rememberOrigin(origin: String) {
    // The origin list should never change, so don't invalidate the origin list cache
    // item when the per site cache version changes. So use CacheValueIgnoreVersion.
    var done = false
    do {
      val originsKey = this.originsKey(siteId)
      lookupInCache[List[String]](originsKey) match {
        case None =>
          done = putInCacheIfAbsent(originsKey, CacheValueIgnoreVersion(List(origin)))
        case Some(knownOrigins) =>
          if (knownOrigins contains origin)
            return
          val newOrigins = origin :: knownOrigins
          done = replaceInCache(originsKey, CacheValueIgnoreVersion(knownOrigins),
            newValue = CacheValueIgnoreVersion(newOrigins))
      }
    }
    while (!done)
  }


  private def knownOrigins(siteId: SiteId): List[String] =
    lookupInCache[List[String]](originsKey(siteId)) getOrElse Nil


  private def uncacheRenderedPage(sitePageId: SitePageId) {
    // Since the server address might be included in the generated html,
    // we need to uncache pageId for each server address that maps
    // to the current website (this.tenantId).
    val origins = knownOrigins(sitePageId.siteId)
    for (origin <- origins) {
      removeFromCache(_pageHtmlKey(sitePageId, origin))
    }

    // BUG race condition: What if anotoher thread started rendering a page
    // just before the invokation of this function, and is finished
    // just after we've cleared the cache? Then that other thread will insert
    // a stale cache item. Could fix, by verifying that when you cache
    // something, the current version of the page is the same as the page
    // version when you started generating the cache value (e.g. started
    // rendering a page).
  }


  private def _pageHtmlKey(sitePageId: SitePageId, origin: String) =
    CacheKey(sitePageId.siteId, s"${sitePageId.pageId}|$origin|PageHtml")


  private def originsKey(siteId: SiteId) =
    CacheKey(siteId, "|PossibleOrigins") // "|" required by a debug check function

}

