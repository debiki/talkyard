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

import com.debiki.v0._
import controllers._
import debiki._
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

  def createPage(page: Page): Page = tenantDbDao.createPage(page)

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
        : (PageNoPath, Seq[PostActionDtoOld]) = {
    savePageActionsGenNotfsImpl(PageNoPath(pageReq.page_!, pageReq.pageMeta_!), actions)
  }


  final def savePageActionsGenNotfs(page: PageParts, actions: List[PostActionDtoOld])
        : (PageNoPath, Seq[PostActionDtoOld]) = {
    val pageMeta = tenantDbDao.loadPageMeta(page.id) getOrElse
      throwNotFound("DwE115Xf3", s"Found no meta for page ${page.id}")
    savePageActionsGenNotfsImpl(PageNoPath(page, pageMeta), actions)
  }


  def savePageActionsGenNotfsImpl(page: PageNoPath, actions: List[PostActionDtoOld])
        : (PageNoPath, Seq[PostActionDtoOld]) = {
    if (actions isEmpty)
      return (page, Nil)

    // COULD check that e.g. a deleted post is really a post, an applied edit is
    // really an edit, an action undone is not itself an Undo action,
    // and lots of other similar tests.

    val (pageWithNewActions, actionsWithId) =
      tenantDbDao.savePageActions(page, actions)

    (pageWithNewActions, actionsWithId)
  }


  def loadPage(debateId: String): Option[PageParts] =
    tenantDbDao.loadPage(debateId)

  def loadPageAnyTenant(sitePageId: SitePageId): Option[PageParts] =
    loadPageAnyTenant(tenantId = sitePageId.siteId, pageId = sitePageId.pageId)

  def loadPageAnyTenant(tenantId: String, pageId: String): Option[PageParts] =
    tenantDbDao.loadPage(pageId, tenantId = Some(tenantId))

  /**
   * Loads articles (title + body) e.g. for inclusion on a blog post list page.
   */
  def loadPageBodiesTitles(pageIds: Seq[String]): Map[String, PageParts] =
    tenantDbDao.loadPageBodiesTitles(pageIds)

  def loadPostsRecentlyActive(limit: Int): (Seq[Post], People) =
    tenantDbDao.loadPostsRecentlyActive(limit, offset = 0)

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

