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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{util => ju}
import scala.concurrent.Future



abstract class SiteDaoFactory {
  def newSiteDao(quotaConsumers: QuotaConsumers): SiteDao
}



object SiteDaoFactory {

  /** Creates a non-caching SiteDaoFactory.
    */
  def apply(dbDaoFactory: DbDaoFactory, quotaCharger: QuotaCharger)
        = new SiteDaoFactory {
    private val _dbDaoFactory = dbDaoFactory
    private val _quotaCharger = quotaCharger

    def newSiteDao(quotaConsumers: QuotaConsumers): SiteDao = {
      val siteDbDao = _dbDaoFactory.newSiteDbDao(quotaConsumers)
      val chargingDbDao = new ChargingSiteDbDao(siteDbDao, _quotaCharger)
      new SiteDao(chargingDbDao)
    }
  }

}



/** A data access object for site specific data. Data could be loaded
  * from database, or fetched from some in-memory cache.
  *
  * Delegates most requests to SiteDbDao. However, hides some
  * SiteDbDao methods, because calling them directly would mess up
  * the cache in SiteDao's subclass CachingSiteDao.
  */
class SiteDao(protected val siteDbDao: ChargingSiteDbDao)
  extends AnyRef
  with AssetBundleDao
  with ConfigValueDao
  with SettingsDao
  with SpecialContentDao
  with PageDao
  with PagePathMetaDao
  with PageSummaryDao
  with RenderedPageHtmlDao
  with UserDao {

  def quotaConsumers = siteDbDao.quotaConsumers


  // ----- Tenant

  def siteId = siteDbDao.siteId

  def loadSite(): Tenant = siteDbDao.loadTenant()

  @deprecated("use loadSite() instead", "now")
  def loadTenant(): Tenant = siteDbDao.loadTenant()

  def createWebsite(name: Option[String], address: Option[String],
        embeddingSiteUrl: Option[String], ownerIp: String,
        ownerLoginId: String, ownerIdentity: Identity, ownerRole: User)
        : Option[(Tenant, User)] =
    siteDbDao.createWebsite(name = name, address = address,
      embeddingSiteUrl, ownerIp = ownerIp,
      ownerLoginId = ownerLoginId, ownerIdentity = ownerIdentity,
      ownerRole = ownerRole)

  def addTenantHost(host: TenantHost) = siteDbDao.addTenantHost(host)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup =
    siteDbDao.lookupOtherTenant(scheme, host)


  // ----- Pages

  def listChildPages(parentPageId: String, sortBy: PageSortOrder,
        limit: Int, offset: Int = 0, filterPageRole: Option[PageRole] = None)
        : Seq[PagePathAndMeta] =
    siteDbDao.listChildPages(
        parentPageId, sortBy, limit = limit, offset = offset, filterPageRole)

  /**
   * Loads articles (title + body) e.g. for inclusion on a blog post list page.
   */
  def loadPageBodiesTitles(pageIds: Seq[String]): Map[String, PageParts] =
    siteDbDao.loadPageBodiesTitles(pageIds)

  def loadPostsRecentlyActive(limit: Int): (Seq[Post], People) =
    siteDbDao.loadPostsRecentlyActive(limit, offset = 0)

  def loadRecentActionExcerpts(
        fromIp: Option[String] = None,
        byIdentity: Option[String] = None,
        pathRanges: PathRanges = PathRanges.Anywhere,
        limit: Int): (Seq[PostActionOld], People) =
    siteDbDao.loadRecentActionExcerpts(fromIp = fromIp,
      byIdentity = byIdentity, pathRanges = pathRanges, limit = limit)


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[String]): Future[FullTextSearchResult] =
    siteDbDao.fullTextSearch(phrase, anyRootPageId)


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        sortBy: PageSortOrder,
        limit: Int,
        offset: Int): Seq[PagePathAndMeta] =
    siteDbDao.listPagePaths(pageRanges, include, sortBy, limit, offset)


  // ----- Notifications

  def saveNotfs(notfs: Seq[NotfOfPageAction]) =
    siteDbDao.saveNotfs(notfs)

  def loadNotfsForRole(roleId: String): Seq[NotfOfPageAction] =
    siteDbDao.loadNotfsForRole(roleId)

  def loadNotfByEmailId(emailId: String): Option[NotfOfPageAction] =
    siteDbDao.loadNotfByEmailId(emailId)

  def skipEmailForNotfs(notfs: Seq[NotfOfPageAction], debug: String): Unit =
    siteDbDao.skipEmailForNotfs(notfs, debug)


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit =
    siteDbDao.saveUnsentEmail(email)

  def saveUnsentEmailConnectToNotfs(email: Email,
        notfs: Seq[NotfOfPageAction]): Unit =
    siteDbDao.saveUnsentEmailConnectToNotfs(email, notfs)

  def updateSentEmail(email: Email): Unit =
    siteDbDao.updateSentEmail(email)

  def loadEmailById(emailId: String): Option[Email] =
    siteDbDao.loadEmailById(emailId)

}

