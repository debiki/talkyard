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
import debiki.{Globals, RateLimits, SiteTpi}
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json.{JsNull, JsString, Json}
import play.api.mvc._
import talkyard.server.TyLogging


/** Logs in and out.
  */
class LoginController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.DiscardingSessionCookie
  import LoginController._


  def showLoginPage(as: Option[String], to: Option[String]): Action[Unit] = GetActionIsLogin { apiReq =>
    val path = to getOrElse "/"
    val badNextUrl = path.contains("//") || path.contains(':') || path.contains("..") ||
      path.isEmpty || path.charAt(0) != '/'
    if (badNextUrl)
      throwForbidden("EsE5YK02", s"Bad next URL: $path")

    var toAdminArea = true
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
        toAdminArea = false
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
        // Old comment, isGuestLoginAllowed() is deleted now:
        // The loginPopup template doesn't include any React store JSON and this results
        // in a JS exception in ReactStore.isGuestLoginAllowed() when accessing
        // store.settings.allowGuestLogin.  [5KUP02]
        toAdminArea = false
        throwNotImplemented("EsE4KU67", "Logging in via /-/login to view pages or users")
      }

    COULD // find out if already logged in with enough perms, then go to `path` directly instead.

    dieIfAssetsMissingIfDevTest()
    CSP_MISSING
    Ok(views.html.authn.authnPage(
      SiteTpi(apiReq, isAdminArea = toAdminArea),
      mode = loginReason,
      serverAddress = s"//${apiReq.host}",  // try to remove
      returnToUrl = apiReq.origin + path)) as HTML
  }


  private val EmbCommentsModeStr = 16.toString  // [8UKBR2AD5]

  /** For showing a login dialog inside a popup window. Used when   [2ABKW24T]
    * 1) logging in in an iframe,
    * because it's not user friendly to open a modal login dialog inside
    * the iframe — only the iframe content would be overlaid by the modal dialog, but
    * the rest of the page (outside the iframe) would be active & clickable as usual,
    * which I think would be confusing?
    *
    * Especially on mobile phones, if one scrolls up or down a bit, so the dialog
    * scrolls out of view, and all one sees are comments behind a non-clickable
    * background. — Would need to disable scroll on the embedd*ing* page? That'd be
    * a bit error prone?
    *
    * And used when 2) logging in via OAuth2 or OIDC — then, it's nice to
    * jump to the external IDP's login page in a popup window, so whatever one
    * is doing in the main window (e.g. having expanded / collapsed threads,
    * maybe started composing a reply) won't disappear.
    */
  def showLoginPopup(mode: St, returnToUrl: St): Action[U] =
        GetActionAllowAnyoneRateLimited(
          RateLimits.NoRateLimits, avoidCookies = mode == EmbCommentsModeStr) { request =>
    CSP_MISSING
    Ok(views.html.authn.authnPage(
      SiteTpi(request),
      mode = mode,
      serverAddress = s"//${request.host}",  // try to remove
      returnToUrl = returnToUrl,
      isInLoginPopup = true)) as HTML
  }


  /** Clears login related cookies and OpenID and OpenAuth stuff, unsubscribes
    * from any event channel.
    */
  def logout(currentUrlPath: Opt[St]): Action[U] = GetActionAllowAnyone { request =>
    doLogout(request, redirectIfMayNotSeeUrlPath = currentUrlPath)
  }


  def doLogout(request: GetRequest, redirectIfMayNotSeeUrlPath: Opt[St]): Result = {
    import request.{dao, requester}

    requester foreach { theRequester =>
      request.dao.logout(theRequester, bumpLastSeen = true)
    }

    val stayOnSamePage = redirectIfMayNotSeeUrlPath match {
      case None =>
        true
      case Some(urlPath) =>
        // May-not-see tested here: [TyT503KRDHJ2]. (May-see: Tested "everywhere".)
        dao.mayStrangerProbablySeeUrlPathUseCache(urlPath)
    }

    def goToNext = request.siteSettings.effectiveSsoLoginRequiredLogoutUrl getOrElse "/"

    val response =
      if (request.isAjax) {
        OkSafeJson(
          Json.obj(
            "goToUrl" -> (if (stayOnSamePage) JsNull else JsString(goToNext))))
      }
      else
        TemporaryRedirect(goToNext)

    // Keep the xsrf cookie, so the login dialog will work.
    response.discardingCookies(DiscardingSessionCookie)
  }


  def resendSiteOwnerAddrVerifEmail: Action[Unit] =
        GetActionRateLimited(RateLimits.Login, allowAnyone = true) { request =>
    val siteOwner = request.dao.loadSiteOwner() getOrElse {
      throwNotFound("EdE85FJKY0" , "No owner")
    }

    val email = LoginWithPasswordController.createEmailAddrVerifEmailLogDontSend(
      siteOwner.briefUser, anyReturnToUrl = None, request.host, request.dao)

    // Don't send a verif email, if already verified, because of possible security issues (?).
    // The verif link was written to the log files though (by ...LogDontSend(...) above),
    // in case needed for some reason.
    // CLEAN_UP but then why create the email & save it in the db? Maybe only write to log instead?
    if (siteOwner.emailVerifiedAt.isEmpty) {
      globals.sendEmail(email, request.dao.siteId)
    }
    Ok
  }
}


object LoginController extends TyLogging {

  val AsSuperadmin = "superadmin"
  val AsAdmin = "admin"
  val AsStaff = "staff"

  /** Tests if we're currently logging in as the very first user — s/he will
    * be made admin if s/he has the correct email address.
    */
  def shallBecomeOwner(request: JsonPostRequest, emailAddress: String): Boolean = {
    val site = request.dao.theSite()
    if (site.status != SiteStatus.NoAdmin) {
      // The very first signup has happened already, owner already created.
      return false
    }

    lazy val firstSiteOwnerEmail =
        request.context.globals.becomeFirstSiteOwnerEmail getOrElse {
          val errorCode = "DwE8PY25"
          val errorMessage = s"Config value '${Globals.BecomeOwnerEmailConfValName}' missing"
          logger.error(s"$errorMessage [$errorCode]")
          throwInternalError(errorCode, errorMessage)
        }

    if (request.siteId == Site.FirstSiteId && emailAddress != firstSiteOwnerEmail)
      // Error code used client side; don't change.
      throwForbidden("_EsE403WEA_", "Wrong email address")

    true
  }

}
