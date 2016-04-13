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
import debiki.{CacheMetric, Globals}
import nl.grons.metrics.scala.Meter
import java.{util => ju}
import scala.reflect.ClassTag
import CachingDao._



trait CacheEvents {  // COULD move to separate file

  private var pageCreatedListeners = List[(PagePath => Unit)]()
  private var pageSavedListeners = List[(SitePageId => Unit)]()
  private var pageMovedListeners = List[(PagePath => Unit)]()
  private var userCreatedListeners = List[(User => Unit)]()


  def onPageCreated(callback: (PagePath => Unit)) {
    pageCreatedListeners ::= callback
  }


  def firePageCreated(pagePath: PagePath) {
    pageCreatedListeners foreach (_(pagePath))
  }


  def onPageSaved(callback: (SitePageId => Unit)) {
    pageSavedListeners ::= callback
  }


  def firePageSaved(sitePageId: SitePageId) {
    pageSavedListeners foreach (_(sitePageId))
  }


  def onPageMoved(callback: (PagePath => Unit)) {
    pageMovedListeners ::= callback
  }


  def firePageMoved(newPath: PagePath) {
    pageMovedListeners foreach (_(newPath))
  }


  def onUserCreated(callback: (User => Unit)) {
    userCreatedListeners ::= callback
  }


  def fireUserCreated(user: User) {
    userCreatedListeners foreach (_(user))
  }

}



object CachingDao {

  case class CacheKey(siteId: SiteId, rest: String) {
    override def toString = s"$siteId|$rest"
  }

  def CacheKeyAnySite(value: String) = CacheKey(siteId = "?", value)

  def CacheValueIgnoreVersion[A](value: A) = CacheValue(value, IgnoreSiteCacheVersion)

  private val IgnoreSiteCacheVersion = 0
  private val FirstSiteCacheVersion = 1

}



/**
  * Functions that lookup, add and remove stuff to/from a cache.
  *
  * Cache keys must contain a '|' (otherwise CachingDao believes you've
  * accidentally passed in a raw string, not yet converted to a cache key).
  * Use e.g. this key format:  (tenant-id)|(page-id)|(cache-entry-type).
  */
trait CachingDao extends CacheEvents {
  self: {
    def siteId: SiteId
    def cache: DaoMemCache
  } =>

  private var _thisSitesCacheVersionNow: Option[Long] = None


  /** Remembers the current site's cache version, so we don't need to look it up in the cache.
    */
  private def thisSitesCacheVersionNow = {
    if (_thisSitesCacheVersionNow.isEmpty) {
      _thisSitesCacheVersionNow = Some(lookupSiteCacheVersion(this.siteId))
    }
    _thisSitesCacheVersionNow.getOrDie("EsE8PYK42")
  }


  private def time[A](anyCacheMetric: CacheMetric)(block: Function[Meter, A]): A = {
    val cacheMetric =
      if (anyCacheMetric ne null) anyCacheMetric
      else Globals.mostMetrics.defaultSiteDaoCacheMetric
    cacheMetric.timer.time {
      block(cacheMetric.hitMeter)
    }
  }


  /**
   * Looks up something in the cache. If not found, and
   * if `orCacheAndReturn` has been specified, evaluates it,
   * and caches the resulting value (if any) and returns it.
   */
  def lookupInCache[A](
        key: CacheKey,
        orCacheAndReturn: => Option[A] = null,
        metric: CacheMetric = null,
        ignoreSiteCacheVersion: Boolean = false)(
        implicit classTag: ClassTag[A]): Option[A] = time(metric) { hitMeter =>

    lookupInCacheToReplace(key) foreach { case CacheValue(value, version) =>
      hitMeter.mark()
      return Some(value)
    }

    // Cache any new value, and return it:

    // Load the site version before we evaluate `orCacheAndReturn` (if ever), so
    // the `siteCacheVersion` will be from before we start calculating `orCacheAndReturn`.
    val siteCacheVersion =
      if (ignoreSiteCacheVersion) IgnoreSiteCacheVersion
      else siteCacheVersionNow(key.siteId)

    val newValueOpt = orCacheAndReturn
    if (newValueOpt eq null)
      return None

    // – In case some other thread just inserted another value,
    // overwrite it, because `newValue` is probably more recent.
    // – For now, don't store info on cache misses.
    newValueOpt foreach { newValue =>
      putInCache(key, CacheValue(newValue, siteCacheVersion))
    }
    newValueOpt
  }


  /** Returns a cached value, if any, including the site cache version number,
    * so the value can be replaced atomically.
    */
  def lookupInCacheToReplace[A](key: CacheKey)(implicit classTag: ClassTag[A])
        : Option[CacheValue[A]] = {
    // (See class EhCachePlugin in play/api/cache/Cache.scala, for how Play Framework
    // does with `getObjectValue`. Namely exactly as on the next line.)
    Option(cache.getIfPresent(key.toString)) foreach { item =>
      val cachedValue = item.value

      if (!classTag.runtimeClass.isInstance(cachedValue))
        throwNoSuchElem("DwE8ZX02", s"""Found a ${classNameOf(cachedValue)},
          expected a ${classTag.runtimeClass.getName}, when looking up: $key""")

      // Is the cached value up-to-date or has the site recently been modified somehow,
      // and we need to discard it?
      var upToDate = item.siteCacheVersion == IgnoreSiteCacheVersion
      if (!upToDate) {
        val siteCacheVersion = siteCacheVersionNow(key.siteId)
        upToDate = siteCacheVersion <= item.siteCacheVersion
      }

      if (upToDate)
        return Some(CacheValue[A](cachedValue.asInstanceOf[A], item.siteCacheVersion))

      // Cached value is stale.
      removeFromCache(key)
    }

    None
  }


  def putInCache(key: CacheKey, value: DaoMemCacheAnyItem) {
    cache.put(key.toString, value)
  }


  def putInCacheIfAbsent[A](key: CacheKey, value: DaoMemCacheAnyItem): Boolean = {
    val javaFn = new ju.function.Function[String, DaoMemCacheAnyItem] {
      override def apply(dummy: String): DaoMemCacheAnyItem = value
    }
    val itemInCacheAfter = cache.get(key.toString, javaFn)
    itemInCacheAfter eq value
  }


  def removeFromCache(key: CacheKey) {
    cache.invalidate(key.toString)
  }


  /** Removes from the cache all things cached on behalf of siteId.
    */
  def emptyCache(siteId: String) {
    val siteCacheVersion = siteCacheVersionNow(siteId)
    val nextVersion = siteCacheVersion + 1  // BUG Race condition.
    cache.put(siteCacheVersionKey(siteId), CacheValue(nextVersion, -1))
    _thisSitesCacheVersionNow = None
  }


  def siteCacheVersionNow(): Long = siteCacheVersionNow(siteId)


  def siteCacheVersionNow(siteId: SiteId): Long = {
    if (this.siteId == siteId)
      thisSitesCacheVersionNow
    else
      lookupSiteCacheVersion(siteId)
  }


  private def lookupSiteCacheVersion(siteId: SiteId): Long = {
    val item = cache.getIfPresent(siteCacheVersionKey(siteId))
    if (item eq null)
      return FirstSiteCacheVersion

    val value = item.value
    dieIf(!value.isInstanceOf[Long], "EsE996F2")
    dieIf(item.siteCacheVersion != -1, "EsE4GKW20")
    value.asInstanceOf[Long]
  }


  private def siteCacheVersionKey(siteId: SiteId) =
    s"$siteId|SiteCacheVersion"

}

