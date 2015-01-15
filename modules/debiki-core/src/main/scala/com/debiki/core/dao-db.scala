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

import com.debiki.core.{PostActionPayload => PAP}
import com.google.{common => guava}
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
  def newSiteDbDao(quotaConsumers: QuotaConsumers): SiteDbDao
  def shutdown()

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
abstract class SiteDbDao {

  def quotaConsumers: QuotaConsumers

  def commonMarkRenderer: CommonMarkRenderer


  // ----- Websites (formerly "tenants")

  def siteId: SiteId

  /**
   * Loads the tenant for this dao.
   */
  def loadTenant(): Tenant

  /**
   * Returns Some(new-website) on success — that is, unless someone else
   * created the very same website, just before you.
   * Throws OverQuotaException if you've created too many websites already
   * (e.g. from the same IP).
   */
  def createWebsite(name: Option[String], address: Option[String],
        embeddingSiteUrl: Option[String], ownerIp: String,
        ownerIdentity: Option[Identity], ownerRole: User)
        : Option[(Tenant, User)]

  def addTenantHost(host: TenantHost)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup


  // ----- Login

  /** Logs in as guest, currently always succeeds (unless out of quota).
    */
  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult

  /**
   * Assigns ids to the login request, saves it, finds or creates a user
   * for the specified Identity, and returns everything with ids filled in.
   * Also, if the Identity does not already exist in the db, assigns it an ID
   * and saves it.
   */
  def tryLogin(loginAttempt: LoginAttempt): LoginGrant


  // ----- New pages, page meta

  def nextPageId(): PageId

  /**
   * Creates a page; returns it, but with an id assigned to the page,
   * if it didn't already have an id, and to actions, if they didn't
   * already have ids specified. (For example, the page body always
   * has id 1 so it'd be pre-assigned. But comments have random ids.)
   */
  def createPage(page: Page): Page

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

  /** Saves actions, updates related page meta data (e.g. if you save edits
    * to the page title post, the page title metadata field is updated),
    * and generates notifications (for example, if you save a reply to Alice,
    * a notification to Alice is generated).
    */
  final def savePageActions(page: PageNoPath, actions: List[RawPostAction[_]])
        : (PageNoPath, List[RawPostAction[_]]) = {
    ActionChecker.checkActions(page, actions)
    doSavePageActions(page, actions)
  }

  /** Don't call, implementation detail. */
  def doSavePageActions(page: PageNoPath, actions: List[RawPostAction[_]])
        : (PageNoPath, List[RawPostAction[_]])

  /** Deletes a vote. If there's a user id, deletes the vote by user id (guest or role),
    * Otherwise by browser id cookie.
    */
  def deleteVote(userIdData: UserIdData, pageId: PageId, postId: PostId,
        voteType: PostActionPayload.Vote)

  /** Remembers that the specified posts have been read by the user that did the action.
    */
  def updatePostsReadStats(pageId: PageId, postIdsRead: Set[PostId],
        actionMakingThemRead: RawPostAction[_])

  def loadPostsReadStats(pageId: PageId): PostsReadStats

  /** Returns None if the page doesn't exist, and a
    * Some(PageParts(the-page-id)) if it exists but is empty.
    * Loads another site's page, if siteId is specified.
    */
  def loadPageParts(debateId: PageId, tenantId: Option[SiteId] = None): Option[PageParts]

  /**
   * For each PagePath, loads a Page (well, Debate) with actions loaded
   * only for Page.BodyId and Page.TitleId. Also loads the authors.
   */
  def loadPageBodiesTitles(pageIds: Seq[PageId]): Map[PageId, PageParts]

  /** Loads posts that have e.g. been created, edited, flagged recently.
    *
    * The most interesting ones are loaded first — that is, flagged posts,
    * because moderators might need to delete such posts. Then new posts
    * that needs to be reviewed, then posts that have been edited, and so on.
    */
  def loadPostsRecentlyActive(limit: Int, offset: Int): (Seq[Post], People)

  /** Loads flags for the specified posts.
    */
  def loadFlags(pagePostIds: Seq[PagePostId])
        : (Map[PagePostId, Seq[RawPostAction[PAP.Flag]]], People)

  /**
   * Loads at most `limit` recent posts, conducted e.g. at `fromIp`.
   * Also loads actions that affected those posts (e.g. flags, edits,
   * approvals). Also loads the people who did the actions.
   *
   * When listing actions by IP, loads the most recent actions of any type.
   * When listing by /path/, however, loads `limit` *posts*, and then loads
   * actions that affected them. Rationale: When selecting by /path/, we
   * probably want to list e.g. all comments on a page. But when listing
   * by IP / user-id, we're also interested in e.g. which ratings the
   * user has cast, to find out if s/he is astroturfing.
   *
   * Loads "excerpts" only:
   * - For Rating:s, loads no rating tags.
   * - For Post:s and Edit:s with very much text, loads only the first
   *   200 chars or something like that (not implemented though).
   */
  def loadRecentActionExcerpts(
        fromIp: Option[String] = None,
        byRole: Option[RoleId] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[PostAction[_]], People)


  // ----- Users and permissions

  def createUserAndLogin(newUserData: NewUserData): LoginGrant

  def createPasswordUser(userData: NewPasswordUserData): User

  /** Returns true if the identity was found (and the password thus changed).
    */
  def changePassword(user: User, newPasswordSaltHash: String): Boolean

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

  def listUsers(userQuery: UserQuery): Seq[(User, Seq[String])]

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername]

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings]

  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings)

  /** Loads users watching the specified page, any parent categories or forums,
    * and people watching everything on the whole site.
    */
  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId]

  def loadRolePreferences(roleId: RoleId): Option[UserPreferences]

  def saveRolePreferences(preferences: UserPreferences)


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

  def configRole(roleId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs] = None, isAdmin: Option[Boolean] = None,
        isOwner: Option[Boolean] = None, emailVerifiedAt: Option[Option[ju.Date]] = None)

  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs)


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId]): Future[FullTextSearchResult]

  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostId*)

}


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


  // ----- Quota

  def loadQuotaState(consumers: Seq[QuotaConsumer])
        : Map[QuotaConsumer, QuotaState]

  /**
   * Adds `delta.deltaQuota` and `.deltaResources` to the amount of quota
   * and resources used, for the specified consumers.
   * Also updates limits and timestamp.
   * Creates new consumer quota entries if needed.
   */
  def useMoreQuotaUpdateLimits(deltas: Map[QuotaConsumer, QuotaDelta])


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



/**
 * Charges the tenants with some quota for each db request.
 *
 * Note: Verify quota is OK *before* writing anything to db. Otherwise
 * it'd be possible to start and rollback (when over quota) transactions,
 * which could be a DoS attack.
 * With NoSQL databases, there's no transaction to roll back, so
 * one must verify quota ok before writing anything.
 *
 * (It delegates database requests to a SiteDbDao implementation.)
 *
 * ((Place in which module? debiki-core, -server or -dao-pgsql?  If I'll create
 * new similar classes for other db backends (e.g. Cassandra), then it
 * should be moved to debiki-dao-pgsql. If, however, it'll be possible
 * to reuse the same instance, with different configs (doesn't yet exist),
 * then it could be moved to debiki-server, and the config classes
 * would be placed here in debiki-core?))
 */
class ChargingSiteDbDao(
  private val _spi: SiteDbDao,
  protected val _quotaCharger: QuotaCharger)
  extends SiteDbDao {

  import com.debiki.core.{ResourceUse => ResUsg}

  def commonMarkRenderer = _spi.commonMarkRenderer


  // ----- Quota

  def quotaConsumers: QuotaConsumers = _spi.quotaConsumers

  private def _chargeForOneReadReq() = _chargeFor(ResUsg(numDbReqsRead = 1))

  private def _chargeForOneWriteReq(mayPilfer: Boolean = false) =
    _chargeFor(ResUsg(numDbReqsWrite = 1), mayPilfer = mayPilfer)

  private def _chargeFor(resourceUsage: ResourceUse,
        mayPilfer: Boolean = false): Unit = {
    _quotaCharger.chargeOrThrow(quotaConsumers, resourceUsage,
       mayPilfer = mayPilfer)
  }

  private def _ensureHasQuotaFor(resourceUsage: ResourceUse,
        mayPilfer: Boolean): Unit =
    _quotaCharger.throwUnlessEnoughQuota(quotaConsumers, resourceUsage,
        mayPilfer = mayPilfer)


  // ----- Website (formerly "tenant")

  def siteId: SiteId = _spi.siteId

  def loadTenant(): Tenant = {
    _chargeForOneReadReq()
    _spi.loadTenant()
  }

  /**
   * Creates a website and returns it and its owner.
   *
   * The new site owner is based on the owner's role at the site via which
   * the new website is being created.
   */
  def createWebsite(name: Option[String], address: Option[String],
        embeddingSiteUrl: Option[String], ownerIp: String,
        ownerIdentity: Option[Identity], ownerRole: User)
        : Option[(Tenant, User)] = {

    // SHOULD consume IP quota — but not tenant quota!? — when generating
    // new tenant ID. Don't consume tenant quota because the tenant
    // would be www.debiki.com?
    // Do this by splitting QuotaManager._charge into two functions: one that
    // loops over quota consumers, and another that charges one single
    // consumer. Then call the latter function, charge the IP only.
    _chargeForOneWriteReq()

    _spi.createWebsite(name = name, address = address,
       embeddingSiteUrl, ownerIp = ownerIp,
       ownerIdentity = ownerIdentity, ownerRole = ownerRole)
  }

  def addTenantHost(host: TenantHost) = {
    // SHOULD hard code max num hosts, e.g. 10.
    _chargeForOneWriteReq()
    _spi.addTenantHost(host)
  }

  def lookupOtherTenant(scheme: String, host: String): TenantLookup = {
    _chargeForOneReadReq()
    _spi.lookupOtherTenant(scheme, host)
  }


  // ----- Login, logout

  def loginAsGuest(loginAttempt: GuestLoginAttempt): GuestLoginResult = {
    _ensureHasQuotaFor(ResUsg.forStoring(loginAttempt), mayPilfer = false)
    val result = _spi.loginAsGuest(loginAttempt)
    if (result.isNewUser) {
      _chargeFor(ResUsg.forStoring(user = result.user))
    }
    result
  }


  def tryLogin(loginAttempt: LoginAttempt): LoginGrant = {
    // Allow people to login via email and unsubscribe, even if over quota.
    val mayPilfer = loginAttempt.isInstanceOf[EmailLoginAttempt]

    // If we don't ensure there's enough quota for the db transaction,
    // Mallory could call tryLogin, when almost out of quota, and
    // tryLogin would write to the db and then rollback, when over quota
    // -- a DoS attack would be possible.
    _ensureHasQuotaFor(ResUsg.forStoring(loginAttempt), mayPilfer = mayPilfer)

    val loginGrant = _spi.tryLogin(loginAttempt)

    val resUsg = ResUsg.forStoring(
       identity = loginGrant.isNewIdentity ? loginGrant.identity.getOrDie("DwE0KSE3") | null,
       user = loginGrant.isNewRole ? loginGrant.user | null)

    _chargeFor(resUsg, mayPilfer = mayPilfer)

    loginGrant
  }


  // ----- Pages

  def nextPageId(): PageId = {
    _chargeForOneWriteReq()
    _spi.nextPageId()
  }

  def createPage(page: Page): Page = {
    _chargeFor(ResUsg.forStoring(page = page.parts))
    _spi.createPage(page)
  }

  def loadPageMeta(pageId: PageId): Option[PageMeta] = {
    _chargeForOneReadReq()
    _spi.loadPageMeta(pageId)
  }

  def loadPageMetasAsMap(pageIds: Seq[PageId], anySiteId: Option[SiteId]): Map[PageId, PageMeta] = {
    _chargeForOneReadReq()
    _spi.loadPageMetasAsMap(pageIds, anySiteId)
  }

  def updatePageMeta(meta: PageMeta, old: PageMeta) {
    _chargeForOneReadReq()
    _spi.updatePageMeta(meta, old = old)
  }

  def loadAncestorIdsParentFirst(pageId: PageId): List[PageId] = {
    _chargeForOneReadReq()
    _spi.loadAncestorIdsParentFirst(pageId)
  }

  def loadCategoryTree(rootPageId: PageId): Seq[Category] = {
    _chargeForOneReadReq()
    _spi.loadCategoryTree(rootPageId)
  }

  def saveSetting(target: SettingsTarget, setting: SettingNameValue[_]) {
    _chargeForOneWriteReq()
    _spi.saveSetting(target, setting)
  }

  def loadSettings(targets: Seq[SettingsTarget]): Seq[RawSettings] = {
    _chargeForOneReadReq()
    _spi.loadSettings(targets)
  }

  def movePages(pageIds: Seq[PageId], fromFolder: String, toFolder: String) {
    _chargeForOneWriteReq()
    _spi.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
  }

  def moveRenamePage(pageId: PageId,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): PagePath = {
    _chargeForOneWriteReq()
    _spi.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)
  }

  def moveRenamePage(pagePath: PagePath) {
    _chargeForOneWriteReq()
    _spi.moveRenamePage(pagePath)
  }

  def movePageToItsPreviousLocation(pagePath: PagePath): Option[PagePath] = {
    _chargeForOneWriteReq()
    _spi.movePageToItsPreviousLocation(pagePath)
  }

  def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    _chargeForOneReadReq()
    _spi.checkPagePath(pathToCheck)
  }

  def lookupPagePath(pageId: PageId): Option[PagePath] = {
    _chargeForOneReadReq()
    _spi.lookupPagePath(pageId)
  }

  def lookupPagePathAndRedirects(pageId: PageId): List[PagePath] = {
    _chargeForOneReadReq()
    _spi.lookupPagePathAndRedirects(pageId)
  }

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        orderOffset: PageOrderOffset,
        limit: Int): Seq[PagePathAndMeta] = {
    _chargeForOneReadReq()
    _spi.listPagePaths(pageRanges, include, orderOffset, limit)
  }

  def listChildPages(parentPageIds: Seq[PageId], orderOffset: PageOrderOffset,
        limit: Int, filterPageRole: Option[PageRole])
        : Seq[PagePathAndMeta] = {
    _chargeForOneReadReq()
    _spi.listChildPages(parentPageIds, orderOffset, limit = limit, filterPageRole = filterPageRole)
  }


  // ----- Actions

  def doSavePageActions(page: PageNoPath, actions: List[RawPostAction[_]])
        : (PageNoPath, List[RawPostAction[_]]) = {
    _chargeFor(ResUsg.forStoring(actions = actions))
    _spi.doSavePageActions(page, actions)
  }

  def deleteVote(userIdData: UserIdData, pageId: PageId, postId: PostId,
        voteType: PostActionPayload.Vote) {
    _chargeForOneWriteReq()
    _spi.deleteVote(userIdData, pageId, postId, voteType)
  }

  def updatePostsReadStats(pageId: PageId, postIdsRead: Set[PostId],
        actionMakingThemRead: RawPostAction[_]) {
    _chargeForOneWriteReq()
    _spi.updatePostsReadStats(pageId, postIdsRead, actionMakingThemRead)
  }

  def loadPostsReadStats(pageId: PageId): PostsReadStats = {
    _chargeForOneReadReq()
    _spi.loadPostsReadStats(pageId)
  }

  def loadPageParts(debateId: PageId, tenantId: Option[SiteId]): Option[PageParts] = {
    _chargeForOneReadReq()
    _spi.loadPageParts(debateId, tenantId)
  }

  def loadPageBodiesTitles(pagePaths: Seq[String]): Map[String, PageParts] = {
    _chargeForOneReadReq()
    _spi.loadPageBodiesTitles(pagePaths)
  }

  def loadPostsRecentlyActive(limit: Int, offset: Int): (Seq[Post], People) = {
    _chargeForOneReadReq()
    _spi.loadPostsRecentlyActive(limit, offset = offset)
  }

  def loadFlags(pagePostIds: Seq[PagePostId])
        : (Map[PagePostId, Seq[RawPostAction[PAP.Flag]]], People) = {
    _chargeForOneReadReq()
    _spi.loadFlags(pagePostIds)
  }

  def loadRecentActionExcerpts(
        fromIp: Option[String] = None,
        byRole: Option[RoleId] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[PostAction[_]], People) = {
    _chargeForOneReadReq()
    _spi.loadRecentActionExcerpts(fromIp = fromIp, byRole = byRole,
        pathRanges = pathRanges, limit = limit)
  }


  // ----- Users and permissions

  def createUserAndLogin(newUserData: NewUserData): LoginGrant = {
    val resUsg = ResourceUse(numIdsAu = 1, numRoles = 1)
    _chargeFor(resUsg, mayPilfer = false)
    _spi.createUserAndLogin(newUserData)
  }


  def createPasswordUser(userData: NewPasswordUserData): User = {
    val resUsg = ResourceUse(numRoles = 1)
    _chargeFor(resUsg, mayPilfer = false)
    _spi.createPasswordUser(userData)
  }

  def changePassword(user: User, newPasswordSaltHash: String): Boolean = {
    _chargeForOneWriteReq(mayPilfer = true)
    _spi.changePassword(user, newPasswordSaltHash)
  }

  def loadUser(userId: UserId): Option[User] = {
    _chargeForOneReadReq()
    _spi.loadUser(userId)
  }

  def loadUserByEmailOrUsername(emailOrUsername: String): Option[User] = {
    _chargeForOneReadReq()
    _spi.loadUserByEmailOrUsername(emailOrUsername)
  }

  def loadIdtyDetailsAndUser(userId: UserId): Option[(Identity, User)] = {
    _chargeForOneReadReq()
    _spi.loadIdtyDetailsAndUser(userId)
  }

  def loadUserInfoAndStats(userId: UserId): Option[UserInfoAndStats] = {
    _chargeForOneReadReq()
    _spi.loadUserInfoAndStats(userId)
  }

  def loadUserStats(userId: UserId): UserStats = {
    _chargeForOneReadReq()
    _spi.loadUserStats(userId)
  }

  def listUserActions(userId: UserId): Seq[UserActionInfo] = {
    _chargeForOneReadReq()
    _spi.listUserActions(userId)
  }

  def loadPermsOnPage(reqInfo: PermsOnPageQuery): PermsOnPage = {
    _chargeForOneReadReq()
    _spi.loadPermsOnPage(reqInfo)
  }

  def listUsers(userQuery: UserQuery): Seq[(User, Seq[String])] = {
    _chargeForOneReadReq()
    _spi.listUsers(userQuery)
  }

  def listUsernames(pageId: PageId, prefix: String): Seq[NameAndUsername] = {
    _chargeForOneReadReq()
    _spi.listUsernames(pageId = pageId, prefix = prefix)
  }

  def loadRolePageSettings(roleId: RoleId, pageId: PageId): Option[RolePageSettings] = {
    _chargeForOneReadReq()
    _spi.loadRolePageSettings(roleId = roleId, pageId = pageId)
  }


  def saveRolePageSettings(roleId: RoleId, pageId: PageId, settings: RolePageSettings) = {
    _chargeForOneWriteReq()
    _spi.saveRolePageSettings(roleId = roleId, pageId = pageId, settings)
  }

  def loadUserIdsWatchingPage(pageId: PageId): Seq[UserId] = {
    _chargeForOneReadReq()
    _spi.loadUserIdsWatchingPage(pageId)
  }

  def loadRolePreferences(roleId: RoleId): Option[UserPreferences] = {
    _chargeForOneReadReq()
    _spi.loadRolePreferences(roleId)
  }

  def saveRolePreferences(preferences: UserPreferences) {
    _chargeForOneWriteReq()
    _spi.saveRolePreferences(preferences)
  }


  // ----- Notifications

  def saveDeleteNotifications(notifications: Notifications) {
    _chargeForOneWriteReq()
    _spi.saveDeleteNotifications(notifications)
  }

  def loadNotificationsForRole(roleId: RoleId): Seq[Notification] = {
    _chargeForOneReadReq()
    _spi.loadNotificationsForRole(roleId)
  }

  def updateNotificationSkipEmail(notifications: Seq[Notification]) {
    _chargeForOneWriteReq()
    _spi.updateNotificationSkipEmail(notifications)
  }


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit = {
    _chargeFor(ResUsg.forStoring(email = email))
    _spi.saveUnsentEmail(email)
  }

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]) {
    _chargeFor(ResUsg.forStoring(email = email))
    _spi.saveUnsentEmailConnectToNotfs(email, notfs)
  }

  def updateSentEmail(email: Email): Unit = {
    _chargeForOneWriteReq()
    _spi.updateSentEmail(email)
  }

  def loadEmailById(emailId: String): Option[Email] = {
    _chargeForOneReadReq()
    _spi.loadEmailById(emailId)
  }


  // ----- User configuration

  def configRole(roleId: RoleId,
        emailNotfPrefs: Option[EmailNotfPrefs], isAdmin: Option[Boolean],
        isOwner: Option[Boolean], emailVerifiedAt: Option[Option[ju.Date]]) =  {
    // When auditing of changes to roles has been implemented,
    // `configRole` will create new rows, and we should:
    // _chargeFor(ResUsg.forStoring(quotaConsumers.role.get))
    // And don't care about whether or not quotaConsumers.role.id == roleId. ?
    // But for now:
    _chargeForOneWriteReq()
    _spi.configRole(roleId = roleId,
      emailNotfPrefs = emailNotfPrefs, isAdmin = isAdmin, isOwner = isOwner,
      emailVerifiedAt = emailVerifiedAt)
  }

  def configIdtySimple(ctime: ju.Date, emailAddr: String, emailNotfPrefs: EmailNotfPrefs) = {
    _chargeForOneWriteReq()
    _spi.configIdtySimple(
      ctime = ctime, emailAddr = emailAddr, emailNotfPrefs = emailNotfPrefs)
  }


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId])
        : Future[FullTextSearchResult] = {
    _chargeForOneReadReq() // should charge much more?
    _spi.fullTextSearch(phrase, anyRootPageId)
  }

  def debugUnindexPosts(pageAndPostIds: PagePostId*) {
    // Charge nothing; this is for test suites only.
    _spi.debugUnindexPosts(pageAndPostIds: _*)
  }
}



object DbDao {

  case class TooManySitesCreatedException(ip: String) extends QuickException {
    override def getMessage = "Website creation limit exceeded"
  }

  case class EmailNotFoundException(emailId: String)
    extends RuntimeException("No email with id: "+ emailId)

  case class BadEmailTypeException(emailId: String)
    extends RuntimeException(s"Email with id $emailId has no recipient user id")

  case object DuplicateUsername extends RuntimeException("Duplicate username")
  case object DuplicateUserEmail extends RuntimeException("Duplicate user email")

  case class IdentityNotFoundException(message: String)
    extends RuntimeException(message)

  case object BadPasswordException extends RuntimeException("Bad password")

  case object EmailNotVerifiedException extends RuntimeException("Email not verified")

  case object DuplicateVoteException extends RuntimeException("Duplicate vote")

  case object LikesOwnPostException extends RuntimeException("One may not upvote ones own post")

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
