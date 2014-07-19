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
import com.mohiva.play.silhouette
import com.mohiva.play.silhouette.core.{exceptions => siex}
import debiki.DebikiHttp._
import play.api.mvc._
import play.api.mvc.BodyParsers.parse.empty
import play.api.Play
import play.api.Play.current
import play.api.libs.concurrent.Execution.Implicits._
import scala.concurrent.Future



/** OpenAuth 1 and 2 login, provided by Silhouette, e.g. for Facebook and Twitter.
  */
object LoginWithSilhouetteController extends Controller {

  private val ReturnToUrlCookieName = "dwCoReturnToUrl"


  def startAuthentication(provider: String, returnToUrl: String, request: Request[Unit]) = {
    val futureResponse = authenticate(provider, request)
    futureResponse map { response =>
      response.withCookies(
        Cookie(name = ReturnToUrlCookieName, value = returnToUrl))
    }
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
  private def authenticate(provider: String, request: Request[Unit]) = {
    val provider: SocialProvider[_] with CommonSocialProfileBuilder[_] = facebookProvider
    val authFutureResult = provider.authenticate()(request)
    authFutureResult.flatMap {
      case Left(result) =>
        Future.successful(result)
      case Right(profile: provider.Profile) =>
        System.out.println(s"Logged in: $profile")

        val response = request.cookies.get(ReturnToUrlCookieName) match {
          case Some(returnToUrlCookie) =>
            Redirect(returnToUrlCookie.value).discardingCookies(DiscardingCookie(ReturnToUrlCookieName))
          case None =>
            // We're logging in in a popup.
            Ok(views.html.login.loginPopupCallback("LoginOk",
              s"You have been logged in, welcome ${profile}", //${loginGrant.displayName}!",
              anyReturnToUrl = None))
        }
        Future.successful(response)

    }.recoverWith({
      case e: siex.AccessDeniedException =>
        Future.successful(Results.Forbidden)
      case e: siex.AuthenticationException =>
        Future.successful(Results.Forbidden)
    })
  }

  val cacheLayer =
    new silhouette.contrib.utils.PlayCacheLayer

  val httpLayer =
    new silhouette.core.utils.PlayHTTPLayer

  def facebookProvider: FacebookProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    FacebookProvider(cacheLayer, httpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.facebook.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.facebook.accessTokenURL").get,
      redirectURL = "http://localhost:9000" + routes.LoginWithSilhouetteController.finishAuthentication("facebook").url,
      clientID = Play.configuration.getString("silhouette.facebook.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.facebook.clientSecret").get,
      scope = Play.configuration.getString("silhouette.facebook.scope")))
  }

}
