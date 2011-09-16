// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import com.debiki.v0.Prelude._
import com.google.{common => guava}
import java.{util => ju}
import net.liftweb.common.{Logger, Box, Empty, Full, Failure}
import Dao._

/** Debiki's Data Access Object service provider interface.
 */
abstract class DaoSpi {

  def create(where: PagePath, debate: Debate): Box[Debate]

  def close()

  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant

  def saveLogout(loginId: String, logoutIp: String)

  // COULD use:  save(Guid(tenantId, pageGuid), xs)  instead?
  // COULD rename to savePage.
  def save[T](tenantId: String, debateId: String, xs: List[T]): Box[List[T]]

  def load(tenantId: String, debateId: String): Box[Debate]

  def loadTemplates(perhapsTmpls: List[PagePath]): List[Debate]

  def checkPagePath(pathToCheck: PagePath): Box[PagePath]

  def checkAccess(pagePath: PagePath, loginId: Option[String], doo: Do
                     ): (Option[Identity], Option[User], Option[IntrsAllowed])

  def createTenant(name: String): Tenant

  def addTenantHost(tenantId: String, host: TenantHost)

  def lookupTenant(scheme: String, host: String): TenantLookup

  def checkRepoVersion(): Box[String]

  /** Used as salt when hashing e.g. email and IP, before the hash
   *  is included in HTML. */
  def secretSalt(): String

}


object Dao {
  case class LoginRequest(login: Login, identity: Identity) {
    require(login.id startsWith "?")
    require(identity.id startsWith "?")
    require(identity.id == login.identityId)
  }

  case class LoginGrant(login: Login, identity: Identity, user: User) {
    require(!login.id.contains('?'))
    require(!identity.id.contains('?'))
    require(!user.id.contains('?'))
    require(login.identityId == identity.id)
    require(identity.userId == user.id)
  }

}


/** Debiki's Data Access Object.
 *
 *  Delegates database requests to a DaoSpi implementation.
 */
abstract class Dao {

  def create(where: PagePath, debate: Debate): Box[Debate]

  def close()

  /** Assigns ids to the login request, saves it, finds or creates a user
   * for the specified Identity, and returns everything with ids filled in.
   */
  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant

  /** Updates the specified login with logout IP and timestamp.*/
  def saveLogout(loginId: String, logoutIp: String)

  def save[T](tenantId: String, debateId: String, xs: List[T]): Box[List[T]]

  def load(tenantId: String, debateId: String): Box[Debate]

  /** Looks up guids for each possible template.
   *
   *  Each perhaps-template is represented by a PagePath.
   *  The guids found are returned, but PagePaths that point to
   *  non-existing templates are filtered out.
   */
  def loadTemplates(perhapsTmpls: List[PagePath]): List[Debate]

  def checkPagePath(pathToCheck: PagePath): Box[PagePath]

  def checkAccess(pagePath: PagePath, loginId: Option[String], doo: Do
                     ): (Option[Identity], Option[User], Option[IntrsAllowed])

  /** Creates a tenant, assigns it an id and and returns it. */
  def createTenant(name: String): Tenant

  def addTenantHost(tenantId: String, host: TenantHost)

  def lookupTenant(scheme: String, host: String): TenantLookup

  def checkRepoVersion(): Box[String]

  def secretSalt(): String
}

/** Caches pages in a ConcurrentMap.
 *
 *  Thread safe, if `impl' is thread safe.
 */
class CachingDao(impl: DaoSpi) extends Dao {

  private val _impl = impl
  private case class Key(tenantId: String, debateId: String)

  private val _cache: ju.concurrent.ConcurrentMap[Key, Debate] =
      new guava.collect.MapMaker().
          softValues().
          maximumSize(100*1000).
          //expireAfterWrite(10. TimeUnits.MINUTES).
          makeComputingMap(new guava.base.Function[Key, Debate] {
            def apply(k: Key): Debate = {
              _impl.load(k.tenantId, k.debateId) openOr null
            }
          })

  def create(where: PagePath, debate: Debate): Box[Debate] = {
    for (debateWithIdsNoUsers <- _impl.create(where, debate)) yield {
      // ------------
      // Bug workaround: Load the page *inclusive Login:s and User:s*.
      // Otherwise only Actions will be included (in debateWithIdsNoUsers)
      // and then the page cannot be rendered (there'll be None.get errors).
      val debateWithIds =
          _impl.load(where.tenantId, debateWithIdsNoUsers.guid).open_!
      // ------------
      val key = Key(where.tenantId, debateWithIds.guid)
      val duplicate = _cache.putIfAbsent(key, debateWithIds)
      errorIf(duplicate ne null, "Newly created page "+ safed(debate.guid) +
          " already present in mem cache [debiki_error_38WcK905]")
      debateWithIds
    }
  }

  def close() = _impl.close

  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant =
    _impl.saveLogin(tenantId, loginReq)

  def saveLogout(loginId: String, logoutIp: String) =
    _impl.saveLogout(loginId, logoutIp)

  def save[T](tenantId: String, debateId: String, xs: List[T]
                 ): Box[List[T]] = {
    for (xsWithIds <- _impl.save(tenantId, debateId, xs)) yield {
      val key = Key(tenantId, debateId)
      var replaced = false
      while (!replaced) {
        val oldPage = _cache.get(key)
        // -- Should to: -----------
        // val newPage = oldPage ++ xsWithIds
        // newPage might == oldPage, if another thread just refreshed
        // the page from the database.
        // -- But bug: -------------
        // None$.get: newPage might not contain xs.loginId, nor the
        // related Identity and User. So later, when newPage
        // is rendered, there'll be a scala.None$.get, from inside
        // DebateHtml._layoutPosts.
        // -- So instead: ----------
        // This loads all Logins, Identity:s and Users referenced by the page:
        val newPage = _impl.load(tenantId, debateId).open_!
        // -------- Unfortunately.--
        replaced = _cache.replace(key, oldPage, newPage)
      }
      xsWithIds  // TODO return newPage instead? Or possibly a pair.
    }
  }

  def load(tenantId: String, debateId: String): Box[Debate] = {
    try {
      Full(_cache.get(Key(tenantId, debateId)))
    } catch {
      case e: NullPointerException =>
        Empty
    }
  }

  def loadTemplates(perhapsTmpls: List[PagePath]): List[Debate] =
    _impl.loadTemplates(perhapsTmpls)

  def checkPagePath(pathToCheck: PagePath): Box[PagePath] =
    _impl.checkPagePath(pathToCheck)

  def checkAccess(pagePath: PagePath, loginId: Option[String], doo: Do
                   ): (Option[Identity], Option[User], Option[IntrsAllowed]) =
    _impl.checkAccess(pagePath, loginId, doo)

  def createTenant(name: String): Tenant =
    _impl.createTenant(name)

  def addTenantHost(tenantId: String, host: TenantHost) =
    _impl.addTenantHost(tenantId, host)

  def lookupTenant(scheme: String, host: String): TenantLookup =
    _impl.lookupTenant(scheme, host)

  def checkRepoVersion(): Box[String] = _impl.checkRepoVersion()

  def secretSalt(): String = _impl.secretSalt()

}

/** Always accesses the database, whenever you ask it do do something.
 *
 *  Useful when constructing test suites that should access the database.
 */
class NonCachingDao(impl: DaoSpi) extends Dao {
  def create(where: PagePath, debate: Debate): Box[Debate] =
    impl.create(where, debate)

  def close() = impl.close

  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant =
    impl.saveLogin(tenantId, loginReq)

  def saveLogout(loginId: String, logoutIp: String) =
    impl.saveLogout(loginId, logoutIp)

  def save[T](tenantId: String, debateId: String, xs: List[T]): Box[List[T]] =
    impl.save(tenantId, debateId, xs)

  def load(tenantId: String, debateId: String): Box[Debate] =
    impl.load(tenantId, debateId)

  def loadTemplates(perhapsTmpls: List[PagePath]): List[Debate] =
    impl.loadTemplates(perhapsTmpls)

  def checkPagePath(pathToCheck: PagePath): Box[PagePath] =
    impl.checkPagePath(pathToCheck)

  def checkAccess(pagePath: PagePath, loginId: Option[String], doo: Do
                   ): (Option[Identity], Option[User], Option[IntrsAllowed]) =
    impl.checkAccess(pagePath, loginId, doo)

  def createTenant(name: String): Tenant =
    impl.createTenant(name)

  def addTenantHost(tenantId: String, host: TenantHost) =
    impl.addTenantHost(tenantId, host)

  def lookupTenant(scheme: String, host: String): TenantLookup =
    impl.lookupTenant(scheme, host)

  def checkRepoVersion(): Box[String] = impl.checkRepoVersion()

  def secretSalt(): String = impl.secretSalt()
}

