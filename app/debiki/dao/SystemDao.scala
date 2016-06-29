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


  // ----- Websites (a.k.a. tenants)

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[SiteId]): Seq[Site] =
    readOnlyTransaction(_.loadTenants(tenantIds))

  def loadSite(siteId: SiteId): Option[Site] =
    readOnlyTransaction(_.loadTenants(Seq(siteId)).headOption)


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]] =
    readOnlyTransaction(_.loadNotificationsToMailOut(delayInMinutes, numToLoad))


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


  // ----- Testing

  def emptyDatabase() {
    readWriteTransaction { transaction =>
      dieIf(!play.api.Play.isTest, "EsE500EDB0")
      transaction.emptyDatabase()
    }
  }


  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup] = {
    require(!hostname.contains(":"), "EsE5KYUU7")

    val key = _tenantLookupByOriginKey(hostname)
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


  private def _tenantLookupByOriginKey(host: String) =
    // Site id unknown, that's what we're about to lookup.
    MemCacheKeyAnySite(s"$host|TenantByOrigin")

}

