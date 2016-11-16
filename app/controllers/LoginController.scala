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

package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import debiki.{Globals, RateLimits, SiteTpi}
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.mvc._
import play.api.mvc.BodyParsers.parse.empty
import play.api.Play.current


/** Logs in and out.
  */
object LoginController extends mvc.Controller {

  val DiscardingSessionCookie = DiscardingSecureCookie("dwCoSid")


  val AsSuperadmin = "superadmin"
  val AsAdmin = "admin"
  val AsStaff = "staff"

  def showLoginPage(as: Option[String], to: Option[String]) = GetActionIsLogin { apiReq =>
    // `thenGoTo` must be an URL relative the same origin.
    val path = to getOrElse "/"
    val badNextUrl = path.contains("//") || path.contains(':') || path.contains("..") ||
      path.isEmpty || path.charAt(0) != '/'
    if (badNextUrl)
      throwForbidden("EsE5YK02", s"Bad next URL: $path")

    val loginReason =
      if (as.contains(AsSuperadmin)) {
        "LoginToAdministrate"  // later: LoginReason.SuperAdminArea   xx
      }
      else if (as.contains(AsAdmin)) {
        "LoginToAdministrate"
      }
      else if (as.contains(AsStaff)) {
        "LoginToAdministrate"  // COULD add LoginReason.StaffOnly
      }
      else if (as.contains("member")) {
        throwNotImplemented("EsE5ES20", "Not impl: ?as=member")
      }
      else if (path.startsWith("/-/admin/")) {
        "LoginToAdministrate"
      }
      else if (path.startsWith("/-/superadmin/")) {
        COULD // check if is superadmin site id, if not, throw forbidden
        "LoginToAdministrate"  // later: LoginReason.SuperAdminArea   xx
      }
      else { // incl if (path.startsWith("/-/users/")) {
        // The loginPopup template doesn't include any React store JSON and this results
        // in a JS exception in ReactStore.isGuestLoginAllowed() when accessing
        // store.settings.allowGuestLogin.  [5KUP02]
        throwNotImplemented("EsE4KU67", "Logging in via /-/login to view pages or users")
      }

    COULD // find out if already logged in with enough perms, then go to `path` directly instead.

    dieIfAssetsMissingIfDevTest()
    Ok(views.html.login.loginPopup(
      SiteTpi(apiReq),
      mode = loginReason,
      serverAddress = s"//${apiReq.host}",  // try to remove
      returnToUrl = apiReq.origin + path)) as HTML
  }


  /** Opens a popup and a login dialog inside that popup. Useful when logging in
    * in an iframe, because it's not feasible to open modal dialogs from inside
    * iframes — only the iframe would be disabled by the modal dialog, but not
    * the rest of the page.
    */
  def showLoginPopup(mode: String, returnToUrl: String) = GetActionAllowAnyone { request =>
    Ok(views.html.login.loginPopup(
      SiteTpi(request),
      mode = mode,
      serverAddress = s"//${request.host}",  // try to remove
      returnToUrl = returnToUrl)) as HTML
  }


  /** Clears login related cookies and OpenID and OpenAuth stuff, unsubscribes
    * from any event channel.
    */
  def logout = GetActionAllowAnyone { request =>
    doLogout(request)
  }


  def doLogout(request: GetRequest): Result = {
    request.user foreach { user =>
      request.dao.pubSub.unsubscribeUser(request.siteId, user, request.theBrowserIdData)
    }
    // Keep the xsrf cookie, so login dialog works:
    Ok.discardingCookies(DiscardingSessionCookie)
  }


  def sendSiteOwnerAddrVerifEmailAgain =
        GetActionRateLimited(RateLimits.Login, allowAnyone = true) { request =>
    val siteOwner = request.dao.loadSiteOwner() getOrElse {
      throwNotFound("EdE85FJKY0" , "No owner")
    }

    val email = LoginWithPasswordController.createEmailAddrVerifEmailLogDontSend(
      siteOwner.briefUser, anyReturnToUrl = None, request.host, request.dao)

    // Don't send a verif email, if already verified, because of possible security issues (?).
    // The verif link was written to the log files though (by ...LogDontSend(...) above),
    // in case needed for some reason.
    if (siteOwner.emailVerifiedAt.isEmpty) {
      Globals.sendEmail(email, request.dao.siteId)
    }
    Ok
  }


  /** Tests if we're currently logging in as the very first user — s/he will
    * be made admin if s/he has the correct email address.
    */
  def shallBecomeOwner(request: JsonPostRequest, emailAddress: String): Boolean = {
    val site = request.dao.theSite()
    val ownerEmailInDatabase = site.status match {
      case SiteStatus.NoAdmin =>
        site.creatorEmailAddress
      case _ =>
        // The very first signup has happened already, owner already created.
        return false
    }

    val ownerEmail =
      if (request.siteId == Site.FirstSiteId)
        Globals.becomeFirstSiteOwnerEmail getOrElse {
          val errorCode = "DwE8PY25"
          val errorMessage = s"Config value '${Globals.BecomeOwnerEmailConfigValue}' missing"
          Logger.error(s"$errorMessage [$errorCode]")
          throwInternalError(errorCode, errorMessage)
        }
      else
        ownerEmailInDatabase

    if (emailAddress != ownerEmail)
      // Error code used client side; don't change.
      throwForbidden("_EsE403WEA_", "Wrong email address")

    true
  }

}
