/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import debiki.JsX.{DateEpochOrNull, JsNumberOrNull, JsUser}
import debiki.dao.SiteDao
import ed.server._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._


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
class InviteController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.createSessionIdAndXsrfToken


  def sendInvite: Action[JsValue] = PostJsonAction(RateLimits.SendInvite, maxBytes = 200) {
        request =>
    import request.{dao, theRequester => requester}
    val toEmailAddress = (request.body \ "toEmailAddress").as[String].trim

    anyEmailAddressError(toEmailAddress) foreach { errMsg =>
      throwUnprocessableEntity("TyEBADEMLADR_-INV", s"Bad email address: $errMsg")
    }

    // Right now, only for staff and core members. [5WBJAF2]
    throwForbiddenIf(!requester.isStaffOrCoreMember,
       "TyE403INA0", "Currently only staff and core members may send invites")

    // Is toEmailAddress already a member or already invited?
    request.dao.readOnlyTransaction { transaction =>
      val alreadyExistingUser = transaction.loadMemberByPrimaryEmailOrUsername(toEmailAddress)
      if (alreadyExistingUser.nonEmpty) {
        // Maybe check if email verified? [5UKHWQ2]
        throwForbidden("_EsE403IUAM_", "That person has joined this site already")
      }

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
      createdAt = globals.now().toJavaDate)

    val anyProbablyUsername = request.dao.readOnlyTransaction { tx =>
      User.makeOkayUsername(
        invite.emailAddress.takeWhile(_ != '@'), allowDotDash = false,  // [CANONUN]
        tx.isUsernameInUse)
    }

    val probablyUsername = anyProbablyUsername getOrElse throwForbidden(
      "TyE3ABK5L0", s"I cannot generate a username given email address: $toEmailAddress")

    val email = makeInvitationEmail(invite, request.theMember,
      probablyUsername = probablyUsername, siteHostname = request.host)

    globals.sendEmail(email, request.siteId)

    try {
      request.dao.insertInvite(invite)
    }
    catch {
      case _: DbDao.DuplicateUserEmail =>
        // This is a very rare race condition.
        throwForbidden("DwE403JIU3", "You just invited him or her")
    }
    OkSafeJson(jsonForInvite(invite, isAdminOrSelf = true))
  }


  def acceptInvite(secretKey: String): Action[Unit] = GetActionAllowAnyone { request =>
    val (newUser, invite, alreadyAccepted) = request.dao.acceptInviteCreateUser(
      secretKey, request.theBrowserIdData)
    request.dao.pubSub.userIsActive(request.siteId, newUser.briefUser, request.theBrowserIdData)
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request.siteId, newUser.id)
    val newSessionCookies = sidAndXsrfCookies

    if (!alreadyAccepted) {
      // Could try to ensure this happens also if the server crashes here? [retry-after-crash]
      val welcomeEmail = makeWelcomeSetPasswordEmail(newUser, request.host)
      request.dao.saveUnsentEmail(welcomeEmail) // COULD (should?) mark as sent, how?
      globals.sendEmail(welcomeEmail, request.siteId)

      val inviter = request.dao.getUser(invite.createdById) getOrDie "DwE4KDEP0"
      val inviteAcceptedEmail = makeYourInviteWasAcceptedEmail(request.host, newUser, inviter)
      globals.sendEmail(inviteAcceptedEmail, request.siteId)
      // COULD create a notification instead / too.
    }

    Redirect("/").withCookies(newSessionCookies: _*)
  }


  def loadInvites(sentById: UserId): Action[Unit] = GetAction { request =>
    val isAdminOrSelf = request.theUser.isAdmin || request.theUserId == sentById
    if (!request.theUser.isStaff && request.theUserId != sentById)
      throwForbidden("DwE403INV0", "Any invites are private")

    val invites = request.dao.readOnlyTransaction { transaction =>
      transaction.loadInvites(createdById = sentById)
    }
    makeInvitesResponse(invites, showFullEmails = isAdminOrSelf, request.dao)
  }


  def loadAllInvites: Action[Unit] = StaffGetAction { request =>
    val isAdmin = request.theUser.isAdmin
    val invites = request.dao.readOnlyTransaction { transaction =>
      transaction.loadAllInvites(limit = 100)
    }
    makeInvitesResponse(invites, showFullEmails = isAdmin, request.dao)
  }


  private def makeInvitesResponse(invites: Seq[Invite], showFullEmails: Boolean, dao: SiteDao)
        : Result = {
    val senderIds = invites.map(_.createdById)
    val invitedIds = invites.flatMap(_.userId)
    val userIds = (senderIds ++ invitedIds).distinct
    val users = dao.getUsersAsSeq(userIds)
    OkSafeJson(Json.obj(
      "users" -> JsArray(users.map(JsUser)),
      "invites" -> JsArray(invites.map(jsonForInvite(_, showFullEmails)))))
  }


  private def jsonForInvite(invite: Invite, isAdminOrSelf: Boolean): JsValue = {
    val safeEmail = isAdminOrSelf ? invite.emailAddress | hideEmailLocalPart(invite.emailAddress)
    Json.obj(
      "invitedEmailAddress" -> safeEmail,
      "invitedById" -> invite.createdById,
      "createdAtEpoch" -> invite.createdAt.getTime,
      "createdById" -> invite.createdById,
      "acceptedAtEpoch" -> DateEpochOrNull(invite.acceptedAt),
      "deletedAtEpoch" -> DateEpochOrNull(invite.deletedAt),
      "deletedById" -> JsNumberOrNull(invite.deletedById),
      "invalidatedAtEpoch" -> DateEpochOrNull(invite.invalidatedAt),
      "userId" -> JsNumberOrNull(invite.userId))
  }


  private def makeInvitationEmail(invite: Invite, inviter: Member,
        probablyUsername: String, siteHostname: String): Email = {

    val emailBody = views.html.invite.inviteEmail(
      inviterName = inviter.usernameParensFullName, siteHostname = siteHostname,
      probablyUsername = probablyUsername, secretKey = invite.secretKey, globals).body
    Email(
      EmailType.Invite,
      createdAt = globals.now(),
      sendTo = invite.emailAddress,
      toUserId = None,
      subject = s"Invitation to $siteHostname",
      bodyHtmlText = (_) => emailBody)
  }


  private def makeWelcomeSetPasswordEmail(newUser: MemberInclDetails, siteHostname: String) = {
    Email(
      EmailType.InvitePassword,
      createdAt = globals.now(),
      sendTo = newUser.primaryEmailAddress,
      toUserId = Some(newUser.id),
      subject = s"[$siteHostname] Welcome! Account created",
      bodyHtmlText = (emailId) => views.html.invite.welcomeSetPasswordEmail(
      siteHostname = siteHostname, emailId = emailId, newUser.username, globals).body)
  }


  def makeYourInviteWasAcceptedEmail(siteHostname: String, newUser: MemberInclDetails, inviter: User)
        : Email = {
    Email(
      EmailType.InviteAccepted,
      createdAt = globals.now(),
      sendTo = inviter.email,
      toUserId = Some(inviter.id),
      subject = s"[$siteHostname] Your invitation for ${newUser.primaryEmailAddress} to join was accepted",
      bodyHtmlText = (_) => views.html.invite.inviteAcceptedEmail(
        siteHostname = siteHostname, invitedEmailAddress = newUser.primaryEmailAddress).body)
  }
}

