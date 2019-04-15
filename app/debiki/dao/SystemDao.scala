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
import debiki.Globals
import play.api.libs.json.{JsObject, Json}
import talkyard.server.JsX


class NumSites(val byYou: Int, val total: Int)


/** Database and cache queries that take all sites in mind.
 */
class SystemDao(
  private val dbDaoFactory: DbDaoFactory,
  val cache: DaoMemCache,
  val globals: Globals) {

  private def dbDao2: DbDao2 = dbDaoFactory.newDbDao2()

  val memCache = new MemCache(NoSiteId, cache, globals.mostMetrics)

  private def readOnlyTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readOnlySystemTransaction(fn)

  // WARNING: [PGSERZERR] Causes transaction rollbacks, rarely and infrequently, if writing
  // to the same parts of the same tables, at the same time as per site transactions.
  // Even if the app server code is otherwise fine and bug free. It's a database thing.
  // So, don't use this for updating per-site things. Instead, create a site specific
  // dao and site specific transactions — they do the database writes under mutex,
  // and so avoids any tx rollbacks.
  private def dangerous_readWriteTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readWriteSystemTransaction(fn)


  def applyEvolutions() {
    dangerous_readWriteTransaction(_.applyEvolutions())
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
    dangerous_readWriteTransaction(_.updateSites(sites))  // BUG tx race, rollback risk
    for ((siteId, _) <- sites) {
      globals.siteDao(siteId).emptyCache()
    }
  }


  private def createFirstSite(): Site = {
    val pubId =
      if (globals.isOrWasTest) Site.FirstSiteTestPublicId
      else Site.newPublId()
    // Not dangerous: The site doesn't yet exist, so no other transactions can access it.
    dangerous_readWriteTransaction { sysTx =>
      val firstSite = sysTx.createSite(Some(FirstSiteId),
        pubId = pubId, name = "Main Site", SiteStatus.NoAdmin,
        creatorIp = "0.0.0.0",
        quotaLimitMegabytes = None, maxSitesPerIp = 9999, maxSitesTotal = 9999,
        isTestSiteOkayToDelete = false, pricePlan = "-", createdAt = sysTx.now)

      dieIf(firstSite.id != FirstSiteId, "EdE2AE6U0")
      val siteTx = sysTx.siteTransaction(FirstSiteId)

      // Keep this in sync with createSite(). (5DWSR42)

      siteTx.upsertSiteSettings(SettingsToSave(
        orgFullName = Some(Some("Unnamed Organization"))))

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


  def createSite(
    pubId: PublSiteId,
    name: String,
    status: SiteStatus,
    hostname: Option[String],
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

    dieIf(hostname.exists(_ contains ":"), "DwE3KWFE7")

    val config = globals.config
    val maxSitesPerIp = skipMaxSitesCheck ? 999999 | config.createSite.maxSitesPerPerson
    val maxSitesTotal = skipMaxSitesCheck ? 999999 | {
      // Allow a little bit more than maxSitesTotal sites, in case Alice starts creating
      // a site, then Bo and Bob finish creating theirs so that the total limit is reached
      // — then it'd be annoying if Alice gets an error message.
      config.createSite.maxSitesTotal + 5
    }

    // Not dangerous: The site doesn't yet exist, so no other transactions can access it.
    try dangerous_readWriteTransaction { sysTx =>
      if (deleteOldSite) {
        dieIf(hostname.exists(!Hostname.isE2eTestHostname(_)), "TyE7PK5W8")
        dieIf(!Hostname.isE2eTestHostname(name), "TyE50K5W4")

        val anySitesToDeleteMaybeDupls: Vec[Site] =
          if (hostname.isEmpty) Vector.empty else
            sysTx.loadSiteByHostname(hostname.get).toVector ++ sysTx.loadSiteByName(name).toVector

        val anySitesToDelete = anySitesToDeleteMaybeDupls.distinct
        val deletedAlready = mutable.HashSet[SiteId]()

        val anyDeletedHostnames: Seq[String] = anySitesToDelete flatMap { siteToDelete =>
          dieIf(siteToDelete.id > MaxTestSiteId, "EdE20PUJ6", "Trying to delete a *real* site")

          // Delete the site. Maybe we've deleted it alread — although we do `.distinct`
          // above, there's a tiny tiny likelihood for duplicates — in case we happened
          // to load it twice, and it was changed in between, so `.distinct` didn't "work".
          val gotDeleted = sysTx.deleteSiteById(siteToDelete.id)
          dieIf(!gotDeleted && !deletedAlready.contains(siteToDelete.id),
            "TyE2ABK493U4", s"Could not delete site: $siteToDelete")

          deletedAlready.add(siteToDelete.id)
          siteToDelete.hostnames.map(_.hostname)
        }

        anyDeletedHostnames.toSet foreach this.forgetHostname

        // + also redisCache.clearThisSite() doesn't work if there are many Redis nodes [0GLKW24].
        // This won't clear the watchbar cache: memCache.clearSingleSite(site.id)
        // so instead:
        if (anyDeletedHostnames.nonEmpty) {
          memCache.clearAllSites()
          // Redis cache cleared below, for the new site only (if overwriting old). (2PKF05Y)
        }

        if (isTestSiteOkayToDelete) {
          globals.endToEndTestMailer.tell(
            "ForgetEndToEndTestEmails" -> anySitesToDelete.map(_.id), Actor.noSender)
        }
      }

      // Keep all this in sync with createFirstSite(). (5DWSR42)

      val newSite = sysTx.createSite(id = None, pubId = pubId, name = name, status,
        creatorIp = browserIdData.ip,
        quotaLimitMegabytes = config.createSite.quotaLimitMegabytes,
        maxSitesPerIp = maxSitesPerIp, maxSitesTotal = maxSitesTotal,
        isTestSiteOkayToDelete = isTestSiteOkayToDelete, pricePlan = pricePlan, sysTx.now)

      // Delete Redis stuff even if no site found (2PKF05Y), because sometimes, when developing
      // one empties the SQL database or imports a dump, resulting in most sites disappearing
      // from the database, but not from the Redis cache. So even if 'anyDeletedSite' is None,
      // might still need to:
      val redisCache = new RedisCache(newSite.id, globals.redisClient, globals.now)
      redisCache.clearThisSite()

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
        // Blogs barely get any comments nowadays (instead, everyone uses Facebook/Reddit/etc),
        // so, by default, make it easy to post a blog comment: don't require people to create
        // real accounts. Guest comments always get queued for moderation anyway. [4JKFWP4]
        allowGuestLogin = yesIfEmbedded,
        requireVerifiedEmail = notIfEmbedded,
        mayComposeBeforeSignup = yesIfEmbedded,
        mayPostBeforeEmailVerified = yesIfEmbedded,
        // Features intended for forums — like chat and direct messages — just make people
        // confused, in a blog comments site, right.
        enableForum = notIfEmbedded,
        // People who create new sites via a hosted service, might not be technical
        // people; to keep things simple for them, disable API and tags, initially. [DEFFEAT]
        enableApi = Some(Some(false)),
        enableTags = Some(Some(false)),
        enableChat = notIfEmbedded,
        enableDirectMessages = notIfEmbedded,
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
        doerId = SystemUserId, // no admin account yet created
        doneAt = newSiteTx.now.toJavaDate,
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = createdFromSiteId))

      newSite.copy(hostnames = newSiteHost.toList)
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

  def loadStuffToIndex(limit: Int): StuffToIndex = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToIndex(limit)
    }
  }

  def deleteFromIndexQueue(post: Post, siteId: SiteId) {
    dangerous_readWriteTransaction { transaction =>  // BUG tx race, rollback risk
      transaction.deleteFromIndexQueue(post, siteId)
    }
  }

  def addEverythingInLanguagesToIndexQueue(languages: Set[String]) {
    dangerous_readWriteTransaction { transaction =>  // BUG tx race, rollback risk
      transaction.addEverythingInLanguagesToIndexQueue(languages)
    }
  }


  // ----- Spam

  def loadStuffToSpamCheck(limit: Int): immutable.Seq[SpamCheckTask] = {
    readOnlyTransaction { transaction =>
      transaction.loadStuffToSpamCheck(limit)
    }
  }

  // COULD move to SpamSiteDao, since now uses only a per site tx.
  //
  def handleSpamCheckResults(spamCheckTaskNoResults: SpamCheckTask, spamCheckResults: SpamCheckResults) {
    val postToSpamCheck= spamCheckTaskNoResults.postToSpamCheck getOrElse {
      // Currently registration spam is checked directly when registering;
      // we don't save anything to the database, and shouldn't find anything here later.
      unimplemented("Delayed dealing with spam for things other than posts " +
        "(i.e. registration spam?) [TyE295MKAR2]")
    }

    val spamFoundResults: immutable.Seq[SpamCheckResult.SpamFound] =
      spamCheckResults.collect { case r: SpamCheckResult.SpamFound => r }

    val numIsSpamResults = spamFoundResults.length
    val numNotSpamResults = spamCheckResults.length - numIsSpamResults

    val spamCheckTaskWithResults: SpamCheckTask =
      spamCheckTaskNoResults.copy(
        resultAt = Some(globals.now()),
        resultJson = Some(JsObject(spamCheckResults.map(r =>
            r.spamCheckerDomain -> JsX.JsSpamCheckResult(r)))),
        resultText = Some(spamCheckResults.map(r => i"""
            |${r.spamCheckerDomain}:
            |${r.humanReadableMessage}""").mkString("------").trim),
        numIsSpamResults = Some(numIsSpamResults),
        numNotSpamResults = Some(numNotSpamResults))

    // COULD if is new page, no replies, then hide the whole page (no point in showing a spam page).
    // Then mark section page stale below (4KWEBPF89).
    val sitePageIdToRefresh = globals.siteDao(spamCheckTaskWithResults.siteId).readWriteTransaction {
          siteTransaction =>

      // Add the spam check results from the spam check service, so we won't re-check
      // this again and again.
      siteTransaction.updateSpamCheckTaskForPostWithResults(spamCheckTaskWithResults)

      if (spamFoundResults.isEmpty)
        return

      val postBefore = siteTransaction.loadPost(postToSpamCheck.postId) getOrElse {
        // It was hard deleted?
        return
      }

      val postAfter = postBefore.copy(
        bodyHiddenAt = Some(siteTransaction.now.toJavaDate),
        bodyHiddenById = Some(SystemUserId),
        bodyHiddenReason = Some(
          s"Is spam or malware?:\n\n" +
          spamFoundResults.mkString("\n\n")))

      val reviewTask: ReviewTask = PostsDao.createOrAmendOldReviewTask(
        createdById = SystemUserId, postAfter, reasons = Vector(ReviewReason.PostIsSpam),
        siteTransaction)

      siteTransaction.updatePost(postAfter)

      // Add a review task, so a human will check this out. When hen has
      // done that, we'll hide or show the post, if needed, and, if the human
      // disagrees with the spam check service, we'll tell the spam check service
      // that it did a mistake. [SPMSCLRPT]
      siteTransaction.upsertReviewTask(reviewTask)

      SECURITY; COULD // if the author hasn't posted more than a few posts,  [DETCTHR]
      // and they haven't gotten any like votes or replies,
      // and many of the author's posts have been detected as spam —
      // then:
      //  - Hide all the author's not-yet-reviewed posts, and mark hen as a Moderate Threat.
      //  - Moderate Threat: Should block hen from posting more posts, if hen has more than,
      //    say five?, posts pending review. To prevent staff from having to review really
      //    lots of posts by a single maybe-spammer.

      // If the post was visible, need to rerender the page + update post counts.
      if (postBefore.isVisible) {
        val oldMeta = siteTransaction.loadPageMeta(postAfter.pageId) getOrDie "EdE4FK0YUP"

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

        siteTransaction.updatePageMeta(newMeta, oldMeta = oldMeta,
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

  def deletePersonalDataFromOldAuditLogEntries() {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deletePersonalDataFromOldAuditLogEntries()
    }
  }

  def deletePersonalDataFromOldSpamCheckTasks() {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deletePersonalDataFromOldSpamCheckTasks()
    }
  }

  def deleteOldUnusedUploads()  {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deleteOldUnusedUploads()
    }
  }

  def executePendingReviewTasks()  {
    val taskIdsBySite: Map[SiteId, immutable.Seq[ReviewTaskId]] = readOnlyTransaction { tx =>
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


  def reportSpamClassificationMistakesBackToSpamCheckServices() {
    val spamCheckTasks: immutable.Seq[SpamCheckTask] =
      readOnlyTransaction(_.loadMisclassifiedSpamCheckTasks(22))

    for (task <- spamCheckTasks) {
      globals.spamChecker.reportClassificationMistake(task).foreach({
            case (falsePositives, falseNegatives) =>
        globals.e2eTestCounters.numReportedSpamFalsePositives += falsePositives
        globals.e2eTestCounters.numReportedSpamFalseNegatives += falseNegatives
        val taskDone = task.copy(misclassificationsReportedAt = Some(globals.now()))
        val siteDao = globals.siteDao(task.siteId)
        siteDao.readWriteTransaction { tx =>
          tx.updateSpamCheckTaskForPostWithResults(taskDone)
        }
      })(globals.executionContext)
    }
  }


  // ----- Testing

  def emptyDatabase() {
    dangerous_readWriteTransaction { transaction =>
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
    site.hostnames foreach { host =>
      memCache.remove(canonicalHostKey(host.hostname))
    }
  }

}

