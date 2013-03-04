/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import DebikiHttp._
import Prelude._


abstract class TenantDaoFactory {
  def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao
}



object TenantDaoFactory {

  /**
   * Creates a non-caching TenantDaoFactory.
   */
  def apply(dbDaoFactory: DbDaoFactory, quotaCharger: QuotaCharger)
        = new TenantDaoFactory {
    private val _dbDaoFactory = dbDaoFactory
    private val _quotaCharger = quotaCharger

    def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao = {
      val tenantDbDao = _dbDaoFactory.newTenantDbDao(quotaConsumers)
      val chargingDbDao = new ChargingTenantDbDao(tenantDbDao, _quotaCharger)
      new TenantDao(chargingDbDao)
    }
  }
}



/**
 * Delegates most requests to TenantDbDao. However, hides some
 * TenantDbDao methods, because calling them directly would mess up
 * the cache in TenantDao's subclass CachingTenantDao.
 */
class TenantDao(protected val tenantDbDao: ChargingTenantDbDao)
  extends AnyRef
  with AssetBundleDao
  with ConfigValueDao
  with PagePathMetaDao
  with PageSummaryDao
  with RenderedPageHtmlDao
  with UserDao {

  def quotaConsumers = tenantDbDao.quotaConsumers


  // ----- Tenant

  def siteId = tenantDbDao.siteId

  //@deprecated("use siteId instead", "now") -- gah, terrible many warnings!
  def tenantId: String = tenantDbDao.tenantId

  def loadTenant(): Tenant = tenantDbDao.loadTenant()

  def createWebsite(name: String, address: String, ownerIp: String,
        ownerLoginId: String, ownerIdentity: IdentityOpenId, ownerRole: User)
        : Option[(Tenant, User)] =
    tenantDbDao.createWebsite(name = name, address = address, ownerIp = ownerIp,
      ownerLoginId = ownerLoginId, ownerIdentity = ownerIdentity,
      ownerRole = ownerRole)

  def addTenantHost(host: TenantHost) = tenantDbDao.addTenantHost(host)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup =
    tenantDbDao.lookupOtherTenant(scheme, host)


  // ----- Pages

  def createPage(page: PageStuff): PageStuff = tenantDbDao.createPage(page)

  def listChildPages(parentPageId: String, sortBy: PageSortOrder,
        limit: Int, offset: Int = 0, filterPageRole: Option[PageRole] = None)
        : Seq[(PagePath, PageMeta)] =
    tenantDbDao.listChildPages(
        parentPageId, sortBy, limit = limit, offset = offset, filterPageRole)


  // ----- Actions

  /**
   * Saves page actions and places messages in users' inboxes, as needed.
   * Returns the page including new actions, and the actions, but with ids assigned.
   */
  final def savePageActionsGenNotfs(pageReq: PageRequest[_], actions: List[PostActionDtoOld])
        : (Debate, Seq[PostActionDtoOld]) = {
    savePageActionsGenNotfsImpl(pageReq.page_!, actions, pageReq.pageMeta_!)
  }


  final def savePageActionsGenNotfs(page: Debate, actions: List[PostActionDtoOld])
        : (Debate, Seq[PostActionDtoOld]) = {
    val pageMeta = tenantDbDao.loadPageMeta(page.id) getOrElse
      throwNotFound("DwE115Xf3", s"Found no meta for page ${page.id}")
    savePageActionsGenNotfsImpl(page, actions, pageMeta)
  }


  def savePageActionsGenNotfsImpl(page: Debate, actions: List[PostActionDtoOld],
        pageMeta: PageMeta): (Debate, Seq[PostActionDtoOld]) = {
    if (actions isEmpty)
      return (page, Nil)

    val actionsWithId = tenantDbDao.savePageActions(page.id, actions)
    val pageWithNewActions = page ++ actionsWithId

    val newMeta = PageMeta.forChangedPage(pageMeta, pageWithNewActions)
    if (newMeta != pageMeta)
      tenantDbDao.updatePageMeta(newMeta, old = pageMeta) // BUG: race condition
                        // Could fix by using Optimistic Concurrency Control?

    // Notify users whose actions were affected.
    // BUG: notification lost if server restarted here.
    // COULD rewrite Dao so the notfs can be saved in the same transaction:
    val notfs = NotfGenerator(pageWithNewActions, actionsWithId).generateNotfs
    tenantDbDao.saveNotfs(notfs)

    (pageWithNewActions, actionsWithId)
  }


  def loadPage(debateId: String): Option[Debate] =
    tenantDbDao.loadPage(debateId)

  def loadPageAnyTenant(sitePageId: SitePageId): Option[Debate] =
    loadPageAnyTenant(tenantId = sitePageId.siteId, pageId = sitePageId.pageId)

  def loadPageAnyTenant(tenantId: String, pageId: String): Option[Debate] =
    tenantDbDao.loadPage(pageId, tenantId = Some(tenantId))

  /**
   * Loads articles (title + body) e.g. for inclusion on a blog post list page.
   */
  def loadPageBodiesTitles(pageIds: Seq[String]): Map[String, Debate] =
    tenantDbDao.loadPageBodiesTitles(pageIds)

  def loadRecentActionExcerpts(
        fromIp: Option[String] = None,
        byIdentity: Option[String] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[PostActionOld], People) =
    tenantDbDao.loadRecentActionExcerpts(fromIp = fromIp,
      byIdentity = byIdentity, pathRanges = pathRanges, limit = limit)


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int): Seq[(PagePath, PageMeta)] =
    tenantDbDao.listPagePaths(pageRanges, include, sortBy, limit, offset)


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

}

