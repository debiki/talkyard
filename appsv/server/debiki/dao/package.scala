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

package debiki

import com.debiki.core._
import com.github.benmanes.caffeine
import play.api.libs.json.JsArray


package object dao {

  type DaoMemCache = caffeine.cache.Cache[String, DaoMemCacheAnyItem]

  case class MemCacheItem[A](
    value: A,
    siteCacheVersion: Long)

  type DaoMemCacheAnyItem = MemCacheItem[Any]


  REFACTOR; COULD_OPTIMIZE // change DaoMemCache so there's one per site!  [mem_cache_per_site]
  // Instead of indexing by s"$siteId|...key....".
  //
  case class MemCacheKey(siteId: SiteId, rest: String) {
    override def toString = s"$siteId|$rest"
  }

  def MemCacheKeyAnySite(value: String): MemCacheKey =
    MemCacheKey(siteId = NoSiteId, value)

  def MemCacheValueIgnoreVersion[A](value: A): MemCacheItem[A] =
    MemCacheItem(value, MemCache.IgnoreSiteCacheVersion)


  type UsersOnlineCache = caffeine.cache.Cache[SiteId, UsersOnlineStuff]

  case class UsersOnlineStuff(
    users: Seq[Participant],
    usersJson: JsArray,
    numStrangers: Int)

}

