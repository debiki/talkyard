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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good, Or}
import play.api._
import play.api.mvc.{Action, ControllerComponents, Result => p_Result}
import redis.RedisClient
import scala.concurrent.Await
import scala.concurrent.duration._


/** 1) Lets admins and super admins impersonate others, e.g. to troubleshoot some problem
  * that happens to a certain user only, or testing permission settings.
  *
  * And 2) lets staff view the site, in read-only mode, as strangers, guests, normal members,
  * or member of some group. Only partly implemented (2017-01).
  */
class ImpersonateController @Inject()(cc: ControllerComponents, edContext: EdContext,
    LoginController: LoginController)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security._

  val MaxBecomeOldUserSeconds = 3600
  val MaxKeyAgeSeconds = 3600

  // This stuff is used client side too. [8AXFC0J2]
  private val ImpersonationCookieName = "esCoImp"
  private val FieldSeparator = '.'
  private val ViewAsGroupOnly = "VAO"
  private val ImpersonateRealUser = "IRU"

  private def redis: RedisClient = globals.redisClient
  private val RedisTimeout = 5 seconds


  def impersonateAtOtherSite(siteId: SiteId, userId: UserId, goToSiteById: Option[Boolean])
        : Action[Unit] = SuperAdminGetAction { request =>
    // Dupl code? Reuse /-/v0/login-with-secret instead?  [7AKBRW02]
    val secretKey = nextRandomString()
    val value = s"$siteId$FieldSeparator$userId"
    Await.ready(redis.set(secretKey, value, exSeconds = Some(MaxKeyAgeSeconds)), RedisTimeout)
    val origin =
      if (goToSiteById.is(true) || request.hostname.endsWith("localhost")) {
        globals.siteByIdOrigin(siteId)
      }
      else {
        val site = globals.systemDao.getSiteById(siteId)
        site.flatMap(globals.originOf) getOrElse globals.siteByIdOrigin(siteId)
      }
    val pathAndQuery = routes.ImpersonateController.impersonateWithKey(secretKey).url
    TemporaryRedirect(origin + pathAndQuery)
  }


  /** Don't use a hash of whatever and the server's secret value for this, because the
    * hash is included in the URL (this is a GET request) and could end up in a log file,
    * and in that way be leaked. — Instead, store a secret key in Redis, and delete it
    * immediately once used, so it cannot be used twice.
    *
    * (SECURITY could probably use <form action="other-site/-/impersonate"> with the key in
    * post data instead, then the key wouldn't appear in the URL at all.)
    */
  def impersonateWithKey(key: String): Action[Unit] = GetActionIsLogin { request =>
    // Dupl code? Reuse /-/v0/login-with-secret instead?  [7AKBRW02]

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
    val Array(siteIdString, userIdString) = theGetResult.split(FieldSeparator)
    val siteId = siteIdString.toIntOrThrow("EdE4KW02", s"Bad site id, not an Int: $siteIdString")
    val userId = userIdString.toInt

    if (siteId != request.siteId)
      throwForbidden("EsE8YKW3", s"Wrong site id: ${request.siteId}, should go to site $siteId")

    // ? mark as online ?
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request, userId)
    Redirect("/").withCookies(sidAndXsrfCookies: _*)
  }


  def impersonate(userId: UserId): Action[Unit] = AdminGetAction { request =>
    impersonateImpl(Some(userId), viewAsOnly = false, request)
  }


  def viewAsOther(userId: Int): Action[Unit] = StaffGetAction { request =>
    // Ensure userId is a group the requester has access to. Right now, there are no groups,
    // so only allow strangers, that is, the unknown user:
    val anyUserId =
      if (userId == NoUserId) None
      else {
        // For now
        throwForbidden("EdE5FK2AH6", "May only view as stranger")
      }
    impersonateImpl(anyUserId, viewAsOnly = true, request)
  }


  private def impersonateImpl(anyUserId: Opt[PatId], viewAsOnly: Bo,
        request: DebikiRequest[_]): p_Result = {

    // To view as another user, the session id should be amended so it includes info like:
    // "We originally logged in as Nnn and now we're viewing as Nnn2." And pages should be shown
    // only if _both_ Nnn and Nnn2 may view them. — Not yet implemented, only view-as-stranger
    // supported right now.
    dieIf(anyUserId.isDefined && viewAsOnly, "EdE6WKT0S")

    val sidAndXsrfCookies = anyUserId.toList flatMap { userId =>
      createSessionIdAndXsrfToken(request, userId)._3
    }

    val logoutCookies =
      if (anyUserId.isEmpty) DiscardingSessionCookies
      else Nil

    val impCookie = makeImpersonationCookie(request.siteId, viewAsOnly, request.theUserId)
    val newCookies = impCookie :: sidAndXsrfCookies

    request.dao.pubSub.unsubscribeUser(request.siteId, request.theRequester)

    // But don't subscribe to events for the user we'll be viewing the site as. Real
    // time events isn't the purpose of view-site-as.  The client should resubscribe
    // the requester to hens *own* notfs, once done impersonating, though.

    Ok.withCookies(newCookies: _*).discardingCookies(logoutCookies: _*)
  }


  private def makeImpersonationCookie(siteId: SiteId, viewAsGroupOnly: Boolean,
      currentUserId: UserId) = {
    val randomString = nextRandomString()
    val unixSeconds = globals.now().numSeconds
    val cookieValue = concatAndHash(currentUserId, viewAsGroupOnly = viewAsGroupOnly,
      unixSeconds, randomString)
    val impersonatingCookie = SecureCookie(name = ImpersonationCookieName,
      value = cookieValue, maxAgeSeconds = Some(MaxBecomeOldUserSeconds))
    impersonatingCookie
  }


  def stopImpersonating: Action[Unit] = GetActionAllowAnyone { request =>
    urlDecodeCookie(ImpersonationCookieName, request.underlying) match {
      case None =>
        // What's this? Clicking Stop Impersonating, but no such cookie?
        // Maybe clicking twice in different tabs? Anyway, feels
        // better to log out, so as not to accidentally stay logged in somehow.
        LoginController.doLogout(request, redirectIfMayNotSeeUrlPath = None)
      case Some(cookieValue) =>
        val response =
          checkHashElseGetAgeAndUserId(cookieValue) match {
            case Bad(r) => r
            case Good((secondsAgo, oldUserId)) =>
              // Ignore old impersonation cookies, in case they're leaked somehow.
                if (secondsAgo > MaxBecomeOldUserSeconds || oldUserId == NoUserId) {
                  LoginController.doLogout(request, redirectIfMayNotSeeUrlPath = None)
                }
                else {
                  // Restore the old user id.
                  val (_, _, sidAndXsrfCookies) =
                        createSessionIdAndXsrfToken(request, oldUserId)
                  Ok.withCookies(sidAndXsrfCookies: _*)
                }
          }
        response.discardingCookies(
            mvc.DiscardingCookie(ImpersonationCookieName))
    }
  }


  private def concatAndHash(userId: UserId, viewAsGroupOnly: Boolean, unixSeconds: Long,
        randomString: String) = {
    val CFS = FieldSeparator
    val viewOnlyString = viewAsGroupOnly ? ViewAsGroupOnly | ImpersonateRealUser
    val toHash = s"$userId$CFS$viewOnlyString$CFS$unixSeconds$CFS$randomString"
    val theHash = hashSha1Base64UrlSafe(toHash + CFS + globals.applicationSecret)
    s"$toHash$CFS$theHash"
  }


  private def checkHashElseGetAgeAndUserId(value: String): (Long, UserId) Or mvc.Result = {
    val parts = value.split(FieldSeparator)
    if (parts.length != 5)
      return Bad(ForbiddenResult(
        "EsE4YK82", s"Bad $ImpersonationCookieName cookie: ${parts.length} parts, not 4"))

    val oldUserId = parts(0).toIntOrThrow("EsE8IKPW2", "Old user id is not a number")
    val viewAsGroupOnly = parts(1) match {
      case ViewAsGroupOnly => true
      case ImpersonateRealUser => false
      case bad => return Bad(ForbiddenResult("EdE2WK6PX", s"Bad view-only field"))
    }
    val unixSeconds = parts(2).toLongOrThrow("EsE4YK0W2", "Unix seconds is not a number")
    val randomString = parts(3)
    val correctCookieValue = concatAndHash(oldUserId, viewAsGroupOnly, unixSeconds, randomString)
    if (value != correctCookieValue)
      return Bad(ForbiddenResult("TyE6YKP2JW3", s"Bad hash"))

    val ageSeconds = globals.now().numSeconds - unixSeconds
    Good((ageSeconds, oldUserId))
  }

}
