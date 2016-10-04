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

package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import debiki.Globals
import debiki.Xsrf
import io.efdi.server.http._
import play.api._
import play.api.libs.json.JsString
import redis.RedisClient
import scala.concurrent.Await
import scala.concurrent.duration._


/** Lets admins and super admins impersonate others, e.g. to troubleshoot some problem
  * that happens to a certain user only, or testing permission settings.
  */
object ImpersonateController extends mvc.Controller {

  val MaxBecomeOldUserSeconds = 3600
  val MaxKeyAgeSeconds = 3600
  private val ImpersonationCookieName = "esCoImp"
  private val FieldSeparator = '.'

  private def redis: RedisClient = Globals.redisClient
  val RedisTimeout = 5 seconds


  def makeImpersonateOtherSiteUrl(siteId: SiteId, userId: UserId) = SuperAdminGetAction { request =>
    val secretKey = nextRandomString()
    val value = s"$siteId$FieldSeparator$userId"
    Await.ready(redis.set(secretKey, value, exSeconds = Some(MaxKeyAgeSeconds)), RedisTimeout)
    val origin = Globals.siteByIdOrigin(siteId)
    val pathAndQuery = routes.ImpersonateController.impersonateWithKey(secretKey).url
    OkSafeJson(JsString(origin + pathAndQuery))
  }


  /** Don't use a hash of whatever and the server's secret value for this, because the
    * hash is included in the URL (this is a GET request) and could end up in a log file,
    * and in that way be leaked. — Instead, store a secret key in Redis, and delete it
    * immediately once used, so it cannot be used twice.
    *
    * (SECURITY could probably use <form action="other-site/-/impersonate"> with the key in
    * post data instead, then the key wouldn't appear in the URL at all.)
    */
  def impersonateWithKey(key: String) = GetActionIsLogin { request =>
    // Delete the key so no one else can use it, in case Mallory sees it in a log file.
    val redisTransaction = redis.transaction()
    val futureGetResult = redisTransaction.get[String](key)
    val futureDelResult = redisTransaction.del(key)
    redisTransaction.exec()

    val getResult: Option[String] = Await.result(futureGetResult, RedisTimeout)
    val theGetResult = getResult getOrElse {
      throwForbidden("EsE3UP8Z0", "Incorrect or expired key")
    }

    val delResult: Long = Await.result(futureDelResult, RedisTimeout)
    if (delResult != 1)
      throwForbidden("EsE8YKE23", s"Error deleting hash: deleted $delResult items, should be 1")

    dieIf(theGetResult.count(_ == FieldSeparator) != 1, "EsE7YKF22")
    val Array(siteId, userIdString) = theGetResult.split(FieldSeparator)
    val userId = userIdString.toInt

    if (siteId != request.siteId)
      throwForbidden("EsE8YKW3", s"Wrong site id: ${request.siteId}, should go to site $siteId")

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(siteId, userId)
    Redirect("/").withCookies(sidAndXsrfCookies: _*)
  }


  def impersonate(userId: UserId) = AdminGetAction { request =>
    val cookies = makeCookiesToImpersonate(request.siteId, userId, request.theUserId)
    Ok.withCookies(cookies: _*)
  }


  private def makeCookiesToImpersonate(siteId: SiteId, userId: UserId, currentUserId: UserId) = {
    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(siteId, userId)
    val randomString = nextRandomString()
    val unixSeconds = When.now().numSeconds
    val cookieValue = concatAndHash(currentUserId, unixSeconds, randomString)
    val impersonatingCookie = SecureCookie(name = ImpersonationCookieName,
      value = cookieValue, maxAgeSeconds = Some(MaxBecomeOldUserSeconds))
    impersonatingCookie :: sidAndXsrfCookies
  }


  def stopImpersonating = GetAction { request =>
    urlDecodeCookie(ImpersonationCookieName, request.underlying) match {
      case None =>
        LoginController.doLogout(request)
      case Some(cookieValue) =>
        val (secondsAgo, oldUserId) = throwIfBadHashElseGetAgeAndUserId(cookieValue)
        // Ignore old impersonation cookies, in case they're leaked somehow.
        if (secondsAgo > MaxBecomeOldUserSeconds || oldUserId == NoUserId) {
          LoginController.doLogout(request)
        }
        else {
          // Restore the old user id.
          val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(request.siteId, oldUserId)
          Ok.withCookies(sidAndXsrfCookies: _*)
            .discardingCookies(mvc.DiscardingCookie(ImpersonationCookieName))
        }
    }
  }


  private def concatAndHash(userId: UserId, unixSeconds: Long, randomString: String) = {
    val CFS = FieldSeparator
    val toHash = s"$userId$CFS$unixSeconds$CFS$randomString"
    val theHash = hashSha1Base64UrlSafe(toHash + CFS + Globals.applicationSecret)
    s"$toHash$CFS$theHash"
  }


  private def throwIfBadHashElseGetAgeAndUserId(value: String): (Long, UserId) = {
    val parts = value.split(FieldSeparator)
    if (parts.length != 4)
      throwForbidden(
        "EsE4YK82", s"Bad $ImpersonationCookieName cookie: ${parts.length} parts, not 4")

    val oldUserId = parts(0).toIntOrThrow("EsE8IKPW2", "Old user id is not a number")
    val unixSeconds = parts(1).toLongOrThrow("EsE4YK0W2", "Unix seconds is not a number")
    val randomString = parts(2)
    val correctCookieValue = concatAndHash(oldUserId, unixSeconds, randomString)
    if (value != correctCookieValue)
      throwForbidden("EsE6YKP2", s"Bad hash")

    val ageSeconds = When.now().numSeconds - unixSeconds
    (ageSeconds, oldUserId)
  }

}
