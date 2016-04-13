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

  // COULD rename to DaoMemCacheItem
  case class CacheValue[A](value: A, siteCacheVersion: Long)

  type DaoMemCacheAnyItem = CacheValue[Any]

}

