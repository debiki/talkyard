/**
 * Copyright (c) 2012-2020 Kaj Magnus Lindberg
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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import talkyard.server.search.SearchEngine
import org.{elasticsearch => es}
import redis.RedisClient
import talkyard.server.dao._
import talkyard.server.{PostRendererSettings, TyLogging}
import scala.collection.{immutable => imm}
import scala.collection.immutable
import talkyard.server.TyContext
import talkyard.server.authz.MayMaybe
import talkyard.server.notf.NotificationGenerator
import talkyard.server.parser
import talkyard.server.pop.PagePopularityDao
import talkyard.server.pubsub.{PubSubApi, StrangerCounterApi}
import talkyard.server.summaryemails.SummaryEmailsDao
import play.api.libs.json.JsObject
import org.scalactic.{ErrorMessage, Or}
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import org.scalactic.{Good, Or, Bad}


/** If the Dao should use the mem cache, or load things from the database.
  * It's more clear what this means than just Opt[SiteTx]?
  */
sealed abstract class CacheOrTx {
  def anyTx: Opt[SiteTx]
  // def staleStuff: Opt[StaleStuff]  // later
}

object CacheOrTx {
}

case class UseTx(tx: SiteTx) extends CacheOrTx { def anyTx: Opt[SiteTx] = Some(tx) }
case class UseCache(dao: SiteDao) extends CacheOrTx { def anyTx: Opt[SiteTx] = None}



class SiteDaoFactory (
  private val context: TyContext,
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


trait ReadOnlySiteDao {
  def getCatsBySlugs(catNames: Iterable[St]): imm.Seq[Opt[Cat]]
  def getCategoryByRef(ref: Ref): Option[Category] Or ErrorMessage  // repl w ParsedRef?
  def getCategoryByParsedRef(parsedRef: ParsedRef): Option[Category]
  def getTagTypesByNamesOrSlugs(catNames: Iterable[St]): imm.Seq[Opt[TagType]]
  def getPageMetaByParsedRef(parsedRef: ParsedRef): Option[PageMeta]
  def getPageMetaByExtId(extId: ExtId): Option[PageMeta]
  def getMembersByUsernames(usernames: Iterable[Username]): imm.Seq[Opt[Member]]
  def getParticipantByRef(ref: Ref): Option[Participant] Or ErrorMessage  // remove?
  def getParticipantByParsedRef(ref: ParsedRef): Option[Participant]
  def loadPostByPageIdNr(pageId: PageId, postNr: PostNr): Option[Post]
  def getPagePath2(pageId: PageId): Option[PagePathWithId]

  def now(): When

  def nashorn: Nashorn
  @deprecated // can create new tx
  def textAndHtmlMaker: TextAndHtmlMaker
  def makePostRenderSettings(pageType: PageType): PostRendererSettings
}


class TestReadOnlySiteDao extends ReadOnlySiteDao {
  def unim() = unimpl("For tests, not impl")
  def getCatsBySlugs(catNames: Iterable[St]): imm.Seq[Opt[Cat]] = unim()
  def getCategoryByRef(ref: Ref): Option[Category] Or ErrorMessage = unim()
  def getCategoryByParsedRef(parsedRef: ParsedRef): Option[Category] = unim()
  def getTagTypesByNamesOrSlugs(catNames: Iterable[St]): imm.Seq[Opt[TagType]] = unim()
  def getPageMetaByParsedRef(parsedRef: ParsedRef): Option[PageMeta] = unim()
  def getPageMetaByExtId(extId: ExtId): Option[PageMeta] = unim()
  def getMembersByUsernames(usernames: Iterable[Username]): imm.Seq[Opt[Member]] = unim()
  def getParticipantByRef(ref: Ref): Option[Participant] Or ErrorMessage = unim()
  def getParticipantByParsedRef(ref: ParsedRef): Option[Participant] = unim()
  def loadPostByPageIdNr(pageId: PageId, postNr: PostNr): Option[Post] = unim()
  def getPagePath2(pageId: PageId): Option[PagePathWithId] = unim()
  def now(): When = unim()
  def nashorn: Nashorn = unim()
  def textAndHtmlMaker: TextAndHtmlMaker = unim()
  def makePostRenderSettings(pageType: PageType): PostRendererSettings = unim()
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
  val context: TyContext,
  private val dbDaoFactory: DbDaoFactory,
  private val redisClient: RedisClient,
  private val cache: DaoMemCache,
  val usersOnlineCache: UsersOnlineCache,
  private val elasticSearchClient: es.client.Client,
  val config: Config)
  extends AnyRef
  with TyLogging
  with ReadOnlySiteDao
  with AssetBundleDao
  with SettingsDao
  with SpecialContentDao
  with talkyard.server.authz.AuthzSiteDaoMixin
  with talkyard.server.authn.AuthnSiteDaoMixin
  with talkyard.server.sess.SessionSiteDaoMixin
  with ForumDao
  with CategoriesDao
  with PagesDao
  with PagePathMetaDao
  with PageLinksDao
  with PageStuffDao
  with PagePopularityDao
  with RenderedPageHtmlDao
  with PostsDao
  with TagsDao
  with SearchDao
  with talkyard.server.spam.QuickSpamCheckDao
  with UploadsDao
  with UserDao
  with MessagesDao
  with WatchbarDao
  with ReviewsDao
  with SummaryEmailsDao
  with FeedsDao
  with AuditDao
  with talkyard.server.events.WebhooksSiteDaoMixin {

  import SiteDao._

  // Could be protected instead? Then need to move parts of ApiV0Controller to inside the Dao.
  // Need more caches? E.g. one that expires keys after 1 hour, say [mem_cache_exp_secs].
  lazy val memCache = new MemCache(siteId, cache, globals.mostMetrics)

  lazy val redisCache = new RedisCache(siteId, redisClient, context.globals.now _)

  protected lazy val searchEngine = new SearchEngine(siteId, elasticSearchClient,
        ffIxMapping2 = theSite().isFeatureEnabled("ffIxMapping2", globals.config.featureFlags))

  def readOnly: ReadOnlySiteDao = this.asInstanceOf[ReadOnlySiteDao]

  def copyWithNewSiteId(siteId: SiteId): SiteDao =
    new SiteDao(
          siteId = siteId, context, dbDaoFactory, redisClient, cache,
          usersOnlineCache, elasticSearchClient, config)

  def globals: debiki.Globals = context.globals
  def jsonMaker = new JsonMaker(this)

  def now(): When = globals.now()
  def nashorn: Nashorn = context.nashorn

  REFACTOR // rename to anyPageDao and return a Some(PageDao) with PageMeta pre-loaded
  // if the page exist, otherwise None? — If callers "always" want a PageMeta.
  COULD_OPTIMIZE // get loadWholeSiteSettings(tx) from cache too?
  def newPageDao(pageId: PageId, tx: SiteTransaction,
          whichPosts: WhichPostsOnPage = WhichPostsOnPage.OnlyPublic(activeOnly = false),
          useMemCache: Bo = false)
          : PageDao =
    PageDao(pageId, loadWholeSiteSettings(tx),
          tx, if (useMemCache) Some(this) else None, whichPosts)

  REFACTOR // Change textAndHtmlMaker to maketextAndHtmlMaker(pageType: PageType)  Edit: Also incl page id  [ln_pv_az]
  // which automatically knows the right embeddedOriginOrEmpty etc,
  // so won't need to always use makePostRenderSettings() below before
  // using textAndHtmlMaker?
  @deprecated // might create a new tx
  def textAndHtmlMaker = new TextAndHtmlMaker(theSite(), context.nashorn)
  def textAndHtmlMakerNoTx(site: Site) = new TextAndHtmlMaker(site, context.nashorn)

  def makePostRenderSettings(pageType: PageType): PostRendererSettings = {
    val settings = this.getWholeSiteSettings()
    val embeddedOriginOrEmpty =
          if (pageType == PageType.EmbeddedComments) theSiteOrigin()
          else ""
    PostRendererSettings(
          embeddedOriginOrEmpty = embeddedOriginOrEmpty,
          pageRole = pageType,
          siteId = siteId,
          thePubSiteId(),
          relFollowTo = settings.relFollowTo)
  }


  def notfGenerator(tx: SiteTransaction) =
    NotificationGenerator(tx, this, context.nashorn, globals.config)


  def getMaxLimits(cacheOrTx: CacheOrTx): MaxLimits = {
    val site = cacheOrTx.anyTx.flatMap(_.loadSite()) getOrElse getSite().getOrDie(
          "TyE60MSEH257")
    MaxLimits.Default.multByMultipliers(site)
  }


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

  RENAME // to uncacheSiteEntryFromMemCache? So it's clear that it's not all
  // site contents get uncached?
  def uncacheSiteFromMemCache(): U = {
    val thisSite = memCache.lookup[Site](thisSiteCacheKey)
    memCache.remove(thisSiteCacheKey)
    thisSite.foreach(SystemDao.removeCanonicalHostCacheEntries(_, memCache))
  }

  private def thisSiteCacheKey = siteCacheKey(this.siteId)


  def writeTxTryReuse[R](anyTx: Option[(SiteTx, StaleStuff)])(
          fn: (SiteTx, StaleStuff) => R): R =
    anyTx match {
      case Some((tx, staleStuff)) => fn(tx, staleStuff)
      case None => writeTx(fn)
    }


  def writeTx[R](fn: (SiteTx, StaleStuff) => R): R = {
    writeTx()(fn)
  }


  def writeTx[R](retry: Bo = false, allowOverQuota: Bo = false)(
          // maybe incl  lims = getMaxLimits(UseTx(tx))  too? Always needed, right?
          // And a class  TxCtx(tx, maxLimits, rateLimits, staleStuff) ?
          fn: (SiteTransaction, StaleStuff) => R): R = {
    dieIf(retry, "TyE403KSDH46", "writeTx(retry = true) not yet impl")

    val staleStuff = new StaleStuff()

    val runFnUpdStaleStuff = (tx: SiteTx) => {
      val result = fn(tx, staleStuff)


      // ----- Refresh database cache

      staleStuff.clearStaleStuffInDatabase(tx)

      // [cache_race_counter] Maybe bump mem cache contents counter here,
      // just before this tx ends and the mem cache thus becomes stale?
      // Set it to an odd value — an anything read from the cache,
      // when the counter was odd, must not be cached.

      result
    }

    val result: R =
          readWriteTransaction(runFnUpdStaleStuff, allowOverQuota)


    // ----- Refresh in-memory cache   [rm_cache_listeners]

    staleStuff.clearStaleStuffInMemory(this)


    // [cache_race_counter] Maybe somehow "mark as done" the bumping of the
    // mem cache contents counter?
    // Set it to an even value — mem cache ok to use again.

    result
  }


  @deprecated("now", "use writeTx { (tx, staleStuff) => ... } instead")
  def readWriteTransaction[R](fn: SiteTransaction => R, allowOverQuota: Boolean = false): R = {
    // Serialize writes per site. This reduces transaction rollbacks because of
    // serialization errors in Postgres (e.g. if 2 people post 2 comments at the same time).

    DB_CONFICT // ? there're other ways to create per-site Dao:s too: by starting with a SystemDao.
    withSiteWriteLock(siteId) {
      dbDao2.readWriteSiteTransaction(siteId, allowOverQuota) {
        fn(_)
      }
    }
  }

  RENAME // to just readTx
  def readOnlyTransaction[R](fn: SiteTransaction => R): R =
    readTx(fn)

  def readTx[R](fn: SiteTx => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = true) { fn(_) }

  def readOnlyTransactionTryReuse[R](anyTx: Option[SiteTransaction])(fn: SiteTransaction => R): R =
    readTxTryReuse(anyTx)(fn)

  def readTxTryReuse[R](anyTx: Opt[SiteTx])(fn: SiteTx => R): R =
    anyTx match {
      case Some(tx) => fn(tx)
      case None => readOnlyTransaction(fn)
    }

  def readOnlyTransactionNotSerializable[R](fn: SiteTransaction => R): R =
    dbDao2.readOnlySiteTransaction(siteId, mustBeSerializable = false) { fn(_) }


  def refreshPageInMemCache(pageId: PageId): Unit = {
    // Old approach:
    memCache.firePageSaved(SitePageId(siteId = siteId, pageId = pageId))

    // But this won't uncache links? In case needed. Currently, though, never
    // happens that a page needs to be updated & uncached at the same time as
    // other pages linking to it got changed / links remvoed/added.
    // [sleeping_links_bug]

    // New:  [rm_cache_listeners]
  }

  def refreshPagesInMemCache(pageIds: collection.Set[PageId]): U = {
    pageIds.foreach(refreshPageInMemCache)
  }

  def clearDatabaseCacheAndMemCache(anyTx: Opt[(SiteTx, StaleStuff)] = None): U = {
    writeTxTryReuse(anyTx)((tx, _) => tx.bumpSiteVersion())
    memCache.clearThisSite()
  }

  def emptyCacheImpl(transaction: SiteTransaction): Unit = {  BUG; RACE; // if mem cache refilled before tx ends
    transaction.bumpSiteVersion()
    memCache.clearThisSite()
  }


  def removeFromMemCache(key: MemCacheKey): Unit = {
    memCache.remove(key)
  }


  def dieOrThrowNoUnless(mayMaybe: MayMaybe, errorCode: String): Unit = {
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

  COULD // return a struct, maybe add more fields to SiteIdOrigins?
  def theSiteOriginHostname(tx: SiteTx): (Site, String, String) = {
    val site = tx.loadSite() getOrDie "TyENOSITEINTX"
    val siteOrigin = globals.theOriginOf(site)
    val siteHostname = globals.theHostnameOf(site)
    (site, siteOrigin, siteHostname)
  }

  def theSite(): Site = getSite().getOrDie("DwE5CB50", s"Site $siteId not found")

  def theSiteInclDetails(): SiteInclDetails = {
    globals.systemDao.loadSiteInclDetailsById(siteId).getOrDie(
          "TyE592KTD", s"Site $siteId not found")
  }

  def thePubSiteId(): PubSiteId =
    theSite().pubId

  /** Uses the hostname, if no name available. Well currently always uses the hostname.
    */
  def theSiteName(): String = theSiteNameAndOrigin()._1

  def theSiteOrigin(): String = theSiteNameAndOrigin()._2

  def theSiteIdsOrigins(): SiteIdOrigins = {
    val site = theSite()
    val (_, siteOrigin) = theSiteNameAndOriginImpl(site)
    val uploadsOrigin = globals.anyUgcOrCdnOriginFor(site) getOrElse siteOrigin
    SiteIdOrigins(
      siteId = site.id,
      pubId = site.pubId,
      siteOrigin = siteOrigin,
      uploadsOrigin = uploadsOrigin)
  }

  def theSiteNameAndOrigin(): (String, String) = {
    theSiteNameAndOriginImpl(theSite())
  }

  private def theSiteNameAndOriginImpl(site: Site): (String, String) = {
    val anyHostname = site.canonicalHostname.map(_.hostname)
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
    site.hostnames.map(host => {
      globals.schemeColonSlashSlash + host.hostname + globals.colonPort
    }) toSet
  }

  def ensureSiteActiveOrThrow(newMember: UserInclDetails, transaction: SiteTransaction): Unit = {
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

  def listHostnames(): Seq[HostnameInclDetails] = {
    readOnlyTransaction(_.loadHostsInclDetails())
  }

  def changeSiteHostname(newHostname: String): Unit = {
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
        case Some(oldSiteHost: HostnameInclDetails) =>
          // We're changing back to one of our old hostnames.
          val hostAsCanonical = oldSiteHost.copy(role = Hostname.RoleCanonical)
          tx.updateHost(hostAsCanonical.noDetails)
        case None =>
          // This is a new hostname.
          try tx.insertSiteHost(Hostname(newHostname, Hostname.RoleCanonical))
          catch {
            case _: DuplicateHostnameException =>
              throwForbidden("TyE7FKW20", s"There's already a site with hostname '$newHostname'")
          }
      }
    }
    uncacheSiteFromMemCache()
  }


  def changeExtraHostsRole(newRole: Hostname.Role): Unit = {
    readWriteTransaction { tx =>
      tx.changeExtraHostsRole(newRole)
      uncacheSiteFromMemCache()
    }
  }


  def loadResourceUsage(): ResourceUse = {
    readOnlyTransaction { tx =>
      tx.loadResourceUsage()
    }
  }


  def addAdminNotice(noticeId: NoticeId): U = {
    writeTx { (tx, _) =>
      tx.addAdminNotice(noticeId)
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

  def loadNotificationByEmailId(emailId: EmailOutId): Opt[Notf] = {
    readTx(_.loadNotificationByEmailId(emailId))
  }

  def saveDeleteNotifications(notifications: Notifications): Unit = {
    readWriteTransaction(_.saveDeleteNotifications(notifications))
  }

  def loadNotificationsToShowInMyMenu(roleId: RoleId, limit: Int,
        unseenFirst: Boolean, skipDeleted: Boolean): Seq[Notification] =
    readOnlyTransaction(_.loadNotificationsToShowInMyMenu(
      roleId, limit = limit, unseenFirst = unseenFirst, skipDeleted = skipDeleted))

  def updateNotificationSkipEmail(notifications: Seq[Notification]): Unit =
    readWriteTransaction(_.updateNotificationSkipEmail(notifications))

  def markAllNotfsAsSeen(userId: UserId): Unit = {
    val user = loadTheUserInclDetailsById(userId)
    readWriteTransaction(_.markNotfsAsSeen(userId, None,
      skipEmails = user.emailNotfPrefs != EmailNotfPrefs.ReceiveAlways))
  }

  def markNotificationAsSeen(userId: UserId, notfId: NotificationId): Unit = {
    val user = loadTheUserInclDetailsById(userId)
    readWriteTransaction(_.markNotfsAsSeen(userId, Some(notfId),
      skipEmails = user.emailNotfPrefs != EmailNotfPrefs.ReceiveAlways))
  }

  def snoozeNotifications(reqrId: UserId, untilWhen: Option[When]): Unit = {
    //writeTx { (tx, _) =>
    readWriteTransaction { tx =>
      val statsBefore = tx.loadUserStats(reqrId) getOrDie "EdE2FPJR9"
      val statsAfter = statsBefore.copy(snoozeUntil = untilWhen)
      tx.upsertUserStats(statsAfter)
    }
  }

  // ----- API secrets

  def listApiSecrets(limit: Int): immutable.Seq[ApiSecret] = {
    readOnlyTransaction(_.listApiSecretsRecentlyCreatedFirst(limit))
  }

  def createApiSecret(forUserId: Option[UserId]): ApiSecret = {
    require(forUserId.isEmpty, "TyE7KFBR02") // for now
    val now = globals.now()

    // If more than two *sysbot* secrets get greated per day, something weird is going on.
    val recentSecrets = listApiSecrets(limit = 50).takeWhile(s => now.daysSince(s.createdAt) < 20)
    throwForbiddenIf(recentSecrets.length > 40, "TyE5PKR2Q", "You're creating secrets too fast")

    val value = nextRandomString()
    readWriteTransaction { tx =>
      val nr = tx.nextApiSecretNr()
      val secret = ApiSecret(nr, userId = forUserId, createdAt = now,
        deletedAt = None, isDeleted = false, secretKey = value)
      tx.insertApiSecret(secret)
      secret
    }
  }

  def deleteApiSecrets(secretNrs: immutable.Seq[ApiSecretNr]): Unit = {
    val now = globals.now()
    readWriteTransaction(tx => secretNrs.foreach(tx.setApiSecretDeleted(_, now)))
  }

  def getApiSecret(secretKey: String): Option[ApiSecret] = {
    readOnlyTransaction(_.loadApiSecretBySecretKey(secretKey))
  }


  // ----- Emails


  def saveUnsentEmail(email: Email): U = {
    // Allow over quota, so "you're over quota" alert emails get sent.
    readWriteTransaction(_.saveUnsentEmail(email),
          allowOverQuota = true)
  }


  def saveUnsentEmailConnectToNotfs(email: Email, notfs: Seq[Notification]): U = {
    // Allow over quota, so "you're over quota" alert emails get sent.
    readWriteTransaction(_.saveUnsentEmailConnectToNotfs(email, notfs),
          allowOverQuota = true)
  }


  def updateSentEmail(email: Email): Unit = {
    dieIf(Globals.isDevOrTest && email.sentOn.isDefined && email.sentFrom.isEmpty,
          "TyE5MW20UM4")
    readWriteTransaction(tx => {
      tx.updateSentEmail(email)
      if (email.failureText.isEmpty) {
        email.toUserId foreach { userId =>
          addUserStats(UserStats(
                userId, lastEmailedAt = When.fromOptDate(email.sentOn)))(tx)
        }
      }
    }, allowOverQuota = true)
  }


  def loadEmailsToPatAboutThread(toPatId: PatId, pageId: PageId, parentPostNr: Opt[PostNr],
          limit: i32): ImmSeq[EmailOut] = {
    readTx(_.loadEmailsToPatAboutThread(toPatId = toPatId, pageId = pageId,
          parentPostNr = parentPostNr, limit = limit))
  }


  def loadEmailByIdOrErr(emailId: St, maxAgeDays: Opt[i32] = None)
          : EmailOut Or ErrMsg = {
    val email = readOnlyTransaction(_.loadEmailByIdOnly(emailId)) getOrElse {
      return Bad("Email not found")
    }
    for (sentOn <- email.sentOn; maxDays <- maxAgeDays) {
      if (now().daysSince(sentOn) > maxDays) {
        return Bad(s"Email too old, older than $maxAgeDays days")
      }
    }
    Good(email)
  }


  def loadEmailCheckSecret(secretOrId: St, mustBeOfType: EmailType)
          : EmailOut Or ErrMsg = {

    writeTx { (tx, _) =>
      val emailInDb = tx.loadEmailBySecretOrId(secretOrId) getOrElse {
        return Bad("Email not found")
      }

      var email = emailInDb

      // New emails use secret values, instead of the email id — then, disallow
      // looking up by id.
      val isViaId = email.id == secretOrId
      if (email.secretValue.isDefined && isViaId) {
        logger.warn(s"s$siteId: Looked up email by id: ${email.id
              } although there's a secret [TyE026MSJ]")
        return Bad("Looked up new email by id — should look up by secret value")
      }

      val isViaSecret = email.secretValue.is(secretOrId)
      dieIf(email.secretValue.isDefined && !isViaSecret, "TyE60MSI42")

      val sentOn = email.sentOn getOrElse {
        logger.warn(o"""Checking secret for email that hasn't been sent,
              site: $siteId, email id: ${email.id}""")
        return Bad(s"Email not yet sent [TyE60MREG26]")
      }

      val sentHoursAgo: i64 = {
        val sentWhen = When.fromDate(sentOn)
        tx.now.hoursSince(sentWhen)
      }

      val maxHours = email.tyype.secretsExpireHours
      val expiredHoursAgo = sentHoursAgo - maxHours
      if (expiredHoursAgo > 0) {
        if (email.secretStatus.is(SecretStatus.DeletedCanUndo)) {
          email = email.copy(secretStatus = Some(SecretStatus.DeletedNoUndo))
          tx.updateSentEmail(email)
        }
        else if (email.secretStatus.forall(_.isOrWillBeValid)) {
          // This includes secretStatus.isEmpty — old emails loaded by id, no secret.
          email = email.copy(secretStatus = Some(SecretStatus.Expired))
          tx.updateSentEmail(email)
        }
      }

      email.secretStatus foreach { secretStatus =>
        import SecretStatus._
        secretStatus match {
          case NotYetValid =>
            return Bad(s"Email link not yet valid")
          case Valid =>
            // Continue below; we'll return email.secretStatus Valid,
            // only marking the email Consumed in the database.
            if (!mustBeOfType.canReuseSecret) {
              tx.updateSentEmail(email.copy(secretStatus = Some(SecretStatus.Consumed)))
            }
          case Consumed =>
            return Bad(s"Trying to use a one time email link many times")
          case DeletedCanUndo | DeletedNoUndo =>
            return Bad(s"Email link deleted")
          case Expired =>
            return Bad(o"""Email link expired $expiredHoursAgo hours ago —
                  these email links are valid only for $maxHours hours""")
        }
      }

      if (mustBeOfType != email.tyype) {
        logger.warn(o"""s$siteId: Found email of type ${email.tyype}, expected:
              $mustBeOfType, email id: ${email.id} [TyE726MS0]""")
        return Bad(s"Wrong email type, should be: $mustBeOfType, is: ${
              email.tyype} [TyEEMLTYPE]")
      }

      email.toUserId foreach { id =>
        this.getUser(id) match {
          case None =>
            // Would be a bug? Users aren't currently hard deleted.
            val msg = s"No user with id $id [TyE30^MR3]"
            logger.warn(msg)
            return Bad(msg)
          case Some(user) =>
            TESTS_MISSING // See: TyT_DELACT_RSTPW
            if (user.isDeleted)
              return Bad("Account deactivated or deleted")
            // In the future, maybe sometimes allow? [email_lgi_susp]
            // Not needed here, now, though.
            if (user.isSuspendedAt(this.now()))
              return Bad("Account suspended")
        }
      }

      Good(email)
    }
  }


  // ----- Testing

  def skipRateLimitsBecauseIsTest(): Unit = {
    memCache.put(
      MemCacheKey(siteId, "skip-rate-limits"),
      MemCacheValueIgnoreVersion("y"))
  }

  def shallSkipRateLimitsBecauseIsTest: Boolean = {
    memCache.lookup[String](MemCacheKey(siteId, "skip-rate-limits")).isDefined
  }

}



object SiteDao extends TyLogging {

  private val SoftMaxOldHostnames = 5
  private val WaitUntilAnotherHostnameInterval = 60

  private val locksBySiteId =
        scala.collection.concurrent.TrieMap[SiteId, ReentrantLock]()

  def siteCacheKey(siteId: SiteId): MemCacheKey = MemCacheKey(siteId, "|SiteId")


  /*
  def withManySiteWriteLocks_Real_[R](siteIds: Set[SiteId])(block: => R): R = {
    // Lock in same order, to avoid deadlocks.
    val idsSorted = siteIds.toSeq.sorted
    lockManyImpl(idsSorted) {
      block
    }
  }


  private def lockManyImpl[R](siteIds: Seq[SiteId])(block: => R): R = {
    if (siteIds.isEmpty) {
      block
    }
    else {
      val lockNowId = siteIds.head
      val lockLaterIds = siteIds.tail
      siteWriteLockIdImpl(lockNowId) {
        lockManyImpl(lockLaterIds) {
          block
        }
      }
    }
  } */


  def withSiteWriteLock[R](siteId: SiteId)(block: => R): R = {
    // Prevent the SystemDao from getting any whole db write lock.
    SystemDao.withWholeDbReadLock {
      // Then lock the desired site only — letting other threads write lock
      // other unrelated sites in parallel.
      siteWriteLockIdImpl(siteId)(block)
    }
  }


  private def siteWriteLockIdImpl[R](siteId: SiteId)(block: => R): R = {
    val lock = locksBySiteId.getOrElseUpdate(siteId, new ReentrantLock)
    // Wait for fairly long (some seconds) in case a garbage collection takes long.
    // (Previously we waited forever here — so a few seconds should be fine.)
    if (lock.tryLock(5L, TimeUnit.SECONDS)) {
      try {
        block
      }
      finally {
        lock.unlock()
      }
    }
    else {
      throw new RuntimeException(s"Couldn't lock site $siteId for updates [TyE0SITELOCK]")
    }
  }


  /** When accessing the default site, the hostname might have been specified
    * in the config file only, that is, globals.defaultSiteHostname.
    */
  def maybeCopyWithDefaultHostname(site: Site, globals: debiki.Globals): Site = {
    if (site.canonicalHostname.nonEmpty)
      return site

    // If no canonical host, use site-NNN.base-domain.com:
    // (This can happen for the very first site, with id 1, if it gets accessed after
    // talkyard.defaultSiteId has been set to != 1.)
    if (site.id != globals.defaultSiteId) {
      val hostname = globals.siteByIdHostnamePort(site.id)  // BUG if custom port incl?
      val canonicalHost = Hostname(hostname, Hostname.RoleCanonical)
      COULD_OPTIMIZE // is :+ faster?
      return site.copy(hostnames = canonicalHost +: site.hostnames)
    }

    val defaultHostname = globals.defaultSiteHostname.getOrDie(
      "TyE5GKU2S7", s"No ${Globals.DefaultSiteHostnameConfValName} specified")
    val canonicalHost = Hostname(defaultHostname, Hostname.RoleCanonical)
    COULD_OPTIMIZE // is :+ faster?
    site.copy(hostnames = canonicalHost +: site.hostnames)
  }


  /** For rejecting a request early, if an invalid alias is specified,
    * while `getAliasOrTruePat()` (below) is used later, in a db tx, to get or lazy-create
    * the alias.
    *
    * @param reqBody If a persona is specified in the request body, it overrides
    *   any persona mode. [choose_persona]
    * @param reqr The person doing the thing. Rename to 'prin(cipal)'? [rename_2_principal]
    * @param modeAlias Any persona mode alias (e.g. if entering Anonymous Mode).
    * @param mayCreateAnon If editing one's old comment, should reuse the same anon
    *   as when posting the comment; may not create a new.
    * @param mayReuseAnon If creating a new page, there's no anonym on that page
    *   to reuse, yet.
    */
  def checkAliasOrThrowForbidden(reqBody: JsObject, reqr: Pat, modeAlias: Opt[WhichAliasPat],
          mayCreateAnon: Bo = true, mayReuseAnon: Bo = true,
          )(dao: SiteDao): Opt[WhichAliasPat] = {

    TESTS_MISSING // [misc_alias_tests], check callers

    // Any 'doAsAnon' in the request json body telling us which persona to use?
    val anyAliasIdInReqBody: Opt[WhichAliasId] =
          parser.parseDoAsAnonField(reqBody) getOrIfBad { prob =>
            throwBadReq("TyEPERSBDYJSN", s"Bad persona req body json: $prob")
          }

    // The actual anonym or pseudonym, after having looked up by id.
    val anyAliasPatInReqBody: Opt[Opt[WhichAliasPat]] = anyAliasIdInReqBody map {
      case WhichAliasId.Oneself =>
        // Any alias should be the *principal*'s alias, not the requester's — but
        // currently the requester and principal are the same, for all endpoints that
        // support persona mode, see  [alias_4_principal].
        None

      case sa: WhichAliasId.SameAnon =>
        throwForbiddenIf(!mayReuseAnon, "TyEREUSEANON", "Cannot reuse anonym here")
        val anon = dao.getTheParticipant(sa.sameAnonId).asAnonOrThrow
        throwForbiddenIf(anon.anonForPatId != reqr.id,
              "TyE0YOURANON01", "No your anonym")
        Some(WhichAliasPat.SameAnon(anon))

      case n: WhichAliasId.LazyCreatedAnon =>
        throwForbiddenIf(!mayCreateAnon, "TyENEWANON1", "Cannot create anonym now")
        Some(WhichAliasPat.LazyCreatedAnon(n.anonStatus))
    }

    // if  anyAliasPatInReqBody.get != modeAlias  {
    //   Noop. It's ok if any Persona Mode alias is different from any alias in the
    //   request body. Then, one can switch to Persona Mode, but still do one-off
    //   things as sbd else if in an old discussion one was sbd else.
    // }

    val which = anyAliasPatInReqBody getOrElse modeAlias

    // Anon sensitive discussions enabled?
    val anyAnonStatus: Opt[AnonStatus] = which.flatMap(_.anyAnonStatus)
    // For now, safest to assume that any anon-status except for the Ideation purpose
    // (that is, AnonStatus.IsAnonCanAutoDeanon) is sensitive discussions.
    val isAnonSens = anyAnonStatus.exists(_ != AnonStatus.IsAnonCanAutoDeanon)
    if (isAnonSens && !dao.getWholeSiteSettings().enableAnonSens)
      throwForbidden("TyE0ANONSENS", // [reject_anon_sensitive_posts]
            "Sensitive anonymous discussions aren't enabled (any longer)")

    which
  }


  def getPersonaAndLevels(truePatAndLevels: UserAndLevels, pageId: PageId,
          asAlias: Opt[WhichAliasPat], mayCreateAnon: Bo = true, mayReuseAnon: Bo = true,
          isCreatingPage: Bo = false)(tx: SiteTx, mab: MessAborter): UserAndLevels = {
    val persona = getAliasOrTruePat(truePatAndLevels.user, pageId = pageId, asAlias,
          mayCreateAnon = mayCreateAnon, mayReuseAnon = mayReuseAnon,
          isCreatingPage = isCreatingPage)(tx, mab)
    persona match {
      case anon: Anonym =>
        UserAndLevels(anon,
              // This is the current trust level, for all anons. [anon_tr_lv]
              TrustLevel.NewMember, ThreatLevel.HopefullySafe)
        // [pseudonyms_later]
      case _ =>
        dieIf(persona ne truePatAndLevels.user, "TyE703SKJLU4")
        truePatAndLevels
    }
  }


  /** Gets or lazy-creates the specified alias, or just returns the user hanself (`truePat`).
    *
    * If the requester is doing sth anonymously (e.g. anon comments or votes),
    * looks up & returns the anonymous user. Or creates a new anonymous user if
    * needed.
    *
    * @param truePat The true person behind any anonym or pseudonym.
    * @param pageId Anonyms are per page, each one is restricted to a single page.
    * @param asAlias The anonym or pseudonym to use.
    * @param mayCreateAnon If the author of a page closes it or reopens it etc,
    *   han cannot create a new anonym to do that. Han needs to reuse the same
    *   persona, as when creating the page. (Otherwise others can guess that
    *   the real person and any anonym of hans are the same —  if they both can
    *   alter the same page. [deanon_risk])
    *
    * RENAME to getPersona()  ?
    */
  def getAliasOrTruePat(truePat: Pat, pageId: PageId, asAlias: Opt[WhichAliasPat],
          mayCreateAnon: Bo = true, mayReuseAnon: Bo = true, isCreatingPage: Bo = false,
          )(tx: SiteTx, mab: MessAborter): Pat = {
    TESTS_MISSING // [misc_alias_tests], of callers.

    if (asAlias.isEmpty)
      return truePat

    asAlias.get match {
      case WhichAliasPat.SameAnon(anonOtherTx) =>
        if (!mayReuseAnon)
          mab.abort("TyEOLDANON2", "Cannot reuse anonym now")

        // (Maybe we don't actually need to reload the anon. Oh well.)
        val anon: Anonym = tx.loadTheParticipant(anonOtherTx.id).asAnonOrThrow
        if (anon.anonForPatId != truePat.id)
          mab.abortDeny("TyE0YOURANON2", "No your anon")

        anon

      case WhichAliasPat.LazyCreatedAnon(anonStatus: AnonStatus) =>
        if (!anonStatus.isAnon)
          return truePat

        if (!mayCreateAnon)
          mab.abort("TyENEWANON2", "Cannot create new anonym now")

        // Reuse any already existing anonym [one_anon_per_page] — at most one per page
        // and person, for now.
        val anyAnon = tx.loadAnyAnon(truePat.id, pageId = pageId, anonStatus)
        anyAnon foreach { anon =>
          dieIf(anon.anonForPatId != truePat.id, "TyE7L02SLP3")
          return anon
        }

        val anonId = tx.nextGuestId
        val newAnon = Anonym(
              id = anonId,
              createdAt = tx.now,
              anonStatus = anonStatus,
              anonForPatId = truePat.id,
              anonOnPageId = pageId)

        // We might insert the anonym before the page exists, but there's a foreign key
        // from anons to pages:  pats_t.anon_on_page_id_st_c,  so defer constraints.
        if (isCreatingPage) {
          tx.deferConstraints()
        }

        tx.insertAnonym(newAnon)
        newAnon
    }
  }

}
