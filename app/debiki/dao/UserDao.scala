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

import actions.SafeActions.SessionRequest
import com.debiki.core._
import debiki.DebikiHttp.{throwNotFound, throwForbidden}
import java.net.InetAddress
import java.{util => ju}
import requests.ApiRequest
import scala.collection.immutable
import Prelude._
import EmailNotfPrefs.EmailNotfPrefs
import CachingDao.{CacheKey, CacheValueIgnoreVersion}


trait UserDao {
  self: SiteDao =>


  def insertInvite(invite: Invite) {
    readWriteTransaction { transaction =>
      transaction.insertInvite(invite)
    }
  }


  def acceptInviteCreateUser(secretKey: String): (CompleteUser, Invite) = {
    readWriteTransaction { transaction =>
      var invite = transaction.loadInvite(secretKey) getOrElse throwForbidden(
        "DwE6FKQ2", "Bad invite key")

      invite.acceptedAt foreach { acceptedAt =>
        val millisAgo = (new ju.Date).getTime - acceptedAt.getTime
        // For now: If the invitation is < 1 day old, allow the user to log in
        // again via the invitation link. In Discourse, this timeout is configurable.
        if (millisAgo < 24 * 3600 * 1000) {
          val user = loadCompleteUser(invite.userId getOrDie "DwE6FKEW2") getOrDie "DwE8KES2"
          return (user, invite)
        }

        throwForbidden("DwE0FKW2", "You have joined the site already, but this link has expired")
      }

      if (transaction.loadUserByEmailOrUsername(invite.emailAddress).isDefined)
        throwForbidden("DwE8KFG4", o"""You have joined this site already, so this
             join-site invitation link does nothing. Thanks for clicking it anyway""")

      val userId = transaction.nextAuthenticatedUserId
      var newUser = invite.makeUser(userId, transaction.currentTime)
      val inviter = transaction.loadUser(invite.createdById) getOrDie "DwE5FKG4"
      if (inviter.isAdmin) {
        newUser = newUser.copy(
          isApproved = Some(true),
          approvedAt = Some(transaction.currentTime),
          approvedById = Some(invite.createdById))
      }

      invite = invite.copy(acceptedAt = Some(transaction.currentTime), userId = Some(userId))

      // COULD loop and append 1, 2, 3, ... until there's no username clash.
      transaction.insertAuthenticatedUser(newUser)
      transaction.updateInvite(invite)
      (newUser, invite)
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
      var user = transaction.loadTheCompleteUser(userId)
      user = user.copy(
        isApproved = isapproved,
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId))
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(userId)
  }


  def suspendUser(userId: UserId, numDays: Int, reason: String, suspendedById: UserId) {
    require(numDays >= 1, "DwE4PKF8")
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(userId)
      val suspendedTill = new ju.Date(transaction.currentTime.getTime + numDays * MillisPerDay)
      user = user.copy(
        suspendedAt = Some(transaction.currentTime),
        suspendedTill = Some(suspendedTill),
        suspendedById = Some(suspendedById),
        suspendedReason = Some(reason.trim))
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(userId)
  }


  def unsuspendUser(userId: UserId) {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(userId)
      user = user.copy(suspendedAt = None, suspendedTill = None, suspendedById = None,
        suspendedReason = None)
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(userId)
  }


  def blockGuest(postId: UniquePostId, numDays: Int, blockerId: UserId) {
    readWriteTransaction { transaction =>
      val auditLogEntry: AuditLogEntry = transaction.loadFirstAuditLogEntry(postId) getOrElse {
        throwForbidden("DwE2WKF5", "Cannot block user: No audit log entry, IP unknown")
      }

      if (!User.isGuestId(auditLogEntry.doerId))
        throwForbidden("DwE4WKQ2", "Cannot block authenticated users. Suspend them instead")

      val blockedTill =
        Some(new ju.Date(transaction.currentTime.getTime + MillisPerDay * numDays))

      val ipBlock = Block(
        ip = Some(auditLogEntry.browserIdData.inetAddress),
        browserIdCookie = None,
        blockedById = blockerId,
        blockedAt = transaction.currentTime,
        blockedTill = blockedTill)

      val browserIdCookieBlock = Block(
        ip = None,
        browserIdCookie = Some(auditLogEntry.browserIdData.idCookie),
        blockedById = blockerId,
        blockedAt = transaction.currentTime,
        blockedTill = blockedTill)

      // COULD catch dupl key error when inserting IP block, and continue anyway
      // with inserting browser id cookie block.
      transaction.insertBlock(ipBlock)
      transaction.insertBlock(browserIdCookieBlock)
    }
  }


  def unblockGuest(postId: PostId, unblockerId: UserId) {
    readWriteTransaction { transaction =>
      val auditLogEntry: AuditLogEntry = transaction.loadFirstAuditLogEntry(postId) getOrElse {
        throwForbidden("DwE5FK83", "Cannot unblock guest: No audit log entry, IP unknown")
      }
      transaction.unblockIp(auditLogEntry.browserIdData.inetAddress)
      transaction.unblockBrowser(auditLogEntry.browserIdData.idCookie)
    }
  }


  def loadAuthorBlocks(postId: UniquePostId): immutable.Seq[Block] = {
    readOnlyTransaction { transaction =>
      val auditLogEntry = transaction.loadFirstAuditLogEntry(postId) getOrElse {
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


  def createIdentityUserAndLogin(newUserData: NewUserData): LoginGrant = {
    readWriteTransaction { transaction =>
      val userId = transaction.nextAuthenticatedUserId
      val user = newUserData.makeUser(userId, transaction.currentTime)
      val identityId = transaction.nextIdentityId
      val identity = newUserData.makeIdentity(userId = userId, identityId = identityId)
      transaction.insertAuthenticatedUser(user)
      transaction.insertIdentity(identity)
      LoginGrant(Some(identity), user.briefUser, isNewIdentity = true, isNewRole = true)
    }
  }


  def createPasswordUser(userData: NewPasswordUserData): User = {
    readWriteTransaction { transaction =>
      val userId = transaction.nextAuthenticatedUserId
      var user = userData.makeUser(userId, transaction.currentTime)

      // 2^14 = 16384, 1-2 seconds on my mobile. 2^16 = 65536, takes too long on my mobile.
      // But 2^14 was the recommended setting 5 years ago. On the server, 2^17 works fine
      // today though, so let's skip server relief for now and have the server do the
      // computations.
      val scryptHash: String = com.lambdaworks.crypto.SCryptUtil.scrypt(userData.password, 65536, 8, 1)
      scryptHash match {
        case ScryptHashRegex(hash) =>
          val hashOfHash = hashSha256Base64UrlSafe(hash)
          val scryptHashWithoutHash = hash.dropRightWhile(_ != '$')
          val scryptHashWithHashHash = scryptHashWithoutHash + hashOfHash
          user = user.copy(passwordHash = Some("scrypt-sha256:" + scryptHashWithHashHash))
        case _ =>
          die("DwE4KEW20", "scrypt error")
      }

      transaction.insertAuthenticatedUser(user)
      user.briefUser
    }
  }


  def changePassword(userId: UserId, newPasswordSaltHash: String): Boolean = {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(userId)
      user = user.copy(passwordHash = Some(newPasswordSaltHash))
      transaction.updateCompleteUser(user)
    }
  }


  def loginAsGuest(loginAttempt: GuestLoginAttempt): User = {
    readWriteTransaction { transaction =>
      transaction.loginAsGuest(loginAttempt).user
    }
  }


  def tryLoginWithPassword(loginAttempt: PasswordLoginAttempt): User = {
    def fail() = throwForbidden("DwE6KF47", "Bad email or username or password")

    val user = loadUserByEmailOrUsername(loginAttempt.email) getOrElse fail()
    if (user.emailVerifiedAt.isEmpty)
      throwForbidden("DwE4UBM2", o"""You have not yet confirmed your email address.
            Please check your email inbox — you should find an email from us with a
            verification link; please click it.""")

    val scryptHashHash = user.passwordHash getOrElse fail()

    // The scrpyt hash looks like: (for password "secret")
    //   $s0$e0801$epIxT/h6HbbwHaehFnh/bw==$7H0vsXlY8UxxyW/BWx/9GuY7jEvGjT71GFd6O4SZND0=
    //    version. salt_base64------------. derived_key_base64-------------------------.
    //       params.
    // where s0 means the salt is 128 bits and the derived key is 256 bits.
    // and params = 16 bit: log2(N), 8 bit: r, 8 bit: p. So in the example above:
    // log2(N) = 14, r = 8, p = 1.
    // However, we calculate the derived key client side (server relief) and send it to
    // the server which sha256-hashes it (the base64 version of the key).
    // ScryptHashHash looks like:
    //   scrypt-sha256:$s0$e0801$epIxT/h6HbbwHaehFnh/bw==$...sha-256-hash-of-the-
    //                                                            -base64-encoded-derived-key....
    //
    // So let us hash the derived key the client sent and see if it matches the sha-256 hash
    // in the database.
    //
    // The client could use:  https://github.com/dchest/scrypt-async-js
    // it's fast, on my laptop browser, if you specify interruptStep 0.
    // Just be sure to convert the hash from base64 to a byte array, like so, for example:
    //   var byteCharacters = atob('epIxT/h6HbbwHaehFnh/bw==');
    //   var byteNumbers = new Array(byteCharacters.length);
    //   for (var i = 0; i < byteCharacters.length; i++) {
    //     byteNumbers[i] = byteCharacters.charCodeAt(i);
    //   }
    //   and then call scrypt:
    //   scrypt('secret', [122, 146, 49, 79, 248, 122, 29, 182, 240, 29, 167, 161,
    //      22, 120, 127, 111], 14, 8, 32, 99999, function(res) { console.log(res); }, 'base64')
    //

    val hashOfDerivedKey = hashSha256Base64UrlSafe(loginAttempt.password)
    scryptHashHash match {
      case ScryptHashRegex(hash) =>
        if (hashOfDerivedKey != hash)
          fail()
      case _ =>
        die("DwE5KWE2", s"Corrupt password for user id ${user.id}")
    }

    user
  }


  private val ScryptHashRegex = """(?:scrypt-sha256:)?\$s0\$[^\$]+\$[^\$]+\$(.+)""".r


  def tryLogin(loginAttempt: LoginAttempt): LoginGrant = {
    val loginGrant = siteDbDao.tryLogin(loginAttempt)
    if (loginGrant.user.isSuspendedAt(loginAttempt.date)) {
      // (This is being rate limited, all post requests are.)
      val user = loadCompleteUser(loginGrant.user.id) getOrElse throwForbidden(
        "DwE05KW2", "User gone")
      // Still suspended?
      if (user.suspendedAt.isDefined) {
        val forHowLong = user.suspendedTill match {
          case None => "forever"
          case Some(date) => "until " + toIso8601(date)
        }
        throwForbidden("DwE403SP0", o"""Account suspended $forHowLong,
            reason: ${user.suspendedReason getOrElse "?"}""")
      }
    }
    loginGrant
  }


  def loadUsers(): immutable.Seq[User] = {
    readOnlyTransaction { transaction =>
      transaction.loadUsers()
    }
  }


  def loadCompleteUsers(onlyThosePendingApproval: Boolean): immutable.Seq[CompleteUser] = {
    readOnlyTransaction { transaction =>
      transaction.loadCompleteUsers(onlyPendingApproval = onlyThosePendingApproval)
    }
  }


  def loadCompleteUser(userId: UserId): Option[CompleteUser] = {
    readOnlyTransaction { transaction =>
      transaction.loadCompleteUser(userId)
    }
  }


  def loadUser(userId: UserId): Option[User] =
    siteDbDao.loadUser(userId)


  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User] =
    // Don't need to cache this? Only called when logging in.
    siteDbDao.loadUserByEmailOrUsername(emailOrUsername)


  def loadUserAndAnyIdentity(userId: UserId): Option[(Option[Identity], User)] = {
    loadIdtyDetailsAndUser(userId) match {
      case Some((identity, user)) => Some((Some(identity), user))
      case None =>
        // No OAuth or OpenID identity, try load password user:
        loadUser(userId) match {
          case Some(user) =>
            Some((None, user))
          case None =>
            None
        }
    }
  }


  private def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)] =
    // Don't cache this, because this function is rarely called
    // — currently only when creating new website.
    siteDbDao.loadIdtyDetailsAndUser(userId)


  def loadUserInfoAndStats(userId: UserId): Option[UserInfoAndStats] =
    siteDbDao.loadUserInfoAndStats(userId)


  def listUserActions(userId: UserId): Seq[UserActionInfo] =
    siteDbDao.listUserActions(userId)


  def loadPermsOnPage(reqInfo: PermsOnPageQuery): PermsOnPage =
    // Currently this results in no database request; there's nothing to cache.
    siteDbDao.loadPermsOnPage(reqInfo)


  def loadPermsOnPage(request: ApiRequest[_], pageId: PageId): PermsOnPage = {
    val pageMeta = loadPageMeta(pageId)
    val pagePath = lookupPagePath(pageId) getOrElse throwNotFound(
      "DwE74BK0", s"No page path found to page id: $pageId")

    siteDbDao.loadPermsOnPage(PermsOnPageQuery(
      tenantId = request.tenantId,
      ip = request.ip,
      user = request.user,
      pagePath = pagePath,
      pageMeta = pageMeta))
  }


  def verifyEmail(userId: UserId, verifiedAt: ju.Date) {
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(userId)
      user = user.copy(emailVerifiedAt = Some(verifiedAt))
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(userId)
  }


  def configRole(userId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs] = None, isAdmin: Option[Boolean] = None,
        isOwner: Option[Boolean] = None) {
    // Don't specify emailVerifiedAt here — use verifyEmail() instead; it refreshes the cache.
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(userId)
      emailNotfPrefs foreach { prefs =>
        user = user.copy(emailNotfPrefs = prefs)
      }
      isAdmin foreach { isAdmin =>
        user = user.copy(isAdmin = isAdmin)
      }
      isOwner foreach { isOwner =>
        user = user.copy(isOwner = isOwner)
      }
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(userId)
  }


  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) = {
    siteDbDao.configIdtySimple(ctime = ctime,
      emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)
    // COULD refresh guest in cache: new email prefs --> perhaps show "??" not "?" after name.
  }


  def listUsers(): Seq[User] = {
    readOnlyTransaction { transaction =>
      transaction.loadUsers()
    }
  }


  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername] =
    siteDbDao.listUsernames(pageId = pageId, prefix = prefix)


  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId] =
    siteDbDao.loadUserIdsWatchingPage(pageId)


  def loadRolePageSettings(roleId: RoleId, pageId: PageId): RolePageSettings =
    siteDbDao.loadRolePageSettings(roleId = roleId, pageId = pageId) getOrElse
      RolePageSettings.Default


  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings) =
    siteDbDao.saveRolePageSettings(roleId = roleId, pageId = pageId, settings)


  def saveRolePreferences(preferences: UserPreferences) = {
    // BUG: the lost update bug.
    readWriteTransaction { transaction =>
      var user = transaction.loadTheCompleteUser(preferences.userId)
      user = user.copyWithNewPreferences(preferences)
      transaction.updateCompleteUser(user)
    }
    refreshUserInAnyCache(preferences.userId)
  }


  def saveGuest(guestId: UserId, name: String, url: String): Unit = {
    // BUG: the lost update bug.
    readWriteTransaction { transaction =>
      var guest = transaction.loadTheUser(guestId)
      guest = guest.copy(displayName = name, website = url)
      transaction.updateGuest(guest)
    }
    refreshUserInAnyCache(guestId)
  }


  def perhapsBlockGuest(request: SessionRequest[_]) {
    if (request.underlying.method == "GET")
      return

    // Authenticated users are ignored here. Suspend them instead.
    if (request.sidStatus.userId.map(User.isRoleId) == Some(true))
      return

    // Ignore not-logged-in people, unless they attempt to login as guests.
    if (request.sidStatus.userId.isEmpty) {
      val guestLoginPath = controllers.routes.LoginAsGuestController.loginGuest().url
      if (!request.path.contains(guestLoginPath))
        return
    }

    if (request.browserId.isEmpty)
      throwForbidden("DwE403NBI0", "No browser id cookie")

    // COULD cache blocks, but not really needed since this is for post requests only.
    val blocks = loadBlocks(
      ip = request.remoteAddress,
      browserIdCookie = request.browserId.get.cookieValue)

    val nowMillis = System.currentTimeMillis
    for (block <- blocks) {
      if (block.isActiveAt(nowMillis)) {
        throwForbidden(
          "DwE403BK01", "Not allowed. Please authenticate yourself by creating a real account.")
      }
    }
  }


  def refreshUserInAnyCache(userId: UserId) {
  }

}



trait CachingUserDao extends UserDao {
  self: CachingSiteDao =>


  override def createIdentityUserAndLogin(newUserData: NewUserData): LoginGrant = {
    val loginGrant = super.createIdentityUserAndLogin(newUserData)
    fireUserCreated(loginGrant.user)
    loginGrant
  }


  override def createPasswordUser(userData: NewPasswordUserData): User = {
    val user = super.createPasswordUser(userData)
    fireUserCreated(user)
    user
  }


  override def loginAsGuest(loginAttempt: GuestLoginAttempt): User = {
    val user = super.loginAsGuest(loginAttempt)
    putInCache(
      key(user.id),
      CacheValueIgnoreVersion(user))
    user
  }


  override def tryLogin(loginAttempt: LoginAttempt): LoginGrant = {
    // Don't save any site cache version, because user specific data doesn't change
    // when site specific data changes.
    val loginGrant = super.tryLogin(loginAttempt)
    putInCache(
      key(loginGrant.user.id),
      CacheValueIgnoreVersion(loginGrant.user))
    loginGrant
  }


  override def loadUser(userId: UserId): Option[User] = {
    lookupInCache[User](
      key(userId),
      orCacheAndReturn = super.loadUser(userId),
      ignoreSiteCacheVersion = true)
  }


  override def refreshUserInAnyCache(userId: UserId) {
    removeFromCache(key(userId))
  }


  private def key(userId: UserId) = CacheKey(siteId, s"$userId|UserById")

}


