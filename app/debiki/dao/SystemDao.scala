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
import play.{api => p}


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

        val anySitesToDeleteMaybeDupls: Vec[Site] =
          sysTx.loadSiteByHostname(hostname).toVector ++ sysTx.loadSiteByName(name).toVector

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
          siteToDelete.hosts.map(_.hostname)
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
        orgFullName = Some(Some(organizationName))))

      val newSiteHost = SiteHost(hostname, SiteHost.RoleCanonical)
      try newSiteTx.insertSiteHost(newSiteHost)
      catch {
        case _: DuplicateHostnameException =>
          throwForbidden(
            "TyE5AKB02ZF", o"""There's already a site with hostname '${newSiteHost.hostname}'. Add
            the URL param deleteOldSite=true to delete it (works for e2e tests only)""")
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


  def maybeUpdateTraefikRulesFile() {
    val traefikRulesDir = sys.env.getOrElse("TRAEFIK_RULES_DIR", {   // [5FJKS20]
      return
    })

    val sites = readOnlyTransaction { tx =>
      tx.loadSites()
    }

    p.Logger.info(s"Writing Traefik rules for ${sites.length} sites to temp file... [TyMTRAEFIK01]")
    val (config, numHostnames) = generateTraefikRules(sites, globals.baseDomainNoPort, globals.now())
    val rulesDirNoSlash = traefikRulesDir.dropRightWhile(_ == '/')

    // First save the file to a temporary location — because if updating the file
    // directly in the directory that Traefik watches, then Traefik can reload it,
    // whilst we're still writing to it (especially if it's large) and then logs error
    // about the file being corrupt, and fails to load lots of rules — some hostnames
    // can then become broken.
    // Here're the error messages:
    // proxy_1 | time="2019-01-03T15:27:24Z" level=error msg="Error occurred during watcher callback: Near line 668 (last key parsed 'frontends.dummy_81.entryPoints'): expected value but found '\\x00' instead"
    // proxy_1 | time="2019-01-03T15:27:24Z" level=error msg="Error occurred during watcher callback: Near line 25232 (last key parsed 'frontends.dummy_3151.routes.rule_1.rule'): unexpected EOF"
    // proxy_1 | time="2019-01-03T15:27:25Z" level=info msg="Server configuration reloaded on :80"
    // proxy_1 | time="2019-01-03T15:27:25Z" level=info msg="Server configuration reloaded on :443"
    // proxy_1 | time="2019-01-03T15:27:25Z" level=info msg="Server configuration reloaded on :8070"

    val tempPathStr = rulesDirNoSlash + "/.custom-hostname-frontends-writing-to"
    new java.io.PrintWriter(tempPathStr) {
      try write(config)
      finally close()
    }
    p.Logger.info(s"Renaming Traefik rules temp file to real name ... [TyMTRAEFIK02]")
    val tempPath = new java.io.File(tempPathStr).toPath
    val realPath = new java.io.File(rulesDirNoSlash + "/custom-hostname-frontends.toml").toPath
    java.nio.file.Files.move(tempPath, realPath, java.nio.file.StandardCopyOption.ATOMIC_MOVE)
    p.Logger.info(o"""Done updating Traefik rules: $numHostnames hostnames,
      for ${sites.length} sites [TyMTRAEFIK03]""")
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

      val reviewTask = PostsDao.createOrAmendOldReviewTask(
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


  // ----- The janitor actor

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


  def generateTraefikRules(sites: immutable.Seq[Site], baseDomain: String, now: When)
        : (String, Int) = {
    val dotBaseDomain = "." + baseDomain
    var numHostnames = 0

    // Sort everything so one can find the differences between two files, in a diff.
    val sitesSortedOldRealFirst = sites.sortBy(s =>
      // Test site ids increase downwards.
      if (s.isTestSite) - s.id + 100*1000*1000 else s.id )

    val perSiteFrontendConfigs: Seq[String] = sitesSortedOldRealFirst flatMap { site =>
      // Create one frontend per hostname, so that failing to renew a cert for one hostname,
      // won't prevent the others from getting renewed. — If all hostnames were placed in
      // the same cert, then, LetsEncrypt would reject the cert, which means all of them,
      // if any old domain has expired and fails to renew. Which could break the whole site.
      val hostnames: Seq[String] = site.hosts.map(_.hostname.takeWhile(_ != ':')).sorted.distinct
      var index = 0
      val hostnamesThatNeedHttpsCert = hostnames.filter(h =>
        !IsIpAddrRegex.matches(h) &&
        !h.endsWith(".localhost") && h != "localhost" &&
        !h.endsWith(".localdomain") && h != "localdomain" && {
          // You're supposed to get your own wildcard cert, if you specify a base domain.
          // Exclude hostnames covered by that cert.
          if (!h.endsWith(dotBaseDomain)) {
            // Not covered by wildcard cert. Tell Traefik to generate a cert.
            true
          }
          else {
            val localHostname = h.dropRight(dotBaseDomain.length)
            // Wildcard certs don't work for sub sub domains. So, if this is a
            // sub subdomain, need to include in the list so that Traefik will generate a cert.
            // Example:  sub.subdomain.base-domain.com — yes, include.
            // But not:  subdomain.base-domain.com — covered by *.base-domain.com wildcard cert.
            localHostname.contains(".")
          }
        })
      hostnamesThatNeedHttpsCert map { hostname =>
        index += 1
        numHostnames += 1
        // Better avoid '-' (for negative site ids) in key names: instead of site_-123, use site_m123,
        // where 'm' means 'minus'.
        val idWithMNotMinus = site.id.toString.replace('-', 'm')
        val frontendName = s"talkyard_site_${idWithMNotMinus}_hostname_$index"
        i"""
           |  [frontends.$frontendName]
           |    entryPoints = ["http", "https"]
           |    backend = "talkyard_web"
           |    passHostHeader = true
           |    [frontends.$frontendName.routes.rule_1]
           |      rule = "Host:$hostname"
           |"""

        // Later, could, per site, based on which plan it has subscribed for:
        //    [frontends.$frontendName.ratelimit.rateset.rateset_1]
        //      period = "15s"
        //      average = 100
        //      burst = 200
      }
    }

    val nowStr = toIso8601(now.toJavaDate)

    val config = i"""# Auto generated file, created by the Talkyard app server, at $nowStr. [ATOGTRFK]
       |#
       |# There are $numHostnames frontends with a Host:(some-hostname) rule, for ${sites.length} sites.
       |#
       |# Traefik will provision a LetsEncrypt HTTPS certificate, for all those hostnames.
       |# *.$baseDomain hostnames were excluded — because that's your talkyard.baseDomain setting,
       |# and you're supposed to provide a wildcard cert for any such domain of yours.
       |# Localhost and localdomain hostnames were also excluded.
       |
       |[frontends]
       |${perSiteFrontendConfigs.mkString}
       |${/*
          // This is for testing if having 1 000 or 10 000 frontends affects Traefik's performance.
          // 50 000 frontends —> Traefik becomes 98 - 99% slower, even if using only 1 of the frontends.
          val numDummyFrontends = 50*1000 - numHostnames
          ((1 to numDummyFrontends) map { dummyIx => i"""
            |  [frontends.dummy_$dummyIx]
            |    entryPoints = ["http", "https"]
            |    backend = "talkyard_web"
            |    passHostHeader = true
            |    [frontends.dummy_$dummyIx.routes.rule_1]
            |      rule = "Host:dummy-server-$dummyIx.example.com"
            |"""
          }).mkString("\n") */ ""
        }
       |"""
    (config, numHostnames)
  }

}

