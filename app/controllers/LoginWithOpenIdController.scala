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
/*
package controllers

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.EmailNotfPrefs.EmailNotfPrefs
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.data._
import play.api.data.Forms._
import play.api.libs.concurrent._
import play.api.libs.{openid => oid}
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.{Success, Failure}
import scala.util.control.NonFatal
import Utils.ValidationImplicits._


object LoginWithOpenIdController extends mvc.Controller {


  val Logger = play.api.Logger("app.openid")

  val RequiredAttrs = Seq(
    "email" -> "http://schema.openid.net/contact/email",
    "country" -> "http://axschema.org/contact/country/home",
    "timezone" -> "http://axschema.org/pref/timezone",
    "firstname" -> "http://axschema.org/namePerson/first")


  def loginGet = mvc.Action {
    Ok(views.html.login.loginOpenid())
  }


  // COULD change to an ErrorAction, and use throwBadReq instead of BadRequest.
  def loginPost = mvc.Action.async(parse.urlFormEncoded(maxBytes = 200)) {
        request =>
    asyncLoginWithPostData(returnToUrl = "")(request)
  }


  def asyncLoginWithPostData(returnToUrl: String)(
        implicit request: Request[Map[String, Seq[String]]]): Future[Result] = {
    // (From the spec: The form field's "name" attribute should have the value
    // "openid_identifier", so that User-Agents can automatically
    // determine that this is an OpenID form.
    //    http://openid.net/specs/openid-authentication-2_0.html#discovery )
    val openIdIdentifier = request.body.getOrThrowBadReq("openid_identifier")
    asyncLogin(returnToUrl, openIdIdentifier = openIdIdentifier)
  }


  def asyncLogin(returnToUrl: String, openIdIdentifier: String)
       (implicit request: Request[_]): Future[Result] = {

    val realm = _wildcardRealmFor(request.host)

    // Find out to which OpenID provider the user should be redirected to,
    // and subsequently login.
    var futureUrl: Future[String] =
      oid.OpenID.redirectURL(  // issues a HTTP request
        openIdIdentifier,
        routes.LoginWithOpenIdController.loginCallback(returnToUrl).absoluteURL(),
        RequiredAttrs,
        realm = Some(realm))

    // On success, redirect the browser to that provider.
    val futureResult = futureUrl.map((url: String) => {
      Logger.trace("OpenID provider redirection URL discovered: " + url)
      Redirect(url)
    }) recover {
      case NonFatal(exception) =>
        Logger.debug(o"""OpenID provider redirection URL error, OpenId:
          $openIdIdentifier, error: $exception""")
        Redirect(routes.LoginWithOpenIdController.loginGet)
    }

    futureResult
  }


  /**
   * Attempts to construct a *.domain.com realm, given a host name.
   *
   * The OpenID realm is the domain/subdomains the end user will be
   * asked to trust. Google uses directed identities, which means the
   * end user's ID varies by realm. So if *.another-domain.com is specified
   * instead of *.debiki.se, all Gmail OpenID:s will change. (This gives
   * better anonymity: it prevents collusion.) We want the ids to change
   * as infrequently as possible thugh, so there are fewer identities
   * to store in the database, and possible to rename a host without
   * all Gmail ids being "invalidated". Therefore, use generic realms,
   * e.g. *.debiki.se rather than host.subdomain.debiki.se.
   * See http://openid.net/specs/openid-authentication-2_0.html#realms
   * And read even more here (search for 'realm'):
   *   https://code.google.com/googleapps/marketplace/sso.html
   *   https://code.google.com/intl/es-ES/apis/accounts/docs/OpenID.html
   */
  private def _wildcardRealmFor(host: String): String = {
    val isIpNo = _IpRegex matches host
    val hostNameSpecified = !isIpNo && host.count(_ == '.') >= 2
    val realm = Globals.scheme "://" + (if (hostNameSpecified) {
      // The host is like "hostname.example.com". Replace "hostname" with "*"
      // to get a realm like "*.example.com".
      val dotAndDomain = host.dropWhile(_ != '.')
      "*"+ dotAndDomain
    } else {
      // The host is like "some-domain.com". We cannot construct a
      // wildcard realm. ("*.some-domain.com" is not considered
      // the same realm as "some-domain.com".)
      host
    })
    realm
  }


  // For now, IPv4 only [IPv6 todo]
  private val _IpRegex = """\d+\.\d+\.\d+\.\d+(:\d+)?""".r


  def loginCallback(returnToUrl: String) = mvc.Action.async { request =>
    val qs = request.queryString
    lazy val id =
      qs.get("openid.claimedId").flatMap(_.headOption).orElse(
        qs.get("openid.identity"))
    Logger.trace("Verifying OpenID: "+ id +" ...")

    val futureResult = oid.OpenID.verifiedId(request) map { userInfo =>
      _handleLoginOk(request, userInfo, returnToUrl)
    } recover {
      case NonFatal(exception) =>
        _handleLoginFailure(request, exception, returnToUrl)
    }

    futureResult
  }


  private def _handleLoginOk(
        request: Request[AnyContent], info: oid.UserInfo, returnToUrl: String): Result = {

    Logger.trace("OpenID verified okay: " + info.id +
       ", attributes: " + info.attributes)

    // ----- Read request params

    def getAttr(name: String) = info.attributes.get(name)

    val emailOpt = getAttr("email")
    //nickNameOpt = getAttr(Nickname)
    val firstNameOpt = getAttr("firstname") // SECURITY sanitize, e.g. `|'
    val timeZoneOpt = getAttr("timezone")
    val countryOpt = getAttr("country")

    val prevSidValOpt = urlDecodeCookie("dwCoSid", request)
    val prevSid = prevSidValOpt.map(Sid.check _) getOrElse SidAbsent
    val addr = realOrFakeIpOf(request)
    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Globals.systemDao)

    def getQueryParam(paramName: String): Option[String] =
      request.queryString.get(paramName).flatMap(_.headOption)
    val oidOpLocalId = getQueryParam("openid.identity") getOrElse ""
    val oidEndpoint = getQueryParam("openid.op_endpoint").get
    // Play supports version 2 only?
    val oidVersion = "http://specs.openid.net/auth/2.0/server"
    // In the request to the OpenID Provider (OP), the openid.realm must be
    // consistent with the domain defined in openid.return_to.
    // (See https://developers.google.com/accounts/docs/OpenID#Parameters )
    // So we can reconstruct the realm that was specified
    // in the request to the OP, like so:
    val oidRealm = _wildcardRealmFor(request.host)

    // ----- Save login in database

    val loginAttempt = OpenIdLoginAttempt(
      ip = addr,
      date = new ju.Date,
      prevLoginId = prevSid.loginId,
      OpenIdDetails(
        oidEndpoint = oidEndpoint,
        oidVersion = oidVersion,
        oidRealm = oidRealm,
        // The claimedId might be null, if identifier selection is handled
        // at the OpenID provider (which is the case with Gmail).
        // Is the openid.claimedId query string param, if present,
        // otherwise the openid.identity param:
        oidClaimedId = info.id,
        oidOpLocalId = oidOpLocalId,
        firstName = firstNameOpt getOrElse "",
        email = emailOpt getOrElse "",
        country = countryOpt getOrElse ""))

    val loginGrant = Globals.siteDao(tenantId, ip = addr).tryLogin(loginAttempt)

    // ----- Reply, with session cookies

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = ConfigUserController.userConfigCookie(loginGrant)

    val result = returnToUrl match {
      case "" =>
        // Also see debiki-login-dialog.ls, search for [509KEF31].
        Ok(views.html.login.loginPopupCallback("LoginOk",
          s"You have been logged in, welcome ${loginGrant.displayName}!"))
      case url =>
        Redirect(url)
    }

    SHO ULD: Globals.strangerCounter.tellStrangerLoggedIn(request.siteId, request.theBrowserIdData)
    result.withCookies(userConfigCookie::sidAndXsrfCookies: _*)
  }


  private def _handleLoginFailure(
        request: Request[AnyContent], thrown: scala.Throwable, returnToUrl: String) = {

    import play.api.libs.openid.Errors
    import play.api.libs.openid.OpenIDError

    // Some errors are described here:
    //   http://openid.net/specs/openid-authentication-2_0.html
    // e.g. AUTH_ERROR which I think is indicated by the endpoint
    // sending is_valid=false, see section 11.4.2.2.

    val mess = thrown match {
      case Errors.AUTH_CANCEL =>
        // This message is easier to understand than Play's built in message?
        "Login failed: You cancelled the login, by denying access?"
      case error: OpenIDError =>
        Logger.warn(s"OpenID login failed: ${error.message} [DwE58FU0]")
        s"Login failed: ${error.message}"
      case x =>
        Logger.warn(s"OpenID login failed, unknown error: ${x.toString} [DwE3FSh8]")
        s"Login failed: ${x.toString}"
    }

    val anyReturnToUrl =
      if (returnToUrl.nonEmpty) Some(returnToUrl)
      else None

    // COULD fix status code handling: "LoginFailed" results in debiki.js
    // informing the user that "You closed the login window?" (which is
    // incorrect).
    Ok(views.html.login.loginPopupCallback(
      "LoginFailed", mess + " [error DwE3903r32]", anyReturnToUrl))
    //Redirect(routes.AppAuth.loginOpenidGet).flashing(
    //  "OpenID login failure" -> t.toString)
  }

} */
