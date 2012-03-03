/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import com.debiki.v0.EmailNotfPrefs.EmailNotfPrefs
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import Actions._


object AppAuth extends mvc.Controller {

  /**
   * Finds the session id and any xsrf token in the specified request;
   * throws an error if this is not a GET request and the xsrf token is bad.
   * @return The current SID and xsrf token. Or new ones if needed (with no
   * login id, no user, no display name), and a new SID and xsrf cookie.
   * @throws DebikiHttp.ResultException, for non-GET requests,
   * if the SID or the XSRF token is bad.
   */
  def checkSidAndXsrfToken(request: Request[_])
        : (SidOk, XsrfOk, List[Cookie]) = {

    val sidValOpt = urlDecodeCookie("dwCoSid", request)
    val sidStatus: SidStatus = sidValOpt.map(Sid.check(_)) getOrElse SidAbsent

    // On GET requests, simply accept the value of the xsrf cookie.
    // (On POST requests, however, we check the xsrf form input value)
    val xsrfValOpt = urlDecodeCookie("dwCoXsrf", request)
    var xsrfStatus: XsrfStatus = xsrfValOpt.map(XsrfOk(_)) getOrElse XsrfAbsent
    // However, we might catch some bug if we verify it matches the sid:
    if (xsrfValOpt.isDefined) {
      assert(Xsrf.check(xsrfValOpt.get, sidValOpt).isInstanceOf[XsrfOk])
    }

    val sidXsrfNewCookies: Tuple3[SidOk, XsrfOk, List[Cookie]] =
      if (request.method == "GET") {
        // Reuse SID and xsrf token, or create new ones.
        (sidStatus, xsrfStatus) match {
          case (sidOk: SidOk, xsrfOk: XsrfOk) => (sidOk, xsrfOk, Nil)
          case (_, _) => Xsrf.newSidAndXsrf(
            loginId = None, userId = None, displayName = None)
        }
      } else {
        // There must be an xsrf token in the POST:ed form data.
        assert(request.method == "POST") // for now
        val params = request.body.asInstanceOf[Map[String, Seq[String]]]
        val xsrfToken: String =
          params.get(FormHtml.XsrfInpName).map(_.head).getOrElse(
            throwForbidden("DwE0y321", "No XSRF token"))
        xsrfStatus = Xsrf.check(xsrfToken, sidValOpt)
        (sidStatus, xsrfStatus) match {
          case (sidOk: SidOk, xsrfOk: XsrfOk) => (sidOk, xsrfOk, Nil)
          case (_: SidOk, _) => throwForbidden("DwE35k3wkU9", "Bad XSRF token")
          case (_, _) => throwForbidden("DwE530Rstx90", "Bad SID")
        }
      }

    sidXsrfNewCookies
  }

  def loginSimple = ErrorAction(parse.urlFormEncoded(maxLength = 200)) {
        request =>

    XSRF // check a token, so cannot fake logins via xsrf
    // (rather harmless though)

    def getOrDie(paramName: String, errCode: String): String =
      request.body.getOrElse(paramName, DebikiHttp.throwBadReq(errCode)).head

    val name = getOrDie("dw-fi-login-name", "DwE0k31c5")
    val email = getOrDie("dw-fi-login-email", "DwE8k3i30")
    val emailNotfInp = request.body.getOrElse("dw-fi-lgi-spl-email-ntf", "no")
    val url = getOrDie("dw-fi-login-url", "DwE64kC21")

    def failLogin(errCode: String, summary: String, details: String) =
      throwForbiddenDialog(errCode, "Login Failed", summary, details)

    if (User nameIsWeird name)
      failLogin("DwE82ckWE19", "Weird name.",
        "Please specify another name, with no weird characters.")
    if (name isEmpty)
      failLogin("DwE873k2e90", "No name specified.",
        "Please fill in your name.")
    if (email.nonEmpty && User.emailIsWeird(email))
      failLogin("DwE0432hrsk23", "Weird email.",
        "Please specify an email address with no weird characters.")

    val emailNotfPrefs: EmailNotfPrefs = emailNotfInp match {
      case "yes" =>
        if (email isEmpty)
          failLogin("DwE9UW5", "No email address.",
            "Please specify an email address, so you can receive"+
            " email notifications.")
        EmailNotfPrefs.Receive
      case "no" => EmailNotfPrefs.DontReceive
      case _ =>
        // Someone has hand crafted this request?
        throwBadReq("DwE03k1r35009", "Weird checkbox value.")
    }

    if (User urlIsWeird url)
      failLogin("DwE734krsn215", "Weird URL.",
        "Please specify a website address with no weird characters.")

    val prevSidValOpt = urlDecodeCookie("dwCoSid", request)
    val prevSid = prevSidValOpt.map(Sid.check _) getOrElse SidAbsent
    val addr = "?.?.?.?"  // TODO
    val tenantId = lookupTenantByHost(request.host)

    val loginReq = Dao.LoginRequest(
      login = Login(id = "?", prevLoginId = prevSid.loginId,
        ip = addr, date = new ju.Date, identityId = "?i"),
      identity = IdentitySimple(id = "?i", userId = "?", name = name,
        email = email, location = "", website = url))

    val loginGrant = Debiki.Dao.saveLogin(tenantId, loginReq)

    if (loginGrant.user.emailNotfPrefs != emailNotfPrefs) {
      // The user changed the "Email me if someone replies to me"
      // setting. Update the database.
      Debiki.Dao.configIdtySimple(
        tenantId, loginId = loginGrant.login.id,
        ctime = loginGrant.login.date,
        emailAddr = email, emailNotfPrefs = emailNotfPrefs)
    }

    // -----
    // Duplicated code! Display name also constructed in NiLo,
    // in user.scala in debiki-core. COULD write another ctor for NiLo so
    // a NiLo can be used here too? NiLo(loginGrant.login, identity, user).
    var displayName = loginGrant.user.displayName
    if (displayName isEmpty) displayName = loginGrant.identity.displayName
    // -----
    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(
      Some(loginGrant.login.id),
      Some(loginGrant.user.id),
      Some(displayName))

    // Could include a <a href=last-page>Okay</a> link, see the
    // Logout dialog below. Only needed if javascript disabled though,
    // otherwise a javascript welcome dialog is shown instead.
    OkDialogResult("Welcome", "", // (empty summary)
      "You have been logged in, welcome "+ name +"!").  // i18n
      withCookies(sidAndXsrfCookies: _*)
  }

  /**
   * Clears login related cookies and OpenID and OpenAuth stuff.
   *
   * GET -> An "Are you sure?" dialog.
   * POST -> logout.
   */
  // --- later, when is ?logout: -------
  // CheckSidAndPathAction(parse.urlFormEncoded(maxLength = 100)) {
  //  (sidOk, xsrfOk, pagePath, request) =>
  // -----------------------------------
  def logout = mvc.Action(parse.urlFormEncoded(maxLength = 100)) { request =>
    request.method match {
      case "GET" =>
        Ok(<form action='' method='POST'>
          Really log out?
          <input type='submit' value='Yes'/>
        </form>) as HTML
      case "POST" =>
        /*
        val sidCookieVal = LiftUtil.decodeCookie("dwCoSid")
        val sid = sidCookieVal.map(Sid.checkSid(_)) openOr SidAbsent
        sid.loginId foreach { loginId =>
          try {
            Boot.dao.saveLogout(loginId, logoutIp = req.remoteAddr)
          } catch {
            case e: Throwable => logger.warn(
              "Error writing logout to database: "+ e.getMessage +
                 " [error DwE35k0sk2i6]")  // COULD LOG stack trace?
            // Continue logging out anyway.
          }
        }
        */
        (Ok(<p>You have been logged out. Return to last page?
            <a href=''>Okay</a>
          </p>) as HTML)
          .discardingCookies("dwCoSid")  // keep the xsrf cookie,
                                         // so login dialog works?
    }
  }

  def lookupTenantByHost(host: String): String = {
    // For now, duplicate here the tenant lookup code from Globa.
    // In the future, ?login-openid will be the login function (??), and
    // then the tenant lookup code in Global will be used.
    val scheme = "http" // for now
    Debiki.Dao.lookupTenant(scheme, host) match {
      case found: FoundChost => found.tenantId
      case found: FoundAlias => throwForbidden("DwE03h103", "Not impl")
      case FoundNothing =>
        throwNotFound("DwE2k5I9", "The specified host name maps to no tenant.")
    }
  }

}
