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

package controllers

import com.debiki.core.EmailNotfPrefs
import com.debiki.core._
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.mvc.BodyParsers.parse.empty
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
object UnsubscriptionController extends mvc.Controller {

  val OldEmailIdParam = "email-id" // <-- ok remove year 2016
  val EmailIdParam = "emailId"
  val DoWhatParam = "do"

  val Unsub = ""
  val UnsubDone = "unsub-done"
  val PreventResub = "prevent-resub"
  val ResubPrevented = "resub-prevented"


  private def emailId(request: mvc.RequestHeader): String =
    request.queryString.get(EmailIdParam).orElse(
      request.queryString.get(OldEmailIdParam)).map(_.head).getOrElse(
      throwBadReq("DwE03kI21", "No email id specified"))

  private def doWhat(request: mvc.RequestHeader): String =
     request.queryString.get(DoWhatParam).map(_.head).getOrElse(Unsub)

  private def nextPage(request: mvc.RequestHeader) =
    "/-/unsubscribe&emailId="+ emailId(request) +"&do="+ (doWhat(request) match {
      case Unsub => UnsubDone
      case UnsubDone => PreventResub
      case PreventResub => ResubPrevented
      case ResubPrevented => "unused-value"
      case x => assErr("DwE3029541", "Bad &do: "+ x)
    })


  def showForm() = ExceptionAction(empty) { request =>
    showFormImpl(request)
  }


  def showFormImpl(implicit request: Request[Unit]) = {
    Ok(views.html.unsubscribePage(emailId(request), doWhat(request), nextPage(request)))
  }


  def handleForm() = ExceptionAction(parse.urlFormEncoded(maxLength = 200)) { implicit request =>
    val site = DebikiHttp.lookupSiteOrThrow(request, debiki.Globals.systemDao)

    SECURITY // SHOULD rate limit and check email type.

    // Login.
    val loginAttempt = EmailLoginAttempt(
       ip = realOrFakeIpOf(request), date = new ju.Date, emailId = emailId(request))

    val dao = Globals.siteDao(site.id)

    val loginGrant =
      try dao.tryLogin(loginAttempt)
      catch {
        case ex: DbDao.EmailNotFoundException =>
          throwForbidden("DwE530KI37", "Email not found")
      }

    ??? /*
    import loginGrant.{identity, user}
    val idtyEmailId: IdentityEmailId = identity.getOrDie("DwE4YPF8").asInstanceOf[IdentityEmailId]

    // Find out what to do.
    val emailNotfPrefs: EmailNotfPrefs.Value = doWhat(request) match {
      case Unsub => EmailNotfPrefs.DontReceive
      case PreventResub => EmailNotfPrefs.ForbiddenForever
      case x => assErr("DwE82WM91")
    }

    // Do it.
    if (user.isAuthenticated) {
      dao.configRole(
        userId = user.id, emailNotfPrefs = Some(emailNotfPrefs))
    }
    else {
      val emailAddr = idtyEmailId.emailSent.get.sentTo
      dao.configIdtySimple(
         ctime = new ju.Date(), emailAddr = emailAddr,
         emailNotfPrefs = emailNotfPrefs)
    }

    // Tell user what happened.
    SeeOther(nextPage(request))
    */
  }

}

