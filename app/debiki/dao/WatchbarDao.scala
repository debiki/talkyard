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
import com.debiki.core.Prelude._


/** Returns an empty watchbar. Only the CachingWatchbarDao does something useful.
  *
  * I don't want to save watchbars in PostgreSQL because that'd mean 1 db write request per
  * forum member & page view (because the recent topics list in the watchbar gets updated
  * whenever the user visits a new page).
  */
trait WatchbarDao {
  self: SiteDao with PageStuffDao =>


  def getOrCreateWatchbar(userId: UserId): BareWatchbar = {
    // Hmm, double caching? Mem + Redis. This doesn't make sense? Let's keep it like this for
    // a while and see what'll happen. At least it's fast. And lasts across Play app restarts.
    memCache.lookup[BareWatchbar](
      key(userId),
      orCacheAndReturn = redisCache.loadWatchbar(userId) orElse Some({
        readOnlyTransaction { transaction =>
          val chatChannelIds = transaction.loadPageIdsUserIsMemberOf(
            userId, Set(PageRole.OpenChat, PageRole.PrivateChat))
          val directMessageIds = transaction.loadPageIdsUserIsMemberOf(userId, Set(PageRole.FormalMessage))
          BareWatchbar.withChatChannelAndDirectMessageIds(chatChannelIds, directMessageIds)
        }
      }),
      ignoreSiteCacheVersion = true) getOrDie "EsE4UYKF5"
  }


  /* BUG race conditions, if e.g. saveWatchbar & markPageAsUnreadInWatchbar called at the
  * same time. Could perhaps solve by creating a Watchbar actor that serializes access?
  */
  def saveWatchbar(userId: UserId, watchbar: Watchbar) {
    memCache.put(
      key(userId),
      MemCacheValueIgnoreVersion(watchbar))
    redisCache.saveWatchbar(userId, watchbar)
  }


  def markPageAsUnreadInWatchbar(userId: UserId, pageId: PageId) {
    val watchbar = getOrCreateWatchbar(userId)
    val newWatchbar = watchbar.markPageAsUnread(pageId)
    saveWatchbar(userId, newWatchbar)
  }


  def fillInWatchbarTitlesEtc(watchbar: BareWatchbar): WatchbarWithTitles = {
    val pageStuffById = getPageStuffById(watchbar.watchedPageIds)
    watchbar.addTitlesEtc(pageStuffById)
  }


  private def key(userId: UserId) = MemCacheKey(siteId, s"$userId|Watchbar")

}


