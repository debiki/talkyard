// This file is from Silhouette, which Ty no longer uses, but it's simpler for now,
// to keep Silhouette's class OAuth2Settings (at the end of this file) rather
// than removing all at once.
//
// This file is, as you can see just below, under a different license (more permissive),
// than Talkyard itself.
//

/**
 * Original work: SecureSocial (https://github.com/jaliss/securesocial)
 * Copyright 2013 Jorge Aliss (jaliss at gmail dot com) - twitter: @jaliss
 *
 * Derivative work: Silhouette (https://github.com/mohiva/play-silhouette)
 * Modifications Copyright 2015 Mohiva Organisation (license at mohiva dot com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package talkyard.server.authn


/*
import java.net.URLEncoder._

import com.mohiva.play.silhouette.api._
import com.mohiva.play.silhouette.api.exceptions._
import com.mohiva.play.silhouette.api.util.ExtractableRequest
import com.mohiva.play.silhouette.impl.exceptions.{ AccessDeniedException, UnexpectedResponseException }
import com.mohiva.play.silhouette.impl.providers.OAuth2Provider._
import com.mohiva.play.silhouette.impl.providers.state.UserStateItemHandler
import com.mohiva.play.silhouette.ScalaCompat._
import play.api.libs.functional.syntax._
import play.api.libs.json._
import play.api.libs.ws.WSResponse
import play.api.mvc._

import scala.concurrent.Future
import scala.reflect.ClassTag
import scala.util.{ Failure, Success, Try }

/**
 * The OAuth2 info.
 *
 * @param accessToken  The access token.
 * @param tokenType    The token type.
 * @param expiresIn    The number of seconds before the token expires.
 * @param refreshToken The refresh token.
 * @param params       Additional params transported in conjunction with the token.
 */
case class OAuth2Info(
  accessToken: String,
  tokenType: Option[String] = None,
  expiresIn: Option[Int] = None,
  refreshToken: Option[String] = None,
  params: Option[Map[String, String]] = None) extends AuthInfo

/**
 * The Oauth2 info companion object.
 */
object OAuth2Info extends OAuth2Constants {

  /**
   * Converts the JSON into a [[com.mohiva.play.silhouette.impl.providers.OAuth2Info]] object.
   */
  implicit val infoReads = (
    (__ \ AccessToken).read[String] and
    (__ \ TokenType).readNullable[String] and
    (__ \ ExpiresIn).readNullable[Int] and
    (__ \ RefreshToken).readNullable[String]
  )((accessToken: String, tokenType: Option[String], expiresIn: Option[Int], refreshToken: Option[String]) =>
      new OAuth2Info(accessToken, tokenType, expiresIn, refreshToken)
    )
}

/**
 * Base implementation for all OAuth2 providers.
 */
trait OAuth2Provider extends SocialStateProvider with OAuth2Constants with Logger {

  /**
   * The type of the auth info.
   */
  type A = OAuth2Info

  /**
   * The settings type.
   */
  type Settings = OAuth2Settings

  /**
   * The social state handler implementation.
   */
  protected val stateHandler: SocialStateHandler

  /**
   * A list with headers to send to the API.
   */
  protected val headers: Seq[(String, String)] = Seq()

  /**
   * The default access token response code.
   *
   * Override this if a specific provider uses another HTTP status code for a successful access token response.
   */
  protected val accessTokeResponseCode: Int = 200

  /**
   * The implicit access token reads.
   *
   * Override this if a specific provider needs another reads.
   */
  implicit protected val accessTokenReads: Reads[OAuth2Info] = OAuth2Info.infoReads

  /**
   * Starts the authentication process.
   *
   * @param request The current request.
   * @tparam B The type of the request body.
   * @return Either a Result or the auth info from the provider.
   */
  def authenticate[B]()(implicit request: ExtractableRequest[B]): Future[Either[Result, OAuth2Info]] = {
    handleFlow(handleAuthorizationFlow(stateHandler)) { code =>
      stateHandler.unserialize(request.extractString(State).getOrElse("")).flatMap { _ =>
        getAccessToken(code).map(oauth2Info => oauth2Info)
      }
    }
  }

  /**
   * Authenticates the user and returns the auth information and the user state.
   *
   * Returns either a [[StatefulAuthInfo]] if all went OK or a `play.api.mvc.Result` that the controller
   * sends to the browser (e.g.: in the case of OAuth where the user needs to be redirected to the service
   * provider).
   *
   * @tparam S The type of the user state.
   * @tparam B The type of the request body.
   * @param format The JSON format to the transform the user state into JSON.
   * @param request The request.
   * @param classTag The class tag for the user state item.
   * @return Either a `play.api.mvc.Result` or the [[StatefulAuthInfo]] from the provider.
   */
  def authenticate[S <: SocialStateItem, B](userState: S)(
    implicit
    format: Format[S],
    request: ExtractableRequest[B],
    classTag: ClassTag[S]
  ): Future[Either[Result, StatefulAuthInfo[A, S]]] = {
    val userStateItemHandler = new UserStateItemHandler(userState)
    val newStateHandler = stateHandler.withHandler(userStateItemHandler)

    handleFlow(handleAuthorizationFlow(newStateHandler)) { code =>
      newStateHandler.unserialize(request.extractString(State).getOrElse("")).flatMap { state =>
        val maybeUserState: Option[S] = state.items.flatMap(item => userStateItemHandler.canHandle(item)).headOption
        maybeUserState match {
          case Some(s) => getAccessToken(code).map(oauth2Info => StatefulAuthInfo(oauth2Info, s))
          case None    => Future.failed(new UnexpectedResponseException("Cannot extract user info from response"))
        }
      }
    }
  }

  /**
   * Handles the OAuth2 flow.
   *
   * The left flow is the authorization flow, which will be processed, if no `code` parameter exists
   * in the request. The right flow is the access token flow, which will be executed after a successful
   * authorization.
   *
   * @param left The authorization flow.
   * @param right The access token flow.
   * @param request The request.
   * @tparam L The return type of the left flow.
   * @tparam R The return type of the right flow.
   * @tparam B The type of the request body.
   * @return Either the left or the right flow.
   */
  def handleFlow[L, R, B](left: => Future[L])(right: String => Future[R])(
    implicit
    request: ExtractableRequest[B]
  ): Future[Either[L, R]] = {
    request.extractString(Error).map {
      case e @ AccessDenied => new AccessDeniedException(AuthorizationError.format(id, e))
      case e                => new UnexpectedResponseException(AuthorizationError.format(id, e))
    } match {
      case Some(throwable) => Future.failed(throwable)
      case None => request.extractString(Code) match {
        // We're being redirected back from the authorization server with the access code and the state
        case Some(code) => right(code).map(Right.apply)
        // There's no code in the request, this is the first step in the OAuth flow
        case None       => left.map(Left.apply)
      }
    }
  }

  /**
   * Handles the authorization step of the OAuth2 flow.
   *
   * @tparam B The type of the request body.
   * @param stateHandler The state handler to use.
   * @param request The request.
   * @return The redirect to the authorization URL of the OAuth2 provider.
   */
  protected def handleAuthorizationFlow[B](stateHandler: SocialStateHandler)(
    implicit
    request: ExtractableRequest[B]
  ): Future[Result] = {
    stateHandler.state.map { state =>
      val serializedState = stateHandler.serialize(state)
      val stateParam = if (serializedState.isEmpty) List() else List(State -> serializedState)
      val redirectParam = settings.redirectURL match {
        case Some(rUri) => List((RedirectURI, resolveCallbackURL(rUri)))
        case None       => Nil
      }
      val params = settings.scope.foldLeft(List(
        (ClientID, settings.clientID),
        (ResponseType, Code)) ++ stateParam ++ settings.authorizationParams.toList ++ redirectParam) {
        case (p, s) => (Scope, s) :: p
      }
      val encodedParams = params.map { p => encode(p._1, "UTF-8") + "=" + encode(p._2, "UTF-8") }
      val url = settings.authorizationURL.getOrElse {
        throw new ConfigurationException(AuthorizationURLUndefined.format(id))
      } + encodedParams.mkString("?", "&", "")
      val redirect = stateHandler.publish(Results.Redirect(url), state)
      logger.debug("[Silhouette][%s] Use authorization URL: %s".format(id, settings.authorizationURL))
      logger.debug("[Silhouette][%s] Redirecting to: %s".format(id, url))
      redirect
    }
  }

  /**
   * Gets the access token.
   *
   * @param code    The access code.
   * @param request The current request.
   * @return The info containing the access token.
   */
  protected def getAccessToken(code: String)(implicit request: RequestHeader): Future[OAuth2Info] = {
    val redirectParam = settings.redirectURL match {
      case Some(rUri) => List((RedirectURI, resolveCallbackURL(rUri)))
      case None       => Nil
    }
    val params = Map(
      ClientID -> Seq(settings.clientID),
      ClientSecret -> Seq(settings.clientSecret),
      GrantType -> Seq(AuthorizationCode),
      Code -> Seq(code)) ++ settings.accessTokenParams.transformValues(Seq(_)) ++ redirectParam.toMap.transformValues(Seq(_))
    httpLayer.url(settings.accessTokenURL).withHttpHeaders(headers: _*).post(params).flatMap { response =>
      logger.debug("[Silhouette][%s] Access token response: [%s]".format(id, response.body))
      Future.fromTry(buildInfo(response))
    }
  }

  /**
   * Builds the OAuth2 info from response.
   *
   * @param response The response from the provider.
   * @return The OAuth2 info on success, otherwise a failure.
   */
  protected def buildInfo(response: WSResponse): Try[OAuth2Info] = {
    response.status match {
      case status if status == accessTokeResponseCode =>
        Try(response.json) match {
          case Success(json) => json.validate[OAuth2Info].asEither.fold(
            error => Failure(new UnexpectedResponseException(InvalidInfoFormat.format(id, error))),
            info => Success(info)
          )
          case Failure(error) => Failure(
            new UnexpectedResponseException(JsonParseError.format(id, response.body, error))
          )
        }
      case status => Failure(
        new UnexpectedResponseException(UnexpectedResponse.format(id, response.body, status))
      )
    }
  }
}

/**
 * The OAuth2Provider companion object.
 */
object OAuth2Provider extends OAuth2Constants {

  /**
   * The error messages.
   */
  val AuthorizationURLUndefined = "[Silhouette][%s] Authorization URL is undefined"
  val AuthorizationError = "[Silhouette][%s] Authorization server returned error: %s"
  val InvalidInfoFormat = "[Silhouette][%s] Cannot build OAuth2Info because of invalid response format: %s"
  val JsonParseError = "[Silhouette][%s] Cannot parse response `%s` to Json; got error: %s"
  val UnexpectedResponse = "[Silhouette][%s] Got unexpected response `%s`; status code: %s"
}

/**
 * The OAuth2 constants.
 */
trait OAuth2Constants {

  val ClientID = "client_id"
  val ClientSecret = "client_secret"
  val RedirectURI = "redirect_uri"
  val Scope = "scope"
  val ResponseType = "response_type"
  val State = "state"
  val GrantType = "grant_type"
  val AuthorizationCode = "authorization_code"
  val AccessToken = "access_token"
  val Error = "error"
  val Code = "code"
  val TokenType = "token_type"
  val ExpiresIn = "expires_in"
  val Expires = "expires"
  val RefreshToken = "refresh_token"
  val AccessDenied = "access_denied"
}

*/

/**
 * The OAuth2 settings.
 *
 * @param authorizationURL    The authorization URL provided by the OAuth provider.
 * @param accessTokenURL      The access token URL provided by the OAuth provider.
 * @param redirectURL         The redirect URL to the application after a successful authentication on the OAuth
 *                            provider. The URL can be a relative path which will be resolved against the current
 *                            request's host.
 * @param apiURL              The URL to fetch the profile from the API. Can be used to override the default URL
 *                            hardcoded in every provider implementation.
 * @param clientID            The client ID provided by the OAuth provider.
 * @param clientSecret        The client secret provided by the OAuth provider.
 * @param scope               The OAuth2 scope parameter provided by the OAuth provider.
 * @param authorizationParams Additional params to add to the authorization request.
 * @param accessTokenParams   Additional params to add to the access token request.
 * @param customProperties    A map of custom properties for the different providers.
 */
case class OAuth2Settings(
  authorizationURL: Option[String] = None,
  accessTokenURL: String,
  redirectURL: Option[String] = None,
  apiURL: Option[String] = None,
  clientID: String, clientSecret: String,
  scope: Option[String] = None,
  authorizationParams: Map[String, String] = Map.empty,
  accessTokenParams: Map[String, String] = Map.empty,
  customProperties: Map[String, String] = Map.empty
)

