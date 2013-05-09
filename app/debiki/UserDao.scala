/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import Prelude._
import EmailNotfPrefs.EmailNotfPrefs


trait UserDao {
  self: TenantDao =>


  def saveLogin(loginReq: LoginRequest): LoginGrant =
    tenantDbDao.saveLogin(loginReq)


  def saveLogout(loginId: String, logoutIp: String) =
    tenantDbDao.saveLogout(loginId, logoutIp)


  def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)] =
    tenantDbDao.loadIdtyAndUser(forLoginId)


  def loadIdtyDetailsAndUser(forLoginId: String = null,
        forIdentity: Identity = null): Option[(Identity, User)] =
    // Don't cache this, because this function is rarely called
    // — currently only when creating new website.
    tenantDbDao.loadIdtyDetailsAndUser(forLoginId = forLoginId,
      forIdentity = forIdentity)


  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage =
    // Currently this results in no database request; there's nothing to cache.
    tenantDbDao.loadPermsOnPage(reqInfo)


  def configRole(loginId: String, ctime: ju.Date, roleId: String,
        emailNotfPrefs: Option[EmailNotfPrefs] = None, isAdmin: Option[Boolean] = None,
        isOwner: Option[Boolean] = None) =
    tenantDbDao.configRole(loginId = loginId, ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner)


  def configIdtySimple(loginId: String, ctime: ju.Date,
        emailAddr: String, emailNotfPrefs: EmailNotfPrefs) =
    tenantDbDao.configIdtySimple(loginId = loginId, ctime = ctime,
      emailAddr = emailAddr,
      emailNotfPrefs = emailNotfPrefs)


  def listUsers(userQuery: UserQuery): Seq[(User, Seq[String])] =
    tenantDbDao.listUsers(userQuery)

}



trait CachingUserDao extends UserDao {
  self: CachingTenantDao =>


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


  private def key(loginId: String) = s"$tenantId|$loginId|UserByLoginId"

}


