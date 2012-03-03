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
        implicit request =>
    // (From the spec: The form field's "name" attribute should have the value
    // "openid_identifier", so that User-Agents can automatically
    // determine that this is an OpenID form.
    //    http://openid.net/specs/openid-authentication-2_0.html#discovery )
      Form(single("openid_identifier" -> nonEmptyText)).bindFromRequest.fold(
      error => {
        Logger.debug("Bad request: " + error.toString)
        BadRequest(error.toString)
      }, {
        case (openid) =>
          AsyncResult(oid.OpenID.redirectURL(openid,
            routes.AppAuthOpenid.loginCallback.absoluteURL(),
            RequiredAttrs)
             .extend(_.value match {
            case Redeemed(url) =>
              Logger.trace("OpenID redirect URL found: " + url)
              Redirect(url)
            case Thrown(t) =>
              Logger.debug("OpenID redirect URL error, id: " + openid +
                 ", error: " + t)
              Redirect(routes.AppAuthOpenid.loginGet)
          }))
      })
  }


  def loginCallback = mvc.Action { request =>
    val qs = request.queryString
    lazy val id =
      qs.get("openid.claimedId").flatMap(_.headOption).orElse(
        qs.get("openid.identity"))
    Logger.trace("Verifying OpenID: "+ id +" ...")

    AsyncResult(oid.OpenID.verifiedId(request).extend(_.value match {
      case Redeemed(userInfo) => _handleLoginOk(request, userInfo)
      case Thrown(t) => _handleLoginFailure(request, t)
    }))
  }


  private def _handleLoginOk(
        request: Request[AnyContent], info: oid.UserInfo): Result = {

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
    val addr = "?.?.?.?" // TODO
    val tenantId = AppAuth.lookupTenantByHost(request.host)

    def getQueryParam(paramName: String): Option[String] =
      request.queryString.get(paramName).flatMap(_.headOption)
    val oidOpLocalId = getQueryParam("openid.identity") getOrElse ""
    val oidEndpoint = getQueryParam("openid.op_endpoint").get
    // Play supports version 2 only?
    val oidVersion = "http://specs.openid.net/auth/2.0/server"

    // ----- Save login in database

    val loginReq = Dao.LoginRequest(
      Login(id = "?", prevLoginId = prevSid.loginId,
        ip = addr, date = new ju.Date,
        identityId = "?i"),
      IdentityOpenId(id = "?i",
        userId = "?",
        oidEndpoint = oidEndpoint,
        oidVersion = oidVersion,
        oidRealm = "http://localhost:8080", // for now TODO MUST [Play-port]
        // The claimedId might be null, if identifier selection is handled
        // at the OpenID provider (which is the case with Gmail).
        // Is the openid.claimedId query string param, if present,
        // otherwise the openid.identity param:
        oidClaimedId = info.id,
        oidOpLocalId = oidOpLocalId,
        firstName = firstNameOpt getOrElse "",
        email = emailOpt getOrElse "",
        country = countryOpt getOrElse ""))

    val granted = Debiki.Dao.saveLogin(tenantId, loginReq)

    // ----- Check and update email settings

    // Use the email in the USERS table, if specified.
    val emailToUse =
      if (granted.user.email.nonEmpty) granted.user.email
      else granted.identity.email
    // Should remember related checbox value in the OpenID login form.
    val emailNotfPrefInp = EmailNotfPrefs.DontReceive // for now

    // Update database if user changed the "Be notified via email" setting.
    if (emailToUse.nonEmpty &&
       granted.user.emailNotfPrefs != emailNotfPrefInp) {
      Debiki.Dao.configRole(
        tenantId,
        loginId = granted.login.id,
        ctime = granted.login.date,
        roleId = granted.user.id,
        emailNotfPrefs = emailNotfPrefInp)
    }

    // ----- Reply OK, with cookies

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(
      loginId = Some(granted.login.id),
      userId = Some(granted.user.id),
      displayName = firstNameOpt)

    Ok(views.html.loginOpenidCallback("LoginOk",
      "You have been logged in, welcome " + firstNameOpt.getOrElse("") +"!"))
       .withCookies(sidAndXsrfCookies: _*)
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
