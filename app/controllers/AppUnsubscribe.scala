package controllers

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Dao.LoginRequest
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._
import Utils.{OkHtml}


object AppUnsubscribe extends mvc.Controller {

  import Debiki.Dao

  val EmailIdParam = "email-id"
  val PreventResubParam = "prevent-resub"


  def showForm(tenantId: String) = ExceptionAction { request =>
    Ok
  }


  def handleForm(tenantId: String) =
        ExceptionAction(BodyParsers.parse.urlFormEncoded) { request =>

    val emailId: String =
      request.queryString.get(EmailIdParam).map(_.head).getOrElse(
        throwBadReq("DwE03kI21", "No email id specified"))

    val emailNotfPrefs: EmailNotfPrefs.Value =
      request.body.get(PreventResubParam).map(_.head) match {
        case Some("t") => EmailNotfPrefs.ForbiddenForever
        case Some(x) if x != "f" =>
          throwBadParamValue("DwE09krI2", PreventResubParam)
        case _ => EmailNotfPrefs.DontReceive  // matches None and "f"
      }

    val loginNoId = Login(id = "?", prevLoginId = None, ip = "?.?.?.?",
       date = new ju.Date, identityId = "?")

    val loginReq = LoginRequest(loginNoId, IdentityEmailId(emailId))
    val loginGrant = Dao.saveLogin(tenantId, loginReq)

    import loginGrant.{login, identity, user}
    val idtyEmailId = identity.asInstanceOf[IdentityEmailId]

    if (user.isAuthenticated) {
      Dao.configRole(tenantId, loginId = login.id, ctime = login.date,
         roleId = user.id, emailNotfPrefs = emailNotfPrefs)
    }
    else {
      // `emailSent' is available after login.
      val emailAddr = idtyEmailId.emailSent.get.sentTo
      Dao.configIdtySimple(tenantId, loginId = login.id,
         ctime = login.date, emailAddr = emailAddr,
         emailNotfPrefs = emailNotfPrefs)
    }

    // Don't save any login cookie. Email login is not safe, because
    // emails are transmitted in the clear, and the email id is included
    // in the url, and might end up in access logs or being sent to other
    // web sites, in the Referer header. (But using it for unsubscriptions
    // seems reasonably okay, I think.)

    // showForm, with updated info, allow user to post again,
    // e.g. to prevent resubscription.
    Ok
  }

}

