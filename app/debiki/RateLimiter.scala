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
import com.github.benmanes.caffeine
import debiki.DebikiHttp.throwTooManyRequests
import io.efdi.server.http.DebikiRequest
import java.util.concurrent.atomic.AtomicReference
import RateLimits._



object RateLimiter {

  /** Don't place this cache in Redis because 1) the rate limiter should be really fast,
    * not do any calls to other processes. And 2) it's just fine if sometimes a bit too
    * many requests are allowed, because they hit different rate limit caches on different
    * app servers.
    */
  private val timestampsCache: caffeine.cache.Cache[String, TimestampsHolder] =
    caffeine.cache.Caffeine.newBuilder()
    .maximumSize(100*1000)
    .build()

  private val VeryLongAgo: UnixTime = 0


  /** Could perhaps use a thread safe circle buffer instead? But then I would
    * have to think about what happens if it changes whilst I'm iterating over it,
    * and I would have to think about how much memory it might use?
    * Or use AtomicIntegerArray? Is that faster than cloning which I do now?
    */
  private class TimestampsHolder(ts: Array[UnixTime]) {
    val timestamps = new AtomicReference(ts)
  }


  def rateLimit(rateLimits: RateLimits, request: DebikiRequest[_]) {
    if (request.user.exists(_.isAdmin))
      return

    if (rateLimits.isUnlimited(isNewUser = false))
      return

    if (io.efdi.server.http.hasOkE2eTestPassword(request.underlying))
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
    val roleIdOrIp = request.user.flatMap(_.anyMemberId).map(request.siteId + "|" + _)
      .getOrElse(request.ip)
    val key = s"$roleIdOrIp|${rateLimits.key}"

    var timestampsHolder: TimestampsHolder =
      timestampsCache.get(key, new java.util.function.Function[String, TimestampsHolder] {
        override def apply(key: String) = makeCacheItem(key, rateLimits)
      })


    var requestTimestamps: Array[UnixTime] = timestampsHolder.timestamps.get

    // If the rate limits have been changed, we need a new properly sized cache elem.
    if (requestTimestamps.length != rateLimits.numRequestsToRemember(isNewUser = false)) {
      timestampsHolder = makeCacheItem(key, rateLimits)
      timestampsCache.put(key, timestampsHolder)
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


  private def makeCacheItem(key: String, rateLimits: RateLimits): TimestampsHolder = {
    require(rateLimits != NoRateLimits, "DwE293Z14")
    val numRequestsToRemember = rateLimits.numRequestsToRemember(isNewUser = false)
    val oldTimestamps = Array.fill[UnixTime](numRequestsToRemember)(VeryLongAgo)
    new TimestampsHolder(oldTimestamps)
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
        o"""You (or someone else) have ${rateLimits.what} too many times today.
           Please try again tomorrow. [DwE42KJ2]"""
      else if (rateLimits.maxPerFifteenMinutes <= numRequestsLast15Minutes)
        o"""You (or someone else) have ${rateLimits.what} too many times. Please try again after
           fifteen minutes. [DwE8IJF4]"""
      else if (rateLimits.maxPerFifteenSeconds <= numRequestsLast15Seconds)
        o"""You (or someone else) have ${rateLimits.what} quickly too many times. Please try
           again after fifteen seconds. [DwE35BG8]"""
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


