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
import java.{util => ju}
import Prelude._
import EmailNotfPrefs.EmailNotfPrefs


trait UserDao {
  self: SiteDao =>


  def saveLogin(loginReq: LoginRequest): LoginGrant =
    siteDbDao.saveLogin(loginReq)


  def saveLogout(loginId: String, logoutIp: String) =
    siteDbDao.saveLogout(loginId, logoutIp)


  def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)] =
    siteDbDao.loadIdtyAndUser(forLoginId)


  def loadIdtyDetailsAndUser(forLoginId: String = null,
        forIdentity: Identity = null): Option[(Identity, User)] =
    // Don't cache this, because this function is rarely called
    // — currently only when creating new website.
    siteDbDao.loadIdtyDetailsAndUser(forLoginId = forLoginId,
      forIdentity = forIdentity)


  def loadPermsOnPage(reqInfo: PermsOnPageQuery): PermsOnPage =
    // Currently this results in no database request; there's nothing to cache.
    siteDbDao.loadPermsOnPage(reqInfo)


  def configRole(loginId: String, ctime: ju.Date, roleId: String,
        emailNotfPrefs: Option[EmailNotfPrefs] = None, isAdmin: Option[Boolean] = None,
        isOwner: Option[Boolean] = None) =
    siteDbDao.configRole(loginId = loginId, ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner)


  def configIdtySimple(loginId: String, ctime: ju.Date,
        emailAddr: String, emailNotfPrefs: EmailNotfPrefs) =
    siteDbDao.configIdtySimple(loginId = loginId, ctime = ctime,
      emailAddr = emailAddr,
      emailNotfPrefs = emailNotfPrefs)


  def listUsers(userQuery: UserQuery): Seq[(User, Seq[String])] =
    siteDbDao.listUsers(userQuery)

}



trait CachingUserDao extends UserDao {
  self: CachingSiteDao =>


  override def saveLogin(loginReq: LoginRequest): LoginGrant = {
    val loginGrant = super.saveLogin(loginReq)
    putInCache(
      key(loginGrant.login.id),
      (loginGrant.identity, loginGrant.user))
    loginGrant
  }


  override def saveLogout(loginId: String, logoutIp: String) {
    super.saveLogout(loginId, logoutIp)
    // There'll be no more requests with this login id.
    removeFromCache(key(loginId))
  }


  override def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)] =
    lookupInCache[(Identity, User)](
      key(forLoginId),
      orCacheAndReturn = super.loadIdtyAndUser(forLoginId))


  override def configRole(loginId: String, ctime: ju.Date, roleId: String,
        emailNotfPrefs: Option[EmailNotfPrefs], isAdmin: Option[Boolean],
        isOwner: Option[Boolean]) {
    super.configRole(loginId = loginId, ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner)
    removeFromCache(key(loginId))
  }


  override def configIdtySimple(loginId: String, ctime: ju.Date,
                       emailAddr: String, emailNotfPrefs: EmailNotfPrefs) {
    super.configIdtySimple(
      loginId = loginId,
      ctime = ctime,
      emailAddr = emailAddr,
      emailNotfPrefs = emailNotfPrefs)
    removeFromCache(key(loginId))
  }


  private def key(loginId: String) = s"$siteId|$loginId|UserByLoginId"

}


