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
import debiki.DebikiHttp.throwNotFound
import java.{util => ju}
import requests.ApiRequest
import Prelude._
import EmailNotfPrefs.EmailNotfPrefs
import CachingDao.{CacheKey, CacheValueIgnoreVersion}


trait UserDao {
  self: SiteDao =>


  def createPasswordIdentityAndRole(identity: PasswordIdentity, user: User): (Identity, User) =
    siteDbDao.createPasswordIdentityAndRole(identity, user)


  def changePassword(identity: PasswordIdentity, newPasswordSaltHash: String): Boolean =
    siteDbDao.changePassword(identity, newPasswordSaltHash)


  def loginAsGuest(loginAttempt: GuestLoginAttempt): User =
    siteDbDao.loginAsGuest(loginAttempt).user


  def saveLogin(loginAttempt: LoginAttempt): LoginGrant =
    siteDbDao.saveLogin(loginAttempt)


  /* TODO [nologin] Would be good if could remove from cache?
  def saveLogout(loginId: LoginId, logoutIp: String) =
    siteDbDao.saveLogout(loginId, logoutIp)
  */


  def loadUser(userId: UserId): Option[User] =
    siteDbDao.loadUser(userId)


  def loadIdtyDetailsAndUser(forUserId: UserId = null,
        forOpenIdDetails: OpenIdDetails = null,
        forEmailAddr: String = null): Option[(Identity, User)] =
    // Don't cache this, because this function is rarely called
    // — currently only when creating new website.
    siteDbDao.loadIdtyDetailsAndUser(forUserId = forUserId,
      forOpenIdDetails = forOpenIdDetails, forEmailAddr = forEmailAddr)


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


  def configRole(ctime: ju.Date, roleId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs] = None, isAdmin: Option[Boolean] = None,
        isOwner: Option[Boolean] = None) =
    siteDbDao.configRole(ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner)


  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) =
    siteDbDao.configIdtySimple(ctime = ctime,
      emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)


  def listUsers(userQuery: UserQuery): Seq[(User, Seq[String])] =
    siteDbDao.listUsers(userQuery)

}



trait CachingUserDao extends UserDao {
  self: CachingSiteDao =>


  override def loginAsGuest(loginAttempt: GuestLoginAttempt): User = {
    val user = super.loginAsGuest(loginAttempt)
    putInCache(
      key(user.id),
      CacheValueIgnoreVersion(user))
    user
  }


  override def saveLogin(loginAttempt: LoginAttempt): LoginGrant = {
    // Don't save any site cache version, because user specific data doesn't change
    // when site specific data changes.
    val loginGrant = super.saveLogin(loginAttempt)
    putInCache(
      key(loginGrant.user.id),
      CacheValueIgnoreVersion(loginGrant.user))
    loginGrant
  }


  /*
  override def saveLogout(loginId: LoginId, logoutIp: String) {
    super.saveLogout(loginId, logoutIp)
    // There'll be no more requests with this login id.
    ??? // TODO [nologin] remove user from cache?
    // removeFromCache(key(loginId)) -- won't work. Needs the user id.
  }*/


  override def loadUser(userId: UserId): Option[User] = {
    lookupInCache[User](
      key(userId),
      orCacheAndReturn = super.loadUser(userId),
      ignoreSiteCacheVersion = true)
  }


  override def configRole(ctime: ju.Date, roleId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs], isAdmin: Option[Boolean],
        isOwner: Option[Boolean]) {
    super.configRole(ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner)
    removeFromCache(key(roleId))
  }


  override def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) {
    super.configIdtySimple(
      ctime = ctime, emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)
    ??? // TODO [nologin] remove user from cache?
    ??? // removeFromCache(key(loginId)) -- won't work. Needs the user id.
  }


  private def key(userId: UserId) = CacheKey(siteId, s"$userId|UserById")

}


