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
import debiki.EdHttp.throwForbidden
import scala.collection.immutable
import SystemDao._
import debiki.Globals


class NumSites(val byYou: Int, val total: Int)


/** Database and cache queries that take all sites in mind.
 */
class SystemDao(
  private val dbDaoFactory: DbDaoFactory,
  val cache: DaoMemCache,
  val globals: Globals) {

  private def dbDao2: DbDao2 = dbDaoFactory.newDbDao2()

  val memCache = new MemCache(NoSiteId, cache, globals.mostMetrics)

  protected def readOnlyTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readOnlySystemTransaction(fn)

  protected def readWriteTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readWriteSystemTransaction(fn)


  def applyEvolutions() {
    readWriteTransaction(_.applyEvolutions())
  }


  // ----- Sites

  def theSite(siteId: SiteId): Site = getSite(siteId) getOrDie "EsE2WUY5"

  def getOrCreateFirstSite(): Site = getSite(FirstSiteId) getOrElse createFirstSite()

  def getSite(siteId: SiteId): Option[Site] = {
    COULD_OPTIMIZE // move getSite() to SystemDao instead so won't need to create temp SiteDao obj.
    globals.siteDao(siteId).getSite()
  }

  def getSiteByPublId(publSiteId: PublSiteId): Option[Site] = {
    getSiteIdByPublId(publSiteId).flatMap(getSite)
  }

  def getSiteIdByPublId(pubSiteId: PublSiteId): Option[SiteId] = {
    // The publ and private ids never change; no need to ever uncache this.
    memCache.lookup(
      MemCacheKeyAnySite(s"$pubSiteId|pubSiteId"),
      orCacheAndReturn = {
        COULD_OPTIMIZE // don't load *all* sites here.  (And optimize this too: [4GUKW27])
        loadSites().find(_.pubId == pubSiteId) map { site =>
          site.id.asInstanceOf[Integer]
        }
      }).map(_.toInt)
  }

  def loadSites(): Seq[Site] =
    readOnlyTransaction(_.loadSites())

  def loadSitesWithIds(siteIds: Seq[SiteId]): Seq[Site] =
    readOnlyTransaction(_.loadSitesWithIds(siteIds))

  def loadSite(siteId: SiteId): Option[Site] =
    readOnlyTransaction(_.loadSitesWithIds(Seq(siteId)).headOption)

  def updateSites(sites: Seq[(SiteId, SiteStatus)]) {
    readWriteTransaction(_.updateSites(sites))
    for ((siteId, _) <- sites) {
      globals.siteDao(siteId).emptyCache()
    }
  }

  private def createFirstSite(): Site = {
    val pubId =
      if (globals.isOrWasTest) Site.FirstSiteTestPublicId
      else Site.newPublId()
    readWriteTransaction { sysTx =>
      val firstSite = sysTx.createSite(Some(FirstSiteId),
        pubId = pubId, name = "Main Site", SiteStatus.NoAdmin,
        creatorIp = "0.0.0.0",
        quotaLimitMegabytes = None, maxSitesPerIp = 9999, maxSitesTotal = 9999,
        isTestSiteOkayToDelete = false, pricePlan = "-", createdAt = sysTx.now)

      dieIf(firstSite.id != FirstSiteId, "EdE2AE6U0")
      val siteTx = sysTx.siteTransaction(FirstSiteId)

      siteTx.upsertSiteSettings(SettingsToSave(
        orgFullName = Some(Some("Unnamed Organization"))))

      // Don't insert any site host — instead, we use the ed.hostname config value.

      CreateSiteDao.createSystemUser(siteTx)
      CreateSiteDao.createUnknownUser(siteTx)
      CreateSiteDao.createDefaultGroupsAndPermissions(siteTx)

      firstSite
    }
  }


  def createSite(
    pubId: PublSiteId,
    name: String,
    status: SiteStatus,
    hostname: String,
    embeddingSiteUrl: Option[String],
    organizationName: String,
    creatorId: UserId,
    browserIdData: BrowserIdData,
    isTestSiteOkayToDelete: Boolean,
    skipMaxSitesCheck: Boolean,
    deleteOldSite: Boolean,
    pricePlan: PricePlan,
    createdFromSiteId: Option[SiteId]): Site = {

    if (!Site.isOkayName(name))
      throwForbidden("EsE7UZF2_", s"Bad site name: '$name'")

    dieIf(hostname contains ":", "DwE3KWFE7")

    val config = globals.config
    val maxSitesPerIp = skipMaxSitesCheck ? 999999 | config.createSite.maxSitesPerPerson
    val maxSitesTotal = skipMaxSitesCheck ? 999999 | {
      // Allow a little bit more than maxSitesTotal sites, in case Alice starts creating
      // a site, then Bo and Bob finish creating theirs so that the total limit is reached
      // — then it'd be annoying if Alice gets an error message.
      config.createSite.maxSitesTotal + 5
    }

    try readWriteTransaction { sysTx =>
      if (deleteOldSite) {
        dieUnless(SiteHost.isE2eTestHostname(hostname), "EdE7PK5W8")
        dieUnless(SiteHost.isE2eTestHostname(name), "EdE50K5W4")
        sysTx.deleteAnyHostname(hostname)
        val anyDeletedSite = sysTx.deleteSiteByName(name)
        forgetHostname(hostname)
        anyDeletedSite foreach { site =>
          dieIf(site.id > MaxTestSiteId, "EdE20PUJ6", "Trying to delete a *real* site")
          // + also redisCache.clearThisSite() doesn't work if there are many Redis nodes [0GLKW24].
          // This won't clear the watchbar cache: memCache.clearSingleSite(site.id)
          // so instead:
          memCache.clearAllSites()
          // Redis cache cleared below. (2PKF05Y)
        }
      }

      val newSite = sysTx.createSite(id = None, pubId = pubId, name = name, status,
        creatorIp = browserIdData.ip,
        quotaLimitMegabytes = config.createSite.quotaLimitMegabytes,
        maxSitesPerIp = maxSitesPerIp, maxSitesTotal = maxSitesTotal,
        isTestSiteOkayToDelete = isTestSiteOkayToDelete, pricePlan = pricePlan, sysTx.now)

      if (deleteOldSite) {
        // Delete Redis stuff even if no site found (2PKF05Y), because sometimes, when developing,
        // I've imported a SQL dump, resulting in most sites disappearing from the database, but
        // not from the Redis cache. So even if 'anyDeletedSite' is None, might still need to:
        val redisCache = new RedisCache(newSite.id, globals.redisClient, globals.now)
        redisCache.clearThisSite()
      }

      createdFromSiteId foreach { oldSiteId =>
        val oldSiteTx = sysTx.siteTransaction(oldSiteId)
        AuditDao.insertAuditLogEntry(AuditLogEntry(
          siteId = oldSiteId,
          id = AuditLogEntry.UnassignedId,
          didWhat = AuditLogEntryType.CreateSite,
          doerId = creatorId,
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
        requireVerifiedEmail = notIfEmbedded,
        mayComposeBeforeSignup = yesIfEmbedded,
        mayPostBeforeEmailVerified = yesIfEmbedded,
        orgFullName = Some(Some(organizationName))))

      val newSiteHost = SiteHost(hostname, SiteHost.RoleCanonical)
      try newSiteTx.insertSiteHost(newSiteHost)
      catch {
        case _: DuplicateHostnameException =>
          throwForbidden(
            "EdE7FKW20", o"""There's already a site with hostname '${newSiteHost.hostname}'. Add
            the URL param deleteOldSite=true to delete it (works for e2e tests only)""")
      }

      CreateSiteDao.createSystemUser(newSiteTx)
      CreateSiteDao.createUnknownUser(newSiteTx)
      CreateSiteDao.createDefaultGroupsAndPermissions(newSiteTx)

      newSiteTx.insertAuditLogEntry(AuditLogEntry(
        siteId = newSite.id,
        id = AuditLogEntry.FirstId,
        didWhat = AuditLogEntryType.ThisSiteCreated,
        doerId = SystemUserId, // no admin account yet created
        doneAt = newSiteTx.now.toJavaDate,
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = createdFromSiteId))

      newSite.copy(hosts = List(newSiteHost))
    }
    catch {
      case ex @ DbDao.SiteAlreadyExistsException(site) =>
        play.api.Logger.error(s"Cannot create site, dupl key error [TyE4ZKTP01]: $site")
        throw ex
    }
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

  def refreshPageInMemCache(sitePageId: SitePageId) {
    memCache.firePageSaved(sitePageId)
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
  def loadCachedPageVersion(sitePageId: SitePageId)
        : Option[(CachedPageVersion, SitePageVersion)] = {
    readOnlyTransaction { transaction =>
      transaction.loadCachedPageVersion(sitePageId)
    }
  }

  def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender] = {
    readOnlyTransaction { transaction =>
      transaction.loadPageIdsToRerender(limit)
    }
  }


  // ----- Indexing

  def loadStuffToIndex(limit: Int): StuffToIndex = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToIndex(limit)
    }
  }

  def deleteFromIndexQueue(post: Post, siteId: SiteId) {
    readWriteTransaction { transaction =>
      transaction.deleteFromIndexQueue(post, siteId)
    }
  }

  def addEverythingInLanguagesToIndexQueue(languages: Set[String]) {
    readWriteTransaction { transaction =>
      transaction.addEverythingInLanguagesToIndexQueue(languages)
    }
  }


  // ----- Spam

  def loadStuffToSpamCheck(limit: Int): StuffToSpamCheck = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToSpamCheck(limit)
    }
  }

  def deleteFromSpamCheckQueue(task: SpamCheckTask) {
    readWriteTransaction { transaction =>
      transaction.deleteFromSpamCheckQueue(
          task.siteId, postId = task.postId, postRevNr = task.postRevNr)
    }
  }

  def dealWithSpam(spamCheckTask: SpamCheckTask, isSpamReason: String) {
    // COULD if is new page, no replies, then hide the whole page (no point in showing a spam page).
    // Then mark section page stale below (4KWEBPF89).
    val sitePageIdToRefresh = readWriteTransaction { transaction =>
      val siteTransaction = transaction.siteTransaction(spamCheckTask.siteId)
      val postBefore = siteTransaction.loadPost(spamCheckTask.postId) getOrElse {
        // It was hard deleted?
        return
      }

      val postAfter = postBefore.copy(
        bodyHiddenAt = Some(siteTransaction.now.toJavaDate),
        bodyHiddenById = Some(SystemUserId),
        bodyHiddenReason = Some(s"Spam because: $isSpamReason"))

      val reviewTask = PostsDao.makeReviewTask(
        createdById = SystemUserId, postAfter, reasons = Vector(ReviewReason.PostIsSpam),
        siteTransaction): ReviewTask

      siteTransaction.updatePost(postAfter)
      siteTransaction.upsertReviewTask(reviewTask)

      // If the post was visible, need to rerender the page + update post counts.
      if (postBefore.isVisible) {
        val oldMeta = siteTransaction.loadPageMeta(postAfter.pageId) getOrDie "EdE4FK0YUP"

        val newNumOrigPostRepliesVisible =
          if (postAfter.isOrigPostReply) oldMeta.numOrigPostRepliesVisible - 1
          else oldMeta.numOrigPostRepliesVisible

        val newMeta = oldMeta.copy(
          numRepliesVisible = oldMeta.numRepliesVisible - 1,
          numOrigPostRepliesVisible = newNumOrigPostRepliesVisible,
          version = oldMeta.version + 1)

        siteTransaction.updatePageMeta(newMeta, oldMeta = oldMeta,
          markSectionPageStale = false) // (4KWEBPF89)
        BUG; SHOULD // updatePagePopularity(PagePartsDao(pageId, transaction), transaction)
        // but tricky to do right now. Also, I should perhaps, instead of updating the page
        // popularity instantly, have a background job queue for pages that need to be updated?
        // Like the job queue for pages to reindex? Then, if many many pages need to have their
        // popularity updated "at once", the server won't go crazy and spike the CPU. Instead,
        // it'll look at the pages one at a time, when it has some CPU to spare.

        Some(SitePageId(spamCheckTask.siteId, postAfter.pageId))
      }
      else
        None
    }

    sitePageIdToRefresh.foreach(refreshPageInMemCache)
  }


  // ----- Old stuff deletion

  def deletePersonalDataFromOldAuditLogEntries() {
    readWriteTransaction { tx =>
      tx.deletePersonalDataFromOldAuditLogEntries()
    }
  }

  def deleteOldUnusedUploads()  {
    readWriteTransaction { tx =>
      tx.deleteOldUnusedUploads()
    }
  }


  // ----- Testing

  def emptyDatabase() {
    readWriteTransaction { transaction =>
      dieIf(!globals.isOrWasTest, "EsE500EDB0")
      transaction.emptyDatabase()
    }
  }


  def forgetHostname(hostname: String) {
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

  private def canonicalHostKey(host: String) =
    // Site id unknown, that's what we're about to lookup.
    MemCacheKeyAnySite(s"$host|SiteByOrigin")


  def removeCanonicalHostCacheEntries(site: Site, memCache: MemCache) {
    site.hosts foreach { host =>
      memCache.remove(canonicalHostKey(host.hostname))
    }
  }

}

