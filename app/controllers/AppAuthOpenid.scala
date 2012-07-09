package controllers

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
import com.debiki.v0.EmailNotfPrefs.EmailNotfPrefs
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.data._
import play.api.data.Forms._
import play.api.libs.concurrent._
import play.api.libs.{openid => oid}
import Actions._
import Utils.ValidationImplicits._


object AppAuthOpenid extends mvc.Controller {


  val Logger = play.api.Logger("app.openid")

  val RequiredAttrs = Seq(
    "email" -> "http://schema.openid.net/contact/email",
    "country" -> "http://axschema.org/contact/country/home",
    "timezone" -> "http://axschema.org/pref/timezone",
    "firstname" -> "http://axschema.org/namePerson/first")


  def loginGet = mvc.Action {
    Ok(views.html.loginOpenid())
  }


  // COULD change to an ErrorAction, and use throwBadReq instead of BadRequest.
  def loginPost = mvc.Action(parse.urlFormEncoded(maxLength = 200)) {
        request =>
    asyncLogin(returnToUrl = "")(request)
  }


  def asyncLogin(returnToUrl: String)(
        implicit request: Request[Map[String, Seq[String]]]): AsyncResult = {
    // (From the spec: The form field's "name" attribute should have the value
    // "openid_identifier", so that User-Agents can automatically
    // determine that this is an OpenID form.
    //    http://openid.net/specs/openid-authentication-2_0.html#discovery )
    val openIdIdentifier = request.body.getOrThrowBadReq("openid_identifier")
    val realm = _wildcardRealmFor(request.host)

    // Find out to which OpenID provider the user should be redirected to,
    // and subsequently login.
    var promise: Promise[String] =
      oid.OpenID.redirectURL(  // issues a HTTP request
        openIdIdentifier,
        routes.AppAuthOpenid.loginCallback(returnToUrl).absoluteURL(),
        RequiredAttrs,
        realm = Some(realm))

    // On success, redirect the browser to that provider.
    val result = promise.extend(_.value match {
      case Redeemed(url: String) =>
        Logger.trace("OpenID provider redirection URL discovered: " + url)
        Redirect(url)
      case Thrown(t) =>
        Logger.debug("OpenID provider redirection URL error, OpenId: " +
           openIdIdentifier +", error: "+ t)
        Redirect(routes.AppAuthOpenid.loginGet)
    })

    AsyncResult(result)
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
   *   http://code.google.com/googleapps/marketplace/sso.html
   *   http://code.google.com/intl/es-ES/apis/accounts/docs/OpenID.html
   */
  private def _wildcardRealmFor(host: String): String = {
    val isIpNo = _IpRegex matches host
    val hostNameSpecified = !isIpNo && host.count(_ == '.') >= 2
    val realm = "http://"+ (if (hostNameSpecified) {
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


  def loginCallback(returnToUrl: String) = mvc.Action { request =>
    val qs = request.queryString
    lazy val id =
      qs.get("openid.claimedId").flatMap(_.headOption).orElse(
        qs.get("openid.identity"))
    Logger.trace("Verifying OpenID: "+ id +" ...")

    AsyncResult(oid.OpenID.verifiedId(request).extend(_.value match {
      case Redeemed(userInfo) => _handleLoginOk(request, userInfo, returnToUrl)
      case Thrown(t) => _handleLoginFailure(request, t)
    }))
  }


  private def _handleLoginOk(
        request: Request[AnyContent], info: oid.UserInfo, returnToUrl: String)
        : Result = {

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
    val addr = request.remoteAddress
    val tenantId = AppAuth.lookupTenantByHost(request.host)

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

    val loginReq = LoginRequest(
      Login(id = "?", prevLoginId = prevSid.loginId,
        ip = addr, date = new ju.Date,
        identityId = "?i"),
      IdentityOpenId(id = "?i",
        userId = "?",
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

    val loginGrant =
       Debiki.tenantDao(tenantId, ip = addr).saveLogin(loginReq)

    // ----- Reply, with session cookies

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = AppConfigUser.userConfigCookie(loginGrant)

    val result = returnToUrl match {
      case "" =>
        Ok(views.html.loginOpenidCallback("LoginOk",
          "You have been logged in, welcome " + loginGrant.displayName +"!"))
      case url =>
        Redirect(url)
    }

    result.withCookies(userConfigCookie::sidAndXsrfCookies: _*)
  }


  private def _handleLoginFailure(
        request: Request[AnyContent], thrown: scala.Throwable) = {

    val mess = thrown match {
      case play.api.libs.openid.Errors.AUTH_ERROR =>
        // Concerning is_valid=false, see section 11.4.2.2 here:
        // http://openid.net/specs/openid-authentication-2_0.html
        Logger.debug("OpenID verification failed: "+ thrown)
        "Authentication failed: The OpenID provider said: is_valid=false."
      case _ =>
        Logger.warn("Openid verification failed: Unknown error: "+ thrown)
        "Authentication failed: Unknown error."
    }

    // COULD fix status code handling: "LoginFailed" results in debiki.js
    // informing the user that "You closed the login window?" (which is
    // incorrect).
    Ok(views.html.loginOpenidCallback(
      "LoginFailed", mess + " [error DwE3903r32]"))
    //Redirect(routes.AppAuth.loginOpenidGet).flashing(
    //  "OpenID login failure" -> t.toString)
  }

}
