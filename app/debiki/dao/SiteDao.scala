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
import play.{api => p}
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
      new NonCachingSiteDao(siteId, _dbDaoFactory)
    }
  }

}



/** A data access object for site specific data. Data could be loaded
  * from database, or fetched from some in-memory cache.
  *
  * Delegates most requests to SiteDbDao. However, hides some
  * SiteDbDao methods, because calling them directly would mess up
  * the cache in SiteDao's subclass CachingSiteDao.
  *
  * Don't use for more than one http request — it might cache things,
  * in private fields, and is perhaps not thread safe.
  */
abstract class SiteDao
  extends AnyRef
  with AssetBundleDao
  with SettingsDao
  with SpecialContentDao
  with ForumDao
  with CategoriesDao
  with PagesDao
  with PagePathMetaDao
  with PageStuffDao
  with RenderedPageHtmlDao
  with PostsDao
  with UploadsDao
  with UserDao
  with MessagesDao
  with ReviewsDao
  with AuditDao
  with CreateSiteDao {

  def dbDao2: DbDao2

  def commonmarkRenderer = ReactRenderer

  def readWriteTransaction[R](fn: SiteTransaction => R, allowOverQuota: Boolean = false): R =
    dbDao2.readWriteSiteTransaction(siteId, allowOverQuota) { fn(_) }

  def readOnlyTransaction[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = true) { fn(_) }

  def readOnlyTransactionNotSerializable[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = false) { fn(_) }


  // Later on I'll cache always, then these two will be implemented directy here.
  def refreshPageInAnyCache(pageId: PageId) {}
  def emptyCache() {}


  // ----- Tenant

  def siteId: SiteId

  def loadSite(): Site = readOnlyTransaction(_.loadTenant())

  @deprecated("use loadSite() instead", "now")
  def loadTenant(): Site = loadSite()

  def loadSiteStatus(): SiteStatus =
    readOnlyTransaction(_.loadSiteStatus())

  def updateSite(changedSite: Site) =
    readWriteTransaction(_.updateSite(changedSite))

  def addTenantHost(host: SiteHost) = {
    readWriteTransaction { transaction =>
      transaction.addSiteHost(host)
    }
  }

  def loadResourceUsage(): ResourceUse = {
    readWriteTransaction { transaction =>
      transaction.loadResourceUsage()
    }
  }


  // ----- Full text search

  def fullTextSearch(phrase: String, anyRootPageId: Option[PageId]): Future[FullTextSearchResult] =
    ??? // siteDbDao.fullTextSearch(phrase, anyRootPageId)

  /** Unindexes everything on some pages. Intended for test suites only.
    * Returns the number of *posts* that were unindexed.
    */
  def debugUnindexPosts(pageAndPostIds: PagePostNr*): Unit = {
    ???
  }


  // ----- List stuff

  def listPagePaths(
        pageRanges: PathRanges,
        include: List[PageStatus],
        orderOffset: PageOrderOffset,
        limit: Int): Seq[PagePathAndMeta] =
    readOnlyTransaction(_.listPagePaths(pageRanges, include, orderOffset, limit))


  // ----- Notifications

  def pubSub = Globals.pubSub

  def saveDeleteNotifications(notifications: Notifications) =
    readWriteTransaction(_.saveDeleteNotifications(notifications))

  def loadNotificationsForRole(roleId: RoleId, limit: Int, unseenFirst: Boolean)
        : Seq[Notification] =
    readOnlyTransaction(_.loadNotificationsForRole(roleId, limit, unseenFirst))

  def updateNotificationSkipEmail(notifications: Seq[Notification]): Unit =
    readWriteTransaction(_.updateNotificationSkipEmail(notifications))

  def markNotificationAsSeen(userId: UserId, notfId: NotificationId): Unit =
    readWriteTransaction(_.markNotfAsSeenSkipEmail(userId, notfId))


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit =
    readWriteTransaction(_.saveUnsentEmail(email))

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]): Unit =
    readWriteTransaction(_.saveUnsentEmailConnectToNotfs(email, notfs))

  def updateSentEmail(email: Email): Unit =
    readWriteTransaction(_.updateSentEmail(email))

  def loadEmailById(emailId: String): Option[Email] =
    readOnlyTransaction(_.loadEmailById(emailId))

}



class NonCachingSiteDao(val siteId: SiteId, val dbDaoFactory: DbDaoFactory) extends SiteDao {
  def dbDao2 = dbDaoFactory.newDbDao2()
}
