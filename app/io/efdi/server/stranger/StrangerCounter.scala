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

package io.efdi.server.stranger

import com.debiki.core._
import com.debiki.core.Prelude._
import scala.collection.mutable


class StrangerCounter {

  val TenMinutesInMillis = 10 * OneMinuteInMillis

  // Could consider browser id cookie too (instead of just ip), but then take care
  // to avoid DoS attacks if someone generates 9^99 unique ids and requests.
  private val lastSeenByBrowserBySite =
    mutable.HashMap[SiteId, mutable.LinkedHashMap[IpAddress, When]]()

  def getLastSeenByBrowser(siteId: SiteId) =
    lastSeenByBrowserBySite.getOrElseUpdate(siteId,
      // Use a LinkedHashMap because iteration order = insertion order.
      mutable.LinkedHashMap[IpAddress, When]())


  def addStranger(siteId: SiteId, browserIdData: BrowserIdData) {
    val lastSeenByBrowser = getLastSeenByBrowser(siteId)
    // Remove and add back this ip, so it'll appear last during iteration.
    lastSeenByBrowser.remove(browserIdData.ip)
    lastSeenByBrowser.put(browserIdData.ip, When.now())
  }


  def removeStranger(siteId: SiteId, browserIdData: BrowserIdData) {
    val lastSeenByBrowser = getLastSeenByBrowser(siteId)
    lastSeenByBrowser.remove(browserIdData.ip)
  }


  def countStrangers(siteId: SiteId): Int = {
    val lastSeenByBrowser = lastSeenByBrowserBySite.getOrElse(siteId, {
      return 0
    })
    lastSeenByBrowser.size
  }


  def deleteOldStrangers() {
    val now = When.now()
    for (lastSeenByBrowser <- lastSeenByBrowserBySite.values) {
      // LinkedHashMap iteration order = insertion order, so we'll find all old entries directly.
      lastSeenByBrowser removeWhileValue { lastSeenAt =>
        now.millisSince(lastSeenAt) > TenMinutesInMillis
      }
    }
  }
}
