/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import scala.xml.NodeSeq
import EmailNotfPrefs.EmailNotfPrefs
import Prelude._


abstract class DaoFactory {
  def systemDao: SystemDao
  def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao
}



object DaoFactory {

  def apply(dbDaoFactory: DbDaoFactory, quotaCharger: QuotaCharger)
        = new DaoFactory {
    private val _dbDaoFactory = dbDaoFactory
    private val _quotaCharger = quotaCharger

    def systemDao = _dbDaoFactory.systemDbDao

    def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao = {
      val tenantDbDao = _dbDaoFactory.newTenantDbDao(quotaConsumers)
      val chargingDbDao = new ChargingTenantDbDao(tenantDbDao, _quotaCharger)
      new TenantDao(chargingDbDao)
    }
  }
}



class TenantDao(protected val tenantDbDao: ChargingTenantDbDao) {

  def quotaConsumers = tenantDbDao.quotaConsumers


  // ----- Tenant

  def tenantId: String = tenantDbDao.tenantId

  def loadTenant(): Tenant = tenantDbDao.loadTenant()

  def createWebsite(name: String, address: String, ownerIp: String,
        ownerLoginId: String, ownerIdentity: IdentityOpenId, ownerRole: User)
        : Option[Tenant] =
    tenantDbDao.createWebsite(name = name, address = address, ownerIp = ownerIp,
      ownerLoginId = ownerLoginId, ownerIdentity = ownerIdentity,
      ownerRole = ownerRole)

  def addTenantHost(host: TenantHost) = tenantDbDao.addTenantHost(host)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup =
    tenantDbDao.lookupOtherTenant(scheme, host)


  // ----- Login, logout

  def saveLogin(loginReq: LoginRequest): LoginGrant =
    tenantDbDao.saveLogin(loginReq)

  def saveLogout(loginId: String, logoutIp: String) =
    tenantDbDao.saveLogout(loginId, logoutIp)


  // ----- Pages

  def createPage(page: PageStuff): PageStuff = tenantDbDao.createPage(page)

  def loadPageMeta(pageId: String): Option[PageMeta] =
    tenantDbDao.loadPageMeta(pageId)

  def movePages(pageIds: Seq[String], fromFolder: String, toFolder: String) =
    tenantDbDao.movePages(pageIds, fromFolder = fromFolder, toFolder = toFolder)

  def moveRenamePage(pageId: String, newFolder: Option[String] = None,
        showId: Option[Boolean] = None, newSlug: Option[String] = None)
        : PagePath =
    tenantDbDao.moveRenamePage(pageId = pageId, newFolder = newFolder,
      showId = showId, newSlug = newSlug)

  def loadTemplate(templPath: PagePath): Option[TemplateSrcHtml] =
    tenantDbDao.loadTemplate(templPath)

  def checkPagePath(pathToCheck: PagePath): Option[PagePath] =
    tenantDbDao.checkPagePath(pathToCheck)

  def lookupPagePathByPageId(pageId: String): Option[PagePath] =
    tenantDbDao.lookupPagePathByPageId(pageId = pageId)

  def listChildPages(parentPageId: String, sortBy: PageSortOrder,
        limit: Int, offset: Int = 0): Seq[(PagePath, PageDetails)] =
    tenantDbDao.listChildPages(
        parentPageId, sortBy, limit = limit, offset = offset)


  def renderPage(pageReq: PageRequest[_], appendToBody: NodeSeq = Nil)
        : String = {
    PageRenderer(pageReq, None, appendToBody).renderPage()
  }


  // ----- Actions

  /**
   * Saves page actions and places messages in users' inboxes, as needed.
   * Returns the saved actions, with ids assigned.
   */
  def savePageActions(pageReq: PageRequest[_], actions: List[Action])
        : Seq[Action] = {
    savePageActions(pageReq, pageReq.page_!, actions)
  }


  def savePageActions(request: DebikiRequest[_], page: Debate,
        actions: List[Action]): Seq[Action] = {

    if (actions isEmpty)
      return Nil

    val actionsWithId = tenantDbDao.savePageActions(page.id, actions)

    // Notify users whose actions were affected.
    // BUG: notification lost if server restarted here.
    // COULD rewrite Dao so the notfs can be saved in the same transaction:
    val pageWithNewActions = page ++ actionsWithId
    val notfs = NotfGenerator(pageWithNewActions, actionsWithId).generateNotfs
    tenantDbDao.saveNotfs(notfs)

    actionsWithId
  }


  def loadPage(debateId: String): Option[Debate] =
    tenantDbDao.loadPage(debateId)

  def loadPageBodiesTitles(pagePaths: Seq[PagePath])
        : Seq[(PagePath, Option[Debate])] =
    tenantDbDao.loadPageBodiesTitles(pagePaths)

  def loadRecentActionExcerpts(
        fromIp: Option[String] = None,
        byIdentity: Option[String] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[ViAc], People) =
    tenantDbDao.loadRecentActionExcerpts(fromIp = fromIp,
      byIdentity = byIdentity, pathRanges = pathRanges, limit = limit)


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int): Seq[(PagePath, PageDetails)] =
    tenantDbDao.listPagePaths(pageRanges, include, sortBy, limit, offset)


  // ----- Users and permissions

  def loadIdtyAndUser(forLoginId: String): Option[(Identity, User)] =
    tenantDbDao.loadIdtyAndUser(forLoginId)


  def loadIdtyDetailsAndUser(forLoginId: String = null,
        forIdentity: Identity = null): Option[(Identity, User)] =
    tenantDbDao.loadIdtyDetailsAndUser(forLoginId = forLoginId,
      forIdentity = forIdentity)

  def loadPermsOnPage(reqInfo: RequestInfo): PermsOnPage =
    tenantDbDao.loadPermsOnPage(reqInfo)


  // ----- Notifications

  def saveNotfs(notfs: Seq[NotfOfPageAction]) =
    tenantDbDao.saveNotfs(notfs)

  def loadNotfsForRole(roleId: String): Seq[NotfOfPageAction] =
    tenantDbDao.loadNotfsForRole(roleId)

  def loadNotfByEmailId(emailId: String): Option[NotfOfPageAction] =
    tenantDbDao.loadNotfByEmailId(emailId)

  def skipEmailForNotfs(notfs: Seq[NotfOfPageAction], debug: String): Unit =
    tenantDbDao.skipEmailForNotfs(notfs, debug)


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit =
    tenantDbDao.saveUnsentEmail(email)

  def saveUnsentEmailConnectToNotfs(email: Email,
        notfs: Seq[NotfOfPageAction]): Unit =
    tenantDbDao.saveUnsentEmailConnectToNotfs(email, notfs)

  def updateSentEmail(email: Email): Unit =
    tenantDbDao.updateSentEmail(email)

  def loadEmailById(emailId: String): Option[Email] =
    tenantDbDao.loadEmailById(emailId)


  // ----- User configuration

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

