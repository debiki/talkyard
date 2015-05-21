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
import play.api.Play.current
import scala.concurrent.Future



abstract class SiteDaoFactory {
  def newSiteDao(siteId: SiteId): SiteDao
}



object SiteDaoFactory {

  /** Creates a non-caching SiteDaoFactory.
    */
  def apply(dbDaoFactory: DbDaoFactory) = new SiteDaoFactory {
    private val _dbDaoFactory = dbDaoFactory

    def newSiteDao(siteId: SiteId): SiteDao = {
      val siteDbDao = _dbDaoFactory.newSiteDbDao(siteId)
      val serializingDbDao = new SerializingSiteDbDao(siteDbDao)
      new NonCachingSiteDao(serializingDbDao, _dbDaoFactory)
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
abstract class SiteDao
  extends AnyRef
  with AssetBundleDao
  with SettingsDao
  with SpecialContentDao
  with PagesDao
  with PagePathMetaDao
  with PageStuffDao
  with RenderedPageHtmlDao
  with PostsDao
  with UserDao
  with AuditDao {

  def siteDbDao: SiteDbDao
  def dbDao2: DbDao2

  def readWriteTransaction[R](fn: SiteTransaction => R, allowOverQuota: Boolean = false): R =
    dbDao2.readWriteSiteTransaction(siteId, allowOverQuota) { fn(_) }

  def readOnlyTransaction[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId) { fn(_) }


  // ----- Tenant

  def siteId = siteDbDao.siteId

  def loadSite(): Tenant = siteDbDao.loadTenant()

  @deprecated("use loadSite() instead", "now")
  def loadTenant(): Tenant = siteDbDao.loadTenant()

  def loadSiteStatus(): SiteStatus =
    siteDbDao.loadSiteStatus()

  def createSite(name: String, hostname: String,
        embeddingSiteUrl: Option[String], creatorIp: String,
        creatorEmailAddress: String) : Tenant = {
    val quotaLimitMegabytes = play.api.Play.configuration.getInt("debiki.newSite.quotaLimitMegabytes")
    siteDbDao.createSite(name = name, hostname = hostname,
      embeddingSiteUrl, creatorIp = creatorIp, creatorEmailAddress = creatorEmailAddress,
      quotaLimitMegabytes = quotaLimitMegabytes)
  }

  def updateSite(changedSite: Tenant) =
    siteDbDao.updateSite(changedSite)

  def addTenantHost(host: TenantHost) = siteDbDao.addTenantHost(host)

  def lookupOtherTenant(scheme: String, host: String): TenantLookup =
    siteDbDao.lookupOtherTenant(scheme, host)


  // ----- List pages

  def listChildPages(parentPageIds: Seq[PageId], orderOffset: PageOrderOffset,
        limit: Int, filterPageRole: Option[PageRole] = None)
        : Seq[PagePathAndMeta] =
    siteDbDao.listChildPages(parentPageIds, orderOffset, limit = limit, filterPageRole)


  /** Lists all topics below rootPageId. Currently intended for forums only.
    * Details: finds all categories with parent rootPageId, then all topics for
    * those categories, plus topics that are  direct children of rootPageId.
    * For now, allows one level of categories only (that is, no sub categories).
    */
  def listTopicsInTree(rootPageId: PageId, orderOffset: PageOrderOffset, limit: Int)
        : Seq[PagePathAndMeta] = {
    val childCategories = listChildPages(parentPageIds = Seq(rootPageId),
      PageOrderOffset.Any, limit = 999, filterPageRole = Some(PageRole.ForumCategory))
    val childCategoryIds = childCategories.map(_.id)
    val allCategoryIds = childCategoryIds :+ rootPageId
    val topics: Seq[PagePathAndMeta] = listChildPages(parentPageIds = allCategoryIds,
      orderOffset, limit = limit, filterPageRole = Some(PageRole.ForumTopic))
    topics
  }


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId]): Future[FullTextSearchResult] =
    siteDbDao.fullTextSearch(phrase, anyRootPageId)


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        orderOffset: PageOrderOffset,
        limit: Int): Seq[PagePathAndMeta] =
    siteDbDao.listPagePaths(pageRanges, include, orderOffset, limit)


  // ----- Notifications

  def saveDeleteNotifications(notifications: Notifications) =
    siteDbDao.saveDeleteNotifications(notifications)

  def loadNotificationsForRole(roleId: RoleId): Seq[Notification] =
    siteDbDao.loadNotificationsForRole(roleId)

  def updateNotificationSkipEmail(notifications: Seq[Notification]): Unit =
    siteDbDao.updateNotificationSkipEmail(notifications)


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit =
    siteDbDao.saveUnsentEmail(email)

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]): Unit =
    siteDbDao.saveUnsentEmailConnectToNotfs(email, notfs)

  def updateSentEmail(email: Email): Unit =
    siteDbDao.updateSentEmail(email)

  def loadEmailById(emailId: String): Option[Email] =
    siteDbDao.loadEmailById(emailId)

}



class NonCachingSiteDao(val siteDbDao: SiteDbDao, val dbDaoFactory: DbDaoFactory) extends SiteDao {
  def dbDao2 = dbDaoFactory.newDbDao2()
}
