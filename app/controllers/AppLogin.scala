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


object AppLogin extends mvc.Controller {


  def showLoginForm(returnToUrl: String) = ExceptionActionNoBody {
        implicit request =>
    // For now
    Ok(views.html.loginOpenid())
  }


  def loginWith(provider: String, returnToUrl: String) = ExceptionActionNoBody {
        implicit reqest =>
    OkHtml(<i>todo</i>)
  }


  def loginWithPostData(returnToUrl: String) = ExceptionAction(
        parse.urlFormEncoded(maxLength = 200)) { implicit request =>
    // For now. Should handle guest login forms too.
    AppLoginOpenId.asyncLoginWithPostData(returnToUrl = "")
  }


  def showLogoutForm = ExceptionActionNoBody { implicit request =>
    OkHtml(
      <form action='' method='POST'>
        Really log out?
        <input type='submit' value='Yes'/>
      </form>)
  }


  /**
   * Clears login related cookies and OpenID and OpenAuth stuff.
   */
  // --- later, when is ?logout: -------
  // CheckSidAndPathAction(parse.urlFormEncoded(maxLength = 100)) {
  //  (sidOk, xsrfOk, pagePath, request) =>
  // -----------------------------------
  def logout = mvc.Action(parse.urlFormEncoded(maxLength = 100)) { request =>
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

      OkHtml(
        <p>
          You have been logged out. Return to last page? (Not implemented)
          <a href=''>Okay</a>
        </p>)
        // keep the xsrf cookie, so login dialog works?
        .discardingCookies("dwCoSid", AppConfigUser.ConfigCookie)
    }

}
