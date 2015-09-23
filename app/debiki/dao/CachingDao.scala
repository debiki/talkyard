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

  case class CacheKey(siteId: SiteId, rest: String)

  def CacheKeyAnySite(value: String) = CacheKey(siteId = "?", value)

  case class CacheValue[A](value: A, siteCacheVersion: Long)
  def CacheValueIgnoreVersion[A](value: A) = CacheValue(value, IgnoreSiteCacheVersion)

  private val IgnoreSiteCacheVersion = 0
  private val FirstSiteCacheVersion = 1

  /** An EhCache instance. Right now, all caches use the same instance, could change that.
    * However doesn't matter? Won't have 2 applications running in the same JVM.
    * I suppose/guess it's good w.r.t. performance to have only 1 EhCache instance?
    * So might as well reuse Play's?
    *
    * In class EhCachePlugin in play/api/cache/Cache.scala you'll see how Play
    * creates its per-application cache, namely exactly like below.
    */
  private lazy val ehcache: net.sf.ehcache.Ehcache = {
    // Ensure Play has created its default cache:
    import play.api.Play.current
    play.api.cache.Cache.get("dummy")
    // Then fetch and reuse that default cache:
    val playCache = net.sf.ehcache.CacheManager.create().getCache("play")
    // Results in "java.lang.NoSuchMethodError: net.sf.ehcache.Ehcache.getStatistics":
    //com.codahale.metrics.ehcache.InstrumentedEhcache.instrument(Globals.metricRegistry, playCache)
    playCache
  }

  def putInCache[A](key: CacheKey, value: CacheValue[A], expiration: Int = 0) {
    ehcache.put(cacheElem(key, value, expiration))
  }

  def removeFromCache(key: CacheKey) {
    ehcache.remove(key)
  }

  private def cacheElem(key: Any, value: CacheValue[_], expiration: Int = 0) = {
    val elem = new net.sf.ehcache.Element(key, value.value)
    elem.setVersion(value.siteCacheVersion)
    // This is what Play Framework does, see class  EhCachePlugin
    // in play/api/cache/Cache.scala. Without this code, I think EHCache removes
    // the elem after a few seconds or minutes.
    if (expiration == 0) elem.setEternal(true)
    elem.setTimeToLive(expiration)
    elem
  }

}



/**
 * Functions that lookup, add and remove stuff to/from a cache.
 *
 * Cache keys must contain a '|' (otherwise CachingDao believes you've
 * accidentally passed in a raw string, not yet converted to a cache key).
 * Use e.g. this key format:  (tenant-id)|(page-id)|(cache-entry-type).
 */
trait CachingDao extends CacheEvents {
  self: { def siteId: SiteId } =>


  /** Remembers the current site's cache version, so we don't need to look it up in the cache.
    */
  private lazy val thisSitesCacheVersionNow = lookupSiteCacheVersion(this.siteId)


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
        ignoreSiteCacheVersion: Boolean = false,
        expiration: Int = 0)(
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
      putInCache(key, CacheValue(newValue, siteCacheVersion), expiration = expiration)
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
    Option(ehcache.get(key)) foreach { ehCacheElement =>
      val cachedValue = ehCacheElement.getObjectValue

      if (!classTag.runtimeClass.isInstance(cachedValue))
        throwNoSuchElem("DwE8ZX02", s"""Found a ${classNameOf(cachedValue)},
          expected a ${classTag.runtimeClass.getName}, when looking up: $key""")

      // Is the cached value up-to-date or has the site recently been modified somehow,
      // and we need to discard it?
      var upToDate = ehCacheElement.getVersion == IgnoreSiteCacheVersion
      if (!upToDate) {
        val siteCacheVersion = siteCacheVersionNow(key.siteId)
        upToDate = siteCacheVersion <= ehCacheElement.getVersion
      }

      if (upToDate)
        return Some(CacheValue[A](cachedValue.asInstanceOf[A], ehCacheElement.getVersion))

      // Cached value is stale.
      removeFromCache(key)
    }

    None
  }


  def putInCache[A](key: CacheKey, value: CacheValue[A], expiration: Int = 0) {
    CachingDao.putInCache(key, value, expiration)
  }


  def putInCacheIfAbsent[A](key: CacheKey, value: CacheValue[A], expiration: Int = 0): Boolean = {
    val anyOldElem = ehcache.putIfAbsent(cacheElem(key, value, expiration))
    val wasInserted = anyOldElem eq null
    wasInserted
  }


  def replaceInCache[A](key: CacheKey, oldValue: CacheValue[A], newValue: CacheValue[A])
        : Boolean = {
    val oldElem = cacheElem(key, oldValue)
    val newElem = cacheElem(key, newValue)
    val wasReplaced = ehcache.replace(oldElem, newElem)
    wasReplaced
  }


  def removeFromCache(key: CacheKey) {
    CachingDao.removeFromCache(key)
  }


  /** Removes from the cache all things cached on behalf of siteId.
    */
  def emptyCache(siteId: String) {
    val siteCacheVersion = siteCacheVersionNow(siteId)
    val nextVersion = siteCacheVersion + 1  // BUG Race condition.
    val elem = new net.sf.ehcache.Element(siteCacheVersionKey(siteId), nextVersion)
    elem.setEternal(true) // see comments in `cacheElem()` above.
    elem.setTimeToLive(0) //
    ehcache.put(elem)
  }


  def siteCacheVersionNow(): Long = siteCacheVersionNow(siteId)


  def siteCacheVersionNow(siteId: SiteId): Long = {
    if (this.siteId == siteId)
      thisSitesCacheVersionNow
    else
      lookupSiteCacheVersion(siteId)
  }


  private def lookupSiteCacheVersion(siteId: SiteId): Long = {
    val elem = ehcache.get(siteCacheVersionKey(siteId))
    if (elem eq null)
      return FirstSiteCacheVersion

    val value = elem.getValue
    alwaysAssert(value.isInstanceOf[Long], "DwE996F2")
    value.asInstanceOf[Long]
  }


  private def siteCacheVersionKey(siteId: SiteId) =
    s"$siteId|SiteCacheVersion"

}

