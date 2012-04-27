// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import com.debiki.v0.Prelude._
import com.google.{common => guava}
import java.{util => ju}
import Dao._
import EmailNotfPrefs.EmailNotfPrefs


// SECURITY Todo: Only pass data to Dao via model class instances! (?)
// Never directly e.g. in a String.
// Let each model class validate itself, e.g. check that each String
// conforms to the required format (e.g. [a-z0-9_]+ for page ids).
// Search for "String" in this file -- no match must be found!
// Could actually add a build pipe step that searches this file for String
// and fails the build shoud any String be found?
// (Unless you use model classes, and only model classes, when passing
// data to/from the Dao, then eventually you will forget to validate
// and sanitaze input. That'd be an eventually inconsistent solution :-/ .)


/** Debiki's Data Access Object service provider interface.
 */
abstract class DaoSpi {

  def close()

  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant

  def saveLogout(loginId: String, logoutIp: String)

  def createPage(where: PagePath, debate: Debate): Debate

  def moveRenamePage(tenantId: String, pageId: String,
        newFolder: Option[String], showId: Option[Boolean],
        newSlug: Option[String]): PagePath

  def savePageActions[T <: Action](
    tenantId: String, debateId: String, xs: List[T]): List[T]

  def loadPage(tenantId: String, debateId: String): Option[Debate]

  def loadTemplate(templPath: PagePath): Option[TemplateSrcHtml]

  def checkPagePath(pathToCheck: PagePath): Option[PagePath]

  def lookupPagePathByPageId(tenantId: String, pageId: String): Option[PagePath]

  def listPagePaths(
        withFolderPrefix: String,
        tenantId: String,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int
      ): Seq[(PagePath, PageDetails)]

  def listActions(
        tenantId: String,
        folderPrefix: String,
        includePages: List[PageStatus],
        limit: Int,
        offset: Int): Seq[ActionLocator]

  def loadIdtyAndUser(forLoginId: String, tenantId: String)
        : Option[(Identity, User)]

  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage

  def saveNotfs(tenantId: String, notfs: Seq[NotfOfPageAction])

  def loadNotfsForRole(tenantId: String, roleId: String)
        : Seq[NotfOfPageAction]

  def loadNotfsToMailOut(delayInMinutes: Int, numToLoad: Int): NotfsToMail

  def loadNotfByEmailId(tenantId: String, emailId: String)
        : Option[NotfOfPageAction]

  def skipEmailForNotfs(tenantId: String, notfs: Seq[NotfOfPageAction],
        debug: String): Unit

  def saveUnsentEmailConnectToNotfs(tenantId: String, email: EmailSent,
        notfs: Seq[NotfOfPageAction]): Unit

  def updateSentEmail(tenantId: String, email: EmailSent): Unit

  def loadEmailById(tenantId: String, emailId: String): Option[EmailSent]

  def configRole(tenantId: String, loginId: String, ctime: ju.Date,
                    roleId: String, emailNotfPrefs: EmailNotfPrefs)

  def configIdtySimple(tenantId: String, loginId: String, ctime: ju.Date,
                       emailAddr: String, emailNotfPrefs: EmailNotfPrefs)

  def createTenant(name: String): Tenant

  def loadTenants(tenantIds: Seq[String]): Seq[Tenant]

  def addTenantHost(tenantId: String, host: TenantHost)

  def lookupTenant(scheme: String, host: String): TenantLookup

  def checkRepoVersion(): Option[String]

  /** Used as salt when hashing e.g. email and IP, before the hash
   *  is included in HTML. */
  def secretSalt(): String

}


/** Debiki's Data Access Object.
 *
 *  Delegates database requests to a DaoSpi implementation.
 */
abstract class Dao {

  protected def _spi: DaoSpi

  def close() = _spi.close


  // ----- Login, logout

  /** Assigns ids to the login request, saves it, finds or creates a user
   * for the specified Identity, and returns everything with ids filled in.
   */
  def saveLogin(tenantId: String, loginReq: LoginRequest): LoginGrant =
    _spi.saveLogin(tenantId, loginReq)

  /** Updates the specified login with logout IP and timestamp.*/
  def saveLogout(loginId: String, logoutIp: String) =
    _spi.saveLogout(loginId, logoutIp)


  // ----- Pages

  def createPage(where: PagePath, debate: Debate): Debate =
    _spi.createPage(where, debate)

  def moveRenamePage(tenantId: String, pageId: String,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): PagePath =
    _spi.moveRenamePage(tenantId, pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

 
  // ----- Actions

  /** You should only save text that has been filtered through
   *  Prelude.convertBadChars().
   */
  def savePageActions[T <: Action](
        tenantId: String, debateId: String, actions: List[T]): List[T] =
    _spi.savePageActions(tenantId, debateId, actions)

  def loadPage(tenantId: String, debateId: String): Option[Debate] =
    _spi.loadPage(tenantId, debateId)

  /** Loads any template at templPath.
   */
  def loadTemplate(templPath: PagePath): Option[TemplateSrcHtml] =
    _spi.loadTemplate(templPath)

  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    _spi.checkPagePath(pathToCheck)

  def lookupPagePathByPageId(tenantId: String, pageId: String)
        : Option[PagePath] =
    _spi.lookupPagePathByPageId(tenantId, pageId = pageId)


  // ----- List stuff

  def listPagePaths(
        withFolderPrefix: String,
        tenantId: String,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int
      ): Seq[(PagePath, PageDetails)] =
    _spi.listPagePaths(withFolderPrefix, tenantId, include,
          sortBy, limit, offset)

  def listActions(
        tenantId: String,
        folderPrefix: String,
        includePages: List[PageStatus],
        limit: Int,
        offset: Int): Seq[ActionLocator] =
    _spi.listActions(
      tenantId, folderPrefix, includePages, limit, offset)


  def loadIdtyAndUser(forLoginId: String, tenantId: String)
        : Option[(Identity, User)] =
    _spi.loadIdtyAndUser(forLoginId, tenantId)

  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage =
    _spi.loadPermsOnPage(reqInfo)


  // ----- Notifications

  def saveNotfs(tenantId: String, notfs: Seq[NotfOfPageAction]) =
    _spi.saveNotfs(tenantId, notfs)

  def loadNotfsForRole(tenantId: String, roleId: String)
        : Seq[NotfOfPageAction] =
    _spi.loadNotfsForRole(tenantId, roleId)

  def loadNotfsToMailOut(delayInMinutes: Int, numToLoad: Int): NotfsToMail =
    _spi.loadNotfsToMailOut(delayInMinutes, numToLoad)

  def loadNotfByEmailId(tenantId: String, emailId: String)
        : Option[NotfOfPageAction] =
    _spi.loadNotfByEmailId(tenantId, emailId)

  def skipEmailForNotfs(tenantId: String, notfs: Seq[NotfOfPageAction],
        debug: String): Unit =
    _spi.skipEmailForNotfs(tenantId, notfs, debug)


  // ----- Emails

  def saveUnsentEmailConnectToNotfs(tenantId: String, email: EmailSent,
        notfs: Seq[NotfOfPageAction]): Unit =
    _spi.saveUnsentEmailConnectToNotfs(tenantId, email, notfs)

  def updateSentEmail(tenantId: String, email: EmailSent): Unit =
    _spi.updateSentEmail(tenantId, email)

  def loadEmailById(tenantId: String, emailId: String): Option[EmailSent] =
    _spi.loadEmailById(tenantId, emailId)


  // ----- User configuration

  def configRole(tenantId: String, loginId: String, ctime: ju.Date,
                 roleId: String, emailNotfPrefs: EmailNotfPrefs) =
    _spi.configRole(tenantId, loginId = loginId, ctime = ctime,
                    roleId = roleId, emailNotfPrefs = emailNotfPrefs)

  def configIdtySimple(tenantId: String, loginId: String, ctime: ju.Date,
                       emailAddr: String, emailNotfPrefs: EmailNotfPrefs) =
    _spi.configIdtySimple(tenantId, loginId = loginId, ctime = ctime,
                          emailAddr = emailAddr,
                          emailNotfPrefs = emailNotfPrefs)

  // ----- Tenants

  /** Creates a tenant, assigns it an id and and returns it. */
  def createTenant(name: String): Tenant =
    _spi.createTenant(name)

  def loadTenants(tenantIds: Seq[String]): Seq[Tenant] =
    _spi.loadTenants(tenantIds)

  def addTenantHost(tenantId: String, host: TenantHost) =
    _spi.addTenantHost(tenantId, host)

  def lookupTenant(scheme: String, host: String): TenantLookup =
    _spi.lookupTenant(scheme, host)

  def checkRepoVersion(): Option[String] = _spi.checkRepoVersion()

  def secretSalt(): String = _spi.secretSalt()
}


/** Caches pages in a ConcurrentMap.
 *
 *  Thread safe, if `impl' is thread safe.
 */
class CachingDao(spi: DaoSpi) extends Dao {

  protected val _spi = spi
  private case class Key(tenantId: String, debateId: String)

  private val _cache: ju.concurrent.ConcurrentMap[Key, Debate] =
      new guava.collect.MapMaker().
          softValues().
          maximumSize(100*1000).
          //expireAfterWrite(10. TimeUnits.MINUTES).
          makeComputingMap(new guava.base.Function[Key, Debate] {
            def apply(k: Key): Debate = {
              _spi.loadPage(k.tenantId, k.debateId) getOrElse null
            }
          })


  override def createPage(where: PagePath, debate: Debate): Debate = {
    val debateWithIdsNoUsers = _spi.createPage(where, debate)
    // ------------
    // Bug workaround: Load the page *inclusive Login:s and User:s*.
    // Otherwise only Actions will be included (in debateWithIdsNoUsers)
    // and then the page cannot be rendered (there'll be None.get errors).
    val debateWithIds =
        _spi.loadPage(where.tenantId, debateWithIdsNoUsers.guid).get
    // ------------
    val key = Key(where.tenantId, debateWithIds.guid)
    val duplicate = _cache.putIfAbsent(key, debateWithIds)
    runErrIf3(duplicate ne null, "DwE8WcK905", "Newly created page "+
          safed(debate.guid) + " already present in mem cache")
    debateWithIds
  }


  override def savePageActions[T <: Action](
      tenantId: String, debateId: String, xs: List[T]): List[T] = {
    for (xsWithIds <- _spi.savePageActions(tenantId, debateId, xs)) yield {
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
        val newPage = _spi.loadPage(tenantId, debateId).get
        // -------- Unfortunately.--
        replaced = _cache.replace(key, oldPage, newPage)
      }
      xsWithIds  // TODO return newPage instead? Or possibly a pair.
    }
  }


  override def loadPage(tenantId: String, debateId: String): Option[Debate] = {
    try {
      Some(_cache.get(Key(tenantId, debateId)))
    } catch {
      case e: NullPointerException =>
        None
    }
  }

}

/** Always accesses the database, whenever you ask it do do something.
 *
 *  Useful when constructing test suites that should access the database.
 */
class NonCachingDao(protected val _spi: DaoSpi) extends Dao


object Dao {

  case class EmailNotFoundException(emailId: String)
    extends Exception("No email with id: "+ emailId)

  case class PageNotFoundException(tenantId: String, pageId: String)
    extends IllegalArgumentException("Page not found, id: "+ pageId +
       ", tenant id: "+ tenantId)

}

