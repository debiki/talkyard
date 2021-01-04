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

import com.debiki.core._
import debiki.EdHttp._
import play.api._
import play.api.mvc.{Action, ControllerComponents}
import Prelude._
import ed.server.{EdContext, EdController}
import javax.inject.Inject


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
class UnsubscriptionController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.safeActions.ExceptionAction

  SECURITY; SHOULD // (not urgent) not allow this type of email id to do anything else
  // than unsubbing, and expire after ... one month?

  val EmailIdParam = "emailId"
  val DoWhatParam = "do"

  val Unsub = ""
  val UnsubDone = "unsub-done"
  val PreventResub = "prevent-resub"
  val ResubPrevented = "resub-prevented"


  private def emailId(request: mvc.RequestHeader): String =
    request.queryString.get(EmailIdParam).map(_.head).getOrElse(
      throwBadReq("DwE03kI21", "No email id specified"))

  private def doWhat(request: mvc.RequestHeader): String =
     request.queryString.get(DoWhatParam).map(_.head).getOrElse(Unsub)

  private def nextPage(request: mvc.RequestHeader) =
    "/-/unsubscribe&emailId="+ emailId(request) +"&do="+ (doWhat(request) match {
      case Unsub => UnsubDone
      case UnsubDone => PreventResub
      case PreventResub => ResubPrevented
      case ResubPrevented => "unused-value"
      case x => throwForbidden("TyE3029541", "Bad 'do' url param value: " + x)
    })


  def showForm(emailId: EmailId): Action[Unit] = ExceptionAction(cc.parsers.empty) { request =>
    CSP_MISSING
    Ok(views.html.unsubscribePage(emailId, doWhat(request), nextPage(request)))
  }


  def handleForm(emailId: EmailId): Action[Map[String, Seq[String]]] =
        ExceptionAction(cc.parsers.formUrlEncoded(maxLength = 200)) { request =>
    val site = globals.lookupSiteOrThrow(request)

    SECURITY; SHOULD // rate limit and check email type.

    val dao = globals.siteDao(site.id)
    val email = dao.loadEmailById(emailId) getOrElse throwForbidden(
      "EsE8YJ93Q", "Email not found")

    // Find out what to do.
    val emailNotfPrefs: EmailNotfPrefs = doWhat(request) match {
      case Unsub => EmailNotfPrefs.DontReceive
      case PreventResub => EmailNotfPrefs.ForbiddenForever
      case _ => die("DwE82WM91")
    }

    if (email.toUserId.exists(Participant.isMember)) {
      dao.configRole(userId = email.toUserId.get, emailNotfPrefs = Some(emailNotfPrefs))
    }
    else {
      dao.configIdtySimple(
         ctime = globals.now().toJavaDate, emailAddr = email.sentTo,
         emailNotfPrefs = emailNotfPrefs)
    }

    SeeOther(routes.UnsubscriptionController.showHasBeenUnsubscribed().url)
  }


  def showHasBeenUnsubscribed(): Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    CSP_MISSING
    Ok(views.html.unsubscribe.youHaveBeenUnsubscribed().body) as HTML
  }

}

