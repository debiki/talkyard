/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import java.{util => ju}
import org.mindrot.jbcrypt.BCrypt
import scala.concurrent.Future
import DbDao._
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._


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


/** Constructs database DAO:s, implemented by service providers,
  * (currently only debiki-dao-pgsql, for Postgres) and used by debiki-server.
  */
abstract class DbDaoFactory {
  def systemDbDao: SystemDbDao
  def newSiteDbDao(siteId: SiteId): SiteDbDao

  def migrations: ScalaBasedDatabaseMigrations
  def shutdown()

  final def newDbDao2(): DbDao2 =
    new DbDao2(this)

  protected[core] def newSiteTransaction(siteId: SiteId, readOnly: Boolean): SiteTransaction
  protected[core] def newSystemTransaction(readOnly: Boolean): SystemTransaction

  /** Helpful for search engine database tests. */
  def debugDeleteRecreateSearchEngineIndexes() {}

  /** Helpful when writing unit test: waits e.g. for ElasticSearch to enter yellow status. */
  def debugWaitUntilSearchEngineStarted() {}

  /** Helpful when writing unit test: waits until ElasticSearch is done indexing stuff. */
  def debugRefreshSearchEngineIndexer() {}

}



/**
 * Debiki's database Data Access Object (DAO), for site specific data.
 *
 * It's named "DbDao" not simply "Dao" because there are other kinds
 * of DAO:s, e.g. a cache DAO that reads stuff from the database, and
 * constructs objects and caches them in-memory / on disk. Perhaps there
 * could be a web service DAO as well.
 */
@deprecated("Use SiteTransaction instead", "Now")
abstract class SiteDbDao {

  def commonMarkRenderer: CommonMarkRenderer


  // ----- Websites (formerly "tenants")

  def siteId: SiteId

  /**
   * Loads the tenant for this dao.
   */
  def loadTenant(): Tenant

  def loadSiteStatus(): SiteStatus

  /** Throws SiteAlreadyExistsException if the site already exists.
    * Throws TooManySitesCreatedException if you've created too many websites already
    * (from the same IP or email address).
    */
  def createSite(name: String, hostname: String, embeddingSiteUrl: Option[String],
        creatorIp: String, creatorEmailAddress: String, quotaLimitMegabytes: Option[Int]): Tenant

  def updateSite(changedSite: Tenant)

  def addTenantHost(host: TenantHost)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup


  // ----- Login

  /**
   * Assigns ids to the login request, saves it, finds or creates a user
   * for the specified Identity, and returns everything with ids filled in.
   * Also, if the Identity does not already exist in the db, assigns it an ID
   * and saves it.
   */
  def tryLogin(loginAttempt: LoginAttempt): LoginGrant


  // ----- New pages, page meta

  def nextPageId(): PageId

  def loadPageMeta(pageId: PageId): Option[PageMeta]

  def loadPageMetasAsMap(pageIds: Seq[PageId], anySiteId: Option[SiteId] = None)
        : Map[PageId, PageMeta]

  def updatePageMeta(meta: PageMeta, old: PageMeta)

  def loadAncestorIdsParentFirst(pageId: PageId): List[PageId]

  def loadCategoryTree(rootPageId: PageId): Seq[Category]

  def saveSetting(target: SettingsTarget, setting: SettingNameValue[_])

  /** Loads settings for all listed targets, returns settings in the same order.
    */
  def loadSettings(targets: Seq[SettingsTarget]): Seq[RawSettings]

  def loadSiteSettings(): RawSettings =
    loadSettings(Vector(SettingsTarget.WholeSite)).headOption.getOrDie("DwE5fl09")


  // ----- Moving and renaming pages

  def movePages(pageIds: Seq[PageId], fromFolder: String, toFolder: String)

  /**
   * Throws a PathClashException if there's already a page in the
   * `newFolder` with slug `newSlug` and if no ids are shown.
   */
  def moveRenamePage(pageId: PageId,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): PagePath

  /**
   * Throws a PathClashException, if there's another page at `pagePath`.
   */
  def moveRenamePage(pagePath: PagePath)

  /**
   * Moves the page at pagePath to the location where it was placed before
   * it was moved to pagePath. Returns that location, or does nothing and
   * returns None, if there is no such location.
   */
  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath]


  // ----- Page paths

  def checkPagePath(pathToCheck: PagePath): Option[PagePath]

  /**
   * Loads the canonical path to pageId.
   */
  def lookupPagePath(pageId: PageId): Option[PagePath]

  /**
   * Loads all PagePaths that map to pageId. The canonical path is placed first
   * and the tail consists only of any redirection paths.
   */
  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath]

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        orderOffset: PageOrderOffset,
        limit: Int): Seq[PagePathAndMeta]

  def listChildPages(parentPageIds: Seq[PageId], orderOffset: PageOrderOffset,
        limit: Int, filterPageRole: Option[PageRole] = None): Seq[PagePathAndMeta]


  // ----- Loading and saving pages

  def loadPostsReadStats(pageId: PageId): PostsReadStats


  // ----- Users and permissions

  def loadUser(userId: UserId): Option[User]

  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User]

  /**
   * Also loads details like OpenID local identifier, endpoint and version info.
   */
  def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)]

  def loadUserInfoAndStats(userId: UserId): Option[UserInfoAndStats]

  def loadUserStats(userId: UserId): UserStats

  def listUserActions(userId: UserId): Seq[UserActionInfo]

  def loadPermsOnPage(reqInfo: PermsOnPageQuery): PermsOnPage

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername]

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings]

  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings)

  /** Loads users watching the specified page, any parent categories or forums,
    * and people watching everything on the whole site.
    */
  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]


  // ----- Notifications

  def saveDeleteNotifications(notifications: Notifications)

  def loadNotificationsForRole(roleId: RoleId): Seq[Notification]

  def updateNotificationSkipEmail(notifications: Seq[Notification])


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification])

  def updateSentEmail(email: Email): Unit

  def loadEmailById(emailId: String): Option[Email]


  // ----- User configuration

  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs)


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId]): Future[FullTextSearchResult]

  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostId*)

}


@deprecated("Use SystemTransaction instead", "Now")
abstract class SystemDbDao {

  def applyEvolutions()

  def close()  // remove? move to DbDaoFactory in some manner?

  def loadUser(siteId: SiteId, userId: UserId): Option[User]


  // ----- Websites (a.k.a. tenants)

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[SiteId]): Seq[Tenant]

  def loadSite(siteId: SiteId): Option[Tenant] =
    loadTenants(Seq(siteId)).headOption

  // COULD rename to findWebsitesCanonicalHost
  def lookupTenant(scheme: String, host: String): TenantLookup


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]]


  // ----- Misc

  def checkRepoVersion(): Option[String]

  /** Used as salt when hashing e.g. email and IP, before the hash
   *  is included in HTML. */
  def secretSalt(): String


  // ----- Testing

  // These dangerous functions COULD be moved to a separate artifact,
  // debiki-core-test (?), that only SBT % "test" configs depend on.
  // So one cannot possibly call `emptyDatabase()` when Play.isProd.

  /**
   * Deletes all data from the database. For example, for a RDBMS,
   * would delete all rows from all tables.
   */
  def emptyDatabase()

}



/** Serializes write requests, per site: when one write request to site X is being served,
  * any other write requests block, for site X. I'll change this later to use actors and
  * asynchronous requests, so whole HTTP request handling threads won't be blocked.
  */
class SerializingSiteDbDao(private val _spi: SiteDbDao)
  extends SiteDbDao {

  def commonMarkRenderer = _spi.commonMarkRenderer


  // ----- Website (formerly "tenant")

  def siteId: SiteId = _spi.siteId

  def loadTenant(): Tenant = {
    _spi.loadTenant()
  }

  def loadSiteStatus(): SiteStatus = {
    _spi.loadSiteStatus()
  }

  def createSite(name: String, hostname: String, embeddingSiteUrl: Option[String],
        creatorIp: String, creatorEmailAddress: String, quotaLimitBytes: Option[Int]): Tenant = {
    _spi.createSite(name = name, hostname = hostname,
      embeddingSiteUrl = embeddingSiteUrl, creatorIp = creatorIp,
      creatorEmailAddress = creatorEmailAddress, quotaLimitMegabytes = quotaLimitBytes)
  }

  def updateSite(changedSite: Tenant) = {
    serialize {
      _spi.updateSite(changedSite)
    }
  }

  def addTenantHost(host: TenantHost) = {
    // SHOULD hard code max num hosts, e.g. 10.
    serialize {
      _spi.addTenantHost(host)
    }
  }

  def lookupOtherTenant(scheme: String, host: String): TenantLookup = {
    _spi.lookupOtherTenant(scheme, host)
  }


  // ----- Login, logout

  def tryLogin(loginAttempt: LoginAttempt): LoginGrant = {
    _spi.tryLogin(loginAttempt)
  }


  // ----- Pages

  def nextPageId(): PageId = {
    serialize {
      _spi.nextPageId()
    }
  }

  def loadPageMeta(pageId: PageId): Option[PageMeta] = {
    _spi.loadPageMeta(pageId)
  }

  def loadPageMetasAsMap(pageIds: Seq[PageId], anySiteId: Option[SiteId]): Map[PageId, PageMeta] = {
    _spi.loadPageMetasAsMap(pageIds, anySiteId)
  }

  def updatePageMeta(meta: PageMeta, old: PageMeta) {
    serialize {
      _spi.updatePageMeta(meta, old = old)
    }
  }

  def loadAncestorIdsParentFirst(pageId: PageId): List[PageId] = {
    _spi.loadAncestorIdsParentFirst(pageId)
  }

  def loadCategoryTree(rootPageId: PageId): Seq[Category] = {
    _spi.loadCategoryTree(rootPageId)
  }

  def saveSetting(target: SettingsTarget, setting: SettingNameValue[_]) {
    serialize {
      _spi.saveSetting(target, setting)
    }
  }

  def loadSettings(targets: Seq[SettingsTarget]): Seq[RawSettings] = {
    _spi.loadSettings(targets)
  }

  def movePages(pageIds: Seq[PageId], fromFolder: String, toFolder: String) {
    serialize {
      _spi.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
    }
  }

  def moveRenamePage(pageId: PageId,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): PagePath = {
    serialize {
      _spi.moveRenamePage(pageId = pageId, newFolder = newFolder,
        showId = showId, newSlug = newSlug)
    }
  }

  def moveRenamePage(pagePath: PagePath) {
    serialize {
      _spi.moveRenamePage(pagePath)
    }
  }

  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    serialize {
      _spi.movePageToItsPreviousLocation(pagePath)
    }
  }

  def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    _spi.checkPagePath(pathToCheck)
  }

  def lookupPagePath(pageId: PageId): Option[PagePath] = {
    _spi.lookupPagePath(pageId)
  }

  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath] = {
    _spi.lookupPagePathAndRedirects(pageId)
  }

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        orderOffset: PageOrderOffset,
        limit: Int): Seq[PagePathAndMeta] = {
    _spi.listPagePaths(pageRanges, include, orderOffset, limit)
  }

  def listChildPages(parentPageIds: Seq[PageId], orderOffset: PageOrderOffset,
        limit: Int, filterPageRole: Option[PageRole])
        : Seq[PagePathAndMeta] = {
    _spi.listChildPages(parentPageIds, orderOffset, limit = limit, filterPageRole = filterPageRole)
  }


  // ----- Actions

  def loadPostsReadStats(pageId: PageId): PostsReadStats = {
    _spi.loadPostsReadStats(pageId)
  }


  // ----- Users and permissions

  def loadUser(userId: UserId): Option[User] = {
    _spi.loadUser(userId)
  }

  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User] = {
    _spi.loadUserByEmailOrUsername(emailOrUsername)
  }

  def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)] = {
    _spi.loadIdtyDetailsAndUser(userId)
  }

  def loadUserInfoAndStats(userId: UserId): Option[UserInfoAndStats] = {
    _spi.loadUserInfoAndStats(userId)
  }

  def loadUserStats(userId: UserId): UserStats = {
    _spi.loadUserStats(userId)
  }

  def listUserActions(userId: UserId): Seq[UserActionInfo] = {
    _spi.listUserActions(userId)
  }

  def loadPermsOnPage(reqInfo: PermsOnPageQuery): PermsOnPage = {
    _spi.loadPermsOnPage(reqInfo)
  }

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername] = {
    _spi.listUsernames(pageId = pageId, prefix = prefix)
  }

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings] = {
    _spi.loadRolePageSettings(roleId = roleId, pageId = pageId)
  }


  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings) = {
    serialize {
      _spi.saveRolePageSettings(roleId = roleId, pageId = pageId, settings)
    }
  }

  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId] = {
    _spi.loadUserIdsWatchingPage(pageId)
  }


  // ----- Notifications

  def saveDeleteNotifications(notifications: Notifications) {
    serialize {
      _spi.saveDeleteNotifications(notifications)
    }
  }

  def loadNotificationsForRole(roleId: RoleId): Seq[Notification] = {
    _spi.loadNotificationsForRole(roleId)
  }

  def updateNotificationSkipEmail(notifications: Seq[Notification]) {
    serialize {
      _spi.updateNotificationSkipEmail(notifications)
    }
  }


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit = {
    serialize {
      _spi.saveUnsentEmail(email)
    }
  }

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]) {
    serialize {
      _spi.saveUnsentEmailConnectToNotfs(email, notfs)
    }
  }

  def updateSentEmail(email: Email): Unit = {
    serialize {
      _spi.updateSentEmail(email)
    }
  }

  def loadEmailById(emailId: String): Option[Email] = {
    _spi.loadEmailById(emailId)
  }


  // ----- User configuration

  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) = {
    serialize {
      _spi.configIdtySimple(
        ctime = ctime, emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)
    }
  }


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId])
        : Future[FullTextSearchResult] = {
    _spi.fullTextSearch(phrase, anyRootPageId)
  }

  def debugUnindexPosts(pageAndPostIds: PagePostId*) {
    serialize {
      _spi.debugUnindexPosts(pageAndPostIds: _*)
    }
  }


  private def serialize[R](block: =>R): R = {
    import SerializingSiteDbDao._
    var anyMutex = perSiteMutexes.get(siteId)
    if (anyMutex eq null) {
      perSiteMutexes.putIfAbsent(siteId, new java.lang.Object)
      anyMutex = perSiteMutexes.get(siteId)
    }
    anyMutex.synchronized {
      block
    }
  }

}


object SerializingSiteDbDao {

  private val perSiteMutexes = new ju.concurrent.ConcurrentHashMap[SiteId, AnyRef]()

}



object DbDao {

  case class SiteAlreadyExistsException(name: String) extends QuickException

  case class TooManySitesCreatedException(ip: String) extends QuickException {
    override def getMessage = "Website creation limit exceeded"
  }

  case class EmailNotFoundException(emailId: String)
    extends RuntimeException("No email with id: "+ emailId)

  case class BadEmailTypeException(emailId: String)
    extends RuntimeException(s"Email with id $emailId has no recipient user id")

  case class EmailAddressChangedException(email: Email, user: User)
    extends QuickException

  case object DuplicateUsername extends RuntimeException("Duplicate username")
  case object DuplicateUserEmail extends RuntimeException("Duplicate user email")
  case object DuplicateGuest extends RuntimeException("Duplicate guest")

  case class IdentityNotFoundException(message: String)
    extends RuntimeException(message)

  case object BadPasswordException extends RuntimeException("Bad password")

  case object EmailNotVerifiedException extends RuntimeException("Email not verified")

  case object DuplicateVoteException extends RuntimeException("Duplicate vote")

  class PageNotFoundException(message: String) extends RuntimeException(message)

  case class PageNotFoundByIdException(
    tenantId: SiteId,
    pageId: PageId,
    details: Option[String] = None)
    extends PageNotFoundException(
      s"Found no page with id: $pageId, tenant id: $tenantId" +
        prettyDetails(details))

  case class PageNotFoundByIdAndRoleException(
    tenantId: SiteId,
    pageId: PageId,
    pageRole: PageRole,
    details: Option[String] = None)
    extends PageNotFoundException(
      s"Found no page with id: $pageId, tenant id: $tenantId, role: $pageRole" +
        prettyDetails(details))

  case class PageNotFoundByPathException(
    pagePath: PagePath,
    details: Option[String] = None)
    extends PageNotFoundException(
      s"Found no page at: ${pagePath.value}, tenant id: ${pagePath.tenantId}" +
        prettyDetails(details))

  case class PathClashException(
    existingPagePath: PagePath, newPagePath: PagePath)
    extends RuntimeException

  case class BadPageRoleException(details: String)
    extends RuntimeException

  private def prettyDetails(anyDetails: Option[String]) = anyDetails match {
    case None => ""
    case Some(message) => s", details: $message"
  }

  // Perhaps this should be moved to debiki-server, so the database didn't have this
  // dependency on the password hashing algorithm?
  def checkPassword(plainTextPassword: String, hash: String) =
    BCrypt.checkpw(plainTextPassword, hash)

  def saltAndHashPassword(plainTextPassword: String): String = {
    val logRounds = 13 // for now. 10 is the default.
    BCrypt.hashpw(plainTextPassword, BCrypt.gensalt(logRounds))
  }

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
