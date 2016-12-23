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
import java.{util => ju}
import play.api.Play.current
import SystemDao._


/** Database and cache queries that take all sites in mind.
 */
class SystemDao(private val dbDaoFactory: DbDaoFactory, val cache: DaoMemCache) {

  def dbDao2 = dbDaoFactory.newDbDao2()

  val memCache = new MemCache("?", cache)

  protected def readOnlyTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readOnlySystemTransaction(fn)

  protected def readWriteTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readWriteSystemTransaction(fn)


  def applyEvolutions() {
    readWriteTransaction(_.applyEvolutions())
  }


  // ----- Sites

  def theSite(siteId: SiteId) = getSite(siteId) getOrDie "EsE2WUY5"

  def getSite(siteId: SiteId): Option[Site] = {
    COULD_OPTIMIZE // move getSite() to SystemDao instead so won't need to create temp SiteDao obj.
    debiki.Globals.siteDao(siteId).getSite()
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
      debiki.Globals.siteDao(siteId).emptyCache()
    }
  }


  // ----- Pages

  def refreshPageInMemCache(sitePageId: SitePageId) {
    memCache.firePageSaved(sitePageId)
  }


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]] =
    readOnlyTransaction { transaction =>
      transaction.loadNotificationsToMailOut(delayInMinutes, numToLoad)
    }


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
        bodyHiddenAt = Some(siteTransaction.currentTime),
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

        Some(SitePageId(spamCheckTask.siteId, postAfter.pageId))
      }
      else
        None
    }

    sitePageIdToRefresh.foreach(refreshPageInMemCache)
  }

  // ----- Testing

  def emptyDatabase() {
    readWriteTransaction { transaction =>
      dieIf(!play.api.Play.isTest, "EsE500EDB0")
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

