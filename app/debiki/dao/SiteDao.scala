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
import controllers.ViewPageController
import debiki._
import io.efdi.server.http._
import play.api.Play.current
import scala.collection.mutable
import scala.concurrent.Future
import SiteDao._



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
  with WatchbarDao
  with ReviewsDao
  with AuditDao
  with CreateSiteDao {

  def dbDao2: DbDao2

  def commonmarkRenderer = ReactRenderer

  def readWriteTransaction[R](fn: SiteTransaction => R, allowOverQuota: Boolean = false): R = {
    // Serialize writes per site. This avoids all? transaction rollbacks because of
    // serialization errors in Postgres (e.g. if 2 people post 2 comments at the same time).
    // Later: Send a message to a per-site actor instead which handles all writes for that site,
    // one at a time. Wait for a reply for at most ... 1? 5? (Right now we might block
    // forever though, bad bad bad.)
    SECURITY // this makes a DoS attack possible? By posting comments all the time, one can make
    // all threads block, waiting for the per-site lock. There's rate limiting stuff though
    // so doing this takes some effort.
    synchronizeOnSiteId(siteId) {
      dbDao2.readWriteSiteTransaction(siteId, allowOverQuota) {
        fn(_)
      }
    }
  }

  def readOnlyTransaction[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = true) { fn(_) }

  def readOnlyTransactionNotSerializable[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = false) { fn(_) }


  // Later on I'll cache always, then these two will be implemented directy here.
  def refreshPageInAnyCache(pageId: PageId) {}

  def refreshPagesInAnyCache(pageIds: Set[PageId]) {
    // Hmm can this be optimized? If using Redis, yes? By batching many changes in just 1 request?
    pageIds.foreach(refreshPageInAnyCache)
  }

  def emptyCache() {}


  // ----- Tenant

  def siteId: SiteId

  def loadSite(): Site = {
    var site = readOnlyTransaction(_.loadTenant())
    if (siteId == FirstSiteId && site.canonicalHost.isEmpty) {
      // No hostname specified in the database. Fallback to the config file.
      val hostname = Globals.firstSiteHostname.getOrDie(
        "EsE5GKU2", s"No ${Globals.FirstSiteHostnameConfigValue} specified")
      val canonicalHost = SiteHost(hostname, SiteHost.RoleCanonical)
      site = site.copy(hosts = canonicalHost :: site.hosts)
    }
    site
  }

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
  def strangerCounter = Globals.strangerCounter

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


  // ----- Authorization
  // (move to separate mixin, later?)

  def throwIfMayNotSeePost(post: Post, author: Option[User])(transaction: SiteTransaction) {
    val pageMeta = transaction.loadPageMeta(post.pageId) getOrElse
      throwIndistinguishableNotFound("EsE8YJK40")
    throwIfMayNotSeePage(pageMeta, author)(transaction)
    def isStaffOrAuthor = author.exists(_.isStaff) || author.exists(_.id == post.createdById)
    if (post.isDeleted && !isStaffOrAuthor)
      throwIndistinguishableNotFound("EsE8YK04W")
  }


  def throwIfMayNotSeePage(page: Page, user: Option[User])(transaction: SiteTransaction) {
    throwIfMayNotSeePage(page.meta, user)(transaction)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, user: Option[User])(transaction: SiteTransaction) {
    if (!user.exists(_.isStaff)) {
      val ancestors = pageMeta.categoryId match {
        case Some(id) =>
          throwIfMayNotSeeCategory(id, user)(transaction)
        case None =>
          // Deny access unless this is a private messages page.
          if (pageMeta.pageRole != PageRole.Message || user.isEmpty)
            throwIndistinguishableNotFound("EsE0YK25")

          val pageMembers = transaction.loadMessageMembers(pageMeta.pageId)
          if (!pageMembers.contains(user.getOrDie("EsE2WY50F3").id))
            throwIndistinguishableNotFound("EsE5GYK0V")
      }
    }
  }


  def throwIfMayNotSeeCategory(categoryId: CategoryId, user: Option[User])(
        transaction: SiteTransaction) {
    if (user.exists(_.isStaff))
      return

    val categories = transaction.loadCategoryPathRootLast(categoryId)
    if (categories.exists(_.staffOnly))
      throwIndistinguishableNotFound("EsE7YKG25")
  }


  def throwIfMayNotCreatePageIn(categoryId: CategoryId, user: Option[User])(
        transaction: SiteTransaction) {
    if (user.exists(_.isStaff))
      return

    val categories = transaction.loadCategoryPathRootLast(categoryId)
    if (categories.exists(_.staffOnly))
      throwIndistinguishableNotFound("EsE5PWX29")
    if (categories.exists(_.onlyStaffMayCreateTopics))
      throwForbidden2("EsE8YK3W2", "You may not start new topics in this category")
  }

  def throwIfMayNotPostTo(page: Page, author: User)(transaction: SiteTransaction) {
    throwIfMayNotSeePage(page, Some(author))(transaction)
    if (!page.role.canHaveReplies)
      throwForbidden2("EsE8YGK42", s"Cannot post to page type ${page.role}")
  }

}



class NonCachingSiteDao(val siteId: SiteId, val dbDaoFactory: DbDaoFactory) extends SiteDao {
  def dbDao2 = dbDaoFactory.newDbDao2()
}



object SiteDao {

  private val locksBySiteId = mutable.HashMap[SiteId, Object]()

  def synchronizeOnSiteId[R](siteId: SiteId)(block: => R): R = {
    val lock = locksBySiteId.getOrElseUpdate(siteId, new Object)
    lock.synchronized {
      block
    }
  }

}
