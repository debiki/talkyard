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
import ed.server.spam.ClearCheckingSpamNowCache
import play.api.libs.json.JsObject
import talkyard.server.JsX
import talkyard.server.TyLogger


class NumSites(val byYou: Int, val total: Int)


/** Database and cache queries that take all sites in mind.
 */
class SystemDao(
  private val dbDaoFactory: DbDaoFactory,
  val cache: DaoMemCache,
  val globals: Globals) {

  private def dbDao2: DbDao2 = dbDaoFactory.newDbDao2()
  private lazy val logger = TyLogger("SystemDao")

  val memCache = new MemCache(NoSiteId, cache, globals.mostMetrics)

  private def readOnlyTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readOnlySystemTransaction(fn)

  // WARNING: [PGSERZERR] Causes transaction rollbacks, rarely and infrequently, if writing
  // to the same parts of the same tables, at the same time as per site transactions.
  // Even if the app server code is otherwise fine and bug free. It's a database thing.
  // So, don't use this for updating per-site things. Instead, create a site specific
  // dao and site specific transactions — they do the database writes under mutex,
  // and so avoids any tx rollbacks.
  def dangerous_readWriteTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readWriteSystemTransaction(fn)

  def dangerous_readWriteTransactionReuseOld[R](
        anyOldTx: Option[SystemTransaction])(fn: SystemTransaction => R): R =
    if (anyOldTx.isDefined) fn(anyOldTx.get)
    else dbDao2.readWriteSystemTransaction(fn)

  def applyEvolutions(): Unit = {
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

  def loadSitesAndStaff(): (Seq[Site], Map[SiteId, Seq[UserInclDetails]]) =
    readOnlyTransaction { tx =>
      val sites = tx.loadSites()
      val staff = tx.loadStaffForAllSites()
      (sites, staff)
    }

  def loadSitesWithIds(siteIds: Seq[SiteId]): Seq[Site] =
    readOnlyTransaction(_.loadSitesWithIds(siteIds))

  def loadSite(siteId: SiteId): Option[Site] =
    readOnlyTransaction(_.loadSitesWithIds(Seq(siteId)).headOption)

  def updateSites(sites: Seq[SuperAdminSitePatch]): Unit = {
    val sitesToClear = mutable.Set[SiteId]()
    for (patch <- sites) {
      val siteInDb = loadSite(patch.siteId)
      if (siteInDb.forall(_.status != patch.newStatus)) {
        sitesToClear.add(patch.siteId)
      }
    }
    dangerous_readWriteTransaction(_.updateSites(sites))  // BUG tx race, rollback risk
    for (siteId <- sitesToClear) {
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
        isTestSiteOkayToDelete = false, createdAt = sysTx.now)

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


  /**
    * During e2e tests, find out which test sites to delete, to make the hostname
    * or something available again. But don't delete them immediately — first
    * acquire a SiteDao mutex (we'll do, a bit below), to avoid PostgreSQL
    * deadlocks if the transaction here deletes the site, but another request
    * tries to update the same site, in a parallel transaction.
    */
  def deleteSitesWithNameAndHostnames(siteName: String, hostnames: Set[String]): Unit = {
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
    SiteDao.synchronizeOnManySiteIds(siteIdsToDelete) {
      // Not dangerous — we locked these site ids (the line above).
      globals.systemDao.dangerous_readWriteTransaction { sysTx =>
        deleteSites(siteIdsToDelete, sysTx)
      }
    }
  }


  def deleteSites(siteIdsToDelete: Set[SiteId], sysTx: SystemTransaction,
        mayDeleteRealSite: Boolean = false): Unit = {

    val deletedHostnames = mutable.Set[String]()

    // ----- Delete the site

    siteIdsToDelete foreach { siteId: SiteId =>
      val site = sysTx.loadSite(siteId)
      deletedHostnames ++= site.map(_.hostnames.map(_.hostname)) getOrElse Nil

      val gotDeleted =
        sysTx.deleteSiteById(siteId, mayDeleteRealSite)

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
    pubId: PublSiteId,
    name: String,
    status: SiteStatus,
    hostname: Option[String],
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

    SiteDao.synchronizeOnManySiteIds(anySiteId.toSet) {
          globals.systemDao.dangerous_readWriteTransactionReuseOld(anySysTx) { sysTx =>
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
        doerId = SystemUserId, // no admin account yet created
        doneAt = newSiteTx.now.toJavaDate,
        browserIdData = browserIdData,
        browserLocation = None,
        targetSiteId = createdFromSiteId))

      newSite.copy(hostnames = newSiteHost.toList)
    }
    catch {
      case ex @ DbDao.SiteAlreadyExistsException(site, details) =>
        logger.error(o"""Cannot create site, dupl key error [TyE4ZKTP01]: $site,
           details: $details""")
        throw ex
    } } }
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

  def deleteFromIndexQueue(post: Post, siteId: SiteId): Unit = {
    dangerous_readWriteTransaction { transaction =>  // BUG tx race, rollback risk
      transaction.deleteFromIndexQueue(post, siteId)
    }
  }

  def addEverythingInLanguagesToIndexQueue(languages: Set[String]): Unit = {
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

  /** Handles spam check results, for a single post, or user profile.
    *
    * @param spamCheckTaskNoResults — A spam check task for the post or user profile.
    * @param spamCheckResults — Results from different external spam check services.
    *
    * COULD REFACTOR move to SpamSiteDao, since now uses only a per site tx.
    */
  def handleSpamCheckResults(spamCheckTaskNoResults: SpamCheckTask, spamCheckResults: SpamCheckResults): Unit = {
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
        return

      val postBefore = siteTx.loadPost(postToSpamCheck.postId) getOrElse {
        // It was hard deleted?
        return
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

  def deletePersonalDataFromOldAuditLogEntries(): Unit = {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deletePersonalDataFromOldAuditLogEntries()
    }
  }

  def deletePersonalDataFromOldSpamCheckTasks(): Unit = {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deletePersonalDataFromOldSpamCheckTasks()
    }
  }

  def deleteOldUnusedUploads(): Unit =  {
    dangerous_readWriteTransaction { tx =>  // BUG tx race, rollback risk
      tx.deleteOldUnusedUploads()
    }
  }

  def executePendingReviewTasks(): Unit =  {
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


  // ----- Testing

  def emptyDatabase(): Unit = {
    dangerous_readWriteTransaction { transaction =>
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

  private def canonicalHostKey(host: String) =
    // Site id unknown, that's what we're about to lookup.
    MemCacheKeyAnySite(s"$host|SiteByOrigin")


  def removeCanonicalHostCacheEntries(site: Site, memCache: MemCache): Unit = {
    site.hostnames foreach { host =>
      memCache.remove(canonicalHostKey(host.hostname))
    }
  }

}

