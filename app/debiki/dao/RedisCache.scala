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

import akka.util.ByteString
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.Globals
import redis.RedisClient
import redis.api.Limit
import scala.concurrent._
import scala.concurrent.duration._


object RedisCache {
  def forSite( siteId: SiteId, redisClient: RedisClient) = new RedisCache(siteId, redisClient)
}



class RedisCache(val siteId: SiteId, private val redis: RedisClient) {

  // Is 3 times faster than String.toInt, according to the parseInt() docs.
  import _root_.redis.protocol.ParseNumber.parseInt

  // Sometimes the request takes long, perhaps because of a Java GC pause? Or because of
  // some page being swapped to disk?
  val DefaultTimeout = 10 seconds


  def loadWatchbar(userId: UserId): Option[BareWatchbar] = {
    val futureString: Future[Option[ByteString]] = redis.get(watchbarKey(siteId, userId))
    val anyString: Option[ByteString] =
      try Await.result(futureString, DefaultTimeout)
      catch {
        case _: TimeoutException => die("EsE5GK2F9", "Redis timeout")
      }
    anyString.map(s => BareWatchbar.fromCompactString(s.utf8String))
  }


  def saveWatchbar(userId: UserId, watchbar: Watchbar) {
    redis.set(watchbarKey(siteId, userId), watchbar.toCompactBareWatchbarString)
  }


  def markUserOnlineRemoveStranger(userId: UserId, browserIdData: BrowserIdData) {
    // Could do this in a transaction. Barely matters.
    redis.zadd(usersOnlineKey(siteId), Globals.now().toDouble -> userId)
    redis.zrem(strangersOnlineByIpKey(siteId), browserIdData.ip)
  }


  def markUserOffline(userId: UserId) {
    redis.zrem(usersOnlineKey(siteId), userId)
    // As of now we don't know if the user left, or if s/he is still online.
    // Let's assume s/he left — so don't add any stranger-online here.
    // (SECURITY Hmm, is it a privacy issue, if one sees user X online, and then X goes
    // offline but the stranger counter changes from say 1 to 2? Then "everyone"
    // sees that X is in fact still online, although s/he went offline.
    // How solve that? Perhaps show a num-strangers interval, like "less than 5 online"
    // or "around 10 strangers online", "around 20", "around 100", but no exact numbers?)
  }


  def markStrangerOnline(browserIdData: BrowserIdData) {
    // Could consider browser id cookie too (instead of just ip), but then take care
    // to avoid DoS attacks if someone generates 9^99 unique ids and requests.
    redis.zadd(strangersOnlineByIpKey(siteId), Globals.now().toDouble -> browserIdData.ip)
  }


  def loadOnlineUserIds(): (Seq[UserId], Int) = {
    removeNoLongerOnlineUserIds()
    val idStringsFuture: Future[Seq[ByteString]] = redis.zrange(usersOnlineKey(siteId), 0, -1)
    val idStrings: Seq[ByteString] =
      try Await.result(idStringsFuture, DefaultTimeout)
      catch {
        case _: TimeoutException => die("EsE7YKFJ2", "Redis timeout")
      }
    val userIds = idStrings.map(parseInt)
    val numStrangersFuture: Future[Long] = redis.zcard(strangersOnlineByIpKey(siteId))
    val numStrangers = try Await.result(numStrangersFuture, DefaultTimeout)
      catch {
        case _: TimeoutException => die("EsE4GKF20W", "Redis timeout")
      }
    (userIds, numStrangers.toInt)
  }


  def removeNoLongerOnlineUserIds() {
    // Could make the time set:table, for tests. But for now:
    val aWhileAgo = Globals.now().minusMinutes(10).toDouble
    redis.zremrangebyscore(usersOnlineKey(siteId), Limit(0.0), Limit(aWhileAgo))
    redis.zremrangebyscore(strangersOnlineByIpKey(siteId), Limit(0.0), Limit(aWhileAgo))
  }


  def clearThisSite() {
    // Read more here: http://stackoverflow.com/questions/4006324/how-to-atomically-delete-keys-matching-a-pattern-using-redis
    // Latent BUG: This won't work if there're many Redis nodes — the keys should instead be sent as
    // arguments to 'del', so Redis can forward the delete requests to the correct nodes. [0GLKW24]
    redis.eval("return redis.call('del', unpack(redis.call('keys', ARGV[1])))", keys = Nil,
        args = Seq(s"$siteId-*"))
  }


  // Key names
  //-------------

  // Use fairly short key names because it's so boring to type many chars when debug-test
  // inspecting Redis via redis-cli.

  // All keys should be like:  <siteId>-
  // and then, if for a user: u<userId>-
  // e.g.  3-u456-w = site 3, user 456, then 'w' (watchbar).

  private def watchbarKey(siteId: SiteId, userId: UserId) = s"$siteId-u$userId-w"

  private def usersOnlineKey(siteId: SiteId) = s"$siteId-uo"
  private def strangersOnlineByIpKey(siteId: SiteId) = s"$siteId-soip"

}

