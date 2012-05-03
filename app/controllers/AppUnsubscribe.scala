package controllers

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.data._
import play.api.mvc.BodyParsers.parse
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import Actions._
import Prelude._
import Utils.{OkHtml}


/**
 * Unsubscribes a user from email notifications.
 *
 * Note: Uses email id login, to authenticate the user.
 * But! Don't save any login cookie. Email login is not safe, because
 * emails are transmitted in the clear, and the email id is included
 * in the url, and might end up in access logs or being sent to other
 * web sites, in the Referer header. So only use each email id
 * for one distinct non-repeatable task?
 */
object AppUnsubscribe extends mvc.Controller {

  val EmailIdParam = "email-id"
  val DoWhatParam = "do"

  val Unsub = ""
  val UnsubDone = "unsub-done"
  val PreventResub = "prevent-resub"
  val ResubPrevented = "resub-prevented"


  def emailId(implicit request: mvc.RequestHeader): String =
    request.queryString.get(EmailIdParam).map(_.head).getOrElse(
      throwBadReq("DwE03kI21", "No email id specified"))

  def doWhat(implicit request: mvc.RequestHeader): String =
     request.queryString.get(DoWhatParam).map(_.head).getOrElse(Unsub)

  def nextPage(implicit request: mvc.RequestHeader) =
    "?unsubscribe&email-id="+ emailId +"&do="+ (doWhat match {
      case Unsub => UnsubDone
      case UnsubDone => PreventResub
      case PreventResub => ResubPrevented
      case ResubPrevented => "unused-value"
      case x => assErr("DwE3029541", "Bad &do: "+ x)
    })


  def showForm(tenantId: String) = ExceptionActionNoBody { implicit request =>
    Ok(views.html.unsubscribePage(emailId, doWhat, nextPage))
  }


  def handleForm(tenantId: String) =
        ExceptionAction(parse.urlFormEncoded(maxLength = 200)) {
        implicit request =>

    // Login.
    val loginNoId = Login(id = "?", prevLoginId = None,
       ip = request.remoteAddress, date = new ju.Date, identityId = emailId)
    val loginReq = LoginRequest(loginNoId, IdentityEmailId(emailId))
    val dao = Debiki.tenantDao(tenantId, ip = request.remoteAddress)

    val loginGrant =
      try dao.saveLogin(tenantId, loginReq)
      catch {
        case ex: Dao.EmailNotFoundException =>
          throwForbidden("DwE530KI37", "Email not found")
      }

    import loginGrant.{login, identity, user}
    val idtyEmailId = identity.asInstanceOf[IdentityEmailId]

    // Find out what to do.
    val emailNotfPrefs = doWhat match {
      case Unsub => EmailNotfPrefs.DontReceive
      case PreventResub => EmailNotfPrefs.ForbiddenForever
      case x => assErr("DwE82WM91")
    }

    // Do it.
    if (user.isAuthenticated) {
      dao.configRole(tenantId, loginId = login.id, ctime = login.date,
         roleId = user.id, emailNotfPrefs = emailNotfPrefs)
    }
    else {
      val emailAddr = idtyEmailId.emailSent.get.sentTo
      dao.configIdtySimple(tenantId, loginId = login.id,
         ctime = login.date, emailAddr = emailAddr,
         emailNotfPrefs = emailNotfPrefs)
    }

    // Tell user what happened.
    SeeOther(nextPage)
  }

}

