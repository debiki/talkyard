/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import scala.collection.immutable


trait SystemTransaction {  RENAME // to SysTx, started already
  def allSitesWriteLocked: Bo

  def commit(): Unit
  def rollback(): Unit

  def now: When

  /** If test mode, deletes and recreates the database, if there's a validation error.
    */
  def applyEvolutions(): Unit

  // ----- Sites

  def countWebsites(createdFromIp: String, creatorEmailAddress: Option[String], testSites: Boolean): Int
  def countWebsitesTotal(testSites: Boolean): Int

  /** Throws SiteAlreadyExistsException if the site already exists.
    * Throws TooManySitesCreatedException if you've created too many websites already
    * (from the same IP or email address).
    */
  def createSite(id: Option[SiteId], pubId: PubSiteId,
    name: String, status: SiteStatus, creatorIp: String,
    quotaLimitMegabytes: Option[Int], maxSitesPerIp: Int, maxSitesTotal: Int,
    isTestSiteOkayToDelete: Boolean, createdAt: When): Site

  def siteTransaction(siteId: SiteId): SiteTransaction  // oops doesn't (and cannot) use SiteDao.synchronizeOnSiteId

  def loadSiteByPubId(pubId: PubSiteId): Option[Site]

  def loadAllSitesInclDetails(): immutable.Seq[SiteInclDetails]
  def loadSiteInclDetailsById(siteId: SiteId): Option[SiteInclDetails]
  def loadSitesDeletedNotPurged(): ImmSeq[SiteInclDetails]

  def loadSitesByIds(tenantIds: Seq[SiteId]): Seq[Site]

  def loadSiteByName(name: String): Option[Site]

  def loadSiteByHostname(hostname: String): Option[Site] =
    // This looks up the canonical hostname and site id, for `hostname`.
    lookupCanonicalHost(hostname).flatMap(canonicalHost => loadSite(canonicalHost.siteId))

  def loadSite(siteId: SiteId): Option[Site] =
    loadSitesByIds(Seq(siteId)).headOption

  def updateSites(sites: Seq[SuperAdminSitePatch]): Unit

  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup]

  def insertSiteHost(siteId: SiteId, host: Hostname): Unit
  def deleteAnyHostname(hostname: String): Boolean

  def deleteSiteById(siteId: SiteId, mayDeleteRealSite: Boolean = false): Boolean


  // ----- Staff users

  def loadStaffForAllSites(): Map[SiteId, Vector[UserInclDetails]]


  // ----- Summary emails, and notifications

  def loadStatsForUsersToMaybeEmailSummariesTo(now: When, limit: Int)
        : Map[SiteId, immutable.Seq[UserStats]]

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]]


  // ----- Pages

  def loadCachedPageVersion(sitePageId: SitePageId, renderParams: PageRenderParams):
    Option[(CachedPageVersion, SitePageVersion)]
  def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender]

  // ----- Indexing

  def loadStuffToIndex(limit: Int): StuffToIndex
  def deleteFromIndexQueue(post: Post, siteId: SiteId): Unit
  def addEverythingInLanguagesToIndexQueue(languages: Set[String]): Unit

  // ----- Spam check queue

  def loadStuffToSpamCheck(limit: Int): immutable.Seq[SpamCheckTask]
  def loadMisclassifiedSpamCheckTasks(limit: Int): immutable.Seq[SpamCheckTask]

  // ----- The janitor: Old stuff deletion

  def deletePersonalDataFromOldAuditLogEntries(): Unit
  def deletePersonalDataFromOldSpamCheckTasks(): Unit
  def deleteOldUnusedUploads(): Unit = { /* ... later ... */ }

  // ----- The janitor: Review decisions

  def loadReviewTaskIdsToExecute(): Map[SiteId, immutable.Seq[ReviewTaskId]]

  // ----- Testing

  /** Deletes all data from the database. For example, for a RDBMS,
    * would delete all rows from all tables. (Except for some "static" data.)
    */
  def emptyDatabase(): Unit

}


case class DuplicateHostnameException(hostname: String) extends QuickMessageException(
  s"Hostname already exists: '$hostname'")

case class DuplicateUsernameException(username: String) extends QuickMessageException(
  s"Username already exists: '$username'")
