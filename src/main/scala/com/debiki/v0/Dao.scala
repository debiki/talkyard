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


/**
 * Constructs database DAO:s, implemented by service providers,
 * (currently only debiki-dao-pgsql, for Postgres) and used by debiki-app-play.
 */
abstract class DbDaoFactory {
  def systemDaoSpi: SystemDbDao
  def buildTenantDaoSpi(quotaConsumers: QuotaConsumers): TenantDbDao
}



/**
 * Debiki's database Data Access Object (DAO).
 *
 * It's named "DbDao" not simply "Dao" because there are other kinds
 * of DAO:s, e.g. a cache DAO that reads stuff from the database, and
 * constructs objects and caches them in-memory / on disk. Perhaps there
 * could be a web service DAO as well.
 */
abstract class TenantDbDao {

  def quotaConsumers: QuotaConsumers

  def tenantId: String

  def loadTenant(): Tenant

  def createWebsite(name: String, address: String, ownerIp: String,
        ownerLoginId: String, ownerIdentity: IdentityOpenId, ownerRole: User)
        : Option[Tenant]

  def addTenantHost(host: TenantHost)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup

  def saveLogin(loginReq: LoginRequest): LoginGrant

  def saveLogout(loginId: String, logoutIp: String)

  def createPage(page: PageStuff): PageStuff

  def loadPageMeta(pageId: String): Option[PageMeta]

  def movePages(pageIds: Seq[String], fromFolder: String, toFolder: String)

  def moveRenamePage(pageId: String,
        newFolder: Option[String], showId: Option[Boolean],
        newSlug: Option[String]): PagePath

  def loadTemplate(templPath: PagePath): Option[TemplateSrcHtml]

  def checkPagePath(pathToCheck: PagePath): Option[PagePath]

  def lookupPagePathByPageId(pageId: String): Option[PagePath]

  def listChildPages(parentPageId: String, sortBy: PageSortOrder,
        limit: Int, offset: Int): Seq[(PagePath, PageDetails)]

  def savePageActions[T <: Action](debateId: String, xs: List[T]): List[T]

  def loadPage(debateId: String): Option[Debate]

  def loadPageBodiesTitles(pagePaths: Seq[PagePath])
        : Seq[(PagePath, Option[Debate])]

  def loadRecentActionExcerpts(fromIp: Option[String],
        byIdentity: Option[String],
        pathRanges: PathRanges, limit: Int): (Seq[ViAc], People)

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int
      ): Seq[(PagePath, PageDetails)]

  def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)]

  def loadIdtyDetailsAndUser(forLoginId: String = null,
        forIdentity: Identity = null): Option[(Identity, User)]

  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage

  def saveNotfs(notfs: Seq[NotfOfPageAction])

  def loadNotfsForRole(roleId: String): Seq[NotfOfPageAction]

  def loadNotfByEmailId(emailId: String): Option[NotfOfPageAction]

  def skipEmailForNotfs(notfs: Seq[NotfOfPageAction], debug: String): Unit

  def saveUnsentEmail(email: Email): Unit

  def saveUnsentEmailConnectToNotfs(email: Email,
        notfs: Seq[NotfOfPageAction]): Unit

  def updateSentEmail(email: Email): Unit

  def loadEmailById(emailId: String): Option[Email]

  def configRole(loginId: String, ctime: ju.Date,
                    roleId: String, emailNotfPrefs: EmailNotfPrefs)

  def configIdtySimple(loginId: String, ctime: ju.Date,
                       emailAddr: String, emailNotfPrefs: EmailNotfPrefs)

}


abstract class SystemDbDao {

  def close()  // remove? move to DbDaoFactory in some manner?

  /**
   * Creates the very first tenant. Then there cannot be any creator,
   * because there are no users or roles (since there are on other tenants).
   */
  // COULD rename to createFirstWebsite
  def createTenant(name: String): Tenant

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[String]): Seq[Tenant]

  // COULD rename to findWebsitesCanonicalHost
  def lookupTenant(scheme: String, host: String): TenantLookup

  def loadNotfsToMailOut(delayInMinutes: Int, numToLoad: Int): NotfsToMail

  def loadQuotaState(consumers: Seq[QuotaConsumer])
        : Map[QuotaConsumer, QuotaState]

  def useMoreQuotaUpdateLimits(deltas: Map[QuotaConsumer, QuotaDelta])

  def checkRepoVersion(): Option[String]

  /** Used as salt when hashing e.g. email and IP, before the hash
   *  is included in HTML. */
  def secretSalt(): String

}



/**
 * Debiki's Data Access Object, for tenant specific data.
 *
 * Delegates database requests to a TenantDbDao implementation.
 */
class TenantDao(
   private val _spi: TenantDbDao,
   protected val _quotaCharger: QuotaCharger) {

  import com.debiki.v0.{ResourceUse => ResUsg}


  // ----- Quota

  // Verify quota is OK *before* writing anything to db. Otherwise
  // it'd be possible to start and rollback (when over quota) transactions,
  // which could be a DoS attack.
  // With NoSQL databases, there's no transaction to roll back, so
  // one must verify quota ok before writing anything.
  def quotaConsumers: QuotaConsumers = _spi.quotaConsumers

  private def _chargeForOneReadReq() = _chargeFor(ResUsg(numDbReqsRead = 1))
  private def _chargeForOneWriteReq() = _chargeFor(ResUsg(numDbReqsWrite = 1))

  private def _chargeFor(resourceUsage: ResourceUse,
        mayPilfer: Boolean = false): Unit = {
    _quotaCharger.chargeOrThrow(quotaConsumers, resourceUsage,
       mayPilfer = mayPilfer)
  }

  private def _ensureHasQuotaFor(resourceUsage: ResourceUse,
        mayPilfer: Boolean): Unit =
    _quotaCharger.throwUnlessEnoughQuota(quotaConsumers, resourceUsage,
        mayPilfer = mayPilfer)


  // ----- Tenant

  def tenantId: String = _spi.tenantId

  /**
   * Loads the tenant for this dao.
   */
  def loadTenant(): Tenant = {
    _chargeForOneReadReq()
    _spi.loadTenant()
  }

  /**
   * Returns Some(new-website) on success — that is, unless someone else
   * created the very same website, just before you.
   * Throws OverQuotaException if you've created too many websites already
   * (e.g. from the same IP).
   */
  def createWebsite(name: String, address: String, ownerIp: String,
        ownerLoginId: String, ownerIdentity: IdentityOpenId, ownerRole: User)
        : Option[Tenant] = {

    // SHOULD consume IP quota — but not tenant quota!? — when generating
    // new tenant ID. Don't consume tenant quota because the tenant
    // would be www.debiki.com?
    // Do this by splitting QuotaManager._charge into two functions: one that
    // loops over quota consumers, and another that charges one single
    // consumer. Then call the latter function, charge the IP only.
    _chargeForOneWriteReq()

    _spi.createWebsite(name = name, address = address, ownerIp = ownerIp,
       ownerLoginId = ownerLoginId, ownerIdentity = ownerIdentity,
       ownerRole = ownerRole)
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

  /**
   * Assigns ids to the login request, saves it, finds or creates a user
   * for the specified Identity, and returns everything with ids filled in.
   * Also, if the Identity does not already exist in the db, assigns it an ID
   * and saves it.
   */
  def saveLogin(loginReq: LoginRequest): LoginGrant = {
    // Allow people to login via email and unsubscribe, even if over quota.
    val mayPilfer = loginReq.identity.isInstanceOf[IdentityEmailId]

    // If we don't ensure there's enough quota for the db transaction,
    // Mallory could call saveLogin, when almost out of quota, and
    // saveLogin would write to the db and then rollback, when over quota
    // -- a DoS attack would be possible.
    _ensureHasQuotaFor(ResUsg.forStoring(login = loginReq.login,
       identity = loginReq.identity), mayPilfer = mayPilfer)

    val loginGrant = _spi.saveLogin(loginReq)

    val resUsg = ResUsg.forStoring(login = loginReq.login,
       identity = loginGrant.isNewIdentity ? loginReq.identity | null,
       user = loginGrant.isNewRole ? loginGrant.user | null)

    _chargeFor(resUsg, mayPilfer = mayPilfer)

    loginGrant
  }

  /**
   * Updates the specified login with logout IP and timestamp.
   */
  def saveLogout(loginId: String, logoutIp: String) = {
    _chargeForOneWriteReq()
    _spi.saveLogout(loginId, logoutIp)
  }


  // ----- Pages

  def createPage(page: PageStuff): PageStuff = {
    _chargeFor(ResUsg.forStoring(page = page.actions))
    _spi.createPage(page)
  }

  def loadPageMeta(pageId: String): Option[PageMeta] = {
    _chargeForOneReadReq()
    _spi.loadPageMeta(pageId)
  }

  def movePages(pageIds: Seq[String], fromFolder: String, toFolder: String) {
    _chargeForOneWriteReq()
    _spi.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)
  }

  def moveRenamePage(pageId: String,
        newFolder: Option[String] = None, showId: Option[Boolean] = None,
        newSlug: Option[String] = None): PagePath = {
    _chargeForOneWriteReq()
    _spi.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)
  }

  def loadTemplate(templPath: PagePath): Option[TemplateSrcHtml] = {
    _chargeForOneReadReq()
    _spi.loadTemplate(templPath)
  }

  def checkPagePath(pathToCheck: PagePath): Option[PagePath] = {
    _chargeForOneReadReq()
    _spi.checkPagePath(pathToCheck)
  }

  def lookupPagePathByPageId(pageId: String): Option[PagePath] = {
    _chargeForOneReadReq()
    _spi.lookupPagePathByPageId(pageId = pageId)
  }

  def listChildPages(parentPageId: String, sortBy: PageSortOrder,
        limit: Int, offset: Int = 0): Seq[(PagePath, PageDetails)] = {
    _chargeForOneReadReq()
    _spi.listChildPages(parentPageId, sortBy, limit = limit, offset = offset)
  }


  // ----- Actions

  def savePageActions[T <: Action](
        debateId: String, actions: List[T]): List[T] = {
    _chargeFor(ResUsg.forStoring(actions = actions))
    _spi.savePageActions(debateId, actions)
  }

  def loadPage(debateId: String): Option[Debate] = {
    _chargeForOneReadReq()
    _spi.loadPage(debateId)
  }

  /**
   * For each PagePath, loads a Page (well, Debate) with actions loaded
   * only for Page.BodyId and Page.TitleId. Also loads the authors.
   */
  def loadPageBodiesTitles(pagePaths: Seq[PagePath])
        : Seq[(PagePath, Option[Debate])] = {
    _chargeForOneReadReq()
    _spi.loadPageBodiesTitles(pagePaths)
  }

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
        byIdentity: Option[String] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[ViAc], People) = {
    _chargeForOneReadReq()
    _spi.loadRecentActionExcerpts(fromIp = fromIp, byIdentity = byIdentity,
        pathRanges = pathRanges, limit = limit)
  }


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int): Seq[(PagePath, PageDetails)] = {
    _chargeForOneReadReq()
    _spi.listPagePaths(pageRanges, include, sortBy, limit, offset)
  }


  // ----- Users and permissions

  def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)] = {
    _chargeForOneReadReq()
    _spi.loadIdtyAndUser(forLoginId)
  }

  /**
   * Also loads details like OpenID local identifier, endpoint and version info.
   */
  def loadIdtyDetailsAndUser(forLoginId: String = null,
        forIdentity: Identity = null): Option[(Identity, User)] = {
    _chargeForOneReadReq()
    _spi.loadIdtyDetailsAndUser(forLoginId = forLoginId,
        forIdentity = forIdentity)
  }

  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage = {
    _chargeForOneReadReq()
    _spi.loadPermsOnPage(reqInfo)
  }


  // ----- Notifications

  def saveNotfs(notfs: Seq[NotfOfPageAction]) = {
    _chargeFor(ResUsg.forStoring(notfs = notfs))
    _spi.saveNotfs(notfs)
  }

  def loadNotfsForRole(roleId: String): Seq[NotfOfPageAction] = {
    _chargeForOneReadReq()
    _spi.loadNotfsForRole(roleId)
  }

  def loadNotfByEmailId(emailId: String): Option[NotfOfPageAction] = {
    _chargeForOneReadReq()
    _spi.loadNotfByEmailId(emailId)
  }

  def skipEmailForNotfs(notfs: Seq[NotfOfPageAction], debug: String): Unit = {
    _chargeForOneWriteReq()
    _spi.skipEmailForNotfs(notfs, debug)
  }


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit = {
    _chargeFor(ResUsg.forStoring(email = email))
    _spi.saveUnsentEmail(email)
  }

  def saveUnsentEmailConnectToNotfs(email: Email,
        notfs: Seq[NotfOfPageAction]): Unit = {
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

  def configRole(loginId: String, ctime: ju.Date,
        roleId: String, emailNotfPrefs: EmailNotfPrefs) =  {
    // When auditing of changes to roles has been implemented,
    // `configRole` will create new rows, and we should:
    // _chargeFor(ResUsg.forStoring(quotaConsumers.role.get))
    // And don't care about whether or not quotaConsumers.role.id == roleId. ?
    // But for now:
    _chargeForOneWriteReq()
    _spi.configRole(loginId = loginId, ctime = ctime,
                    roleId = roleId, emailNotfPrefs = emailNotfPrefs)
  }

  def configIdtySimple(loginId: String, ctime: ju.Date,
        emailAddr: String, emailNotfPrefs: EmailNotfPrefs) = {
    _chargeForOneWriteReq()
    _spi.configIdtySimple(loginId = loginId, ctime = ctime,
                          emailAddr = emailAddr,
                          emailNotfPrefs = emailNotfPrefs)
  }

}



class SystemDao(private val _spi: SystemDbDao) {

  def close() = _spi.close()


  // ----- Emails

  def loadNotfsToMailOut(delayInMinutes: Int, numToLoad: Int): NotfsToMail =
    _spi.loadNotfsToMailOut(delayInMinutes, numToLoad)


  // ----- Tenants

  /**
   * Creates a tenant, assigns it an id and and returns it.
   */
  def createTenant(name: String): Tenant =
    _spi.createTenant(name)

  def loadTenants(tenantIds: Seq[String]): Seq[Tenant] =
    _spi.loadTenants(tenantIds)

  def lookupTenant(scheme: String, host: String): TenantLookup =
    _spi.lookupTenant(scheme, host)


  // ----- Quota

  def loadQuotaState(consumers: Seq[QuotaConsumer])
        : Map[QuotaConsumer, QuotaState] =
    _spi.loadQuotaState(consumers)

  /**
   * Adds `delta.deltaQuota` and `.deltaResources` to the amount of quota
   * and resources used, for the specified consumers.
   * Also updates limits and timestamp.
   * Creates new consumer quota entries if needed.
   */
  def useMoreQuotaUpdateLimits(deltas: Map[QuotaConsumer, QuotaDelta]) =
    _spi.useMoreQuotaUpdateLimits(deltas)


  // ----- Misc

  def checkRepoVersion(): Option[String] = _spi.checkRepoVersion()

  def secretSalt(): String = _spi.secretSalt()

}



object Dao {

  case class EmailNotFoundException(emailId: String)
    extends Exception("No email with id: "+ emailId)

  case class PageNotFoundException(tenantId: String, pageId: String)
    extends IllegalArgumentException("Page not found, id: "+ pageId +
       ", tenant id: "+ tenantId)

}

