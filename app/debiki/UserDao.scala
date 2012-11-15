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
    tenantDbDao.loadIdtyDetailsAndUser(forLoginId = forLoginId,
      forIdentity = forIdentity)


  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage =
    tenantDbDao.loadPermsOnPage(reqInfo)


  def configRole(loginId: String, ctime: ju.Date,
        roleId: String, emailNotfPrefs: EmailNotfPrefs) =
    tenantDbDao.configRole(loginId = loginId, ctime = ctime,
      roleId = roleId, emailNotfPrefs = emailNotfPrefs)


  def configIdtySimple(loginId: String, ctime: ju.Date,
        emailAddr: String, emailNotfPrefs: EmailNotfPrefs) =
    tenantDbDao.configIdtySimple(loginId = loginId, ctime = ctime,
      emailAddr = emailAddr,
      emailNotfPrefs = emailNotfPrefs)

}



trait CachingUserDao extends UserDao {
  self: TenantDao =>

  // ... todo

}

