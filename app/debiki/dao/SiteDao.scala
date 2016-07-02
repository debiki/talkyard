/**
 * Copyright (c) 2012-2016 Kaj Magnus Lindberg
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
import ed.server.search.{PageAndHits, SearchHit, SearchEngine}
import io.efdi.server.http._
import org.{elasticsearch => es}
import play.api.Play.current
import redis.RedisClient
import scala.collection.mutable
import scala.concurrent.Future
import SiteDao._



class SiteDaoFactory (
  private val _dbDaoFactory: DbDaoFactory,
  private val redisClient: RedisClient,
  private val cache: DaoMemCache,
  private val usersOnlineCache: UsersOnlineCache,
  private val elasticSearchClient: es.client.Client,
  private val config: Config) {

  def newSiteDao(siteId: SiteId): SiteDao = {
    new SiteDao(siteId, _dbDaoFactory, redisClient, cache, usersOnlineCache, elasticSearchClient,
      config)
  }

}



/** A data access object for site specific data. Data could be loaded
  * from database, or fetched from some in-memory cache.
  *
  * Don't use for more than one http request — it might cache things,
  * in private fields, and is perhaps not thread safe.
  */
class SiteDao(
  val siteId: SiteId,
  private val dbDaoFactory: DbDaoFactory,
  private val redisClient: RedisClient,
  private val cache: DaoMemCache,
  val usersOnlineCache: UsersOnlineCache,
  private val elasticSearchClient: es.client.Client,
  val config: Config)
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
  with SearchDao
  with UploadsDao
  with UserDao
  with MessagesDao
  with WatchbarDao
  with ReviewsDao
  with AuditDao
  with CreateSiteDao {

  protected lazy val memCache = new MemCache(siteId, cache)
  protected lazy val redisCache = new RedisCache(siteId, redisClient)
  protected lazy val searchEngine = new SearchEngine(siteId, elasticSearchClient)


  def memCache_test = {
    require(Globals.wasTest, "EsE7YKP42B")
    memCache
  }


  def dbDao2 = dbDaoFactory.newDbDao2()

  def commonmarkRenderer = ReactRenderer


  memCache.onUserCreated { user =>
    if (loadSiteStatus().isInstanceOf[SiteStatus.OwnerCreationPending] && user.isOwner) {
      uncacheSiteStatus()
    }
  }

  memCache.onPageCreated { page =>
    if (loadSiteStatus() == SiteStatus.ContentCreationPending) {
      uncacheSiteStatus()
    }
  }

  private def uncacheSiteStatus() {
    memCache.remove(siteStatusKey)
  }

  private def siteStatusKey = MemCacheKey(this.siteId, "|SiteId")


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


  def refreshPageInMemCache(pageId: PageId) {
    memCache.firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }

  def refreshPagesInAnyCache(pageIds: Set[PageId]) {
    pageIds.foreach(refreshPageInMemCache)
  }

  def emptyCache() {
    readWriteTransaction(_.bumpSiteVersion())
    memCache.clearSingleSite(siteId)
  }


  def emptyCacheImpl(transaction: SiteTransaction) {
    transaction.bumpSiteVersion()
    memCache.clearSingleSite(siteId)
  }


  def removeFromMemCache(key: MemCacheKey) {
    memCache.remove(key)
  }



  // ----- Tenant

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

  def loadSiteStatus(): SiteStatus = {
    memCache.lookup(
      siteStatusKey,
      orCacheAndReturn = Some(readOnlyTransaction(_.loadSiteStatus()))) getOrDie "DwE5CB50"
  }


  def updateSite(changedSite: Site) = {
    readWriteTransaction(_.updateSite(changedSite))
    uncacheSiteStatus()
  }


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



object SiteDao {

  private val locksBySiteId = mutable.HashMap[SiteId, Object]()

  def synchronizeOnSiteId[R](siteId: SiteId)(block: => R): R = {
    val lock = locksBySiteId.getOrElseUpdate(siteId, new Object)
    lock.synchronized {
      block
    }
  }

}
