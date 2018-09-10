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
import debiki.EdHttp._
import ed.server.search.SearchEngine
import org.{elasticsearch => es}
import redis.RedisClient
import scala.collection.immutable
import scala.collection.mutable
import SiteDao._
import ed.server.EdContext
import ed.server.auth.MayMaybe
import ed.server.notf.NotificationGenerator
import ed.server.pop.PagePopularityDao
import ed.server.pubsub.{PubSubApi, StrangerCounterApi}
import ed.server.summaryemails.SummaryEmailsDao
import talkyard.server.PostRenderer



class SiteDaoFactory (
  private val context: EdContext,
  private val _dbDaoFactory: DbDaoFactory,
  private val redisClient: RedisClient,
  private val cache: DaoMemCache,
  private val usersOnlineCache: UsersOnlineCache,
  private val elasticSearchClient: es.client.Client,
  private val config: Config) {

  def newSiteDao(siteId: SiteId): SiteDao = {
    new SiteDao(siteId, context, _dbDaoFactory, redisClient, cache, usersOnlineCache,
      elasticSearchClient, config)
  }

}



/** A data access object for site specific data. Data could be loaded
  * from database, or fetched from some in-memory cache.
  *
  * Don't use for more than one http request — it might cache things,
  * in private fields, and is perhaps not thread safe.
  *
  * Naming convention: dao.getWhatever() when a cache (in-process or Redis) is used.
  * But dao.loadWhatever() when no cache is used, the db is always accessed.
  * And dao.theWhatever(), when the cache is used, and the Whatever must exist otherwise
  * a runtime exception will be thrown.
  * And dao.loadTheWhatever() when the cache is not used, and the whatever must exist.
  * COULD REFACTOR RENAME according to above naming convention.
  */
class SiteDao(
  val siteId: SiteId,
  val context: EdContext,
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
  with ed.server.auth.AuthzSiteDaoMixin
  with ForumDao
  with CategoriesDao
  with PagesDao
  with PagePathMetaDao
  with PageStuffDao
  with PagePopularityDao
  with RenderedPageHtmlDao
  with PostsDao
  with TagsDao
  with SearchDao
  with ed.server.spam.QuickSpamCheckDao
  with UploadsDao
  with UserDao
  with MessagesDao
  with WatchbarDao
  with ReviewsDao
  with SummaryEmailsDao
  with FeedsDao
  with AuditDao {

  protected lazy val memCache = new MemCache(siteId, cache, globals.mostMetrics)
  lazy val redisCache = new RedisCache(siteId, redisClient, context.globals.now)
  protected lazy val searchEngine = new SearchEngine(siteId, elasticSearchClient)

  def globals: debiki.Globals = context.globals
  def jsonMaker = new JsonMaker(this)
  def textAndHtmlMaker = new TextAndHtmlMaker(this.thePubSiteId(), context.nashorn)
  def notfGenerator(tx: SiteTransaction) = NotificationGenerator(tx, context.nashorn, globals.config)

  import context.security.throwIndistinguishableNotFound

  def memCache_test: MemCache = {
    require(globals.isOrWasTest, "EsE7YKP42B")
    memCache
  }


  private def dbDao2: DbDao2 = dbDaoFactory.newDbDao2()


  memCache.onUserCreated { user =>
    if (theSite().status == SiteStatus.NoAdmin) {
      dieIf(!user.isOwner, "EsE6YK20")
      dieIf(!user.isAdmin, "EsE2KU80")
      uncacheSiteFromMemCache()
    }
  }

  private def uncacheSiteFromMemCache() {
    val thisSite = memCache.lookup[Site](thisSiteCacheKey)
    memCache.remove(thisSiteCacheKey)
    thisSite.foreach(SystemDao.removeCanonicalHostCacheEntries(_, memCache))
  }

  private def thisSiteCacheKey = siteCacheKey(this.siteId)


  // Rename to ...NoRetry, add readWriteTransactionWithRetry
  def readWriteTransaction[R](fn: SiteTransaction => R, allowOverQuota: Boolean = false): R = {
    // Serialize writes per site. This avoids all? transaction rollbacks because of
    // serialization errors in Postgres (e.g. if 2 people post 2 comments at the same time).
    // Later: Send a message to a per-site actor instead which handles all writes for that site,
    // one at a time. Wait for a reply for at most ... 1? 5? (Right now we might block
    // forever though, bad bad bad.)
    SECURITY // this makes a DoS attack possible? By posting comments all the time, one can make
    // all threads block, waiting for the per-site lock. There's rate limiting stuff though
    // so doing this takes some effort.
    DB_CONFICT // ? there're other ways to create per-site Dao:s too: by starting with a SystemDao.
    synchronizeOnSiteId(siteId) {
      dbDao2.readWriteSiteTransaction(siteId, allowOverQuota) {
        fn(_)
      }
      // If serialization error, try once? twice? again?
    }
  }

  def readOnlyTransaction[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = true) { fn(_) }

  def readOnlyTransactionNotSerializable[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = false) { fn(_) }


  def refreshPageInMemCache(pageId: PageId) {
    memCache.firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }

  def refreshPagesInAnyCache(pageIds: collection.Set[PageId]) {
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


  def dieOrThrowNoUnless(mayMaybe: MayMaybe, errorCode: String) {
    COULD // avoid logging harmless internal error, see comment below,
    // by checking Globals.now() - this-dao.createdAt and doing throwForbidden() not die().
    // Later, check if current time minus request start time is small, then just
    // throw 403 Forbidden (instead of die()) because then the permission error is probably
    // becaues of a harmless race condition (namely an admin changed permissions just after
    // a perm check at the start of a request was done, but before the perm check inside
    // a transaction was done, resulting in first "you may, yes" and then "no you may not").
    // But for now, always die:
    import MayMaybe._
    mayMaybe match {
      case Yes => // fine
      case NoNotFound(debugCode) => throwIndistinguishableNotFound(s"$errorCode-$debugCode")
      case mayNot: NoMayNot => die(errorCode, s"${mayNot.reason} [${mayNot.code}]")
    }
  }


  // ----- Site

  def theSite(): Site = getSite().getOrDie("DwE5CB50", s"Site $siteId not found")

  def thePubSiteId(): PublSiteId =
    theSite().pubId

  /** Uses the hostname, if no name available. Well currently always uses the hostname.
    */
  def theSiteName(): String = theSiteNameAndOrigin()._1

  def theSiteOrigin(): String = theSiteNameAndOrigin()._2

  def theSiteNameAndOrigin(): (String, String) = {
    val site = theSite()
    val anyHostname = site.canonicalHost.map(_.hostname)
    val anyOrigin = anyHostname.map(globals.schemeColonSlashSlash + _ + globals.colonPort)
    val siteNameOrHostname = anyHostname getOrElse site.name
    val origin = anyOrigin getOrElse globals.siteByIdOrigin(siteId)
    (siteNameOrHostname, origin)
  }

  def getSite(): Option[Site] = {
    memCache.lookup(
      thisSiteCacheKey,
      orCacheAndReturn = loadSiteNoCache())
  }

  private def loadSiteNoCache(): Option[Site] = {
    readOnlyTransaction(_.loadSite()) map { site =>
      maybeCopyWithDefaultHostname(site, globals)
    }
  }

  private def loadOrigins(): Set[String] = {
    val site = loadSiteNoCache() getOrElse {
      return  Set.empty
    }
    site.hosts.map(host => {
      globals.schemeColonSlashSlash + host.hostname + globals.colonPort
    }) toSet
  }

  def ensureSiteActiveOrThrow(newMember: MemberInclDetails, transaction: SiteTransaction) {
    // The throwForbidden exceptions can be triggered for example if someone starts signing up,
    // then the site gets deleted, and then the person clicks the submit button in
    // the signup form. (I.e. a race condition, and that's fine.)
    val site = transaction.loadSite().getOrDie("EsE5YKW0", s"Site gone: ${transaction.siteId}")
    site.status match {
      case SiteStatus.NoAdmin =>
        // We're creating an admin, therefore the site should now be activated.
        dieIf(!newMember.isOwner, "EsE5KYF0", "Trying to create a non-owner for a NoAdmin site")
        dieIf(!newMember.isAdmin, "EsE7RU82", "Trying to create a non-admin for a NoAdmin site")
        transaction.updateSite(
          site.copy(status = SiteStatus.Active))
        BUG; RACE // if reloaded before transaction committed, old state will be reinserted
        // into the cache. Have the caller call uncacheSite() instead? But how ensure it'll
        // remember to do that??
        uncacheSiteFromMemCache()
      case SiteStatus.Active =>
        // Fine.
      case SiteStatus.ReadAndCleanOnly =>
        if (!newMember.isStaff)
          throwForbidden("EsE3KUG54", o"""Trying to create a non-staff user for
              a ${site.status} site""")
      case SiteStatus.HiddenUnlessAdmin =>
        if (!newMember.isAdmin)
          throwForbidden("EsE9YK24S", o"""Trying to create a non-admin user for
              a ${site.status} site""")
      case _ =>
        dieUnless(site.status.isDeleted, "EsE4FEI29")
        throwForbidden("EsE5KUFW2", "This site has been deleted. Cannot add new users.")
    }
  }

  def listHostnames(): Seq[SiteHostInclDetails] = {
    readOnlyTransaction(_.loadHostsInclDetails())
  }

  def changeSiteHostname(newHostname: String) {
    readWriteTransaction { tx =>
      val hostsNewestFirst = tx.loadHostsInclDetails().sortBy(-_.addedAt.millis)
      if (hostsNewestFirst.length > SoftMaxOldHostnames) {
        val hostNr2 = hostsNewestFirst(1)
        if (globals.now().daysSince(hostNr2.addedAt) < WaitUntilAnotherHostnameInterval) {
          throwForbidden("EdE3KYP2", "You've changed hostname too many times and too often")
        }
      }
      tx.changeCanonicalHostRoleToExtra()
      hostsNewestFirst.find(_.hostname == newHostname) match {
        case Some(oldSiteHost: SiteHostInclDetails) =>
          // We're changing back to one of our old hostnames.
          val hostAsCanonical = oldSiteHost.copy(role = SiteHost.RoleCanonical)
          tx.updateHost(hostAsCanonical.noDetails)
        case None =>
          // This is a new hostname.
          try tx.insertSiteHost(SiteHost(newHostname, SiteHost.RoleCanonical))
          catch {
            case _: DuplicateHostnameException =>
              throwForbidden("TyE7FKW20", s"There's already a site with hostname '$newHostname'")
          }
      }
    }
    uncacheSiteFromMemCache()
  }

  def changeExtraHostsRole(newRole: SiteHost.Role) {
    readWriteTransaction { transaction =>
      transaction.changeExtraHostsRole(newRole)
      uncacheSiteFromMemCache()
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

  def pubSub: PubSubApi = globals.pubSub
  def strangerCounter: StrangerCounterApi = globals.strangerCounter

  def saveDeleteNotifications(notifications: Notifications) {
    readWriteTransaction(_.saveDeleteNotifications(notifications))
  }

  def loadNotificationsForRole(roleId: RoleId, limit: Int, unseenFirst: Boolean)
        : Seq[Notification] =
    readOnlyTransaction(_.loadNotificationsForRole(roleId, limit, unseenFirst))

  def updateNotificationSkipEmail(notifications: Seq[Notification]): Unit =
    readWriteTransaction(_.updateNotificationSkipEmail(notifications))

  def markNotificationAsSeen(userId: UserId, notfId: NotificationId): Unit =
    readWriteTransaction(_.markNotfAsSeenSkipEmail(userId, notfId))


  // ----- API secrets

  def listApiSecrets(limit: Int): immutable.Seq[ApiSecret] = {
    readOnlyTransaction(_.listApiSecretsRecentlyCreatedFirst(limit))
  }

  def createApiSecret(forUserId: Option[UserId]): ApiSecret = {
    require(forUserId.isEmpty, "TyE4AKBR02") // for now
    val now = globals.now()

    // If more than two *sysbot* secrets get greated per day, something weird is going on.
    val recentSecrets = listApiSecrets(limit = 100).takeWhile(s => now.daysSince(s.createdAt) < 20)
    throwForbiddenIf(recentSecrets.length > 40, "TyE5PKR2Q", "You're creating secrets too fast")

    val value = nextRandomString()
    readWriteTransaction { tx =>
      val nr = tx.nextApiSecretNr()
      val secret = ApiSecret(nr, userId = forUserId, createdAt = now,
        deletedAt = None, isDeleted = false, secretValue = value)
      tx.insertApiSecret(secret)
      secret
    }
  }

  def deleteApiSecrets(secretNrs: immutable.Seq[ApiSecretNr]) {
    val now = globals.now()
    readWriteTransaction(tx => secretNrs.foreach(tx.setApiSecretDeleted(_, now)))
  }

  def getApiSecret(secretValue: String): Option[ApiSecret] = {
    readOnlyTransaction(_.loadApiSecretBySecretValue(secretValue))
  }


  // ----- Emails

  def saveUnsentEmail(email: Email): Unit =
    readWriteTransaction(_.saveUnsentEmail(email))

  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]): Unit =
    readWriteTransaction(_.saveUnsentEmailConnectToNotfs(email, notfs))

  def updateSentEmail(email: Email) {
    readWriteTransaction { transaction =>
      transaction.updateSentEmail(email)
      if (email.failureText.isEmpty) {
        email.toUserId foreach { userId =>
          addUserStats(UserStats(
            userId, lastEmailedAt = When.fromOptDate(email.sentOn)))(transaction)
        }
      }
    }
  }

  def loadEmailById(emailId: String): Option[Email] =
    readOnlyTransaction(_.loadEmailById(emailId))

}



object SiteDao {

  private val SoftMaxOldHostnames = 5
  private val WaitUntilAnotherHostnameInterval = 60

  private val locksBySiteId = mutable.HashMap[SiteId, Object]()

  def siteCacheKey(siteId: SiteId) = MemCacheKey(siteId, "|SiteId")

  def synchronizeOnSiteId[R](siteId: SiteId)(block: => R): R = {
    val lock = locksBySiteId.getOrElseUpdate(siteId, new Object)
    lock.synchronized {
      block
    }
  }


  /** When accessing the default site, the hostname might have been specified
    * in the config file only, that is, globals.defaultSiteHostname.
    */
  def maybeCopyWithDefaultHostname(site: Site, globals: debiki.Globals): Site = {
    if (site.canonicalHost.nonEmpty)
      return site

    // If no canonical host, use site-NNN.base-domain.com:
    // (This can happen for the very first site, with id 1, if it gets accessed after
    // talkyard.defaultSiteId has been set to != 1.)
    if (site.id != globals.defaultSiteId) {
      val hostname = globals.siteByIdHostname(site.id)
      return site.copy(hosts = SiteHost(hostname, SiteHost.RoleCanonical) :: site.hosts)
    }

    val defaultHostname = globals.defaultSiteHostname.getOrDie(
      "TyE5GKU2S7", s"No ${Globals.DefaultSiteHostnameConfValName} specified")
    val canonicalHost = SiteHost(defaultHostname, SiteHost.RoleCanonical)
    site.copy(hosts = canonicalHost :: site.hosts)
  }

}
