/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import com.mohiva.play.silhouette.core.providers._
import com.mohiva.play.silhouette.core.providers.OAuth2Settings
import com.mohiva.play.silhouette.core.providers.oauth2.FacebookProvider
import com.mohiva.play.silhouette.core.providers.oauth2.GoogleProvider
import com.mohiva.play.silhouette
import com.mohiva.play.silhouette.core.{exceptions => siex}
import java.{util => ju}
import play.{api => p}
import play.api.mvc._
import play.api.mvc.BodyParsers.parse.empty
import play.api.Play
import play.api.Play.current
import play.api.libs.concurrent.Execution.Implicits._
import scala.concurrent.Future



/** OpenAuth 1 and 2 login, provided by Silhouette, e.g. for Facebook and Twitter.
  */
object LoginWithOpenAuthController extends Controller {

  private val ReturnToUrlCookieName = "dwCoReturnToUrl"


  /** The authentication flow starts here, if it happens in the main window and you
    * thus have a page you want to return to afterwards.
    */
  def startAuthentication(provider: String, returnToUrl: String, request: Request[Unit]) = {
    val futureResponse = authenticate(provider, request)
    futureResponse map { response =>
      response.withCookies(
        Cookie(name = ReturnToUrlCookieName, value = returnToUrl))
    }
  }


  /** The authentication starts here if it happens in a popup. Then, afterwards,
    * the popup window will be sent some Javascript that tells the popup opener
    * what has happened (i.e. that the user logged in).
    */
  def startAuthenticationInPopupWindow(provider: String) = Action.async(empty) { request =>
    authenticate(provider, request)
  }


  def finishAuthentication(provider: String) = Action.async(empty) { request: Request[Unit] =>
    authenticate(provider, request)
  }


  /** Authenticates a user against e.g. Facebook or Google or Twitter, using OAuth 1 or 2.
    *
    * Based on:
    *   https://github.com/mohiva/play-silhouette-seed/blob/master/
    *                     app/controllers/SocialAuthController.scala#L32
    */
  private def authenticate(providerName: String, request: Request[Unit]): Future[Result] = {
    val provider: SocialProvider[_] with CommonSocialProfileBuilder[_] = providerName match {
      case silhouette.core.providers.oauth2.FacebookProvider.Facebook =>
        facebookProvider(request)
      case silhouette.core.providers.oauth2.GoogleProvider.Google =>
        googleProvider(request)
      case x =>
        return Future.successful(Results.Forbidden(s"Bad provider: `$providerName' [DwE2F0D6]"))
    }
    val authFutureResult = provider.authenticate()(request)
    authFutureResult.flatMap {
      case Left(result) =>
        Future.successful(result)
      case Right(profile: provider.Profile) =>
        loginAndRedirect(request, profile)
    }.recoverWith({
      case e: siex.AccessDeniedException =>
        Future.successful(Results.Forbidden)
      case e: siex.AuthenticationException =>
        Future.successful(Results.Forbidden)
    })
  }


  private def loginAndRedirect(request: Request[Unit], profile: CommonSocialProfile[_])
        : Future[Result] = {
    p.Logger.debug(s"User logging in: $profile")

    val siteId = debiki.DebikiHttp.lookupTenantIdOrThrow(request, debiki.Globals.systemDao)
    val dao = debiki.Globals.siteDao(siteId, ip = request.remoteAddress)

    val loginAttempt = OpenAuthLoginAttempt(
      ip = request.remoteAddress,
      date = new ju.Date,
      prevLoginId = None, // for now
      OpenAuthDetails(
        providerId = profile.loginInfo.providerID,
        providerKey = profile.loginInfo.providerKey,
        firstName = profile.firstName,
        fullName = profile.fullName,
        email = profile.email,
        avatarUrl = profile.avatarURL))

    val loginGrant: LoginGrant = dao.saveLogin(loginAttempt)

    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = ConfigUserController.userConfigCookie(loginGrant)
    val newSessionCookies = userConfigCookie::sidAndXsrfCookies

    val response = request.cookies.get(ReturnToUrlCookieName) match {
      case Some(returnToUrlCookie) =>
        Redirect(returnToUrlCookie.value).discardingCookies(DiscardingCookie(ReturnToUrlCookieName))
      case None =>
        // We're logging in in a popup.
        Ok(views.html.login.loginPopupCallback("LoginOk",
          s"You have been logged in, welcome ${loginGrant.displayName}!",
          anyReturnToUrl = None))
    }

    // PostgreSQL doesn't support async requests; everything above has happened already.
    Future.successful(
      response.withCookies(newSessionCookies: _*))
  }


  private val CacheLayer =
    new silhouette.contrib.utils.PlayCacheLayer

  private val HttpLayer =
    new silhouette.core.utils.PlayHTTPLayer


  private def googleProvider(request: Request[Unit])
        : GoogleProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    GoogleProvider(CacheLayer, HttpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.google.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.google.accessTokenURL").get,
      redirectURL = buildRedirectUrl(request, "google"),
      clientID = Play.configuration.getString("silhouette.google.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.google.clientSecret").get,
      scope = Play.configuration.getString("silhouette.google.scope")))
  }


  private def facebookProvider(request: Request[Unit])
        : FacebookProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    FacebookProvider(CacheLayer, HttpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.facebook.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.facebook.accessTokenURL").get,
      redirectURL = buildRedirectUrl(request, "facebook"),
      clientID = Play.configuration.getString("silhouette.facebook.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.facebook.clientSecret").get,
      scope = Play.configuration.getString("silhouette.facebook.scope")))
  }


  private def buildRedirectUrl(request: Request[_], provider: String) = {
    val scheme = if (request.secure) "https" else "http"
    val origin = s"$scheme://${request.host}"
    origin + routes.LoginWithOpenAuthController.finishAuthentication(provider).url
  }

}
