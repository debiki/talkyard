/**
 * Copyright (c) 2012-2015 Kaj Magnus Lindberg
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

package io.efdi.server.http

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.LoginController
import controllers.Utils
import debiki._
import debiki.DebikiHttp._
import debiki.RateLimits.NoRateLimits
import java.{util => ju}
import play.api._
import play.{api => p}
import play.api.mvc._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}


/** Play Framework Actions for requests to Debiki's HTTP API.
  */
private[http] object PlainApiActions {


  def PlainApiAction(rateLimits: RateLimits, allowAnyone: Boolean = false) =
    PlainApiActionImpl(rateLimits, adminOnly = false, staffOnly = false, allowAnyone)

  def PlainApiActionStaffOnly =
    PlainApiActionImpl(NoRateLimits, adminOnly = false, staffOnly = true)

  val PlainApiActionAdminOnly =
    PlainApiActionImpl(NoRateLimits, adminOnly = true, staffOnly = false)


  def PlainApiActionImpl(rateLimits: RateLimits, adminOnly: Boolean,
        staffOnly: Boolean, allowAnyone: Boolean = false) =
      new ActionBuilder[ApiRequest] {

    override def composeAction[A](action: Action[A]) = {
      SessionAction.async(action.parser) { request: Request[A] =>
        action(request)
      }
    }

    override def invokeBlock[A](
        genericRequest: Request[A], block: ApiRequest[A] => Future[Result]) = {

      // We've wrapped PlainApiActionImpl in a SessionAction which only provides SessionRequest:s.
      val request = genericRequest.asInstanceOf[SessionRequest[A]]

      val siteId = DebikiHttp.lookupTenantIdOrThrow(request, Globals.systemDao)

      val dao = Globals.siteDao(siteId = siteId)
      dao.perhapsBlockGuest(request)

      var anyUser = Utils.loadUserOrThrow(request.sidStatus, dao)
      var logoutBecauseSuspended = false
      if (anyUser.exists(_.isSuspendedAt(new ju.Date))) {
        anyUser = None
        logoutBecauseSuspended = true
      }

      if (staffOnly && !anyUser.exists(_.isStaff))
        throwForbidden("DwE7BSW3", "Please login as admin or moderator")

      if (adminOnly && !anyUser.exists(_.isAdmin))
        throwForbidden("DwE1GfK7", "Please login as admin")

      if (!allowAnyone) {
        val siteSettings = dao.loadWholeSiteSettings()
        if (!anyUser.exists(_.isApprovedOrStaff) && siteSettings.userMustBeApproved.asBoolean)
          throwForbidden("DwE4HKG5", "Not approved")
        if (!anyUser.exists(_.isAuthenticated) && siteSettings.userMustBeAuthenticated.asBoolean)
          throwForbidden("DwE6JGY2", "Not authenticated")
      }

      val apiRequest = ApiRequest[A](
        request.sidStatus, request.xsrfOk, request.browserId, anyUser, dao, request)

      RateLimiter.rateLimit(rateLimits, apiRequest)

      // COULD use markers instead for site id and ip, and perhaps uri too? Dupl code [5KWC28]
      val requestUriAndIp = s"site $siteId, ip ${apiRequest.ip}: ${apiRequest.uri}"
      p.Logger.debug(s"API request started [DwM6L8], " + requestUriAndIp)

      val timer = Globals.metricRegistry.timer(request.path)
      val timerContext = timer.time()
      var result = try {
        block(apiRequest)
      }
      catch {
        case ex: ResultException =>
          // This is fine, probably just a 403 Forbidden exception or 404 Not Found, whatever.
          p.Logger.debug(
            s"API request result exception [EsE4K2J2]: $ex, $requestUriAndIp")
          throw ex
        case ex: Exception =>
          p.Logger.warn(s"API request unexpected exception [EsE4JYU0], $requestUriAndIp", ex)
          throw ex
      }
      finally {
        timerContext.stop()
      }

      result onComplete {
        case Success(r) =>
          p.Logger.debug(
            s"API request ended, status ${r.header.status} [DwM9Z2], $requestUriAndIp")
        case Failure(exception) =>
          p.Logger.debug(
            s"API request exception: ${classNameOf(exception)} [DwE4P7], $requestUriAndIp")
      }

      if (logoutBecauseSuspended) {
        // We won't get here if e.g. a 403 Forbidden exception was thrown because 'user' was
        // set to None. How solve that?
        result = result.map(_.discardingCookies(LoginController.DiscardingSessionCookie))
      }
      result
    }
  }
}
