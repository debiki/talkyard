/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import CachingDao.{CacheKey, CacheValueIgnoreVersion}


/** Returns an empty watchbar. Only the CachingWatchbarDao does something useful.
  *
  * I don't want to save watchbars in PostgreSQL because that'd mean 1 db write request per
  * forum member & page view (because the recent topics list in the watchbar gets updated
  * whenever the user visits a new page).
  */
trait WatchbarDao {
  self: SiteDao =>

  def loadWatchbar(userId: UserId) = BareWatchbar.empty

  def saveWatchbar(userId: UserId, watchbar: Watchbar) {}

  def fillInWatchbarTitlesEtc(watchbar: BareWatchbar): WatchbarWithTitles =
    ???

}



/** Stores in-memory each member's watchbar. Lost on server restart. Later: use Redis?
  * So won't vanish when the server restarts.
  */
trait CachingWatchbarDao extends WatchbarDao {
  self: CachingSiteDao with CachingPageStuffDao =>


  override def saveWatchbar(userId: UserId, watchbar: Watchbar) {
    putInCache(
      key(userId),
      CacheValueIgnoreVersion(watchbar))
  }


  override def loadWatchbar(userId: UserId): BareWatchbar = {
    lookupInCache[BareWatchbar](
      key(userId),
      ignoreSiteCacheVersion = true) getOrElse BareWatchbar.empty
  }


  override def fillInWatchbarTitlesEtc(watchbar: BareWatchbar): WatchbarWithTitles = {
    val pageStuffById = loadPageStuff(watchbar.watchedPageIds)
    watchbar.addTitlesEtc(pageStuffById)
  }


  private def key(userId: UserId) = CacheKey(siteId, s"$userId|Watchbar")

}


