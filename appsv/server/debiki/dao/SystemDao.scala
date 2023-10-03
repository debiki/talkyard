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

import akka.actor.Actor
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.throwForbidden
import scala.collection.{immutable, mutable}
import SystemDao._
import debiki.{ForgetEndToEndTestEmails, Globals}
import debiki.EdHttp.{throwNotFound, throwBadReqIf, throwForbiddenIf}
import talkyard.server.spam.ClearCheckingSpamNowCache
import java.util.concurrent.TimeUnit
import play.api.libs.json.JsObject
import talkyard.server.JsX
import talkyard.server.TyLogger


class NumSites(val byYou: Int, val total: Int)

/** SuperAdmin Site Stuff. Info to show in the super admin interface about a site.
  */
case class SASiteStuff(
  site: SiteInclDetails,
  staff: Seq[UserInclDetails],
  reindexRange: Opt[TimeRange],
  reindexQueueLen: i32)


/** Database and cache queries that take all sites in mind.
 */
class SystemDao(
  private val dbDaoFactory: DbDaoFactory,
  val cache: DaoMemCache,
  val globals: Globals) {

  private def dbDao2: DbDao2 = dbDaoFactory.newDbDao2()
  private lazy val logger = TyLogger("SystemDao")

  val memCache = new MemCache(NoSiteId, cache, globals.mostMetrics)


  // [Scala_3] Opaque type: SysTx —> SysTxRead
  RENAME
  private def readOnlyTransaction[R](fn: SysTx => R): R =
    readTx(fn)

  def readTx[R](fn: SysTx => R): R =
    dbDao2.readOnlySystemTransaction(fn)


  def writeTxLockNoSites[R](fn: SysTx => R): R = {
    dbDao2.readWriteSystemTransaction(fn, allSitesWriteLocked = false)
  }


  // [Scala_3] Opaque type: SysTx —> SysTxWriteAllSites
  def writeTxLockAllSites[R](fn: SysTx => R): R =
    SystemDao.withWholeDbWriteLock {
      dbDao2.readWriteSystemTransaction(fn, allSitesWriteLocked = true)
    }


  // Note: [PGSERZERR] Would cause transaction rollbacks, rarely and infrequently, if writing
  // to the same parts of the same tables, at the same time as per site transactions.
  // Even if the app server code is otherwise fine and bug free. It's a database thing.
  // So, don't use this for updating per-site things. Instead, create a site specific
  // dao and site specific transactions — they do the database writes under mutex,
  // and so avoids any tx rollbacks.
  // Edit: Now instead we just write lock all sites instead.
  def writeTxLockManySites[R](siteIds_ignored: Set[SiteId])(fn: SysTx => R): R = {
    // For now:
    writeTxLockAllSites(fn)
    // Earlier, but can cause rollbacks: (see comment above)
    // SiteDao.withManySiteWriteLocks(siteIdsToDelete)(fn)
  }


  // [Scala_3] Opaque type: anyOldTx must be a SysTxWriteAllSites
  def writeTxLockAllSitesReuseAnyOldTx[R](
        anyOldTx: Opt[SysTx])(fn: SysTx => R): R = {
    anyOldTx match {
      case Some(oldTx) =>
        DO_AFTER // 2021-08-01 enable dieIf in Prod
        dieIf(Globals.isDevOrTest && !oldTx.allSitesWriteLocked,
              "TyE502MSK", "Trying to reuse old tx but it hasn't a complete write lock")
        fn(oldTx)
      case None =>
        writeTxLockAllSites(fn)
    }
  }

  def applyEvolutions(): U = {
    writeTxLockAllSites(_.applyEvolutions())
  }



  // ----- Sites


  def theSiteById(siteId: SiteId): Site =
    getSiteById(siteId) getOrDie "TyESITE0F"


  def getOrCreateFirstSite(): Site =
    getSiteById(FirstSiteId) getOrElse createFirstSite()


  def getSiteById(siteId: SiteId): Option[Site] = {
    // We use SiteDao.getSite() because it caches.
    COULD_OPTIMIZE // move getSite() to SystemDao instead so won't need to create
    // temp SiteDao obj.  Or, not needed, after:  [rm_cache_listeners]  ?
    globals.siteDao(siteId).getSite()
  }


  def getSiteByPubId(publSiteId: PubSiteId): Option[Site] =
    getSiteIdByPubId(publSiteId).flatMap(getSiteById) // caches


  def getSiteIdByPubId(pubSiteId: PubSiteId): Option[SiteId] = {
    // The publ and private ids never change, ok cache forever.
    memCache.lookup(
          MemCacheKeyAnySite(s"$pubSiteId|pubSiteId"),
          orCacheAndReturn = {
            val anySite = loadSiteByPubId(pubSiteId)
            anySite.map(_.id.asInstanceOf[Integer])
          }).map(_.toInt)
  }


  def loadSiteByPubId(pubId: PubSiteId): Option[Site] =
    readOnlyTransaction(_.loadSiteByPubId(pubId))


  def loadSitesInclDetailsAndStaff(): Seq[SASiteStuff] = {
    readOnlyTransaction { tx =>
      val sites = tx.loadAllSitesInclDetails()
      val staff = tx.loadStaffForAllSites()
      val queueRangesBySiteId: Map[SiteId, TimeRange] = tx.loadJobQueueRangesBySiteId()
      val queueSizesBySiteId: Map[SiteId, i32] = tx.loadJobQueueLengthsBySiteId()
      sites map { site =>
        SASiteStuff(
              site,
              staff.getOrElse(site.id, Nil),
              reindexRange = queueRangesBySiteId.get(site.id),
              reindexQueueLen = queueSizesBySiteId.getOrElse(site.id, 0))
      }
    }
  }

  def loadSiteInclDetailsById(siteId: SiteId): Option[SiteInclDetails] =
    readOnlyTransaction(_.loadSiteInclDetailsById(siteId))

  def loadSitesWithIds(siteIds: Seq[SiteId]): Seq[Site] =
    readOnlyTransaction(_.loadSitesByIds(siteIds))


  def loadSite(siteId: SiteId): Option[Site] =
    readOnlyTransaction(_.loadSitesByIds(Seq(siteId)).headOption)


  def updateSites(patches: Seq[SuperAdminSitePatch]): U = {
    val sitesToClear = mutable.Set[SiteId]()
    val siteEntriesToClear = mutable.Set[SiteId]()
    for (patch <- patches) {
      loadSiteInclDetailsById(patch.siteId) match {
        case None =>
          // Maybe some e2e test fails, if the site is somehow still in
          // the mem cache, although gone from the db.  So, clear the mem
          // cache, for this site. (Don't think this can happen in prod mode though.)
          sitesToClear.add(patch.siteId)
        case Some(siteInDb) =>
          throwForbiddenIf(siteInDb.isPurged && !patch.newStatus.isPurged,
                "TyE503MREG2R5", s"Site already purged, cannot undo")
          throwForbiddenIf(patch.siteId == globals.defaultSiteId &&
                patch.newStatus.isMoreDeletedThan(siteInDb.status),
                "TyEJ406RFMG24", s"Cannot delete or purge the default site")

          val clearWholeSite: Bo = siteInDb.status != patch.newStatus ||
                // Maybe not always necessary, but for now:
                siteInDb.featureFlags != patch.featureFlags
          if (clearWholeSite) {
            sitesToClear.add(patch.siteId)
          }

          // Maybe break out fn?
          val clearSiteEntry: Bo =
                siteInDb.readLimitsMultiplier != patch.readLimitsMultiplier ||
                siteInDb.logLimitsMultiplier != patch.logLimitsMultiplier ||
                siteInDb.createLimitsMultiplier != patch.createLimitsMultiplier
          if (!clearWholeSite && clearSiteEntry) {
            siteEntriesToClear.add(patch.siteId)
          }
      }
    }

    COULD_OPTIMIZE // clearDatabaseCacheAndMemCache() does:
    // `readWriteTransaction(_.bumpSiteVersion())`, but could instead pass
    // a param `bumpSiteVersion = true` to updateSite(), so won't need
    // two separate transactions.
    for (patch <- patches) {
      writeTxLockAllSites(
            _.updateSite(patch))
    }
    for (siteId <- sitesToClear) {
      globals.siteDao(siteId).clearDatabaseCacheAndMemCache()
    }
    for (siteId <- siteEntriesToClear) {
      globals.siteDao(siteId).uncacheSiteFromMemCache()
    }
  }


  def schedulePurgeSite(siteId: SiteId, afterDays: Opt[f32]): U = {
    writeTxLockAllSites { tx =>
      val site = tx.loadSitesByIds(Seq(siteId)).headOption getOrElse {
        throwNotFound("TyE50RMPJ3", s"No such site: $siteId")
      }
      throwBadReqIf(site.status != SiteStatus.Deleted, "TyE50RMGI3",
            s"Site status not Deleted: $siteId, hostname: ${site.canonicalHostnameStr}")
      tx.schedulePurgeSite(siteId = siteId, afterDays = afterDays)
    }
  }


  private def createFirstSite(): Site = {
    val pubId =
          if (globals.isOrWasTest) Site.FirstSiteTestPublicId
          else Site.newPubId()
    writeTxLockAllSites { sysTx =>
      val firstSite = sysTx.createSite(Some(FirstSiteId),
        pubId = pubId, name = "Main Site", SiteStatus.NoAdmin, featureFlags = "",
        creatorIp = "0.0.0.0",
        quotaLimitMegabytes = None, maxSitesPerIp = 9999, maxSitesTotal = 9999,
        isTestSiteOkayToDelete = false, createdAt = sysTx.now)

      dieIf(firstSite.id != FirstSiteId, "EdE2AE6U0")
      val siteTx = sysTx.siteTransaction(FirstSiteId)

      // Keep this in sync with createSite(). (5DWSR42)

      siteTx.upsertSiteSettings(SettingsToSave(
            orgFullName = Some(Some("Unnamed Organization")),
            // Some integration tests require guest login:
            allowGuestLogin = if (globals.isOrWasTest) Some(Some(true)) else None))

      // Don't insert any site host — instead, we use the ed.hostname config value.

      CreateSiteDao.createSystemUser(siteTx)
      CreateSiteDao.createSysbotUser(siteTx)
      CreateSiteDao.createUnknownUser(siteTx)
      CreateSiteDao.createDefaultGroupsAndPermissions(siteTx)

      // Clear the Redis cache for this site, (2PKF05Y), in case we're developing
      // on localhost and there's old stuff in the Redis dev server.
      val redisCache = new RedisCache(FirstSiteId, globals.redisClient, globals.now)
      redisCache.clearThisSite()

      firstSite
    }
  }


  /**
    * During e2e tests, find out which test sites to delete, to make the hostname
    * or something available again. But don't delete them immediately — first
    * acquire a SiteDao mutex (we'll do, a bit below), to avoid PostgreSQL
    * deadlocks if the transaction here deletes the site, but another request
    * tries to update the same site, in a parallel transaction.
    */
  def deleteSitesWithNameOrHostnames(siteName: St, hostnames: Set[St]): U = {
    dieIfAny(hostnames, (h: String) => !Hostname.isE2eTestHostname(h), "TyE7PK5W8",
      (badName: String) => s"Not an e2e test hostname: $badName")

    // isE2eTestHostname works for site names too (not only hostnames).
    dieIf(siteName.nonEmpty && !Hostname.isE2eTestHostname(siteName), "TyE60KPDR",
      s"Not an e2e test site name: $siteName")

    val sitesToDeleteMaybeDupls: Vector[Site] = readOnlyTransaction { sysTx =>
      hostnames.flatMap(sysTx.loadSiteByHostname).toVector ++
          sysTx.loadSiteByName(siteName).toVector
    }

    dieIfAny(sitesToDeleteMaybeDupls, (site: Site) => site.id > MaxTestSiteId,
      "TyE5S20PUJ6", (site: Site) => s"Trying to delete *real* site: $site")

    val siteIdsToDelete = sitesToDeleteMaybeDupls.map(_.id).toSet
    logger.info(s"Deleting sites: $siteIdsToDelete")  ; AUDIT_LOG

    globals.systemDao.writeTxLockManySites(siteIdsToDelete) { sysTx =>
      deleteSites(siteIdsToDelete, sysTx, mayDeleteRealSite = false, keepHostname = false)
    }
  }


  def deleteSites(siteIdsToDelete: Set[SiteId], sysTx: SysTx,
        mayDeleteRealSite: Bo, keepHostname: Bo): U = {

    val deletedHostnames = mutable.Set[String]()

    // ----- Delete the site

    siteIdsToDelete foreach { siteId: SiteId =>
      val site = sysTx.loadSite(siteId)
      deletedHostnames ++= site.map(_.hostnames.map(_.hostname)) getOrElse Nil

      val gotDeleted =
            sysTx.deleteSiteById(siteId, mayDeleteRealSite = mayDeleteRealSite,
                keepHostname = keepHostname)

      dieIf(!gotDeleted,
        "TyE2ABK493U4", o"""Could not delete site $siteId, this site: $site
          — another thread or server deleted it already? A race condition?""")
    }

    // ----- Clear caches

    deletedHostnames.toSet foreach this.forgetHostname

    // + also redisCache.clearThisSite() doesn't work if there are many Redis nodes [0GLKW24].
    // This won't clear the watchbar cache: memCache.clearSingleSite(site.id)  — what? why not?
    // so instead:
    if (deletedHostnames.nonEmpty) {
      memCache.clearAllSites()
    }

    // If there is still stuff in the Redis cache, for any of the now deleted sites,
    // that could make weird things happen, when site ids get reused — e.g. in
    // tests or when restoring a backup. (2PKF05Y)
    siteIdsToDelete foreach { siteId =>
      val redisCache = new RedisCache(siteId, globals.redisClient, globals.now)
      redisCache.clearThisSite()
    }

    logger.info(s"Done deleting sites: $siteIdsToDelete")  ; AUDIT_LOG

    // ----- Cancel any background jobs

    val testSiteIds = siteIdsToDelete.filter(_ <= MaxTestSiteId)
    if (testSiteIds.nonEmpty)
      globals.endToEndTestMailer.tell(
        ForgetEndToEndTestEmails(testSiteIds), Actor.noSender)

    globals.spamCheckActor.foreach(_.tell(
      ClearCheckingSpamNowCache(siteIdsToDelete), Actor.noSender))
  }


  /** Used to create additional sites on the same server. The server then becomes a
    * multi site server (i.e. separate communities, on the same server)
    * — unless we're restoring/overwriting FirstSiteId; then it can remain be
    * a single site server.
    *
    * The first site is instead created by [[createFirstSite()]] above.
    */
  def createAdditionalSite(
    anySiteId: Option[SiteId],
    pubId: PubSiteId,
    name: String,
    status: SiteStatus,
    hostname: Option[String],
    featureFlags: St,
    embeddingSiteUrl: Option[String],
    organizationName: String,
    creatorId: UserId,   // change to Option, present iff createdFromSiteId ?
    browserIdData: BrowserIdData,
    isTestSiteOkayToDelete: Boolean,
    skipMaxSitesCheck: Boolean,
    createdFromSiteId: Option[SiteId],
    anySysTx: Option[SystemTransaction] = None): Site = {

    Site.findNameProblem(name) foreach { problem =>
      throwForbidden("EsE7UZF2_", s"Bad site name: '$name', problem: $problem")
    }

    throwForbiddenIf(!pubId.isAzLowerNumUn,  // [503MSIEJ36]
          "TyESITEPUBID", o"""Only a-z 0-9 and _ allowed in site pub ids,
          but this pub id includes other chars: '$pubId'""")

    dieIf(hostname.exists(_ contains ":"), "DwE3KWFE7")

    val config = globals.config
    val maxSitesPerIp = skipMaxSitesCheck ? 999999 | config.createSite.maxSitesPerPerson
    val maxSitesTotal = skipMaxSitesCheck ? 999999 | {
      // Allow a little bit more than maxSitesTotal sites, in case Alice starts creating
      // a site, then Bo and Bob finish creating theirs so that the total limit is reached
      // — then it'd be annoying if Alice gets an error message.
      config.createSite.maxSitesTotal + 5
    }

    COULD // add a debug test that if there is already anySysTx, then
    // anySiteId must have been locked already, by the caller. So things
    // always get locked in the same order (avoids deadlocks).

    // (Could lock only anySiteId, if no tx to reuse.)
    globals.systemDao.writeTxLockAllSitesReuseAnyOldTx(anySysTx) { sysTx =>
              try {
      // Keep all this in sync with createFirstSite(). (5DWSR42)

      val maxQuota = config.createSite.quotaLimitMegabytes(
        isForBlogComments = embeddingSiteUrl.isDefined,
        isTestSite = isTestSiteOkayToDelete)

      val newSite = sysTx.createSite(
        id = anySiteId,
        pubId = pubId,
        name = name,
        status,
        featureFlags = featureFlags,
        creatorIp = browserIdData.ip,
        quotaLimitMegabytes = maxQuota,
        maxSitesPerIp = maxSitesPerIp,
        maxSitesTotal = maxSitesTotal,
        isTestSiteOkayToDelete = isTestSiteOkayToDelete,
        sysTx.now)

      // Delete Redis stuff even if no site found (2PKF05Y), because if you're developing
      // on localhost, and you empty the SQL database or import an SQL dump, that'd make
      // most/all sites disappear from the Postgres database — but we also need to clear
      // the Redis cache:
      val redisCache = new RedisCache(newSite.id, globals.redisClient, globals.now)
      redisCache.clearThisSite()

      createdFromSiteId foreach { oldSiteId =>
        val oldSiteTx = sysTx.siteTransaction(oldSiteId)
        AuditDao.insertAuditLogEntry(AuditLogEntry(
          siteId = oldSiteId,
          id = AuditLogEntry.UnassignedId,
          didWhat = AuditLogEntryType.CreateSite,
          doerTrueId = TrueId(creatorId),
          doneAt = oldSiteTx.now.toJavaDate,
          browserIdData = browserIdData,
          browserLocation = None,
          targetSiteId = Some(newSite.id)), oldSiteTx)
      }

      val newSiteTx = sysTx.siteTransaction(newSite.id)
      newSiteTx.startAuditLogBatch()

      // Nowadays people kind of never post any comments to blogs. So, for now,
      // make it easy to post, by opening the editor and letting people start writing directly.
      // COULD add separate require-email & may-post-before-email-verified for embedded comments?
      // Or change the settings to Ints? 0 = never, 1 = embedded comments only, 2 = always.
      val notIfEmbedded = if (embeddingSiteUrl.isDefined) Some(Some(false)) else None
      val yesIfEmbedded = if (embeddingSiteUrl.isDefined) Some(Some(true)) else None

      newSiteTx.upsertSiteSettings(SettingsToSave(
        allowEmbeddingFrom = Some(embeddingSiteUrl),

        // Features are disabled, for embedded blog comments sites, here instead: [493MRP1].
        // The below login settings should be moved to there too? So will take effect
        // also for the very first site (self hosted installations for embedded comments)?

        // Blogs barely get any comments nowadays (instead, everyone uses Facebook/Reddit/etc),
        // so, by default, make it easy to post a blog comment: don't require people to create
        // real accounts. Guest comments always get queued for moderation anyway. [4JKFWP4]
        allowGuestLogin = yesIfEmbedded,
        requireVerifiedEmail = notIfEmbedded,
        mayComposeBeforeSignup = yesIfEmbedded,
        mayPostBeforeEmailVerified = yesIfEmbedded,

        // People who create new sites via a hosted service, might not be technical
        // people; to keep things simple for them, disable API and tags, initially. [DEFFEAT]
        // (This is not the very first site on this server, so the person creating this site,
        // is apparently not doing a self hosted installation.)
        enableApi = Some(Some(false)),
        enableTags = Some(Some(false)),
        orgFullName = Some(Some(organizationName))))

      val newSiteHost = hostname.map(Hostname(_, Hostname.RoleCanonical))
      newSiteHost foreach { h =>
        try newSiteTx.insertSiteHost(h)
        catch {
          case _: DuplicateHostnameException =>
            throwForbidden(
              "TyE5AKB02ZF", o"""There's already a site with hostname '${h.hostname}'. Add
              the URL param deleteOldSite=true to delete it (works for e2e tests only)""")
        }
      }

      CreateSiteDao.createSystemUser(newSiteTx)
      CreateSiteDao.createSysbotUser(newSiteTx)
      CreateSiteDao.createUnknownUser(newSiteTx)
      CreateSiteDao.createDefaultGroupsAndPermissions(newSiteTx)

      newSiteTx.insertAuditLogEntry(AuditLogEntry(
        siteId = newSite.id,
        id = AuditLogEntry.FirstId,
        didWhat = AuditLogEntryType.ThisSiteCreated,
        doerTrueId = TrueId(SystemUserId), // no admin account yet created
        doneAt = newSiteTx.now.toJavaDate,
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = createdFromSiteId))

      newSite.copy(hostnames = newSiteHost.toVector)
    }
    catch {
      case ex @ DbDao.SiteAlreadyExistsException(site, details) =>
        logger.warn(o"""Cannot create site, dupl key error [TyE4ZKTP01]: $site,
           details: $details""")
        throw ex
    } }
  }


  def countSites(testSites: Boolean, browserIdData: BrowserIdData): NumSites = {
    readOnlyTransaction { transaction =>
      new NumSites(
        byYou = transaction.countWebsites(createdFromIp = browserIdData.ip,
          creatorEmailAddress = None, testSites),
        total = transaction.countWebsitesTotal(testSites))
    }
  }


  // ----- Pages

  def refreshPageInMemCache(sitePageId: SitePageId): Unit = {
    // No:  memCache.firePageSaved(sitePageId)   [rm_cache_listeners]
    // — then, no event listeners registered, would have no effect. Instead:
    globals.siteDao(sitePageId.siteId).refreshPageInMemCache(sitePageId.pageId)
  }


  // ----- Summary emails

  /** Groups by site id, so can be batch processed and popular topics for one site can
    * be loaded just once, for many users.
    */
  def loadStatsForUsersToMaybeEmailSummariesTo(now: When, limit: Int)
        : Map[SiteId, immutable.Seq[UserStats]] =
    readOnlyTransaction { transaction =>
      transaction.loadStatsForUsersToMaybeEmailSummariesTo(now, limit)
    }


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]] =
    readOnlyTransaction { transaction =>
      transaction.loadNotificationsToMailOut(delayInMinutes, numToLoad)
    }


  /** Returns Option(cached-html-version, current-page-version).
    */
  def loadCachedPageVersion(sitePageId: SitePageId, renderParams: PageRenderParams)
        : Option[(CachedPageVersion, SitePageVersion)] = {
    readOnlyTransaction { transaction =>
      transaction.loadCachedPageVersion(sitePageId, renderParams)
    }
  }

  def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender] = {
    readOnlyTransaction { transaction =>
      transaction.loadPageIdsToRerender(limit)
    }
  }


  // ----- Indexing

  /** Loads all remaining reindex-all time range, per site, and how many posts there
    * currently are, in the reindex queue, per site. If for a site, the queue is short,
    * we'll find a bunch of posts from the end of the time range, and add to the queue,
    * and decrease the end of the time range.
    */
  def addPendingPostsFromTimeRanges(desiredQueueLen: i32): U = {
    // If the queue is long already, let's wait with converting ranges to even more items.
    val numMissing = readTx { tx =>
      val num = tx.loadJobQueueNumPosts(countUpTo = desiredQueueLen + 10)
      desiredQueueLen - num
    }

    if (numMissing <= 0)
      return

    var numRemaining = numMissing

    writeTxLockAllSites { tx =>
      val queueRangesBySiteId: Map[SiteId, TimeRange] = tx.loadJobQueueRangesBySiteId()
      val queueSizesBySiteId: Map[SiteId, i32] = tx.loadJobQueueLengthsBySiteId()

      val approxPerSite = numRemaining / (math.max(queueRangesBySiteId.size, 1))
      val skipIfQueueLongerThan =
            if (queueRangesBySiteId.size == 1) approxPerSite
            else {
              // This _will_distribute indexing work accross sites with ranges to index, right?
              approxPerSite / 2
            }

      for ((siteId, range: TimeRange) <- queueRangesBySiteId; if numRemaining > 0) {
        val numPendingPostsInQueue = queueSizesBySiteId.getOrElse(siteId, 0)
        // numRemaining -= numPendingPostsInQueue
        if (numPendingPostsInQueue > skipIfQueueLongerThan) {
          // Let's wait with this site until its queue is shorter — we'll fetch posts from
          // some other site's time range instead. Also, this _will_distribute the indexing
          // more evenly accross all sites?
          STARVATION // Could theoretically happen, in a site, if the server is slow and
          // people keep editing their comments "all the time" in that site — then we'll
          // be indexing those, never having time to reindex older posts in that site's
          // time range.  If that ever becomes a problem, then: Could reindex
          // edited posts less often, so there's time to reindex the pending time ranges.
        }
        else {
          val siteTx: SiteTx = tx.asSiteTx(siteId)
          val nextPosts: ImmSeq[Post] =
                siteTx.loadPostsByTimeExclAggs(
                      range, toIndex = true, OrderBy.MostRecentFirst,
                      // Don't add too few at a time, would result in many queries.
                      limit = math.max(20, approxPerSite - numPendingPostsInQueue))
          if (nextPosts.isEmpty) {
            // There are no more posts in this time range; we're done reindexing it.
            siteTx.deleteJobQueueRange(range)
          }
          else {
            val numEnqueued = siteTx.indexPostsSoon(nextPosts: _*)
            numRemaining -= numEnqueued
            val oldest: Post =
                  nextPosts.reduceLeft((oldestSoFar: Post, other: Post) => {
                    if (oldestSoFar.createdAt.getTime < other.createdAt.getTime) oldestSoFar
                    else if (other.createdAt.getTime < oldestSoFar.createdAt.getTime) other
                    else if (oldestSoFar.id < other.id) oldestSoFar
                    else if (other.id < oldestSoFar.id) other
                    else die("TyEDUPLPOST2057", s"Site id: $siteId, post id: ${other.id}")
                  })
            siteTx.alterJobQueueRange(
                  range, newEndWhen = When.fromDate(oldest.createdAt), newEndOffset = oldest.id)
          }
        }
      }
    }
  }

  def loadStuffToIndex(limit: Int): StuffToIndex = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToIndex(limit)
    }
  }

  def deleteFromIndexQueue(post: Post, siteId: SiteId): U = {
    writeTxLockAllSites { tx =>
      tx.deleteFromIndexQueue(post, siteId)
    }
  }

  def reindexSites(siteIds: Set[SiteId]): U = {
    writeTxLockAllSites { tx =>
      tx.addEverythingInLanguagesToIndexQueue_usingTimeRange(siteIds)
      /*
      for (id <- siteIds) {
        val siteTx = tx.asSiteTx(id)
        val siteSettings = siteTx.loadSiteSettings() getOrElse mab.abortNotFound(
                "TyE40G263", s"No such site: $id")
        tx.reindexSite(siteId = id, langCode = siteSettings.languageCode)
      } */
    }
  }

  def addEverythingInLanguagesToIndexQueue(languages: Set[St]): U = {
    writeTxLockAllSites { tx =>
      tx.addEverythingInLanguagesToIndexQueue(languages)
    }
  }


  // ----- Spam

  def loadStuffToSpamCheck(limit: Int): immutable.Seq[SpamCheckTask] = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToSpamCheck(limit)
    }
  }

  /** Handles spam check results, for a single post, or user profile.
    *
    * @param spamCheckTaskNoResults — A spam check task for the post or user profile.
    * @param spamCheckResults — Results from different external spam check services.
    *
    * COULD REFACTOR move to SpamSiteDao, since now uses only a per site tx.
    *
    * [PENDNSPM]
    */
  def handleSpamCheckResults(spamCheckTaskNoResults: SpamCheckTask,
          spamCheckResults: SpamCheckResults): U = {
    val postToSpamCheck= spamCheckTaskNoResults.postToSpamCheck getOrElse {
      // Currently registration spam is checked directly when registering;
      // we don't save anything to the database, and shouldn't find anything here later.
      // Later, will spam check users' profile texts & email addrs after they've been
      // saved already, and then this code will run. [PROFLSPM]
      unimplemented("Delayed dealing with spam for things other than posts " +
        "(i.e. registration spam?) [TyE295MKAR2]")
    }

    val spamFoundResults: immutable.Seq[SpamCheckResult.SpamFound] =
      spamCheckResults.collect { case r: SpamCheckResult.SpamFound => r }

    val numIsSpamResults = spamFoundResults.length
    val numNotSpamResults = spamCheckResults.length - numIsSpamResults

    val spamCheckTaskWithResults: SpamCheckTask =
      spamCheckTaskNoResults.copy(
        resultsAt = Some(globals.now()),
        resultsJson = Some(JsObject(spamCheckResults.map(r =>
            r.spamCheckerDomain -> JsX.JsSpamCheckResult(r)))),
        resultsText = Some(spamCheckResults.map(r => i"""
            |${r.spamCheckerDomain}:
            |${r.humanReadableMessage}""").mkString("------")).trimNoneIfBlank,
        numIsSpamResults = Some(numIsSpamResults),
        numNotSpamResults = Some(numNotSpamResults))

    // COULD if is new page, no replies, then hide the whole page (no point in showing a spam page).
    // Then mark section page stale below (4KWEBPF89).
    val sitePageIdToRefresh = globals.siteDao(spamCheckTaskWithResults.siteId).readWriteTransaction {
          siteTx =>

      // Update the spam check task with the spam check results, so we remember it's done.
      siteTx.updateSpamCheckTaskForPostWithResults(spamCheckTaskWithResults)

      if (spamFoundResults.isEmpty)
        return ()

      val postBefore = siteTx.loadPost(postToSpamCheck.postId) getOrElse {
        // It was hard deleted?
        return ()
      }

      val postAfter = postBefore.copy(
        bodyHiddenAt = Some(siteTx.now.toJavaDate),
        bodyHiddenById = Some(SystemUserId),
        bodyHiddenReason = Some(s"Is spam or malware?:\n\n" + spamCheckTaskWithResults.resultsText))

      val reviewTask: ReviewTask = PostsDao.createOrAmendOldReviewTask(
        createdById = SystemUserId, postAfter, reasons = Vector(ReviewReason.PostIsSpam),
        siteTx)

      siteTx.updatePost(postAfter)

      // Add a review task, so a human will check this out. When hen has
      // done that, we'll hide or show the post, if needed, and, if the human
      // disagrees with the spam check service, we'll tell the spam check service
      // it did a mistake. [SPMSCLRPT]
      siteTx.upsertReviewTask(reviewTask)

      SECURITY; COULD // if the author hasn't posted more than a few posts,  [DETCTHR]
      // and they haven't gotten any like votes or replies,
      // and many of the author's posts have been detected as spam
      // then could hide all the author's not-yet-reviewed posts, and block hen and
      // mark hen as a Moderate Threat.
      // Alredy done:
      // The author gets blocked from posting more posts, if hen has more than a few
      // [posts that seem to be spam] pending review  [PENDNSPM].  So the staff won't
      // need to review lots of posts by this maybe-spammer.

      // If the post was visible, need to rerender the page + update post counts.
      if (postBefore.isVisible) {
        val oldMeta = siteTx.loadPageMeta(postAfter.pageId) getOrDie "EdE4FK0YUP"

        val newNumOrigPostRepliesVisible =
          if (postAfter.isOrigPostReply) oldMeta.numOrigPostRepliesVisible - 1
          else oldMeta.numOrigPostRepliesVisible

        val newNumRepliesVisible =
          if (postAfter.isReply) oldMeta.numRepliesVisible - 1
          else oldMeta.numRepliesVisible

        val newMeta = oldMeta.copy(
          numRepliesVisible = newNumRepliesVisible,
          numOrigPostRepliesVisible = newNumOrigPostRepliesVisible,
          version = oldMeta.version + 1)

        siteTx.updatePageMeta(newMeta, oldMeta = oldMeta,
          markSectionPageStale = false) // (4KWEBPF89)
        BUG; SHOULD // updatePagePopularity(PagePartsDao(pageId, transaction), transaction)
        // but tricky to do right now. Also, I should perhaps, instead of updating the page
        // popularity instantly, have a background job queue for pages that need to be updated?
        // Like the job queue for pages to reindex? Then, if many many pages need to have their
        // popularity updated "at once", the server won't go crazy and spike the CPU. Instead,
        // it'll look at the pages one at a time, when it has some CPU to spare.

        Some(SitePageId(spamCheckTaskWithResults.siteId, postAfter.pageId))
      }
      else
        None
    }

    sitePageIdToRefresh.foreach(refreshPageInMemCache)
  }


  // ----- The janitor actor

  def deletePersonalDataFromOldSessions(): U = {
    writeTxLockAllSites { tx =>
      tx.deletePersonalDataFromOldSessions()
    }
  }

  def deletePersonalDataFromOldAuditLogEntries(): U = {
    writeTxLockAllSites { tx =>
      tx.deletePersonalDataFromOldAuditLogEntries()
    }
  }

  def deletePersonalDataFromOldSpamCheckTasks(): U = {
    writeTxLockAllSites { tx =>
      tx.deletePersonalDataFromOldSpamCheckTasks()
    }
  }

  def deleteOldUnusedUploads(): U =  {
    writeTxLockAllSites { tx =>
      tx.deleteOldUnusedUploads()
    }
  }

  def purgeOldDeletedSites(): U = {
    val now = globals.now()

    val sites = readTx { tx =>
      tx.loadSitesToMaybePurge()
    }

    for (site <- sites; purgeWhen <- site.autoPurgeAt) {
      val isOldEnough = purgeWhen.isBefore(now)
      if (!isOldEnough) {
        logger.debug(s"Not purging deleted site ${site.toLogStBrief} until ${
              purgeWhen.toIso8601NoT}")
      }
      else {
        logger.info(s"Purging deleted site: ${site.toLogSt}")
        val siteIdSet = Set(site.id)
        writeTxLockManySites(siteIdSet) { sysTx =>
          deleteSites(siteIdSet, sysTx, mayDeleteRealSite = true, keepHostname = true)
        }
      }
    }
  }

  def executePendingReviewTasks(): U =  {
    val taskIdsBySite: Map[SiteId, immutable.Seq[ReviewTaskId]] = readTx { tx =>
      // Browser info not saved, not loaded here. [save_mod_br_inf]
      tx.loadReviewTaskIdsToExecute()
    }
    taskIdsBySite foreach { case (siteId, taskIds) =>
      val siteDao = globals.siteDao(siteId)
      taskIds foreach { taskId =>
        // This might invalidate other subsequent review tasks — so we check if the tasks
        // has been invalidated, see [2MFFKR0].
        siteDao.carryOutReviewDecision(taskId)
      }
    }
  }


  def reportSpamClassificationMistakesBackToSpamCheckServices(): Unit = {
    val spamCheckTasks: immutable.Seq[SpamCheckTask] =
      readOnlyTransaction(_.loadMisclassifiedSpamCheckTasks(22))

    for (task <- spamCheckTasks) {
      val someNow = Some(globals.now())
      globals.spamChecker.reportClassificationMistake(task).foreach({
            case (falsePositives, falseNegatives) =>
        globals.e2eTestCounters.numReportedSpamFalsePositives += falsePositives
        globals.e2eTestCounters.numReportedSpamFalseNegatives += falseNegatives
        val siteDao = globals.siteDao(task.siteId)
        siteDao.readWriteTransaction { tx =>
          tx.updateSpamCheckTaskForPostWithResults(
              task.copy(misclassificationsReportedAt = someNow))
        }
      })(globals.executionContext)
    }
  }


  def sendWebhookRequests(): U = {
    val pendingWebhooksBySiteId: Map[SiteId, ImmSeq[Webhook]] = readTx { tx =>
      tx.loadPendingWebhooks()
    }
    for ((siteId, webhooks) <- pendingWebhooksBySiteId) {
      val siteDao = globals.siteDao(siteId)
      siteDao.sendPendingWebhookReqs(webhooks)
    }
  }


  def refreshSystemSettings(): U = {
    val sysSettings = readTx { tx =>
      tx.loadSystemSettings()
    }
    globals.updateSystemSettings(sysSettings)
  }


  // ----- Testing

  def emptyDatabase(): Unit = {
    writeTxLockAllSites { transaction =>
      dieIf(!globals.isOrWasTest, "EsE500EDB0")
      transaction.emptyDatabase()
    }
  }


  def forgetHostname(hostname: String): Unit = {
    memCache.remove(canonicalHostKey(hostname))
  }


  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup] = {
    require(!hostname.contains(":"), "EsE5KYUU7")

    val key = canonicalHostKey(hostname)
    memCache.lookup[CanonicalHostLookup](key) foreach { result => CanonicalHostLookup
      return Some(result)
    }
    readOnlyTransaction(_.lookupCanonicalHost(hostname)) match {
      case None =>
        // Don't cache this.
        // There would be infinitely many origins that maps to nothing, if the DNS server
        // maps a wildcard like *.example.com to this server.
        None
      case Some(result) =>
        memCache.put(key, MemCacheValueIgnoreVersion(result))
        Some(result)
    }
  }
}


object SystemDao {

  /** A mutex, to avoid PostgreSQL serialization errors.
    *
    * The SystemDao write-locks it, when writing to the database,
    * because it writes to "anywhere", often many sites at once.
    *
    * Whilst SiteDao:s only read-locks it — they restrict their writes
    * to specific sites only, and it's ok if many SiteDao:s have write transactions
    * open at the same time, to different sites.
    */
  private val wholeDbLock = new java.util.concurrent.locks.ReentrantReadWriteLock()

  private val wholeDbWriteLock = wholeDbLock.writeLock()
  private val wholeDbReadLock = wholeDbLock.readLock()

  // Wait for some seconds — maybe there's a JVM garbage collection pause.
  private val lockTimeoutSecs = 5L

  // This is for the SystemDao to write lock the whole PostgreSQL database.
  private def withWholeDbWriteLock[R](block: => R): R = {
    if (wholeDbWriteLock.tryLock(lockTimeoutSecs, TimeUnit.SECONDS)) {
      try {
        block
      }
      finally {
        wholeDbWriteLock.unlock()
      }
    }
    else {
      throw new RuntimeException(o"""SystemDao couldn't lock wholeDbWriteLock,
            timed out after $lockTimeoutSecs seconds [TyE0SYSDAOLOCK]""")
    }
  }


  /** This is for SiteDao's to prevent the SystemDao from write locking the
    * whole PostgreSQL database, when a SiteDao has write locked a single site.
    */
  def withWholeDbReadLock[R](block: => R): R = {
    if (wholeDbReadLock.tryLock(lockTimeoutSecs, TimeUnit.SECONDS)) {
      try {
        block
      }
      finally {
        wholeDbReadLock.unlock()
      }
    }
    else {
      throw new RuntimeException(o"""SystemDao or a SiteDao couldn't lock
            wholeDbReadLock, timed out after $lockTimeoutSecs seconds [TyE0SYSDAOLOCK]""")
    }
  }


  private def canonicalHostKey(host: String) =
    // Site id unknown, that's what we're about to lookup.
    MemCacheKeyAnySite(s"$host|SiteByOrigin")


  def removeCanonicalHostCacheEntries(site: Site, memCache: MemCache): Unit = {
    site.hostnames foreach { host =>
      memCache.remove(canonicalHostKey(host.hostname))
    }
  }

}

