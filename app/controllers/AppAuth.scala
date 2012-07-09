/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import Actions._
import Utils.{OkHtml}


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
    if (xsrfValOpt.isDefined && sidValOpt.isDefined) {
      assert(Xsrf.check(xsrfValOpt.get, sidValOpt).isInstanceOf[XsrfOk])
    }

    val sidXsrfNewCookies: Tuple3[SidOk, XsrfOk, List[Cookie]] =
      if (request.method == "GET") {
        // Reuse SID and xsrf token, or create new ones.
        (sidStatus, xsrfStatus) match {
          case (sidOk: SidOk, xsrfOk: XsrfOk) => (sidOk, xsrfOk, Nil)
          case (_, _) => Xsrf.newSidAndXsrf(None)
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
          case (_: SidOk, _) => throwForbiddenDialog(
            "DwE35k3wkU9", "Bad XSRF token", "",
            // If Javascript is disabled, the reason for the invalid token
            // could be as described in the end user message bellow. If,
            // however, Javascript is enabled, debiki.js should detect logins
            // in other browser tabs, and then check the new SID cookie and
            // refresh XSRF tokens in any <form>s.
            "Did you just log in as another user in another browser tab?\n"+
            "Try reloading this page.\n"+
            "And copy-paste [any text you've written but not saved] "+
            "to a text editor, or it'll be lost on reload.")
          case (_, _) => throwForbidden("DwE530Rstx90", "Bad SID")
        }
      }

    sidXsrfNewCookies
  }


  def loginSimple = ExceptionAction(parse.urlFormEncoded(maxLength = 200)) {
        request =>

    XSRF // check a token, so cannot fake logins via xsrf
    // (rather harmless though)

    def getOrDie(paramName: String, errCode: String): String =
      request.body.getOrElse(paramName, DebikiHttp.throwBadReq(errCode)).head

    val name = getOrDie("dw-fi-lgi-name", "DwE0k31c5")
    val email = getOrDie("dw-fi-lgi-email", "DwE8k3i30")
    val url = getOrDie("dw-fi-lgi-url", "DwE64kC21")

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

    if (User urlIsWeird url)
      failLogin("DwE734krsn215", "Weird URL.",
        "Please specify a website address with no weird characters.")

    val prevSidValOpt = urlDecodeCookie("dwCoSid", request)
    val prevSid = prevSidValOpt.map(Sid.check _) getOrElse SidAbsent
    val addr = request.remoteAddress
    val tenantId = lookupTenantByHost(request.host)

    val loginReq = LoginRequest(
      login = Login(id = "?", prevLoginId = prevSid.loginId,
        ip = addr, date = new ju.Date, identityId = "?i"),
      identity = IdentitySimple(id = "?i", userId = "?", name = name,
        email = email, location = "", website = url))

    val loginGrant =
       Debiki.tenantDao(tenantId, ip = addr).saveLogin(loginReq)

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = AppConfigUser.userConfigCookie(loginGrant)

    // Could include a <a href=last-page>Okay</a> link, see the
    // Logout dialog below. Only needed if javascript disabled though,
    // otherwise a javascript welcome dialog is shown instead.
    OkDialogResult("Welcome", "", // (empty summary)   // i18n
      "You have been logged in, welcome "+ loginGrant.displayName +"!").
       withCookies(userConfigCookie::sidAndXsrfCookies: _*)
  }


  def loginSimpleAgainWithNewEmail(pageReq: PageRequest[_],
        newEmailAddr: String): (LoginGrant, Seq[Cookie]) = {
    import pageReq._

    if (User.emailIsWeird(newEmailAddr))
      throwForbiddenDialog("DwE83ZJ1", "Weird Email", "",
        "Please specify a real email address.")
    if (newEmailAddr.isEmpty)
      throwForbiddenDialog("DwE7PUX2", "No Email", "",
        "No email address specified")

    val loginReq = LoginRequest(
       login = Login(id = "?", prevLoginId = loginId,
          ip = "?.?.?.?", date = pageReq.ctime, identityId = "?i"),
       identity = identity_!.asInstanceOf[IdentitySimple].copy(
          id = "?i", userId = "?", email = newEmailAddr))

    val loginGrant = pageReq.dao.saveLogin(loginReq)
    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))

    (loginGrant, sidAndXsrfCookies)
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
        OkHtml(<form action='' method='POST'>
          Really log out?
          <input type='submit' value='Yes'/>
        </form>)
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
        OkHtml(<p>You have been logged out. Return to last page?
            <a href=''>Okay</a>
          </p>)
          // keep the xsrf cookie, so login dialog works?
          .discardingCookies("dwCoSid", AppConfigUser.ConfigCookie)
    }
  }

  def lookupTenantByHost(host: String): String = {
    // For now, duplicate here the tenant lookup code from Global.
    // In the future, ?login-openid will be the login function (??), and
    // then the tenant lookup code in Global will be used.
    val scheme = "http" // for now
    Debiki.SystemDao.lookupTenant(scheme, host) match {
      case found: FoundChost => found.tenantId
      case found: FoundAlias => throwForbidden("DwE03h103", "Not impl")
      case FoundNothing =>
        throwNotFound("DwE2k5I9", "The specified host name maps to no tenant.")
    }
  }

}
