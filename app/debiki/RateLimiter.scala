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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.throwTooManyRequests
import net.sf.ehcache.{Element => EhcacheElement}
import java.util.concurrent.atomic.AtomicReference
import requests.DebikiRequest
import RateLimits._



object RateLimiter {

  private val ehcache: net.sf.ehcache.Cache = {
    val cache = buildCache()
    net.sf.ehcache.CacheManager.create().addCache(cache)
    cache
  }

  private val VeryLongAgo: UnixTime = 0


  /** Could perhaps use a thread safe circle buffer instead? But then I would
    * have to think about what happens if it changes whilst I'm iterating over it,
    * and I would have to think about how much memory it might use?
    * Or use AtomicIntegerArray? Is that faster than cloning which I do now?
    */
  private class TimestampsHolder(ts: Array[UnixTime]) {
    val timestamps = new AtomicReference(ts)
  }


  private def buildCache() = {
    val config = new net.sf.ehcache.config.CacheConfiguration()
    config.setName("DebikiRateLimiter")
    // Let's out-of-memory die, and buy more memory, if needed.
    config.setMaxEntriesLocalHeap(0) // 0 means no limit
    new net.sf.ehcache.Cache(config)
  }


  def rateLimit(rateLimits: RateLimits, request: DebikiRequest[_]) {
    if (request.user.map(_.isAdmin) == Some(true))
      return

    if (rateLimits.isUnlimited(isNewUser = false))
      return

    if (rateLimits.noRequestsAllowed(isNewUser = false)) {
      val message =
        if (rateLimits.maxPerDay > 0)
          "You are a new user and not allowed to do this. Please wait one day. [DwE5KF2]"
        else
          "Doing this is currently not allowed. [DwE0EJH7]"
      throwTooManyRequests(message)
    }

    // If authenticated, the user gets his/her own rate limit entry, otherwise s/he
    // has to share resources with everyone on the same ip.
    val roleIdOrIp = request.user.flatMap(_.anyRoleId).map(request.siteId + "|" + _)
      .getOrElse(request.ip)
    val key = s"$roleIdOrIp|${rateLimits.key}"

    var elem: EhcacheElement = ehcache.get(key)
    if (elem eq null) {
      elem = createAndCacheNewCacheElem(key, rateLimits)
    }

    var timestampsHolder = elem.getObjectValue().asInstanceOf[TimestampsHolder]
    var requestTimestamps: Array[UnixTime] = timestampsHolder.timestamps.get

    // If the rate limits have been changed, we need a new properly sized cache elem.
    if (requestTimestamps.length != rateLimits.numRequestsToRemember(isNewUser = false)) {
      elem = createAndCacheNewCacheElem(key, rateLimits)
      timestampsHolder = elem.getObjectValue().asInstanceOf[TimestampsHolder]
      requestTimestamps = timestampsHolder.timestamps.get
    }

    val now: UnixTime = (request.ctime.getTime / 1000).toInt // change before year 2038

    throwIfTooManyRequests(rateLimits, now, requestTimestamps, key)

    // Ignore race conditions. Other parts of the architecture ought to ensure we
    // don't get to here more than at most a few times each second, for each key.
    // (Well, could use `timestampsHolder.timestamps.compareAndSet(updatedTimestamps)`
    // instead here, and throw Too Many Requests if it fails a few times.)
    val updatedTimestamps = copyAndAddCurrentTime(requestTimestamps, now)
    timestampsHolder.timestamps.set(updatedTimestamps)
  }


  private def createAndCacheNewCacheElem(key: String, rateLimits: RateLimits) = {
    require(rateLimits != NoRateLimits, "DwE293Z14")
    val numRequestsToRemember = rateLimits.numRequestsToRemember(isNewUser = false)
    val oldTimestamps = Array.fill[UnixTime](numRequestsToRemember)(VeryLongAgo)
    val elem = new EhcacheElement(key, new TimestampsHolder(oldTimestamps))
    elem.setEternal(true)
    elem.setTimeToIdle(rateLimits.numSecondsToRemember)
    ehcache.put(elem)
    elem
  }


  def throwIfTooManyRequests(rateLimits: RateLimits, now: UnixTime,
        recentRequestTimestamps: Array[UnixTime], key: String) {

    var index = 0
    var numRequestsLast15Seconds = 0
    var numRequestsLast15Minutes = 0
    var numRequestsLastDay = 0
    while (index < recentRequestTimestamps.length) {
      val timestamp = recentRequestTimestamps(index)
      if (now - timestamp < 15) {
        numRequestsLast15Seconds += 1
      }
      if (now - timestamp < 15 * 60) {
        numRequestsLast15Minutes += 1
      }
      if (now - timestamp < 24 * 3600) {
        numRequestsLastDay += 1
      }
      index += 1
    }

    // Use <= not < so we count the current request too.
    // COULD consider `isNewUser`.
    var errorMessage =
      if (rateLimits.maxPerDay <= numRequestsLastDay)
        o"""You (or someone else) have ${rateLimits.what}. Please try again tomorrow. [DwE42KJ2]"""
      else if (rateLimits.maxPerFifteenMinutes <= numRequestsLast15Minutes)
        o"""You (or someone else) have ${rateLimits.what}. Please try again after
           fifteen minutes. [DwE8IJF4]"""
      else if (rateLimits.maxPerFifteenSeconds <= numRequestsLast15Seconds)
        o"""You (or someone else) have ${rateLimits.what}. Please try again after
           fifteen seconds. [DwE35BG8]"""
      else
        return

    if (Globals.securityComplaintsEmailAddress.isDefined)
      errorMessage += "\n\n" + o"""
        If you feel this message is in error, you can email us and tell us what you
        attempted to do, and include the error message shown above.
        Then we can try to change the security settings so that they will work for you.""" +
        s"\n\nEmail: ${Globals.securityComplaintsEmailAddress.get}"


    play.api.Logger.debug(s"Rate limiting ${classNameOf(rateLimits)} for key: $key [DwM429RLMT]")
    throwTooManyRequests(errorMessage)
  }


  def copyAndAddCurrentTime(timestampsToCopy: Array[UnixTime], now: UnixTime): Array[UnixTime] = {
    val timestamps = timestampsToCopy.clone()
    var indexOfOldestTimestamp = 0
    var oldestTimestamp = Int.MaxValue
    var index = 0
    while (index < timestamps.length) {
      if (timestamps(index) < oldestTimestamp) {
        indexOfOldestTimestamp = index
        oldestTimestamp = timestamps(index)
      }
      index += 1
    }
    alwaysAssert(indexOfOldestTimestamp < timestamps.length, "DwE2QJK4")
    timestamps(indexOfOldestTimestamp) = now
    timestamps
  }

}


