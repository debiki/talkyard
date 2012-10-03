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
import PageActions._
import SafeActions._


object AppLoginGuest extends mvc.Controller {


  def loginGuest = CheckSidAction(parse.urlFormEncoded(maxLength = 200)) {
        (sidStatus, xsrfOk, request) =>

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

    val addr = request.remoteAddress
    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Debiki.SystemDao)

    val loginReq = LoginRequest(
      login = Login(id = "?", prevLoginId = sidStatus.loginId,
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


  def loginGuestAgainWithNewEmail(pageReq: PageRequest[_],
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

}
