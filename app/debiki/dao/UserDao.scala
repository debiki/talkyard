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

package debiki.dao

import com.debiki.core._
import debiki.EdHttp.{throwForbidden, throwForbiddenIf}
import ed.server.security.{SidStatus, BrowserId}
import java.{util => ju}
import play.api.libs.json.JsArray
import play.{api => p}
import scala.collection.{immutable, mutable}
import Prelude._
import EmailNotfPrefs.EmailNotfPrefs
import debiki.ReactJson.NotfsAndCounts
import scala.collection.mutable.ArrayBuffer


case class LoginNotFoundException(siteId: SiteId, userId: UserId)
  extends QuickMessageException(s"User $siteId:$userId not found")



trait UserDao {
  self: SiteDao =>

  import self.context.globals
  import self.context.security

  def addUserStats(moreStats: UserStats)(transaction: SiteTransaction) {
    val anyStats = transaction.loadUserStats(moreStats.userId)
    val stats = anyStats.getOrDie("EdE2WKZ8A4", s"No stats for user $siteId:${moreStats.userId}")
    val newStats = stats.addMoreStats(moreStats)
    SHOULD // if moreStats replies to chat message or discourse topic, then update
    // num-chat/discourse-topics-replied-in.
    SHOULD // update num-topics-entered too
    transaction.upsertUserStats(newStats)
  }


  def insertInvite(invite: Invite) {
    readWriteTransaction { transaction =>
      transaction.insertInvite(invite)
    }
  }


  /** Returns: (CompleteUser, Invite, hasBeenAcceptedAlready: Boolean)
    */
  def acceptInviteCreateUser(secretKey: String): (MemberInclDetails, Invite, Boolean) = {
    readWriteTransaction { transaction =>
      var invite = transaction.loadInvite(secretKey) getOrElse throwForbidden(
        "DwE6FKQ2", "Bad invite key")

      invite.acceptedAt foreach { acceptedAt =>
        val millisAgo = (new ju.Date).getTime - acceptedAt.getTime
        // For now: If the invitation is < 1 day old, allow the user to log in
        // again via the invitation link. In Discourse, this timeout is configurable.
        if (millisAgo < 24 * 3600 * 1000) {
          val user = loadMemberInclDetailsById(invite.userId getOrDie "DwE6FKEW2") getOrDie "DwE8KES2"
          return (user, invite, true)
        }

        throwForbidden("DwE0FKW2", "You have joined the site already, but this link has expired")
      }

      if (transaction.loadMemberByPrimaryEmailOrUsername(invite.emailAddress).isDefined)
        throwForbidden("DwE8KFG4", o"""You have joined this site already, so this
             join-site invitation link does nothing. Thanks for clicking it anyway""")

      val userId = transaction.nextMemberId
      var newUser = invite.makeUser(userId, transaction.now.toJavaDate)
      val inviter = transaction.loadUser(invite.createdById) getOrDie "DwE5FKG4"
      if (inviter.isStaff) {
        newUser = newUser.copy(
          isApproved = Some(true),
          approvedAt = Some(transaction.now.toJavaDate),
          approvedById = Some(invite.createdById))
      }

      invite = invite.copy(acceptedAt = Some(transaction.now.toJavaDate), userId = Some(userId))

      // COULD loop and append 1, 2, 3, ... until there's no username clash.
      transaction.deferConstraints()
      transaction.insertMember(newUser)
      transaction.insertUserEmailAddress(newUser.primaryEmailInfo getOrDie "EdE3PDKR20")
      transaction.insertUsernameUsage(UsernameUsage(
        newUser.usernameLowercase, inUseFrom = transaction.now, userId = newUser.id))
      transaction.upsertUserStats(UserStats.forNewUser(
        newUser.id, firstSeenAt = transaction.now, emailedAt = Some(invite.createdWhen)))
      joinGloballyPinnedChats(newUser.briefUser, transaction)
      transaction.updateInvite(invite)
      (newUser, invite, false)
    }
  }


  def approveUser(userId: UserId, approverId: UserId) {
    approveRejectUndoUser(userId, approverId = approverId, isapproved = Some(true))
  }


  def rejectUser(userId: UserId, approverId: UserId) {
    approveRejectUndoUser(userId, approverId = approverId, isapproved = Some(false))
  }


  def undoApproveOrRejectUser(userId: UserId, approverId: UserId) {
    approveRejectUndoUser(userId, approverId = approverId, isapproved = None)
  }


  private def approveRejectUndoUser(userId: UserId, approverId: UserId,
        isapproved: Option[Boolean]) {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      user = user.copy(
        isApproved = isapproved,
        approvedAt = Some(transaction.now.toJavaDate),
        approvedById = Some(approverId))
      transaction.updateMemberInclDetails(user)
    }
    removeUserFromMemCache(userId)
  }


  def setStaffFlags(userId: UserId, isAdmin: Option[Boolean] = None,
        isModerator: Option[Boolean] = None, changedById: UserId) {
    require(isAdmin.isDefined != isModerator.isDefined, "DwE4KEP20")
    if (userId == changedById)
      throwForbidden("DwE4KEF2", "Cannot change one's own is-admin and is-moderator state")

    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)

      if (user.isSuspendedAt(transaction.now.toJavaDate) && (
          isAdmin.contains(true) || isModerator.contains(true)))
        throwForbidden("DwE2KEP8", "User is suspended")

      if (isAdmin.contains(true) && user.isModerator ||
          isModerator.contains(true) && user.isAdmin ||
          isAdmin.contains(true) && isModerator.contains(true))
        throwForbidden("EdE4PJ8SY0", "Cannot be both admin and moderator at the same time")

      user = user.copy(
        isAdmin = isAdmin.getOrElse(user.isAdmin),
        isModerator = isModerator.getOrElse(user.isModerator))
      // COULD update audit log.
      transaction.updateMemberInclDetails(user)
    }
    removeUserFromMemCache(userId)
  }


  def lockMemberTrustLevel(memberId: UserId, newTrustLevel: Option[TrustLevel]) {
    readWriteTransaction { transaction =>
      val member = transaction.loadTheMemberInclDetails(memberId)
      val memberAfter = member.copy(lockedTrustLevel = newTrustLevel)
      transaction.updateMemberInclDetails(memberAfter)
    }
    removeUserFromMemCache(memberId)
  }


  def lockMemberThreatLevel(memberId: UserId, newThreatLevel: Option[ThreatLevel]) {
    readWriteTransaction { transaction =>
      val member: MemberInclDetails = transaction.loadTheMemberInclDetails(memberId)
      val memberAfter = member.copy(lockedThreatLevel = newThreatLevel)
      transaction.updateMemberInclDetails(memberAfter)
    }
    removeUserFromMemCache(memberId)
  }


  def lockGuestThreatLevel(guestId: UserId, newThreatLevel: Option[ThreatLevel]) {
    readWriteTransaction { transaction =>
      val guest = transaction.loadTheGuest(guestId)
      ??? // lock both ips and guest cookie
    }
    removeUserFromMemCache(guestId)
  }


  def suspendUser(userId: UserId, numDays: Int, reason: String, suspendedById: UserId) {
    require(numDays >= 1, "DwE4PKF8")
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      if (user.isAdmin)
        throwForbidden("DwE4KEF24", "Cannot suspend admins")

      val suspendedTill = new ju.Date(transaction.now.millis + numDays * MillisPerDay)
      user = user.copy(
        suspendedAt = Some(transaction.now.toJavaDate),
        suspendedTill = Some(suspendedTill),
        suspendedById = Some(suspendedById),
        suspendedReason = Some(reason.trim))
      transaction.updateMemberInclDetails(user)
    }
    removeUserFromMemCache(userId)
  }


  def unsuspendUser(userId: UserId) {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      user = user.copy(suspendedAt = None, suspendedTill = None, suspendedById = None,
        suspendedReason = None)
      transaction.updateMemberInclDetails(user)
    }
    removeUserFromMemCache(userId)
  }


  def blockGuest(postId: PostId, numDays: Int, threatLevel: ThreatLevel, blockerId: UserId) {
    readWriteTransaction { transaction =>
      val auditLogEntry: AuditLogEntry = transaction.loadCreatePostAuditLogEntry(postId) getOrElse {
        throwForbidden("DwE2WKF5", "Cannot block user: No audit log entry, so no ip and id cookie")
      }

      blockGuestImpl(auditLogEntry.browserIdData, auditLogEntry.doerId,
          numDays, threatLevel, blockerId)(transaction)
    }
  }


  def blockGuestImpl(browserIdData: BrowserIdData, guestId: UserId, numDays: Int,
        threatLevel: ThreatLevel, blockerId: UserId)(transaction: SiteTransaction) {

      if (!User.isGuestId(guestId))
        throwForbidden("DwE4WKQ2", "Cannot block authenticated users. Suspend them instead")

      // Hardcode 2 & 6 weeks for now. Asking the user to choose # days –> too much for him/her
      // to think about. Block the ip for a little bit shorter time, because might affect
      // "innocent" people.
      val ipBlockedTill =
        Some(new ju.Date(transaction.now.millis + OneWeekInMillis * 2))

      val cookieBlockedTill =
        Some(new ju.Date(transaction.now.millis + OneWeekInMillis * 6))

      val ipBlock = Block(
        threatLevel = threatLevel,
        ip = Some(browserIdData.inetAddress),
        // Hmm. Why cookie id too? The cookie is added below too (6PKU02Q), isn't that enough.
        browserIdCookie = Some(browserIdData.idCookie),
        blockedById = blockerId,
        blockedAt = transaction.now.toJavaDate,
        blockedTill = ipBlockedTill)

      val browserIdCookieBlock = Block(
        threatLevel = threatLevel,
        ip = None,
        browserIdCookie = Some(browserIdData.idCookie),
        blockedById = blockerId,
        blockedAt = transaction.now.toJavaDate,
        blockedTill = cookieBlockedTill)

      // COULD catch dupl key error when inserting IP block, and update it instead, if new
      // threat level is *worse* [6YF42]. Aand continue anyway with inserting browser id
      // cookie block.
      transaction.insertBlock(ipBlock)
      transaction.insertBlock(browserIdCookieBlock) // (6PKU02Q)

      // Also set the user's threat level, if the new level is worse.
      transaction.loadGuest(guestId) foreach { guest =>
        if (!guest.lockedThreatLevel.exists(_.toInt > threatLevel.toInt)) {
          transaction.updateGuest(
            guest.copy(lockedThreatLevel = Some(threatLevel)))
        }
      }
  }


  def unblockGuest(postNr: PostNr, unblockerId: UserId) {
    readWriteTransaction { transaction =>
      val auditLogEntry: AuditLogEntry = transaction.loadCreatePostAuditLogEntry(postNr) getOrElse {
        throwForbidden("DwE5FK83", "Cannot unblock guest: No audit log entry, IP unknown")
      }
      transaction.unblockIp(auditLogEntry.browserIdData.inetAddress)
      transaction.unblockBrowser(auditLogEntry.browserIdData.idCookie)
      transaction.loadGuest(auditLogEntry.doerId) foreach { guest =>
        if (guest.lockedThreatLevel.isDefined) {
          transaction.updateGuest(guest.copy(lockedThreatLevel = None))
        }
      }
    }
  }


  def loadAuthorBlocks(postId: PostId): immutable.Seq[Block] = {
    readOnlyTransaction { transaction =>
      val auditLogEntry = transaction.loadCreatePostAuditLogEntry(postId) getOrElse {
        return Nil
      }
      val browserIdData = auditLogEntry.browserIdData
      transaction.loadBlocks(ip = browserIdData.ip, browserIdCookie = browserIdData.idCookie)
    }
  }


  def loadBlocks(ip: String, browserIdCookie: String): immutable.Seq[Block] = {
    readOnlyTransactionNotSerializable { transaction =>
      transaction.loadBlocks(ip = ip, browserIdCookie = browserIdCookie)
    }
  }


  def loadUserAndLevels(who: Who, transaction: SiteTransaction): UserAndLevels = {
    val user = transaction.loadTheUser(who.id)
    val trustLevel = user.effectiveTrustLevel
    val threatLevel = user match {
      case member: Member => member.effectiveThreatLevel
      case guest: Guest =>
        // Somewhat dupl code [2WKPU08], see a bit below.
        val blocks = transaction.loadBlocks(ip = who.ip, browserIdCookie = who.idCookie)
        val baseThreatLevel = guest.lockedThreatLevel getOrElse ThreatLevel.HopefullySafe
        val levelInt = blocks.foldLeft(baseThreatLevel.toInt) { (maxSoFar, block) =>
          math.max(maxSoFar, block.threatLevel.toInt)
        }
        ThreatLevel.fromInt(levelInt) getOrDie "EsE8GY2511"
      case group: Group =>
        ThreatLevel.HopefullySafe // for now
    }
    UserAndLevels(user, trustLevel, threatLevel)
  }


  def loadThreatLevelNoUser(browserIdData: BrowserIdData, transaction: SiteTransaction)
        : ThreatLevel = {
    // Somewhat dupl code [2WKPU08], see just above.
    val blocks = transaction.loadBlocks(
      ip = browserIdData.ip, browserIdCookie = browserIdData.idCookie)
    val levelInt = blocks.foldLeft(ThreatLevel.HopefullySafe.toInt) { (maxSoFar, block) =>
      math.max(maxSoFar, block.threatLevel.toInt)
    }
    ThreatLevel.fromInt(levelInt) getOrDie "EsE8GY2522"
  }


  def createIdentityUserAndLogin(newUserData: NewUserData): MemberLoginGrant = {
    val loginGrant = readWriteTransaction { transaction =>
      val userId = transaction.nextMemberId
      val user: MemberInclDetails = newUserData.makeUser(userId, transaction.now.toJavaDate)
      val identityId = transaction.nextIdentityId
      val identity = newUserData.makeIdentity(userId = userId, identityId = identityId)
      ensureSiteActiveOrThrow(user, transaction)
      transaction.deferConstraints()
      transaction.insertMember(user)
      user.primaryEmailInfo.foreach(transaction.insertUserEmailAddress)
      transaction.insertUsernameUsage(UsernameUsage(
        usernameLowercase = user.usernameLowercase, inUseFrom = transaction.now, userId = user.id))
      transaction.upsertUserStats(UserStats.forNewUser(
        user.id, firstSeenAt = transaction.now, emailedAt = None))
      transaction.insertIdentity(identity)
      joinGloballyPinnedChats(user.briefUser, transaction)
      MemberLoginGrant(Some(identity), user.briefUser, isNewIdentity = true, isNewMember = true)
    }
    memCache.fireUserCreated(loginGrant.user)
    loginGrant
  }


  /** Used if a user without any matching identity has been created (e.g. because
    * you signup as an email + password user, or accept an invitation). And you then
    * later on try to login via e.g. a Gmail account with the same email address.
    * Then we want to create a Gmail OpenAuth identity and connect it to the user
    * in the database.
    */
  def createIdentityConnectToUserAndLogin(user: Member, oauthDetails: OpenAuthDetails)
        : MemberLoginGrant = {
    require(user.email.nonEmpty, "DwE3KEF7")
    require(user.emailVerifiedAt.nonEmpty, "DwE5KGE2")
    require(user.isAuthenticated, "DwE4KEF8")
    readWriteTransaction { transaction =>
      val identityId = transaction.nextIdentityId
      val identity = OpenAuthIdentity(id = identityId, userId = user.id, oauthDetails)
      transaction.insertIdentity(identity)
      addUserStats(UserStats(user.id, lastSeenAt = transaction.now))(transaction)
      MemberLoginGrant(Some(identity), user, isNewIdentity = true, isNewMember = false)
    }
  }


  def createPasswordUserCheckPasswordStrong(userData: NewPasswordUserData): Member = {
    security.throwErrorIfPasswordTooWeak(
      password = userData.password, username = userData.username,
      fullName = userData.name, email = userData.email)
    val user = readWriteTransaction { transaction =>
      val now = userData.createdAt
      val userId = transaction.nextMemberId
      val user = userData.makeUser(userId)
      ensureSiteActiveOrThrow(user, transaction)
      transaction.deferConstraints()
      transaction.insertMember(user)
      user.primaryEmailInfo.foreach(transaction.insertUserEmailAddress)
      transaction.insertUsernameUsage(UsernameUsage(
        usernameLowercase = user.usernameLowercase, inUseFrom = now, userId = user.id))
      transaction.upsertUserStats(UserStats.forNewUser(
        user.id, firstSeenAt = userData.firstSeenAt.getOrElse(now), emailedAt = None))
      joinGloballyPinnedChats(user.briefUser, transaction)
      user.briefUser
    }
    memCache.fireUserCreated(user)
    user
  }


  def changePasswordCheckStrongEnough(userId: UserId, newPassword: String): Boolean = {
    val newPasswordSaltHash = DbDao.saltAndHashPassword(newPassword)
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      security.throwErrorIfPasswordTooWeak(
        password = newPassword, username = user.username,
        fullName = user.fullName, email = user.primaryEmailAddress)
      user = user.copy(passwordHash = Some(newPasswordSaltHash))
      transaction.updateMemberInclDetails(user)
    }
  }


  def loginAsGuest(loginAttempt: GuestLoginAttempt): Guest = {
    val user = readWriteTransaction { transaction =>
      val guest = transaction.loginAsGuest(loginAttempt).guest
      // We don't know if this guest user is being created now, or if it already exists
      // — so upsert (rather than insert? or update?) stats about this guest user.
      // (Currently this upsert keeps the earliest/oldest first/latest dates, see [7FKTU02].)
      transaction.upsertUserStats(UserStats(
        guest.id, firstSeenAtOr0 = transaction.now, lastSeenAt = transaction.now))
      guest
    }
    memCache.put(
      key(user.id),
      MemCacheValueIgnoreVersion(user))
    user
  }


  def tryLoginAsMember(loginAttempt: MemberLoginAttempt): MemberLoginGrant = {
    SECURITY; COULD // add setting that prevents people from logging in by username — because the
    // username is public, can starting guessing passwords directly. (There are rate limits.) Sth like:
    // if (!settings.allowLoginByUsername && loginAttempt.isByUsername) throwForbidden(...)
    // + prevent submitting username, client side.

    val settings = getWholeSiteSettings()
    val loginGrant = readWriteTransaction { transaction =>
      val loginGrant = transaction.tryLoginAsMember(
          loginAttempt, requireVerifiedEmail = settings.requireVerifiedEmail)
      addUserStats(UserStats(loginGrant.user.id, lastSeenAt = transaction.now))(transaction)
      if (!loginGrant.user.isSuspendedAt(loginAttempt.date))
        return loginGrant

      val user = transaction.loadMemberInclDetails(loginGrant.user.id) getOrElse throwForbidden(
        "DwE05KW2", "User not found, id: " + loginGrant.user.id)
      // Still suspended?
      if (user.suspendedAt.isDefined) {
        val forHowLong = user.suspendedTill match {
          case None => "forever"
          case Some(date) => "until " + toIso8601(date)
        }
        throwForbidden("DwE403SP0", o"""Account suspended $forHowLong,
            reason: ${user.suspendedReason getOrElse "?"}""")
      }
      loginGrant
    }

    // Don't save any site cache version, because user specific data doesn't change
    // when site specific data changes.
    memCache.put(
      key(loginGrant.user.id),
      MemCacheValueIgnoreVersion(loginGrant.user))

    loginGrant
  }


  def logout(userId: UserId) {
    readWriteTransaction { transaction =>
      addUserStats(UserStats(userId, lastSeenAt = transaction.now))(transaction)
    }
    memCache.remove(key(userId))
  }


  def loadUsers(): immutable.Seq[User] = {
    readOnlyTransaction { transaction =>
      transaction.loadUsers()
    }
  }


  def loadSiteOwner(): Option[MemberInclDetails] = {
    readOnlyTransaction { transaction =>
      transaction.loadOwner()
    }
  }


  def getUsersAsSeq(userIds: Iterable[UserId]): immutable.Seq[User] = {
    // Somewhat dupl code [5KWE02]. Break out helper function getManyById[K, V](keys) ?
    val usersFound = ArrayBuffer[User]()
    val missingIds = ArrayBuffer[UserId]()
    userIds foreach { id =>
      memCache.lookup[User](key(id)) match {
        case Some(user) => usersFound.append(user)
        case None => missingIds.append(id)
      }
    }
    if (missingIds.nonEmpty) {
      val moreUsers = readOnlyTransaction(_.loadUsers(missingIds))
      usersFound.appendAll(moreUsers)
    }
    usersFound.toVector
  }


  def loadCompleteUsers(onlyThosePendingApproval: Boolean): immutable.Seq[MemberInclDetails] = {
    readOnlyTransaction { transaction =>
      transaction.loadMembersInclDetails(onlyPendingApproval = onlyThosePendingApproval)
    }
  }


  def loadMemberInclDetailsById(userId: UserId): Option[MemberInclDetails] = {
    readOnlyTransaction { transaction =>
      transaction.loadMemberInclDetails(userId)
    }
  }


  def loadTheMemberInclDetailsById(memberId: UserId): MemberInclDetails =
    readOnlyTransaction(_.loadTheMemberInclDetails(memberId))


  def loadTheGroupInclDetailsById(groupId: UserId): Group =
    readOnlyTransaction(_.loadGroupInclDetails(groupId)).getOrDie(
      "EdE2WKBG0", s"Group $groupId@$siteId not found")


  def loadMembersInclDetailsById(userIds: Iterable[UserId]): immutable.Seq[MemberInclDetails] = {
    readOnlyTransaction(_.loadMembersInclDetailsById(userIds))
  }


  def loadMembersWithPrefix(prefix: String): immutable.Seq[Member] = {
    readOnlyTransaction(_.loadMembersWithPrefix(prefix))
  }


  def getMember(userId: UserId): Option[Member] = {
    require(userId >= User.LowestMemberId, "EsE4GKX24")
    getUser(userId).map(_.asInstanceOf[Member])
  }


  def getUser(userId: UserId): Option[User] = {
    memCache.lookup[User](
      key(userId),
      orCacheAndReturn = {
        readOnlyTransaction { transaction =>
          transaction.loadUser(userId)
        }
      },
      ignoreSiteCacheVersion = true)
  }


  /**
    * Loads a user from the database.
    * Verifies that the loaded id match the id encoded in the session identifier,
    * and throws a LoginNotFoundException on mismatch (happens e.g. if
    * I've connected the server to another backend, or access many backends
    * via the same hostname but different ports).
    */
  def getUserBySessionId(sid: SidStatus): Option[User] = {
    sid.userId map { sidUserId =>
      val user = getUser(sidUserId) getOrElse {
        // This might happen 1) if the server connected to a new database
        // (e.g. a standby where the login entry hasn't yet been
        // created), or 2) during testing, when I sometimes manually
        // delete stuff from the database (including login entries).
        p.Logger.warn(s"Didn't find user $siteId:$sidUserId [EdE01521U35]")
        throw LoginNotFoundException(siteId, sidUserId)
      }
      if (user.id != sidUserId) {
        // Sometimes I access different databases via different ports,
        // but from the same host name. Browsers, however, usually ignore
        // port numbers when sending cookies. So they sometimes send
        // the wrong login-id and user-id to the server.
        p.Logger.warn(s"DAO loaded the wrong user, session: $sid, user: $user [EdE0KDBL4]")
        throw LoginNotFoundException(siteId, sidUserId)
      }
      user
    }
  }


  def loadMemberByEmailOrUsername(emailOrUsername: String): Option[Member] = {
    readOnlyTransaction { transaction =>
      // Don't need to cache this? Only called when logging in.
      transaction.loadMemberByPrimaryEmailOrUsername(emailOrUsername)
    }
  }


  def loadUserAndAnyIdentity(userId: UserId): Option[(Option[Identity], User)] = {
    loadIdtyDetailsAndUser(userId) match {
      case Some((identity, user)) => Some((Some(identity), user))
      case None =>
        // No OAuth or OpenID identity, try load password user:
        getUser(userId) match {
          case Some(user) =>
            Some((None, user))
          case None =>
            None
        }
    }
  }


  private def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)] = {
    // Don't cache this, because this function is rarely called
    // — currently only when creating new website.
    readOnlyTransaction { transaction =>
      transaction.loadIdtyDetailsAndUser(userId)
    }
  }


  def getGroupIds(user: Option[User]): Vector[UserId] = {
    user.map(getGroupIds) getOrElse Vector(Group.EveryoneId)
  }


  def getGroupIds(user: User): Vector[UserId] = {
    COULD_OPTIMIZE // For now. Later, cache.
    user match {
      case _: Guest | UnknownUser => Vector(Group.EveryoneId)
      case _: Member | _: Group =>
        readOnlyTransaction { transaction =>
          transaction.loadGroupIds(user)
        }
    }
  }


  def joinOrLeavePageIfAuth(pageId: PageId, join: Boolean, who: Who): Option[BareWatchbar] = {
    if (User.isGuestId(who.id))
      throwForbidden("EsE3GBS5", "Guest users cannot join/leave pages")

    val watchbarsByUserId = joinLeavePageUpdateWatchbar(Set(who.id), pageId, add = join, who)
    val anyNewWatchbar = watchbarsByUserId.get(who.id)
    anyNewWatchbar
  }


  /** When a member joins the site, hen automatically joins chat channels that are pinned
    * globally. Also, when hen transitions to a higher trust level, then more globally-pinned-chats
    * might become visible to hen (e.g. visible only to Trusted users) — and then hen auto-joins
    * those too.
    */
  def joinGloballyPinnedChats(user: User, tx: SiteTransaction) {
    val chatsInclForbidden = tx.loadOpenChatsPinnedGlobally()
    BUG // Don't join a chat again, if has left it. Needn't fix now, barely matters.
    val joinedChats = ArrayBuffer[PageMeta]()
    chatsInclForbidden foreach { chatPageMeta =>
      val (maySee, debugCode) = maySeePageUseCache(chatPageMeta, Some(user))
      if (maySee) {
        val couldntAdd = mutable.Set[UserId]()
        joinLeavePageImpl(Set(user.id), chatPageMeta.pageId, add = true, byWho = Who.System,
            couldntAdd, tx)
        if (!couldntAdd.contains(user.id)) {
          joinedChats += chatPageMeta
        }
      }
    }
    addRemovePagesToWatchbar(joinedChats, user.id, add = true)
  }


  def addUsersToPage(userIds: Set[UserId], pageId: PageId, byWho: Who) {
    joinLeavePageUpdateWatchbar(userIds, pageId, add = true, byWho)
  }


  def removeUsersFromPage(userIds: Set[UserId], pageId: PageId, byWho: Who) {
    joinLeavePageUpdateWatchbar(userIds, pageId, add = false, byWho)
  }


  private def joinLeavePageUpdateWatchbar(userIds: Set[UserId], pageId: PageId, add: Boolean,
      byWho: Who): Map[UserId, BareWatchbar] = {

    if (byWho.isGuest)
      throwForbidden("EsE2GK7S", "Guests cannot add/remove people to pages")

    if (userIds.size > 50)
      throwForbidden("EsE5DKTW02", "Cannot add/remove more than 50 people at a time")

    if (userIds.exists(User.isGuestId) && add)
      throwForbidden("EsE5PKW1", "Cannot add guests to a page")

    val couldntAdd = mutable.Set[UserId]()

    val pageMeta = readWriteTransaction { tx =>
      joinLeavePageImpl(userIds, pageId, add, byWho, couldntAdd, tx)
    }

    SHOULD // push new member notf to browsers, so that this gets updated: [5FKE0WY2]
    // - new members' watchbars
    // - everyone's context bar (the users list)
    // - the Join Chat button (disappears/appears)

    // Chat page JSON includes a list of all page members, so:
    if (pageMeta.pageRole.isChat) {
      refreshPageInMemCache(pageId)
    }

    var watchbarsByUserId = Map[UserId, BareWatchbar]()
    userIds foreach { userId =>
      if (couldntAdd.contains(userId)) {
        // Need not update the watchbar.
      }
      else {
        addRemovePagesToWatchbar(Some(pageMeta), userId, add) foreach { newWatchbar =>
          watchbarsByUserId += userId -> newWatchbar
        }
      }
    }
    watchbarsByUserId
  }


  private def joinLeavePageImpl(userIds: Set[UserId], pageId: PageId, add: Boolean,
    byWho: Who, couldntAdd: mutable.Set[UserId], transaction: SiteTransaction): PageMeta = {
    val pageMeta = transaction.loadPageMeta(pageId) getOrElse
      security.throwIndistinguishableNotFound("42PKD0")

    // Right now, to join a forum page = sub community, one just adds it to one's watchbar.
    // But we don't add/remove the user from the page members list, so nothing to do here.
    if (pageMeta.pageRole == PageRole.Forum)
      return pageMeta

    val usersById = transaction.loadMembersAsMap(userIds + byWho.id)
    val me = usersById.getOrElse(byWho.id, throwForbidden(
      "EsE6KFE0X", s"Your user cannot be found, id: ${byWho.id}"))

    lazy val numMembersAlready = transaction.loadMessageMembers(pageId).size
    if (add && numMembersAlready + userIds.size > 400) {
      // I guess something, not sure what?, would break if too many people join
      // the same page.
      throwForbidden("EsE4FK0Y2", o"""Sorry but currently more than 400 page members
            isn't allowed. There are $numMembersAlready page members already""")
    }

    throwIfMayNotSeePage(pageMeta, Some(me))(transaction)

    val addingRemovingMyselfOnly = userIds.size == 1 && userIds.head == me.id

    if (!me.isStaff && me.id != pageMeta.authorId && !addingRemovingMyselfOnly)
      throwForbidden(
        "EsE28PDW9", "Only staff and the page author may add/remove people to/from the page")

    if (add) {
      if (!pageMeta.pageRole.isGroupTalk)
        throwForbidden("EsE8TBP0", s"Cannot add people to pages of type ${pageMeta.pageRole}")

      userIds.find(!usersById.contains(_)) foreach { missingUserId =>
        throwForbidden("EsE5PKS40", s"User not found, id: $missingUserId, cannot add to page")
      }

      userIds foreach { id =>
        COULD_OPTIMIZE // batch insert all users at once (would slightly speed up imports)
        val wasAdded = transaction.insertMessageMember(pageId, userId = id, addedById = me.id)
        if (!wasAdded) {
          // Someone else has added that user already. Could happen e.g. if someone adds you
          // to a chat channel, and you attempt to join it yourself at the same time.
          couldntAdd += id
        }
      }
    }
    else {
      userIds foreach { id =>
        transaction.removePageMember(pageId, userId = id, removedById = byWho.id)
      }
    }

    // Bump the page version, so the cached page json will be regenerated, now including
    // this new page member.
    // COULD add a numMembers field, and show # members, instead of # comments,
    // for chat topics, in the forum topic list? (because # comments in a chat channel is
    // rather pointless, instead, # new comments per time unit matters more, but then it's
    // simpler to instead show # users?)
    transaction.updatePageMeta(pageMeta, oldMeta = pageMeta, markSectionPageStale = false)
    pageMeta
  }


  private def addRemovePagesToWatchbar(pages: Iterable[PageMeta], userId: UserId, add: Boolean)
        : Option[BareWatchbar] = {
    BUG; RACE // when loading & saving the watchbar. E.g. if a user joins a page herself, and
    // another member adds her to the page, or another page, at the same time.

    val oldWatchbar = getOrCreateWatchbar(userId)
    var newWatchbar = oldWatchbar
    for (pageMeta <- pages) {
      if (add) {
        newWatchbar = newWatchbar.addPage(pageMeta, hasSeenIt = true)
      }
      else {
        newWatchbar = newWatchbar.removePageTryKeepInRecent(pageMeta)
      }
    }

    if (oldWatchbar == newWatchbar) {
      // This happens if we're adding a user whose in-memory watchbar got created in
      // `loadWatchbar` above — then the watchbar will likely be up-to-date already, here.
      return None
    }

    saveWatchbar(userId, newWatchbar)

    // If pages were added to the watchbar, we should start watching them. If we left
    // a private page, it'll disappear from the watchbar — then we should stop watching it.
    if (oldWatchbar.watchedPageIds != newWatchbar.watchedPageIds) {
      pubSub.userWatchesPages(siteId, userId, newWatchbar.watchedPageIds)
    }

    Some(newWatchbar)
  }


  /** Promotes a new member to trust levels Basic and Normal member, if hen meets those
    * requirements, after the additional time spent reading has been considered.
    * (Won't promote to trust level Helper and above though.)
    */
  def trackReadingProgressPerhapsPromote(user: User, pageId: PageId, newProgress: ReadingProgress) {
    // Tracking guests' reading progress would take a bit much disk space, makes disk-space DoS
    // attacks too simple. [8PLKW46]
    require(user.isMember, "EdE8KFUW2")

    readWriteTransaction { transaction =>
      val pageMeta = transaction.loadPageMeta(pageId) getOrDie "EdE5JKDYE"
      if (newProgress.maxPostNr + 1 > pageMeta.numPostsTotal) // post nrs start on TitleNr = 0 so add + 1
        throwForbidden("EdE7UKW25_", o"""Got post nr ${newProgress.maxPostNr} but there are only
          ${pageMeta.numPostsTotal} posts on page '$pageId'""")

      val oldProgress = transaction.loadReadProgress(userId = user.id, pageId = pageId)

      val (numMoreNonOrigPostsRead, numMoreTopicsEntered, resultingProgress) =
        oldProgress match {
          case None =>
            (newProgress.numNonOrigPostsRead, 1, newProgress)
          case Some(old) =>
            val numNewLowPosts =
              (newProgress.lowPostNrsRead -- old.lowPostNrsRead - PageParts.BodyNr).size
            // This might re-count a post that we re-reads...
            var numNewHighPosts =
              (newProgress.lastPostNrsReadRecentFirst.toSet -- old.lastPostNrsReadRecentFirst).size
            // ... but here we cap at the total size of the topic.
            val requestedNumNewPosts = numNewLowPosts + numNewHighPosts
            val maxNumNewPosts =
              math.max(0, pageMeta.numRepliesTotal - old.numNonOrigPostsRead) // [7FF02A3R]
            val allowedNumNewPosts = math.min(maxNumNewPosts, requestedNumNewPosts)
            (allowedNumNewPosts, 0, old.addMore(newProgress))
        }

      val (numMoreDiscourseRepliesRead, numMoreDiscourseTopicsEntered,
          numMoreChatMessagesRead, numMoreChatTopicsEntered) =
        if (pageMeta.pageRole.isChat)
          (0, 0, numMoreNonOrigPostsRead, numMoreTopicsEntered)
        else
          (numMoreNonOrigPostsRead, numMoreTopicsEntered, 0, 0)

      val statsBefore = transaction.loadUserStats(user.id) getOrDie "EdE2FPJR9"
      val statsAfter = statsBefore.addMoreStats(UserStats(
        userId = user.id,
        lastSeenAt = newProgress.lastVisitedAt,
        numSecondsReading = newProgress.secondsReading,
        numDiscourseTopicsEntered = numMoreDiscourseTopicsEntered,
        numDiscourseRepliesRead = numMoreDiscourseRepliesRead,
        numChatTopicsEntered = numMoreChatTopicsEntered,
        numChatMessagesRead = numMoreChatMessagesRead))

      COULD_OPTIMIZE // aggregate the reading progress in Redis instead. Save every 5? 10? minutes,
      // so won't write to the db so very often.

      transaction.upsertReadProgress(userId = user.id, pageId = pageId, resultingProgress)
      transaction.upsertUserStats(statsAfter)

      if (user.canPromoteToBasicMember) {
        if (statsAfter.meetsBasicMemberRequirements) {
          promoteUser(user.id, TrustLevel.BasicMember, transaction)
        }
      }
      else if (user.canPromoteToFullMember) {
        if (statsAfter.meetsFullMemberRequirements) {
          promoteUser(user.id, TrustLevel.FullMember, transaction)
        }
      }
      else {
        // Higher trust levels require running expensive queries; don't do that here.
        // Instead, will be done once a day in some background job.
      }

      SHOULD // also mark any notfs for the newly read posts, as read.
    }
  }


  def promoteUser(userId: UserId, newTrustLevel: TrustLevel, transaction: SiteTransaction) {
    // If trust level locked, we'll promote the member anyway — but member.effectiveTrustLevel
    // won't change, because it considers the locked trust level first.
    val member = transaction.loadTheMemberInclDetails(userId)
    val promoted = member.copy(trustLevel = newTrustLevel)
    transaction.updateMemberInclDetails(promoted)
    TESTS_MISSING // Perhaps now new chat channels are available to the member.
    joinGloballyPinnedChats(member.briefUser, transaction)
  }


  def loadNotifications(userId: UserId, upToWhen: Option[When], me: Who): NotfsAndCounts = {
    readOnlyTransaction { transaction =>
      if (me.id != userId) {
        if (!transaction.loadUser(me.id).exists(_.isStaff))
          throwForbidden("EsE5Y5IKF0", "May not list other users' notifications")
      }
      debiki.ReactJson.loadNotifications(userId, transaction, unseenFirst = false, limit = 100,
        upToWhen = None) // later: Some(upToWhenDate), and change to limit = 50 above?
    }
  }


  def verifyPrimaryEmailAddress(userId: UserId, verifiedAt: ju.Date) {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      user = user.copy(emailVerifiedAt = Some(verifiedAt))
      val userEmailAddress = user.primaryEmailInfo getOrDie "EdE4JKA2S"
      dieUnless(userEmailAddress.isVerified, "EdE7UNHR4")
      transaction.updateMemberInclDetails(user)
      transaction.updateUserEmailAddress(userEmailAddress)
      // Now, when email verified, perhaps time to start sending summary emails.
      transaction.reconsiderSendingSummaryEmailsTo(user.id)
    }
    removeUserFromMemCache(userId)
  }


  SECURITY // Harmless right now, but should pass Who and authz.
  def setUserAvatar(userId: UserId, tinyAvatar: Option[UploadRef], smallAvatar: Option[UploadRef],
        mediumAvatar: Option[UploadRef], browserIdData: BrowserIdData) {
    require(smallAvatar.isDefined == tinyAvatar.isDefined, "EsE9PYM2")
    require(smallAvatar.isDefined == mediumAvatar.isDefined, "EsE8YFM2")
    readWriteTransaction { transaction =>
      val userBefore = transaction.loadTheMemberInclDetails(userId)
      val userAfter = userBefore.copy(
        tinyAvatar = tinyAvatar,
        smallAvatar = smallAvatar,
        mediumAvatar = mediumAvatar)

      val hasNewAvatar =
        userBefore.tinyAvatar != userAfter.tinyAvatar ||
          userBefore.smallAvatar != userAfter.smallAvatar ||
          userBefore.mediumAvatar != userAfter.mediumAvatar

      val relevantRefs =
        if (!hasNewAvatar) Set.empty
        else
          userBefore.tinyAvatar.toSet ++ userBefore.smallAvatar.toSet ++
            userBefore.mediumAvatar.toSet ++ userAfter.tinyAvatar.toSet ++
            userAfter.smallAvatar.toSet ++ userAfter.mediumAvatar.toSet
      val refsInUseBefore = transaction.filterUploadRefsInUse(relevantRefs)

      transaction.updateMemberInclDetails(userAfter)

      if (hasNewAvatar) {
        val refsInUseAfter = transaction.filterUploadRefsInUse(relevantRefs)
        val refsAdded = refsInUseAfter -- refsInUseBefore
        val refsRemoved = refsInUseBefore -- refsInUseAfter
        refsAdded.foreach(transaction.updateUploadQuotaUse(_, wasAdded = true))
        refsRemoved.foreach(transaction.updateUploadQuotaUse(_, wasAdded = false))

        userBefore.tinyAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        userBefore.smallAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        userBefore.mediumAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        userAfter.tinyAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        userAfter.smallAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        userAfter.mediumAvatar.foreach(transaction.updateUploadedFileReferenceCount)
        transaction.markPagesWithUserAvatarAsStale(userId)
      }
      removeUserFromMemCache(userId)

      // Clear the PageStuff cache (by clearing the whole in-mem cache), because
      // PageStuff includes avatar urls.
      // COULD have above markPagesWithUserAvatarAsStale() return a page id list and
      // uncache only those pages.
      emptyCacheImpl(transaction)
    }
  }


  def configRole(userId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs] = None,
        activitySummaryEmailsIntervalMins: Option[Int] = None,
        isAdmin: Option[Boolean] = None, isOwner: Option[Boolean] = None) {
    // Don't specify emailVerifiedAt — use verifyPrimaryEmailAddress() instead; it refreshes the cache.
    readWriteTransaction { transaction =>
      var user = transaction.loadTheMemberInclDetails(userId)
      emailNotfPrefs foreach { prefs =>
        user = user.copy(emailNotfPrefs = prefs)
      }
      activitySummaryEmailsIntervalMins foreach { mins =>
        user = user.copy(summaryEmailIntervalMins = Some(mins))
      }
      isAdmin foreach { isAdmin =>
        user = user.copy(isAdmin = isAdmin)
      }
      isOwner foreach { isOwner =>
        user = user.copy(isOwner = isOwner)
      }
      transaction.updateMemberInclDetails(user)
    }
    removeUserFromMemCache(userId)
  }


  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) {
    readWriteTransaction { transaction =>
      transaction.configIdtySimple(ctime = ctime,
        emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)
      // COULD refresh guest in cache: new email prefs --> perhaps show "??" not "?" after name.
    }
  }


  def listUsers(): Seq[User] =
    readOnlyTransaction(_.loadUsers())


  def listUsersNotifiedAboutPost(postId: PostId): Set[UserId] =
    readOnlyTransaction(_.listUsersNotifiedAboutPost(postId))


  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername] =
    readOnlyTransaction(_.listUsernames(pageId = pageId, prefix = prefix))


  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId] =
    readOnlyTransaction(_.loadUserIdsWatchingPage(pageId))


  def loadUserPageSettings(userId: RoleId, pageId: PageId): UserPageSettings =
    readOnlyTransaction(_.loadUserPageSettings(userId, pageId = pageId)) getOrElse
      UserPageSettings.Default


  def saveUserPageSettings(userId: RoleId, pageId: PageId, settings: UserPageSettings) {
    throwForbiddenIf(settings.notfLevel == NotfLevel.WatchingFirst,
      "EsE6SRK02", s"${NotfLevel.WatchingFirst} not supported, for pages")
    throwForbiddenIf(settings.notfLevel == NotfLevel.Tracking,
      "EsE7DKS85", s"${NotfLevel.Tracking} not yet implemented")
    readWriteTransaction(_.saveUserPageSettings(userId = userId, pageId = pageId, settings))
  }


  def saveMemberPreferences(preferences: MemberPreferences, byWho: Who) {
    // Similar to saveGroupPreferences below. (0QE15TW93)
    SECURITY // should create audit log entry. Should allow staff to change usernames.
    BUG // the lost update bug (if staff + user henself changes the user's prefs at the same time)

    readWriteTransaction { transaction =>
      val user = transaction.loadTheMemberInclDetails(preferences.userId)
      val me = transaction.loadTheMember(byWho.id)
      require(me.isStaff || me.id == user.id, "EdE2WK7G4")

      // Perhaps there's some security problem that would results in a non-staff user
      // getting an email about each and every new post. So, for now:
      SECURITY // (Later, do some security review, add more tests, and remove this restriction.)
      if (preferences.emailForEveryNewPost && (!user.isStaff || !me.isStaff))
        throwForbidden("EsE7YKF24", o"""Currently only staff may choose be notified about
          every new post""")

      // Don't let people change their usernames too often.
      if (user.username != preferences.username) {
        val usersOldUsernames: Seq[UsernameUsage] = transaction.loadUsersOldUsernames(user.id)
        val previousUsages = transaction.loadUsernameUsages(preferences.username)

        // For now: (later, could allow, if never mentioned, after a grace period. Docs [8KFUT20])
        val usagesByOthers = previousUsages.filter(_.userId != user.id)
        if (usagesByOthers.nonEmpty)
          throwForbidden("EdE5D0Y29_",
            "That username is, or has been, in use by someone else. You cannot use it.")

        val maxPerYearTotal = me.isStaff ? 20 | 9
        val maxPerYearDistinct = me.isStaff ? 8 | 3

        val recentUsernames = usersOldUsernames.filter(
            _.inUseFrom.daysBetween(transaction.now) < 365)
        if (recentUsernames.length >= maxPerYearTotal)
          throwForbidden("DwE5FKW02",
            "You have changed your username too many times the past year")

        val recentDistinct = recentUsernames.map(_.usernameLowercase).toSet
        def yetAnotherNewName = !recentDistinct.contains(preferences.username.toLowerCase)
        if (recentDistinct.size >= maxPerYearDistinct && yetAnotherNewName)
          throwForbidden("EdE7KP4ZZ_",
            "You have changed to different usernames too many times the past year")

        val anyUsernamesToStopUsingNow = usersOldUsernames.filter(_.inUseTo.isEmpty)
        anyUsernamesToStopUsingNow foreach { usage: UsernameUsage =>
          val usageStopped = usage.copy(inUseTo = Some(transaction.now))
          transaction.updateUsernameUsage(usageStopped)
        }

        transaction.insertUsernameUsage(UsernameUsage(
          usernameLowercase = preferences.username.toLowerCase,
          inUseFrom = transaction.now,
          inUseTo = None,
          userId = user.id,
          firstMentionAt = None))
      }

      // Changing address is done via UserController.setPrimaryEmailAddresses instead, not here
      if (user.primaryEmailAddress != preferences.emailAddress)
        throwForbidden("DwE44ELK9", "Shouldn't modify one's email here")

      val userAfter = user.copyWithNewPreferences(preferences)
      try transaction.updateMemberInclDetails(userAfter)
      catch {
        case _: DuplicateUsernameException =>
          throwForbidden("EdE2WK8Y4_", "Username already in use")
      }

      if (userAfter.summaryEmailIntervalMins != user.summaryEmailIntervalMins ||
          userAfter.summaryEmailIfActive != user.summaryEmailIfActive) {
        transaction.reconsiderSendingSummaryEmailsTo(user.id)  // related: [5KRDUQ0]
      }

      removeUserFromMemCache(preferences.userId)
      // Clear the page cache (by clearing all caches), if we changed the user's name.  [2WBU0R1]
      // COULD have above markPagesWithUserAvatarAsStale() return a page id list and
      // uncache only those pages.
      if (preferences.changesStuffIncludedEverywhere(user)) {
        emptyCacheImpl(transaction)
      }
    }
  }


  def saveGroupPreferences(preferences: GroupPreferences, byWho: Who): Unit = {
    // Similar to saveMemberPreferences above. (0QE15TW93)
    SECURITY // should create audit log entry. Should allow staff to change usernames.
    BUG // the lost update bug (if staff + user henself changes the user's prefs at the same time)

    readWriteTransaction { transaction =>
      val group = transaction.loadTheGroupInclDetails(preferences.groupId)
      val me = transaction.loadTheMember(byWho.id)
      require(me.isStaff, "EdE5LKWV0")

      val groupAfter = group.copyWithNewPreferences(preferences)
      try transaction.updateGroup(groupAfter)
      catch {
        case _: DuplicateUsernameException =>
          throwForbidden("EdE2WK8Y4_", "Username already in use")
      }

      // If summary-email-settings were changed, hard to know which people were affected.
      // So let the summary-emails module reconsider all members at this site.
      if (groupAfter.summaryEmailIntervalMins != group.summaryEmailIntervalMins ||
          groupAfter.summaryEmailIfActive != group.summaryEmailIfActive) {
        transaction.reconsiderSendingSummaryEmailsToEveryone()  // related: [5KRDUQ0] [8YQKSD10]
      }

      removeUserFromMemCache(group.id)

      // Group names aren't shown everywhere. So need not empty cache (as is however
      // done here [2WBU0R1]).
    }
  }


  def saveGuest(guestId: UserId, name: String) {
    // BUG: the lost update bug.
    readWriteTransaction { transaction =>
      var guest = transaction.loadTheGuest(guestId)
      guest = guest.copy(guestName = name)
      transaction.updateGuest(guest)
    }
    removeUserFromMemCache(guestId)
  }


  def perhapsBlockGuest(request: play.api.mvc.Request[_], sidStatus: SidStatus,
        browserId: BrowserId) {
    if (request.method == "GET")
      return

    // Authenticated users are ignored here. Suspend them instead.
    if (sidStatus.userId.exists(User.isRoleId))
      return

    // Ignore not-logged-in people, unless they attempt to login as guests.
    if (sidStatus.userId.isEmpty) {
      val guestLoginPath = controllers.routes.LoginAsGuestController.loginGuest().url
      if (!request.path.contains(guestLoginPath))
        return
    }

    // COULD cache blocks, but not really needed since this is for post requests only.
    val blocks = loadBlocks(
      ip = request.remoteAddress,
      // COULD pass None not ""?
      browserIdCookie = if (browserId.isNew) "-" else browserId.cookieValue)

    for (block <- blocks) {
      if (block.isActiveAt(globals.now()) && block.threatLevel == ThreatLevel.SevereThreat)
        throwForbidden("DwE403BK01", o"""Not allowed. Please sign up with a username
            and password, or login with Google or Facebook, for example.""")
    }
  }


  def loadUsersOnlineStuff(): UsersOnlineStuff = {
    usersOnlineCache.get(siteId, new ju.function.Function[SiteId, UsersOnlineStuff] {
      override def apply(dummySiteId: SiteId): UsersOnlineStuff = {
        val (userIds, numStrangers) = redisCache.loadOnlineUserIds()
        val users = readOnlyTransaction { transaction =>
          transaction.loadUsers(userIds)
        }
        UsersOnlineStuff(
          users,
          usersJson = JsArray(users.map(debiki.ReactJson.JsUser)),
          numStrangers = numStrangers)
      }
    })
  }


  def removeUserFromMemCache(userId: UserId) {
    memCache.remove(key(userId))
  }

  private def key(userId: UserId) = MemCacheKey(siteId, s"$userId|UserById")

}

