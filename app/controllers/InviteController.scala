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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.ReactJson.{DateEpochOrNull, JsStringOrNull, JsBooleanOrNull, JsNumberOrNull}
import io.efdi.server.http._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import scala.util.Try
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
    val toEmailAddress = (request.body \ "toEmailAddress").as[String].trim

    if (!isValidNonLocalEmailAddress(toEmailAddress))
      throwForbidden("DwE47YK2", "Bad email address")

    // Right now there are no trust levels, so allow only admins to send invites.
    if (!request.theUser.isAdmin)
      throwForbidden("DwE403INA0", "Currently only admins may send invites")

    // Is toEmailAddress already a member or already invited?
    request.dao.readOnlyTransaction { transaction =>
      val alreadyExistingUser = transaction.loadMemberByEmailOrUsername(toEmailAddress)
      if (alreadyExistingUser.nonEmpty)
        throwForbidden("_EsE403IUAM_", "That person has joined this site already")

      val invites = transaction.loadInvites(createdById = request.theUserId)
      for (invite <- invites if invite.emailAddress == toEmailAddress) {
        if (invite.invalidatedAt.isEmpty && invite.deletedAt.isEmpty)
          throwForbidden("_EsE403IAAC0_", "You have invited him or her already")
      }
    }

    val invite = Invite(
      secretKey = nextRandomString(),
      emailAddress = toEmailAddress,
      createdById = request.theUserId,
      createdAt = new ju.Date)

    val email = makeInvitationEmail(invite, request.theMember, request.host)
    debiki.Globals.sendEmail(email, request.siteId)
    try {
      request.dao.insertInvite(invite)
    }
    catch {
      case DbDao.DuplicateUserEmail =>
        // This is a very rare race condition.
        throwForbidden("DwE403JIU3", "You just invited him or her")
    }
    OkSafeJson(jsonForInvite(invite, isAdminOrSelf = true))
  }


  def acceptInvite(secretKey: String) = GetActionAllowAnyone { request =>
    val (newUser, invite, alreadyAccepted) = request.dao.acceptInviteCreateUser(secretKey)
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(request.siteId, newUser.id)
    val newSessionCookies = sidAndXsrfCookies

    if (!alreadyAccepted) {
      // Could try to ensure this happens also if the server crashes here? [retry-after-crash]
      val welcomeEmail = makeWelcomeSetPasswordEmail(newUser, request.host)
      request.dao.saveUnsentEmail(welcomeEmail) // COULD (should?) mark as sent, how?
      debiki.Globals.sendEmail(welcomeEmail, request.siteId)

      val inviter = request.dao.getUser(invite.createdById) getOrDie "DwE4KDEP0"
      val inviteAcceptedEmail = makeYourInviteWasAcceptedEmail(request.host, newUser, inviter)
      debiki.Globals.sendEmail(inviteAcceptedEmail, request.siteId)
      // COULD create a notification instead / too.
    }

    Redirect("/").withCookies(newSessionCookies: _*)
  }


  def listInvites(sentById: String) = GetAction { request =>
    val senderId = Try(sentById.toInt) getOrElse throwBadReq("DwE6FWV0", "Bad user id")
    val isAdminOrSelf = request.theUser.isAdmin || request.theUserId == senderId
    if (!request.theUser.isStaff && request.theUserId != senderId)
      throwForbidden("DwE403INV0", "Any invites are private")

    request.dao.readOnlyTransaction { transaction =>
      val invites = transaction.loadInvites(createdById = senderId)
      OkSafeJson(JsArray(invites.map(jsonForInvite(_, isAdminOrSelf))))
    }
  }


  private def jsonForInvite(invite: Invite, isAdminOrSelf: Boolean): JsValue = {
    val safeEmail = isAdminOrSelf ? invite.emailAddress | hideEmailLocalPart(invite.emailAddress)
    Json.obj(
      "invitedEmailAddress" -> safeEmail,
      "invitedById" -> invite.createdById,
      "createdAtEpoch" -> invite.createdAt.getTime,
      "acceptedAtEpoch" -> DateEpochOrNull(invite.acceptedAt),
      "deletedAtEpoch" -> DateEpochOrNull(invite.deletedAt),
      "deletedById" -> JsNumberOrNull(invite.deletedById),
      "invalidatedAtEpoch" -> DateEpochOrNull(invite.invalidatedAt),
      "userId" -> JsNumberOrNull(invite.userId))
  }


  private def makeInvitationEmail(invite: Invite, inviter: Member, siteHostname: String): Email = {
    val emailBody = views.html.invite.inviteEmail(
      inviterName = inviter.usernameParensFullName,
      siteHostname = siteHostname, secretKey = invite.secretKey).body
    Email(
      EmailType.Invite,
      sendTo = invite.emailAddress,
      toUserId = None,
      subject = s"Invitation to $siteHostname",
      bodyHtmlText = (emailId) => emailBody)
  }


  private def makeWelcomeSetPasswordEmail(newUser: MemberInclDetails, siteHostname: String) = {
    Email(
      EmailType.InvitePassword,
      sendTo = newUser.emailAddress,
      toUserId = Some(newUser.id),
      subject = s"Welcome to $siteHostname, account created",
      bodyHtmlText = (emailId) => views.html.invite.welcomeSetPasswordEmail(
      siteHostname = siteHostname, emailId = emailId).body)
  }


  def makeYourInviteWasAcceptedEmail(siteHostname: String, newUser: MemberInclDetails, inviter: User) = {
    Email(
      EmailType.InviteAccepted,
      sendTo = inviter.email,
      toUserId = Some(inviter.id),
      subject = s"Your invitation for ${newUser.emailAddress} to join $siteHostname was accepted",
      bodyHtmlText = (emailId) => views.html.invite.inviteAcceptedEmail(
        siteHostname = siteHostname, invitedEmailAddress = newUser.emailAddress).body)
  }
}

