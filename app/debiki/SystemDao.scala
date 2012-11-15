/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


package debiki

import com.debiki.v0._
import controllers._
import java.{util => ju}
import play.{api => p}
import play.api.{cache => pc}
import play.api.Play.current
import scala.reflect.ClassTag
import Prelude._


/**
 * Delegates most requests to SystemDbDao. However, hides some
 * SystemDbDao methods, because calling them directly would mess up
 * the cache in SystemDao's subclass CachingSystemDao.
 *
 * Thread safe.
 */
class SystemDao(protected val systemDbDao: SystemDbDao) {


  // ----- Websites (a.k.a. tenants)

  // COULD rename to createFirstWebsite
  def createTenant(name: String): Tenant =
    systemDbDao.createTenant(name)

  // COULD rename to loadWebsitesByIds
  def loadTenants(tenantIds: Seq[String]): Seq[Tenant] =
    systemDbDao.loadTenants(tenantIds)

  // COULD rename to findWebsitesCanonicalHost
  def lookupTenant(scheme: String, host: String): TenantLookup =
    systemDbDao.lookupTenant(scheme, host)


  // ----- Emails

  def loadNotfsToMailOut(delayInMinutes: Int, numToLoad: Int): NotfsToMail =
    systemDbDao.loadNotfsToMailOut(delayInMinutes, numToLoad)


  // ----- Quota

  def loadQuotaState(consumers: Seq[QuotaConsumer])
  : Map[QuotaConsumer, QuotaState] =
    systemDbDao.loadQuotaState(consumers)

  def useMoreQuotaUpdateLimits(deltas: Map[QuotaConsumer, QuotaDelta]): Unit =
    systemDbDao.useMoreQuotaUpdateLimits(deltas)

}



/**
 * Caches tenant ids by server address and port.
 * Currently never removes anything from the cache, because it's not possible
 * to programmatically remove/reassign a tenant's origins (for example,
 * remove http://some-host-addr.com, or have it point to another tenant)
 *
 * Thread safe.
 */
class CachingSystemDao(systemDbDao: SystemDbDao)
  extends SystemDao(systemDbDao) with CachingDao {


  override def lookupTenant(scheme: String, host: String): TenantLookup = {
    val key = _tenantLookupByOriginKey(scheme, host)
    lookupInCache[TenantLookup](key) foreach {
      return _
    }
    super.lookupTenant(scheme, host) match {
      case FoundNothing =>
        // Don't cache this.
        // There are infinitely many origins that maps to nothing, since
        // DNS names *.debiki.net resolves to Debiki's servers.
        FoundNothing
      case tenantLookup =>
        putInCache(key, tenantLookup)
        tenantLookup
    }
  }


  private def _tenantLookupByOriginKey(scheme: String, host: String) =
    s"$scheme|$host|TenantByOrigin"

}

