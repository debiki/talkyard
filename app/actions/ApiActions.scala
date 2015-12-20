/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package actions

import actions.SafeActions.{SessionAction, SessionRequest}
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.LoginController
import controllers.Utils
import debiki._
import debiki.DebikiHttp._
import debiki.RateLimits.NoRateLimits
import java.{util => ju}
import play.api._
import play.api.libs.Files.TemporaryFile
import play.{api => p}
import play.api.mvc._
import requests._
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Failure, Success}


/** Play Framework Actions for requests to Debiki's HTTP API.
  */
object ApiActions {


  def AsyncGetAction(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(NoRateLimits).async(BodyParsers.parse.empty)(f)

  def AsyncGetActionRateLimited(rateLimits: RateLimits)(f: GetRequest => Future[Result])
        : mvc.Action[Unit] =
    PlainApiAction(rateLimits).async(BodyParsers.parse.empty)(f)

  def GetAction(f: GetRequest => Result) =
    PlainApiAction(NoRateLimits)(BodyParsers.parse.empty)(f)

  def GetActionAllowAnyone(f: GetRequest => Result) =
    PlainApiAction(NoRateLimits, allowAnyone = true)(BodyParsers.parse.empty)(f)

  def GetActionRateLimited(rateLimits: RateLimits, allowAnyone: Boolean = false)(
        f: GetRequest => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(BodyParsers.parse.empty)(f)

  def StaffGetAction(f: GetRequest => Result) =
    PlainApiActionStaffOnly(BodyParsers.parse.empty)(f)

  def AdminGetAction(f: GetRequest => Result) =
    PlainApiActionAdminOnly(BodyParsers.parse.empty)(f)


  def JsonOrFormDataPostAction
        (rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)
        (f: ApiRequest[JsonOrFormDataBody] => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(f)

  def AsyncJsonOrFormDataPostAction
        (rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)
        (f: ApiRequest[JsonOrFormDataBody] => Future[Result]): mvc.Action[JsonOrFormDataBody] =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone).async(
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(f)


  def AsyncPostJsonAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Future[Result]) =
  PlainApiAction(rateLimits, allowAnyone = allowAnyone).async(
    BodyParsers.parse.json(maxLength = maxLength))(f)

  def PostJsonAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(
      BodyParsers.parse.json(maxLength = maxLength))(f)

  def StaffPostJsonAction(maxLength: Int)(f: JsonPostRequest => Result) =
    PlainApiActionStaffOnly(
      BodyParsers.parse.json(maxLength = maxLength))(f)

  def AdminPostJsonAction(maxLength: Int)(f: JsonPostRequest => Result) =
    PlainApiActionAdminOnly(
      BodyParsers.parse.json(maxLength = maxLength))(f)


  def PostFilesAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[Either[p.mvc.MaxSizeExceeded, MultipartFormData[TemporaryFile]]] => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(
        BodyParsers.parse.maxLength(maxLength, BodyParsers.parse.multipartFormData))(f)


  private def PlainApiAction(rateLimits: RateLimits, allowAnyone: Boolean = false) =
    PlainApiActionImpl(rateLimits, adminOnly = false, staffOnly = false, allowAnyone)

  private def PlainApiActionStaffOnly =
    PlainApiActionImpl(NoRateLimits, adminOnly = false, staffOnly = true)

  private val PlainApiActionAdminOnly =
    PlainApiActionImpl(NoRateLimits, adminOnly = true, staffOnly = false)


  private def PlainApiActionImpl(rateLimits: RateLimits, adminOnly: Boolean, staffOnly: Boolean,
        allowAnyone: Boolean = false) =
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

