/**
 * Copyright (c) 2017 Kaj Magnus Lindberg
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

package ed.server.summaryemails

import com.debiki.core._
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}
import UnsubFromSummariesController._


object UnsubFromSummariesController {

  val EmailIdInpName = "emailId"
  val WhatInpName = "what"

  val InpValUnsub = "Unsub"
  val InpValMonthly = "Monthly"
  val InpVal2ndWeek = "2ndWeek"
  val InpValWeekly = "Weekly"
  val InpValDaily = "Daily"

}


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
class UnsubFromSummariesController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.safeActions.ExceptionAction
  import context.globals


  def showUnsubForm(emailId: EmailId): Action[Unit] = ExceptionAction(cc.parsers.empty) { request =>
    val site = globals.lookupSiteOrThrow(request)
    val dao = globals.siteDao(site.id)
    val email = dao.loadEmailById(emailId) getOrElse throwForbidden("EdE5JGKW0", "Bad email id")
    CSP_MISSING
    Ok(views.html.summaryemails.unsubFromSummariesPage(emailId, emailAddress = email.sentTo))
  }


  def handleForm: Action[JsonOrFormDataBody] =
        ExceptionAction(new JsonOrFormDataBodyParser(executionContext, cc).parser(maxBytes = 200)) {
          request =>

    val emailId = request.body.getFirst(EmailIdInpName) getOrElse throwParamMissing(
      "EdE2JC0BMX", EmailIdInpName)
    val what = request.body.getFirst(WhatInpName) getOrElse throwParamMissing(
      "EdE6BTU5Y9", WhatInpName)
    val site = globals.lookupSiteOrThrow(request)

    SECURITY; SHOULD // rate limit?

    val dao = globals.siteDao(site.id)
    val email = dao.loadEmailById(emailId) getOrElse throwForbidden("EdE8YEM2Q", "Bad email id")

    if (!email.toUserId.exists(Participant.isMember))
      throwForbidden("EdEZ5JKW30", "Not a member")

    if (email.tyype != EmailType.ActivitySummary)
      throwForbidden("EdE5SRK2L1", s"Wrong email type: ${email.tyype}")

    // Also in Javascript: [7GKW4E1]
    val newIntervalMins = what match {
      case InpValUnsub => SummaryEmails.DoNotSend
      case InpValMonthly => 60 * 24 * 365 / 12
      case InpVal2ndWeek => 60 * 24 * 7 * 2
      case InpValWeekly => 60 * 24 * 7
      case InpValDaily => 60 * 24
      case _ =>
        throwForbidden("EdE2GPRSM")
    }

    dao.configRole(userId = email.toUserId.get,
      activitySummaryEmailsIntervalMins = Some(newIntervalMins))

    SeeOther(routes.UnsubFromSummariesController.showHasBeenUnsubscribed().url)
  }


  def showHasBeenUnsubscribed(): Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    CSP_MISSING
    Ok(views.html.summaryemails.unsubFromSummariesDonePage())
  }

}

