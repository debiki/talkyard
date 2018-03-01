/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.User.{MinUsernameLength, isGuestId}
import debiki._
import debiki.EdHttp._
import debiki.ReactJson._
import ed.server.http._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents}
import scala.util.Try
import scala.collection.immutable
import debiki.RateLimits.TrackReadingActivity
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import javax.inject.Inject
import org.owasp.encoder.Encode


/** Handles requests related to users.
 */
class UserController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  import context.globals

  val MaxEmailsPerUser: Int = 5  // also in js [4GKRDF0]


  def listCompleteUsers(whichUsers: String): Action[Unit] = StaffGetAction { request =>
    var onlyApproved = false
    var onlyPendingApproval = false
    whichUsers match {
      case "ActiveUsers" =>
        onlyApproved = request.dao.getWholeSiteSettings().userMustBeApproved
      case "NewUsers" =>
        onlyPendingApproval = true
    }
    request.dao.readOnlyTransaction { transaction =>
      val usersPendingApproval = transaction.loadMembersInclDetails(
        onlyApproved = onlyApproved,
        onlyPendingApproval = onlyPendingApproval)
      val approverIds = usersPendingApproval.flatMap(_.approvedById)
      val suspenderIds = usersPendingApproval.flatMap(_.suspendedById)
      val usersById = transaction.loadMembersAsMap(approverIds ++ suspenderIds)
      COULD // later load all groups too, for each user. Not needed now though. [2WHK7PU0]
      val usersJson = JsArray(usersPendingApproval.map(
        jsonForMemberInclDetails(_, usersById, groups = Nil, callerIsAdmin = request.theUser.isAdmin,
          callerIsStaff = true)))
      OkSafeJson(Json.toJson(Map("users" -> usersJson)))
    }
  }


  /** Loads a member or group, incl details, or a guest (then there are no details).
    */
  def loadUserAnyDetails(who: String): Action[Unit] = GetAction { request =>
    val (userJson, anyStatsJson) = Try(who.toInt).toOption match {
      case Some(userId) => loadUserJsonAnyDetailsById(userId, includeStats = true, request)
      case None => loadMemberOrGroupJsonInclDetailsByEmailOrUsername(
        who, includeStats = true, request)
    }
    OkSafeJson(Json.toJson(Map("user" -> userJson, "stats" -> anyStatsJson)))
  }


  // A tiny bit dupl code [5YK02F4]
  private def loadUserJsonAnyDetailsById(userId: UserId, includeStats: Boolean,
        request: DebikiRequest[_]): (JsObject, JsValue) = {
    val callerIsStaff = request.user.exists(_.isStaff)
    val callerIsAdmin = request.user.exists(_.isAdmin)
    val callerIsUserHerself = request.user.exists(_.id == userId)
    val isStaffOrSelf = callerIsStaff || callerIsUserHerself
    request.dao.readOnlyTransaction { transaction =>
      val stats = includeStats ? transaction.loadUserStats(userId) | None
      val usersJson =
        if (User.isRoleId(userId)) {
          val memberOrGroup = transaction.loadTheMemberOrGroupInclDetails(userId)
          val groups = transaction.loadGroups(memberOrGroup)
          memberOrGroup match {
            case m: MemberInclDetails =>
              jsonForMemberInclDetails(m, Map.empty, groups, callerIsAdmin = callerIsAdmin,
                callerIsStaff = callerIsStaff, callerIsUserHerself = callerIsUserHerself)
            case g: Group =>
              jsonForGroupInclDetails(g, callerIsAdmin = callerIsAdmin,
                callerIsStaff = callerIsStaff)
          }
        }
        else {
          val user = transaction.loadTheGuest(userId)
          jsonForGuest(user, Map.empty, callerIsStaff = callerIsStaff,
            callerIsAdmin = callerIsAdmin)

        }
      (usersJson, stats.map(makeUserStatsJson(_, isStaffOrSelf)).getOrElse(JsNull))
    }
  }


  // A tiny bit dupl code [5YK02F4]
  private def loadMemberOrGroupJsonInclDetailsByEmailOrUsername(emailOrUsername: String,
        includeStats: Boolean, request: DebikiRequest[_]) = {
    val callerIsStaff = request.user.exists(_.isStaff)
    val callerIsAdmin = request.user.exists(_.isAdmin)

    // For now, unless admin, don't allow emails, so cannot brut-force test email addresses.
    if (emailOrUsername.contains("@") && !callerIsAdmin)
      throwForbidden("EsE4UPYW2", "Lookup by email not allowed")

    val isEmail = emailOrUsername.contains("@")
    if (isEmail)
      throwNotImplemented("EsE5KY02", "Lookup by email not implemented")

    request.dao.readOnlyTransaction { transaction =>
      val memberOrGroup =
            transaction.loadMemberOrGroupInclDetailsByUsername(emailOrUsername) getOrElse {
        if (isEmail)
          throwNotFound("EsE4PYW20", "User not found")

        // Username perhaps changed? Then ought to update the url, browser side [8KFU24R]
        val possibleUserIds = transaction.loadUsernameUsages(emailOrUsername).map(_.userId).toSet
        if (possibleUserIds.isEmpty)
          throwNotFound("EsEZ6F0U", "User not found")

        if (possibleUserIds.size > 1)
          throwNotFound("EsE4AK7B", "Many users with this username, weird")

        val userId = possibleUserIds.head
        transaction.loadMemberOrGroupInclDetails(userId) getOrElse throwNotFound(
          "EsE8PKU02", "User not found")
      }

      val groups = transaction.loadGroups(memberOrGroup)

      memberOrGroup match {
        case member: MemberInclDetails =>
          val stats = includeStats ? transaction.loadUserStats(member.id) | None
          val callerIsUserHerself = request.user.exists(_.id == member.id)
          val isStaffOrSelf = callerIsStaff || callerIsUserHerself
          val userJson = jsonForMemberInclDetails(
            member, Map.empty, groups, callerIsAdmin = callerIsAdmin,
            callerIsStaff = callerIsStaff, callerIsUserHerself = callerIsUserHerself)
          (userJson, stats.map(makeUserStatsJson(_, isStaffOrSelf)).getOrElse(JsNull))
        case group: Group =>
          val groupJson = jsonForGroupInclDetails(
            group, callerIsAdmin = callerIsAdmin, callerIsStaff = callerIsStaff)
          (groupJson, JsNull)
      }
    }
  }


  private def jsonForMemberInclDetails(user: MemberInclDetails, usersById: Map[UserId, Member],
      groups: immutable.Seq[Group],
      callerIsAdmin: Boolean, callerIsStaff: Boolean = false, callerIsUserHerself: Boolean = false)
        : JsObject = {
    var userJson = Json.obj(
      "id" -> user.id,
      "createdAtEpoch" -> JsNumber(user.createdAt.getTime),
      "username" -> user.username,
      "fullName" -> user.fullName,
      "isAdmin" -> user.isAdmin,
      "isModerator" -> user.isModerator,
      "country" -> JsStringOrNull(user.country),
      "url" -> JsStringOrNull(user.website),
      "about" -> JsStringOrNull(user.about),
      "avatarUrl" -> JsUploadUrlOrNull(user.smallAvatar),
      "mediumAvatarUrl" -> JsUploadUrlOrNull(user.mediumAvatar),
      "suspendedTillEpoch" -> DateEpochOrNull(user.suspendedTill),
      "effectiveTrustLevel" -> user.effectiveTrustLevel.toInt)

    if (callerIsStaff || callerIsUserHerself) {
      val anyApprover = user.approvedById.flatMap(usersById.get)
      val safeEmail =
        if (callerIsAdmin || callerIsUserHerself) user.primaryEmailAddress
        else hideEmailLocalPart(user.primaryEmailAddress)

      userJson += "email" -> JsString(safeEmail)
      userJson += "emailForEveryNewPost" -> JsBoolean(user.emailForEveryNewPost)
      userJson += "summaryEmailIntervalMinsOwn" -> JsNumberOrNull(user.summaryEmailIntervalMins)
      userJson += "summaryEmailIntervalMins" ->
          JsNumberOrNull(user.effectiveSummaryEmailIntervalMins(groups))
      userJson += "summaryEmailIfActiveOwn" -> JsBooleanOrNull(user.summaryEmailIfActive)
      userJson += "summaryEmailIfActive" ->
          JsBooleanOrNull(user.effectiveSummaryEmailIfActive(groups))
      userJson += "isApproved" -> JsBooleanOrNull(user.isApproved)
      userJson += "approvedAtEpoch" -> DateEpochOrNull(user.approvedAt)
      userJson += "approvedById" -> JsNumberOrNull(user.approvedById)
      userJson += "approvedByName" -> JsStringOrNull(anyApprover.flatMap(_.fullName))
      userJson += "approvedByUsername" -> JsStringOrNull(anyApprover.flatMap(_.username))
      userJson += "suspendedAtEpoch" -> DateEpochOrNull(user.suspendedAt)
      userJson += "suspendedReason" -> JsStringOrNull(user.suspendedReason)
    }

    if (callerIsStaff) {
      val anySuspender = user.suspendedById.flatMap(usersById.get)
      userJson += "suspendedById" -> JsNumberOrNull(user.suspendedById)
      userJson += "suspendedByUsername" -> JsStringOrNull(anySuspender.flatMap(_.username))
      userJson += "trustLevel" -> JsNumber(user.trustLevel.toInt)
      userJson += "lockedTrustLevel" -> JsNumberOrNull(user.lockedTrustLevel.map(_.toInt))
      userJson += "threatLevel" -> JsNumber(user.threatLevel.toInt)
      userJson += "lockedThreatLevel" -> JsNumberOrNull(user.lockedThreatLevel.map(_.toInt))
    }
    userJson
  }


  private def jsonForGroupInclDetails(group: Group, callerIsAdmin: Boolean,
      callerIsStaff: Boolean = false): JsObject = {
    var json = Json.obj(
      "id" -> group.id,
      "isGroup" -> JsTrue,
      //"createdAtEpoch" -> JsWhen(group.createdAt),
      "username" -> group.theUsername,
      "fullName" -> group.name)
    if (callerIsStaff) {
      json += "summaryEmailIntervalMins" -> JsNumberOrNull(group.summaryEmailIntervalMins)
      json += "summaryEmailIfActive" -> JsBooleanOrNull(group.summaryEmailIfActive)
    }
    json
  }


  private def jsonForGuest(user: Guest, usersById: Map[UserId, User],
        callerIsStaff: Boolean, callerIsAdmin: Boolean): JsObject = {
    val safeEmail = callerIsAdmin ? user.email | hideEmailLocalPart(user.email)
    var userJson = Json.obj(
      "id" -> user.id,
      "fullName" -> user.guestName,
      "country" -> JsStringOrNull(user.country))
      // += ipSuspendedTill
      // += browserIdCookieSuspendedTill
    if (callerIsStaff) {
      userJson += "email" -> JsString(safeEmail)
      // += ipSuspendedAt, ById, ByUsername, Reason
      // += browserIdCookieSuspendedAt, ById, ByUsername, Reason
    }
    userJson
  }


  private def makeUserStatsJson(stats: UserStats, isStaffOrSelf: Boolean): JsObject = {
    var result = Json.obj(
      "userId" -> stats.userId,
      "lastSeenAt" -> JsWhenMs(stats.lastSeenAt),
      "lastPostedAt" -> JsWhenMsOrNull(stats.lastPostedAt),
      "firstSeenAt" -> JsWhenMs(stats.firstSeenAtOr0),
      "firstNewTopicAt" -> JsWhenMsOrNull(stats.firstNewTopicAt),
      "firstDiscourseReplyAt" -> JsWhenMsOrNull(stats.firstDiscourseReplyAt),
      "firstChatMessageAt" -> JsWhenMsOrNull(stats.firstChatMessageAt),
      "numDaysVisited" -> stats.numDaysVisited,
      "numSecondsReading" -> stats.numSecondsReading,
      "numDiscourseRepliesRead" -> stats.numDiscourseRepliesRead,
      "numDiscourseRepliesPosted" -> stats.numDiscourseRepliesPosted,
      "numDiscourseTopicsEntered" -> stats.numDiscourseTopicsEntered,
      "numDiscourseTopicsRepliedIn" -> stats.numDiscourseTopicsRepliedIn,
      "numDiscourseTopicsCreated" -> stats.numDiscourseTopicsCreated,
      "numChatMessagesRead" -> stats.numChatMessagesRead,
      "numChatMessagesPosted" -> stats.numChatMessagesPosted,
      "numChatTopicsEntered" -> stats.numChatTopicsEntered,
      "numChatTopicsRepliedIn" -> stats.numChatTopicsRepliedIn,
      "numChatTopicsCreated" -> stats.numChatTopicsCreated,
      "numLikesGiven" -> stats.numLikesGiven,
      "numLikesReceived" -> stats.numLikesReceived,
      "numSolutionsProvided" -> stats.numSolutionsProvided)
    if (isStaffOrSelf) {
      result += "lastEmailedAt" -> JsWhenMsOrNull(stats.lastEmailedAt)
      result += "lastSummaryEmailAt" -> JsWhenMsOrNull(stats.lastSummaryEmailAt)
      result += "nextSummaryEmailAt" -> JsWhenMsOrNull(stats.nextSummaryEmailAt)
      result += "emailBounceSum" -> JsNumber(stats.emailBounceSum.toDouble)
      result += "topicsNewSince" -> JsWhenMs(stats.topicsNewSince)
      result += "notfsNewSinceId" -> JsNumber(stats.notfsNewSinceId)
    }
    result
  }


  def loadUserEmailsLogins(userId: UserId): Action[Unit] = GetAction { request =>
    loadUserEmailsLoginsImpl(userId, request)
  }


  private def loadUserEmailsLoginsImpl(userId: UserId, request: DebikiRequest[_]): mvc.Result = {
    import request.{dao, theRequester => requester}
    // Could refactor and break out functions. Later some day maybe.

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE5JKWTDY2", "You may not see someone elses email addresses")

    val (memberInclDetails, emails, identities) = dao.readOnlyTransaction { tx =>
      (tx.loadTheMemberInclDetails(userId),
        tx.loadUserEmailAddresses(userId),
        tx.loadIdentities(userId))
    }

    val emailsJson = JsArray(emails map { userEmailAddress =>
      Json.obj(
        "emailAddress" -> userEmailAddress.emailAddress,
        "addedAt" -> JsWhenMs(userEmailAddress.addedAt),
        "verifiedAt" -> JsWhenMsOrNull(userEmailAddress.verifiedAt))
    })

    var loginMethodsJson = JsArray(identities map { identity: Identity =>
      val (provider, email) = identity match {
        case oa: OpenAuthIdentity =>
          val details = oa.openAuthDetails
          (details.providerId, details.email)
        case oid: IdentityOpenId =>
          val details = oid.openIdDetails
          (details.oidEndpoint, details.email)
        case x =>
          (classNameOf(x), None)
      }
      Json.obj(
        "loginType" -> classNameOf(identity),
        "provider" -> provider,
        "email" -> JsStringOrNull(email))
    })

    if (memberInclDetails.passwordHash.isDefined) {
      loginMethodsJson :+= Json.obj(
        "loginType" -> "Local",
        "provider" -> "password",
        "email" -> memberInclDetails.primaryEmailAddress)
    }

    OkSafeJson(Json.obj(
      "emailAddresses" -> emailsJson,
      "loginMethods" -> loginMethodsJson))
  }


  def setPrimaryEmailAddresses: Action[JsValue] =
        PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) { request =>
    import request.{dao, body, theRequester => requester}
    // SECURITY maybe send an email and verify with the old address that changing to the new is ok?

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE4JTA2F0", "You may not add an email address to someone elses account")

    dao.readWriteTransaction { tx =>
      val member = tx.loadTheMemberInclDetails(userId)
      throwBadRequestIf(member.primaryEmailAddress == emailAddress,
        "EdE5GPTVXZ", "Already your primary address")
      val userEmailAddrs = tx.loadUserEmailAddresses(userId)
      val address = userEmailAddrs.find(_.emailAddress == emailAddress)
      throwForbiddenIf(address.isEmpty, "EdE2YGUWF03", "Not your email address")
      throwForbiddenIf(
        address.flatMap(_.verifiedAt).isEmpty, "EdE5AA20I", "Address not verified") // [7GUKRWJ]

      tx.updateMemberInclDetails(member.copy(primaryEmailAddress = emailAddress))
    }

    dao.removeUserFromMemCache(userId)
    loadUserEmailsLoginsImpl(userId, request)
  }


  def addUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) {
        request =>
    import request.{dao, body, theRequester => requester}

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE4JTA2F0", "You may not add an email address to someone else's account")
    throwForbiddenIf(userId < LowestTalkToMemberId,
      "TyE2GKD052", "Cannot add email addresses to built-in users")

    val member: MemberInclDetails = dao.readWriteTransaction { tx =>
      val userEmailAddrs = tx.loadUserEmailAddresses(userId)
      throwForbiddenIf(userEmailAddrs.exists(_.emailAddress == emailAddress),
        "EdE5AVH20", "You've added that email already")
      throwForbiddenIf(userEmailAddrs.length >= MaxEmailsPerUser,
        "EdE2QDS0H", "You've added too many email addresses")
      val member = tx.loadTheMemberInclDetails(userId) // also ensures the user exists
      val newAddress = UserEmailAddress(
        userId, emailAddress = emailAddress, addedAt = tx.now, verifiedAt = None)
      tx.insertUserEmailAddress(newAddress)
      member
    }

    BUG; RACE // If the server crashes / gets shut down, the email won't get sent.
    // Instead, add it to some emails-to-send queue. In the same transaction, as above.

    val email = createNewEmailAddrVerifEmailDontSend(member, request, emailAddress)
    globals.sendEmail(email, dao.siteId)

    loadUserEmailsLoginsImpl(userId, request)
  }


  private def createNewEmailAddrVerifEmailDontSend(user: MemberInclDetails, request: DebikiRequest[_],
        newEmailAddress: String): Email = {

    import context.globals, request.dao
    val (siteName, origin) = dao.theSiteNameAndOrigin()
    val host = request.host

    val returnToUrl = s"$host/-/users/${user.username}/preferences/emails-logins"  // [4JKT28TS]

    val emailId = Email.generateRandomId()

    val safeEmailAddrVerifUrl =
      globals.originOf(host) +
        routes.UserController.confirmOneMoreEmailAddress(
          emailId) // safe, generated by the server

    val email = Email.newWithId(
      emailId,
      EmailType.VerifyAddress,
      createdAt = globals.now(),
      sendTo = newEmailAddress,
      toUserId = Some(user.id),
      subject = s"[$siteName] Confirm your email address",
      bodyHtmlText =
        views.html.confirmOneMoreEmailAddressEmail(
          siteAddress = host,
          username = user.username,
          emailAddress = newEmailAddress,
          safeVerificationUrl = safeEmailAddrVerifUrl,
          expirationTimeInHours = 1,
          globals).body)

    dao.saveUnsentEmail(email)
    email
  }


  def confirmOneMoreEmailAddress(confirmationEmailId: String): Action[Unit] = GetAction { request =>
    import request.{dao, requester}
    val email = dao.loadEmailById(confirmationEmailId) getOrElse {
      throwForbidden("EdE1WRB20", "Link expired? Or bad email id.")
    }

    val toUserId = email.toUserId getOrElse throwForbidden(
      "EdE1FKDP0", "Wrong email type: No user id")
    throwForbiddenIf(requester.map(_.id) isSomethingButNot toUserId,
      "EdE7UKTQ1", "You're logged in as a the wrong user")

    val member: MemberInclDetails = dao.readWriteTransaction { tx =>
      val member = dao.loadTheMemberInclDetailsById(toUserId)
      val userEmailAddrs = tx.loadUserEmailAddresses(toUserId)
      val userEmailAddr = userEmailAddrs.find(_.emailAddress == email.sentTo) getOrElse {
        // This might happen if a user removes hens address, and clicks the verif link afterwards?
        throwForbidden("EdE1WKBPE", "Not your email address, did you remove it?")
      }
      val addrVerified = userEmailAddr.copy(verifiedAt = Some(tx.now))
      tx.updateUserEmailAddress(addrVerified)
      member
    }

    // What do now? Let's redirect to the user's email list.
    // But maybe the user is not currently logged in? I don't think hen should get logged in
    // just by clicking the link. Maybe this isn't supposed to be an email address hen wants
    // to be able to login with.
    val emailsPath = requester.isDefined ? "/preferences/emails-logins" | ""  // [4JKT28TS]
    TemporaryRedirect(s"/-/users/${member.username}$emailsPath")
  }


  def removeUserEmail: Action[JsValue] = PostJsonAction(RateLimits.AddEmailLogin, maxBytes = 300) {
        request =>
    import request.{dao, body, theRequester => requester}

    val userId = (body \ "userId").as[UserId]
    val emailAddress = (body \ "emailAddress").as[String]

    throwForbiddenIf(requester.id != userId && !requester.isAdmin,
      "EdE6LTMQR20", "You may not remove an email address from someone else's account")

    dao.readWriteTransaction { tx =>
      val member = tx.loadTheMemberInclDetails(userId) // ensures user exists
      throwForbiddenIf(member.primaryEmailAddress == emailAddress,
        "EdET7UKW2", s"Cannot remove the primary email address: $emailAddress")

      val anyAddress = tx.loadUserEmailAddresses(userId).find(_.emailAddress == emailAddress)
      throwForbiddenIf(anyAddress.isEmpty,
        "EdE8UKDR1", s"No such email address: $emailAddress")

      val identities = tx.loadIdentities(userId)
      val identityUsingEmail = identities.find(_.usesEmailAddress(emailAddress))
      identityUsingEmail foreach { identity =>
        throwForbidden(
          "EdE3Q1ZB9", s"Email address: $emailAddress in use, login method: ${identity.loginMethodName}")
      }
      tx.deleteUserEmailAddress(userId, emailAddress)
    }

    loadUserEmailsLoginsImpl(userId, request)
  }


  def approveRejectUser: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val doWhat = (request.body \ "doWhat").as[String]
    doWhat match {
      case "Approve" =>
        request.dao.approveUser(userId, approverId = request.theUserId)
      case "Reject" =>
        request.dao.rejectUser(userId, approverId = request.theUserId)
      case "Undo" =>
        request.dao.undoApproveOrRejectUser(userId, approverId = request.theUserId)
    }
    Ok
  }


  def setIsAdminOrModerator: Action[JsValue] = AdminPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val doWhat = (request.body \ "doWhat").as[String]
    doWhat match {
      case "GrantAdmin" =>
        request.dao.setStaffFlags(userId, isAdmin = Some(true), changedById = request.theUserId)
      case "RevokeAdmin" =>
        request.dao.setStaffFlags(userId, isAdmin = Some(false), changedById = request.theUserId)
      case "GrantModerator" =>
        request.dao.setStaffFlags(userId, isModerator = Some(true), changedById = request.theUserId)
      case "RevokeModerator" =>
        request.dao.setStaffFlags(userId, isModerator = Some(false), changedById = request.theUserId)
      case _ =>
        throwBadReq("DwE2KGF8", "Bad 'doWhat'")
    }
    Ok
  }


  def lockTrustLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val trustLevelInt = (request.body \ "trustLevel").as[Int]
    val trustLevel = TrustLevel.fromInt(trustLevelInt) getOrElse throwBadRequest(
      "EsE4JYW0", s"Bad trust level: $trustLevelInt")
    request.dao.lockMemberTrustLevel(userId, Some(trustLevel))
    Ok
  }


  def unlockTrustLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    request.dao.lockMemberTrustLevel(userId, None)
    Ok
  }


  def lockThreatLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val threatLevelInt = (request.body \ "threatLevel").as[Int]
    val threatLevel = ThreatLevel.fromInt(threatLevelInt) getOrElse throwBadRequest(
        "EsE2FW40C", s"Bad threat level: $threatLevelInt")
    if (User.isMember(userId)) {
      request.dao.lockMemberThreatLevel(userId, Some(threatLevel))
    }
    else {
      request.dao.lockGuestThreatLevel(userId, Some(threatLevel))
    }
    Ok
  }


  def unlockThreatLevel: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    if (User.isMember(userId)) {
      request.dao.lockMemberThreatLevel(userId, None)
    }
    else {
      request.dao.lockGuestThreatLevel(userId, None)
    }
    Ok
  }


  def suspendUser: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val userId = (request.body \ "userId").as[UserId]
    val numDays = (request.body \ "numDays").as[Int]
    val reason = (request.body \ "reason").as[String]
    if (numDays < 1)
      throwBadReq("DwE4FKW0", "Please specify at least one day")
    if (reason.length > 255)
      throwBadReq("DwE4FKW0", "Too long suspend-user-reason")
    if (isGuestId(userId))
      throwBadReq("DwE5KE8", "Cannot suspend guest user ids")

    request.dao.suspendUser(userId, numDays, reason, suspendedById = request.theUserId)
    Ok
  }


  def unsuspendUser: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val userId = (request.body \ "userId").as[UserId]
    if (isGuestId(userId))
      throwBadReq("DwE7GPKU8", "Cannot unsuspend guest user ids")
    request.dao.unsuspendUser(userId)
    Ok
  }


  def blockGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    val numDays = -1 // (request.body \ "numDays").as[Int] // currently no longer in use
    val threatLevel = ThreatLevel.fromInt((request.body \ "threatLevel").as[Int]).getOrElse(
      throwBadArgument("EsE8GY2W", "threatLevel"))
    request.dao.blockGuest(postId, numDays = numDays, threatLevel, blockerId = request.theUserId)
    Ok
  }


  def unblockGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    request.dao.unblockGuest(postId, unblockerId = request.theUserId)
    Ok
  }


  /** If not staff, returns a summary only.
    */
  def loadAuthorBlocks(postId: Int) = GetAction { request =>
    val blocks: Seq[Block] = request.dao.loadAuthorBlocks(postId)
    var json = blocksSummaryJson(blocks, request.ctime)
    if (request.user.exists(_.isStaff)) {
      json += "blocks" -> JsArray(blocks map blockToJson)
    }
    OkSafeJson(json)
  }


  private def blocksSummaryJson(blocks: Seq[Block], now: ju.Date): JsObject = {
    var isBlocked = false
    var blockedForever = false
    var maxEndUnixMillis: UnixMillis = 0L
    for (block <- blocks) {
      if (block.blockedTill.isEmpty) {
        isBlocked = true
        blockedForever = true
      }
      else if (now.getTime <= block.blockedTill.get.getTime) {
        isBlocked = true
        maxEndUnixMillis = math.max(maxEndUnixMillis, block.blockedTill.get.getTime)
      }
    }
    var json = Json.obj(
      "isBlocked" -> isBlocked,
      "blockedForever" -> blockedForever)
    if (maxEndUnixMillis != 0L && !blockedForever) {
      json += "blockedTillMs" -> JsNumber(maxEndUnixMillis)
    }
    json
  }


  private def blockToJson(block: Block): JsObject = {
    Json.obj(
      "threatLevel" -> JsNumber(block.threatLevel.toInt),
      "ip" -> JsStringOrNull(block.ip.map(_.toString)),
      "browserIdCookie" -> block.browserIdCookie,
      "blockedById" -> block.blockedById,
      "blockedAtMs" -> block.blockedAt.getTime,
      "blockedTillMs" -> JsLongOrNull(block.blockedTill.map(_.getTime)))
  }


  def redirectToMyLastTopic: Action[Unit] = GetAction { request =>
    import request.{dao, theRequester => requester}
    // Load a few topics, in case some were deleted.
    val topicsInclForbidden = dao.loadPagesByUser(requester.id, isStaffOrSelf = true, limit = 5)
    val latestTopic = topicsInclForbidden find { page: PagePathAndMeta =>
      !page.meta.isDeleted && dao.maySeePageUseCache(page.meta, Some(requester))._1
    }
    val redirectToUrl = latestTopic.map(_.path.value) getOrElse "/"
    TemporaryRedirect(redirectToUrl)
  }


  def viewUserPage(whatever: String): Action[Unit] = AsyncGetAction { request =>
    val htmlStr = views.html.templates.users(SiteTpi(request)).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
      unapprovedPostAuthorIds = Set.empty, request)
  }


  def loadMyPageData(pageId: PageId): Action[Unit] = GetAction { request =>
    val json = loadMyPageDataImpl(request, pageId)
    OkSafeJson(json)
  }


  private def loadMyPageDataImpl(request: ApiRequest[_], pageId: PageId): JsValue = {
    val pageMeta = request.dao.getPageMeta(pageId) getOrElse {
      // Might be an embedded comment page, not yet created because no comments posted.
      // Or we might be in the signup-to-become-owner step, when creating a new site.
      return ReactJson.userNoPageToJson(request)
    }

    val pagePath = request.dao.getPagePath(pageId) getOrElse {
      // The page was apparently deleted some microseconds ago.
      return ReactJson.userNoPageToJson(request)
    }

    val (maySee, _) = request.dao.maySeePageUseCache(pageMeta, request.user)
    if (!maySee)
      return ReactJson.userNoPageToJson(request)

    val pageRequest = new PageRequest(
      request.siteIdAndCanonicalHostname,
      sid = request.sid,
      xsrfToken = request.xsrfToken,
      browserId = request.browserId,
      user = request.user,
      pageExists = true,
      pagePath = pagePath,
      pageMeta = Some(pageMeta),
      altPageId = None,
      embeddingUrl = None,
      dao = request.dao,
      request = request.request)

    val json =
      if (pageRequest.user.isDefined) {
        val renderedPage = request.dao.renderPageMaybeUseCache(pageRequest)
        ReactJson.userDataJson(pageRequest, renderedPage.unapprovedPostAuthorIds).getOrDie(
          "EdE4ZBXKG")
      }
      else {
        val everyonesPerms = request.dao.getPermsForEveryone()
        ReactJson.noUserSpecificData(request.dao, everyonesPerms)
      }

    json
  }


  def trackReadingProgress: Action[JsValue] = PostJsonAction(RateLimits.TrackReadingActivity,
        maxBytes = 1000) { request =>
    trackReadingProgressImpl(request, request.body)
  }


  /** In the browser, navigator.sendBeacon insists on sending plain text. So need this text handler.
    */
  def trackReadingProgressText: Action[String] = PostTextAction(RateLimits.TrackReadingActivity,
        maxBytes = 1000) { request =>
    val bodyXsrfTokenRemoved = request.body.dropWhile(_ != '\n') // [7GKW20TD]
    val json = Json.parse(bodyXsrfTokenRemoved)
    trackReadingProgressImpl(request, json)
  }


  private def trackReadingProgressImpl(request: DebikiRequest[_], body: JsValue): mvc.Result = {
    SECURITY // how prevent an evil js client from saying "I've read everything everywhere",
    // by calling this endpoint many times, and listing all pages + all post nrs.
    // Could be used to speed up the trust level transition from New to Basic to Member.

    import request.{theRequester => requester}
    import ed.server.{WhenFormat, OptWhenFormat}

    throwForbiddenIf(requester.isGuest, "EdE8LUHE2", "Not tracking guests' reading progress")
    throwForbiddenIf(requester.isGroup, "EdE5QFVB5", "Not tracking groups' reading progress")

    val pageId = (body \ "pageId").as[PageId]
    var visitStartedAt = (body \ "visitStartedAt").as[When]
    val lastViewedPostNr = (body \ "lastViewedPostNr").as[PostNr]
    var lastReadAt = (body \ "lastReadAt").as[Option[When]]
    var secondsReading = (body \ "secondsReading").as[Int]
    val postNrsRead = (body \ "postNrsRead").as[Vector[PostNr]]

    val now = globals.now()
    val lowPostNrsRead: Set[PostNr] = postNrsRead.filter(_ <= ReadingProgress.MaxLowPostNr).toSet
    val lastPostNrsReadRecentFirst =
      postNrsRead.filter(_ > ReadingProgress.MaxLowPostNr).reverse.take(
        ReadingProgress.MaxLastPostsToRemember).distinct

    if (visitStartedAt.isAfter(now)) {
      // Bad browser date-time setting?
      visitStartedAt = now
      if (lastReadAt.isDefined) {
        lastReadAt = Some(now)
      }
    }

    if (secondsReading > TrackReadingActivity.IntervalSeconds) {
      secondsReading = TrackReadingActivity.IntervalSeconds
      SECURITY; COULD // prevent the same user from calling much more often than the interval.
      // (But page reloads might --> a little bit more often.)
    }

    lastReadAt foreach { at =>
      if (at.isAfter(now)) {
        // Bad browser date-time setting?
        lastReadAt = Some(now)
      }
    }

    val readingProgress =
      try ReadingProgress(
        firstVisitedAt = visitStartedAt,
        lastVisitedAt = now,
        lastViewedPostNr = lastViewedPostNr,
        lastReadAt = lastReadAt,
        lastPostNrsReadRecentFirst = lastPostNrsReadRecentFirst,
        lowPostNrsRead = lowPostNrsRead,
        secondsReading = secondsReading)
      catch {
        case ex: Exception =>
          throwBadRequest("EdE5FKW02", ex.toString)
      }

    request.dao.trackReadingProgressPerhapsPromote(requester, pageId, readingProgress)
    request.dao.pubSub.userIsActive(request.siteId, requester, request.theBrowserIdData)
    Ok
  }


  def loadNotifications(userId: UserId, upToWhenMs: Long): Action[Unit] =
        GetActionRateLimited(RateLimits.ExpensiveGetRequest) { request =>
    val notfsAndCounts = request.dao.loadNotifications(userId, upToWhen = None, request.who)
    OkSafeJson(notfsAndCounts.notfsJson)
  }


  def markNotificationAsSeen(): Action[JsValue] = PostJsonAction(RateLimits.MarkNotfAsSeen, 200) {
        request =>
    val notfId = (request.body \ "notfId").as[NotificationId]
    request.dao.markNotificationAsSeen(request.theUserId, notfId)
    Ok
  }


  def savePageNotfLevel: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser, maxBytes = 500) {
        request =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val newNotfLevelInt = (body \ "pageNotfLevel").as[Int]
    val newNotfLevel = NotfLevel.fromInt(newNotfLevelInt) getOrElse throwBadRequest(
      "EsE6JP2SK", s"Bad page notf level: $newNotfLevelInt")
    request.dao.saveUserPageSettings(userId = request.theRoleId, pageId = pageId,
      UserPageSettings(newNotfLevel))
    Ok
  }


  def loadGroups = AdminGetAction { request =>
    val groups = request.dao.readOnlyTransaction { tx =>
      tx.loadGroupsAsSeq()
    }
    OkSafeJson(JsArray(groups map ForumController.groupToJson))
  }


  SECURITY // don't allow if user listing disabled, & isn't staff [8FKU2A4]   <——
  def listAllUsers(usernamePrefix: String) = GetAction { request =>
    // Authorization check: Is a member? Add MemberGetAction?
    request.theMember

    val members = request.dao.loadMembersWithPrefix(usernamePrefix)
    val json = JsArray(
      members map { member =>
        Json.obj(
          "id" -> member.id,
          "username" -> member.username,
          "fullName" -> member.fullName)
      })
    OkSafeJson(json)
  }


  /** Listing usernames on a particular page is okay, if one may see the page
    * — however, listing all usernames for the whole site, isn't always okay. [8FKU2A4]
    */
  def listUsernames(pageId: PageId, prefix: String) = GetAction { request =>
    import request.dao

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE4Z0B8P5")
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    SECURITY // Later: shouldn't list authors of hidden / deleted / whisper posts.
    throwNoUnless(Authz.maySeePage(
      pageMeta, request.user, dao.getGroupIds(request.user),
      dao.getAnyPrivateGroupTalkMembers(pageMeta), categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXKSM2")

    val names = dao.listUsernames(pageId = pageId, prefix = prefix)
    val json = JsArray(
      names map { nameAndUsername =>
        Json.obj(
          "id" -> nameAndUsername.id,
          "username" -> nameAndUsername.username,
          "fullName" -> nameAndUsername.fullName)
      })
    OkSafeJson(json)
  }


  /** maxBytes = 3000 because the about text might be fairly long.
    */
  def saveMemberPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000) { request =>
    val prefs = userPrefsFromJson(request.body)
    val staffOrSelf = request.theUser.isStaff || request.theUserId == prefs.userId
    throwForbiddenIf(!staffOrSelf, "DwE15KFE5", "Not your preferences")
    throwForbiddenIf(prefs.userId < LowestTalkToMemberId,
      "TyE2GKVQ", "Cannot configure preferences for this user, it's a built-in user")
    request.dao.saveMemberPreferences(prefs, request.who)
    Ok
  }


  def saveGroupPreferences: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 3000) { request =>
    import request.{dao, theRequester => requester}
    val prefs = groupPrefsFromJson(request.body)
    if (!requester.isAdmin)
      throwForbidden("EdE5PYKW0", "Only admins may change group prefs, right now")
    dao.saveGroupPreferences(prefs, request.who)
    Ok
  }


  def saveGuest: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val guestId = (request.body \ "guestId").as[UserId]
    val name = (request.body \ "name").as[String].trim
    if (name.isEmpty)
      throwForbidden("DwE4KWP9", "No name specified")

    try { request.dao.saveGuest(guestId, name = name) }
    catch {
      case DbDao.DuplicateGuest =>
        throwForbidden("DwE5KQP4", o"""There is another guest with the exact same name
            and other data. Please change the name, e.g. append "2".""")
    }
    Ok
  }


  /*
  private def userInfoToJson(userInfo: UserInfoAndStats): JsObject = {
    Json.obj(
      "userId" -> userInfo.info.id,
      "displayName" -> userInfo.info.anyName,
      "username" -> JsStringOrNull(userInfo.info.anyUsername),
      "isAdmin" -> userInfo.info.isAdmin,
      "isModerator" -> userInfo.info.isModerator,
      "numPages" -> userInfo.stats.numPages,
      "numPosts" -> userInfo.stats.numPosts,
      "numReplies" -> userInfo.stats.numReplies,
      "numLikesGiven" -> userInfo.stats.numLikesGiven,
      "numLikesReceived" -> userInfo.stats.numLikesReceived,
      "numWrongsGiven" -> userInfo.stats.numWrongsGiven,
      "numWrongsReceived" -> userInfo.stats.numWrongsReceived,
      "numBurysGiven" -> userInfo.stats.numBurysGiven,
      "numBurysReceived" -> userInfo.stats.numBurysReceived)

    /* Discourse also includes:
      "avatar_template": ...
      "badge_count" : 0,
      "bio_cooked" : "<p>Hi <strong>everybody</strong>! </p>",
      "bio_excerpt" : "Hi everybody!",
      "bio_raw" : "\nHi **everybody**! ",
      "can_edit" : false,
      "can_edit_email" : false,
      "can_edit_name" : false,
      "can_edit_username" : false,
      "can_send_private_message_to_user" : true,
      "created_at" : "2013-02-17T15:09:06.675-05:00",
       group membership info
      "featured_user_badge_ids" : [  ],
      "invited_by" : null,
      "last_posted_at" : "2014-05-10T02:47:06.860-04:00",
      "last_seen_at" : "2014-05-10T03:42:16.842-04:00",
      "profile_background" : "/uploads/default/4870/f95c8f5b0817f799.jpg",
      "stats" : [ { "action_type" : 4,
              "count" : 5,
              "id" : null
            },
            { "action_type" : 5,
              "count" : 217,
              "id" : null
            },
            ... 11 stats
          ],
        "title" : "designerator",
        "trust_level" : 2,
        "username" : "awesomerobot",
        "website" : "https://"
      },
      "user_badges" : [ ]
     */
  }


  private def actionToJson(actionInfo: UserActionInfo): JsObject = {
    Json.obj(
      "pageUrl" -> s"/-${actionInfo.pageId}", // redirects to the page
      "pageTitle" -> JsString(actionInfo.pageTitle),
      "postId" -> JsNumber(actionInfo.postId), & nr ?
      "actionId" -> JsNumber(actionInfo.actionId),
      "actingUserId" -> JsNumber(actionInfo.actingUserId),
      "actingUserDisplayName" -> JsString(actionInfo.actingUserDisplayName),
      "targetUserId" -> JsNumber(actionInfo.targetUserId),
      "targetUserDisplayName" -> JsString(actionInfo.targetUserDisplayName),
      "createdAtEpoch" -> JsNumber(actionInfo.createdAt.getTime),
      "excerpt" -> JsString(actionInfo.postExcerpt),
      "repliedToPostId" -> actionInfo.repliedToPostNr.map(JsNumber(_)),
      "editedPostId" -> actionInfo.editedPostNr.map(JsNumber(_)),
      "approved" -> JsBoolean(actionInfo.approved),
      "deleted" -> JsBoolean(actionInfo.deleted),
      "pinned" -> JsBoolean(actionInfo.pinned),
      "collapsed" -> JsBoolean(actionInfo.collapsed),
      "closed" -> JsBoolean(actionInfo.closed),
      "votedLike" -> JsBoolean(actionInfo.votedLike),
      "votedWrong" -> JsBoolean(actionInfo.votedWrong),
      "votedBury" -> JsBoolean(actionInfo.votedBury))
    /* Discourse also includes:
      - usernames
      - the user that wrote the relevant post (avatar, display name, username, id)
      - action type (instead of votedLike, repliedTo...)
      - avatars: "//www.gravatar.com/avatar/....png?s={size}&r=pg&d=identicon",
      - deleted : false,
      - edit_reason : null,
      - hidden : false,
      - moderator_action : false,
     */
  }
  */



  private def userPrefsFromJson(json: JsValue): MemberPreferences = {
    val username = (json \ "username").as[String]
    if (username.length < MinUsernameLength)
      throwBadReq("DwE44KUY0", "Username too short")

    SECURITY // add checks for other lengts too, to avoid database constraint exceptions.  <——
              // See if I've added all db constraints also.
    // Create getStringMaxLen and getOptStringMaxLen helpers?
    val about = (json \ "about").asOpt[String].trimNoneIfBlank
    if (about.exists(_.length > 1500))
      throwForbidden("EdE2QRRD40", "Too long about text, max is 1500 chars")  // db: max = 2000

    MemberPreferences(
      userId = (json \ "userId").as[UserId],
      fullName = (json \ "fullName").asOptStringNoneIfBlank,
      username = username,
      emailAddress = (json \ "emailAddress").as[String],
      summaryEmailIntervalMins = (json \ "summaryEmailIntervalMins").asOpt[Int],
      summaryEmailIfActive = (json \ "summaryEmailIfActive").asOpt[Boolean],
      about = (json \ "about").asOpt[String].trimNoneIfBlank,
      location = (json \ "location").asOpt[String].trimNoneIfBlank,
      url = (json \ "url").asOpt[String].trimNoneIfBlank,
      emailForEveryNewPost = (json \ "emailForEveryNewPost").as[Boolean])
  }


  private def groupPrefsFromJson(json: JsValue): GroupPreferences = {
    val username = (json \ "username").as[String]
    if (username.length < MinUsernameLength)
      throwBadReq("EdE2QDP04", "Username too short")

    GroupPreferences(
      groupId = (json \ "userId").as[UserId],
      fullName = (json \ "fullName").asOptStringNoneIfBlank,
      username = username,
      summaryEmailIntervalMins = (json \ "summaryEmailIntervalMins").asOpt[Int],
      summaryEmailIfActive = (json \ "summaryEmailIfActive").asOpt[Boolean])
  }

}

