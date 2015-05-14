/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions._
import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.ReactJson.{DateEpochOrNull, JsStringOrNull, JsBooleanOrNull, JsNumberOrNull}
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import requests.{PageRequest, DebikiRequest}
import scala.util.Try
import Utils.OkSafeJson
import Utils.ValidationImplicits._
import DebikiHttp.{throwForbidden, throwNotFound, throwBadReq}


/** Invites new users to join the site.
  *
  * Sends an email to newuser@ex.com, and when the user clicks a certain link in the
  * email, creates a user with username 'newuser' and the specified email address,
  * and logs the user in.
  *
  * Then sends another email that tells the user how to configure her password
  * before logging in the next time. And, if it's a Gmail address, that she can login
  * via Gmail (not yet implemented, not yet possible, though (May 2015)).
  */
object InviteController extends mvc.Controller {


  def sendInvite = PostJsonAction(RateLimits.SendInvite, maxLength = 200) {
        request =>
    val toEmailAddress = (request.body \ "toEmailAddress").as[String]

    // Right now there are no trust levels, so allow only admins to send invites.
    if (!request.theUser.isAdmin)
      throwForbidden("DwE403INA0", "Currently only admins may send invites")

    // Is toEmailAddress already a member or already invited?
    request.dao.readOnlyTransaction { transaction =>
      val alreadyExistingUser = transaction.loadUserByEmailOrUsername(toEmailAddress)
      if (alreadyExistingUser.nonEmpty)
        throwForbidden("DwE403IUAM0", "The person you want to invite has already joined this site")

      val invites = transaction.loadInvites(createdById = request.theUserId)
      for (invite <- invites if invite.emailAddress == toEmailAddress) {
        if (invite.invalidatedAt.nonEmpty || invite.deletedAt.nonEmpty)
          throwForbidden("Dw403IAAC0", "You have sent an invitation to him or her already")
      }
    }

    val invite = Invite(
      secretKey = nextRandomString(),
      emailAddress = toEmailAddress,
      createdById = request.theUserId,
      createdAt = new ju.Date)

    val email = makeInvitationEmail(invite, request.theUser, request.host)
    debiki.Globals.sendEmail(email, request.siteId)
    try {
      request.dao.insertInvite(invite)
    }
    catch {
      case DbDao.DuplicateUserEmail =>
        // This is a very rare race condition.
        throwForbidden("DwE403JIU3", "You just invited him or her")
    }
    OkSafeJson(jsonForInvite(invite))
  }


  def acceptInvite(secretKey: String) = GetAction { request =>
    val newUser = request.dao.acceptInviteCreateUser(secretKey)
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(newUser.briefUser)
    val newSessionCookies = sidAndXsrfCookies
    // TODO send set-password email
    // TODO send your-invite-was-accepted notification + email
    Redirect("/").withCookies(newSessionCookies: _*)
  }


  def listInvites(sentById: String) = GetAction { request =>
    val senderId = Try(sentById.toInt) getOrElse throwBadReq("DwE6FWV0", "Bad user id")
    if (!request.theUser.isAdmin && request.theUserId != senderId)
      throwForbidden("DwE403INV0", "Any invites are private")

    request.dao.readOnlyTransaction { transaction =>
      val invites = transaction.loadInvites(createdById = senderId)
      OkSafeJson(JsArray(invites.map(jsonForInvite)))
    }
  }


  private def jsonForInvite(invite: Invite): JsValue = {
    Json.obj(
      "invitedEmailAddress" -> invite.emailAddress,
      "invitedById" -> invite.createdById,
      "createdAtEpoch" -> invite.createdAt.getTime,
      "acceptedAtEpoch" -> DateEpochOrNull(invite.acceptedAt),
      "deletedAtEpoch" -> DateEpochOrNull(invite.deletedAt),
      "deletedById" -> JsNumberOrNull(invite.deletedById),
      "invalidatedAtEpoch" -> DateEpochOrNull(invite.invalidatedAt),
      "userId" -> JsNumberOrNull(invite.userId))
  }


  private def makeInvitationEmail(invite: Invite, inviter: User, siteHostname: String): Email = {
    var inviterName = inviter.username getOrDie "DwE4KFW0"
    if (inviter.displayName.nonEmpty) {
      inviterName += " (" + inviter.displayName + ")"
    }
    val acceptInviteUrl = s"http://$siteHostname/-/accept-invite/${invite.secretKey}"
    val emailBody = views.html.invite.inviteEmail(
      inviterName = inviterName, siteHostname = siteHostname, secretKey = invite.secretKey).body
    Email(
      EmailType.Invite,
      sendTo = invite.emailAddress,
      toUserId = None,
      subject = s"Invitation to $siteHostname",
      bodyHtmlText = (emailId) => emailBody)
  }

}

