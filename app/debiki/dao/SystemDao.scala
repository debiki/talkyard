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
import CachingDao.{CacheKeyAnySite, CacheValueIgnoreVersion}


/**
 * Delegates most requests to SystemDbDao. However, hides some
 * SystemDbDao methods, because calling them directly would mess up
 * the cache in SystemDao's subclass CachingSystemDao.
 *
 * Thread safe.
 */
class SystemDao(private val dbDaoFactory: DbDaoFactory) {

  @deprecated("use readOnlyTransaction() instead", "now")
  protected val systemDbDao = dbDaoFactory.systemDbDao

  def dbDao2 = dbDaoFactory.newDbDao2()

  def applyEvolutions() {
    systemDbDao.applyEvolutions()
  }

  def loadUser(siteId: SiteId, userId: UserId) =
    systemDbDao.loadUser(siteId, userId)

  protected def readOnlyTransaction[R](fn: SystemTransaction => R): R =
    dbDao2.readOnlySystemTransaction(fn)

  // ----- Websites (a.k.a. tenants)

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[SiteId]): Seq[Site] =
    systemDbDao.loadTenants(tenantIds)

  def loadSite(siteId: SiteId): Option[Site] =
    systemDbDao.loadTenants(Seq(siteId)).headOption

  def lookupCanonicalHost(hostname: String): Option[CanonicalHostLookup] = {
    dieIf(hostname contains ":", "DwE5KYUU7")
    systemDbDao.lookupCanonicalHost(hostname)
  }


  // ----- Notifications

  def loadNotificationsToMailOut(delayInMinutes: Int, numToLoad: Int)
        : Map[SiteId, Seq[Notification]] =
    systemDbDao.loadNotificationsToMailOut(delayInMinutes, numToLoad)


  def isCachedContentHtmlStale(sitePageId: SitePageId): Boolean = {
    readOnlyTransaction { transaction =>
      transaction.isCachedContentHtmlStale(sitePageId)
    }
  }

  def loadPageIdsToRerender(limit: Int): Seq[PageIdToRerender] = {
    readOnlyTransaction { transaction =>
      transaction.loadPageIdsToRerender(limit)
    }
  }


  // ----- Testing

  def emptyDatabase() {
    systemDbDao.emptyDatabase()
  }

}



/**
 * Caches tenant ids by server address and port.
 * Currently never removes anything from the cache, because it's not possible
 * to programmatically remove/reassign a tenant's origins (for example,
 * remove http://some-host-addr.com, or have it point to another tenant)
 *
 * Thread safe.
 */
class CachingSystemDao(dbDaoFactory: DbDaoFactory)
  extends SystemDao(dbDaoFactory) with CachingDao {

  def siteId = "?"


  override def lookupCanonicalHost(host: String): Option[CanonicalHostLookup] = {
    val key = _tenantLookupByOriginKey(host)
    lookupInCache[CanonicalHostLookup](key) foreach { result => CanonicalHostLookup
      return Some(result)
    }
    super.lookupCanonicalHost(host) match {
      case None =>
        // Don't cache this.
        // There would be infinitely many origins that maps to nothing, if the DNS server
        // maps a wildcard like *.example.com to this server.
        None
      case Some(result) =>
        putInCache(key, CacheValueIgnoreVersion(result))
        Some(result)
    }
  }


  private def _tenantLookupByOriginKey(host: String) =
    // Site id unknown, that's what we're about to lookup.
    CacheKeyAnySite(s"$host|TenantByOrigin")

}

