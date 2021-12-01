/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import debiki.{CacheMetric, MostMetrics}
import nl.grons.metrics4.scala.Meter
import java.{util => ju}
import scala.reflect.ClassTag
import MemCache._
import talkyard.server.TyLogger



object MemCache {
  val IgnoreSiteCacheVersion = 0
  val FirstSiteCacheVersion = 1
}


/**
  * BUG RACE:s [cache_race_counter]: something gets loaded and cached, but at the
  * same time gets uncached — then, the old version might get re-insterted.
  * Handle this by adding a counter, and all uncache fns bump the counter,
  * and all add-to-cache fns skip adding to cache, if that counter has changed,
  * since just before they started loading the stuff to cache.
  */

class MemCache(val siteId: SiteId, val cache: DaoMemCache, mostMetrics: MostMetrics) {

  REFACTOR // change DaoMemCache: one per site  [mem_cache_per_site] [mem_cache_exp_secs]

  private val logger = TyLogger("MemCache")

  COULD_OPTIMIZE; REFACTOR // Inline all clean-cache calls instead. [rm_cache_listeners]
  // Skip this listener stuff.  — Then, simpler to see what's happening, exactly
  // what gets cleared, when. And slightly faster, Dao:s more light-weight.
  // Like so:
  // def onPageCreated(pageId) {
  //   siteDao.clearXCache()
  //   siteDao.clearYCache()
  //   siteDao.clearZCache()
  // }
  // And rename DaoMemCache to CacheImpl and MemCache to DaoMemCache
  // or InProcessDaoCache?


  // COULD delete & rewrite this listener stuff. It's error prone & complicated, bug just killed.
  // Something like this?
  // - change firePageCreated() to uncacheStuffBecausePageCreated(pageId)
  // - change firePageSaved() to uncacheStuffBecausePageSaved(pageId)
  // ... etc
  private var pageCreatedListeners = List[(SiteId, PagePathWithId) => Unit]()
  private var pageSavedListeners = List[(SitePageId => Unit)]()
  private var pageMovedListeners = List[(PagePath => Unit)]()
  private var userCreatedListeners = List[(Participant => Unit)]()


  def onPageCreated(callback: (SiteId, PagePathWithId) => Unit): Unit = {
    pageCreatedListeners ::= callback
  }


  def firePageCreated(siteId: SiteId, pagePath: PagePathWithId): Unit = {
    pageCreatedListeners foreach (_(siteId, pagePath))
  }


  def onPageSaved(callback: (SitePageId => Unit)): Unit = {
    pageSavedListeners ::= callback
  }


  def firePageSaved(sitePageId: SitePageId): Unit = {
    pageSavedListeners foreach (_(sitePageId))
  }


  def onPageMoved(callback: (PagePath => Unit)): Unit = {
    pageMovedListeners ::= callback
  }


  def firePageMoved(newPath: PagePath): Unit = {
    pageMovedListeners foreach (_(newPath))
  }


  def onUserCreated(callback: (Participant => Unit)): Unit = {
    userCreatedListeners ::= callback
  }


  def fireUserCreated(user: Participant): Unit = {
    userCreatedListeners foreach (_(user))
  }


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
      else mostMetrics.defaultSiteDaoCacheMetric
    cacheMetric.timer.time {
      block(cacheMetric.hitMeter)
    }
  }


  /**
   * Looks up something in the cache. If not found, and
   * if `orCacheAndReturn` has been specified, evaluates it,
   * and caches the resulting value (if any) and returns it.
   */
  def lookup[A](
        key: MemCacheKey,
        ifFound: => Unit = {},
        orCacheAndReturn: => Option[A] = null,
        reloadUncacheIfChanged: Bo = false,
        //expireAfterSeconds: Option[Int] = None,
        metric: CacheMetric = null,
        ignoreSiteCacheVersion: Boolean = false)(
        implicit classTag: ClassTag[A]): Option[A] = time(metric) { hitMeter =>

    lookupToReplace(key) foreach { case MemCacheItem(value, version) =>
      hitMeter.mark()
      return Some(value)
    }

    // Cache any new value, and return it:

    // Load the site version before we evaluate `orCacheAndReturn` (if ever), so
    // the `siteCacheVersion` will be from before we start calculating `orCacheAndReturn`.
    val siteCacheVersion =
      if (ignoreSiteCacheVersion) IgnoreSiteCacheVersion
      else siteCacheVersionNow(key.siteId)

    val anyNewValue: Opt[A] = orCacheAndReturn
    if (anyNewValue eq null)
      return None

    // For now, don't store info on cache misses. Maybe could be a param?
    // Because sometimes could make sense. But maybe put an upper limit on how
    // many "miss items" there can be? So no one can fill the available RAM with
    // None cache entries.
    val newValue = anyNewValue getOrElse {
      return None
    }

    // In case some other thread just inserted another value,
    // overwrite it, because `newValue` is probably more recent.
    // But ...
    put(key, MemCacheItem(newValue, siteCacheVersion))

    if (!reloadUncacheIfChanged)
      return anyNewValue

    // ... However [cache_race], maybe it's important to avoid data races, e.g.
    // overwriting a newer value with a fractions of a second older value — maybe
    // newValue is in fact older than some other value another thread tries to cache.
    // So, reload/recompute the value, and if it's now different from what
    // we put into the cache just above, then delete it from the cache
    // (otherwise we'd need to reload and compare in a loop — just uncaching it
    // is simpler).
    //
    COULD // somehow debug-verify that orCacheAndReturn here will create its
    // own separate read-only rdb transaction — otherwise this'd be just pointless.
    // However, as of 2021-11, that's how the caller(s) work.
    val anyNewValue2 = {
      val v = orCacheAndReturn
      if (v eq null) None else v
    }

    var uncacheWhy = ""
    if (anyNewValue2 contains newValue) {
      // Fine, no race.
    }
    else if (anyNewValue2.isEmpty) {
      // The item must have been deleted by another thread? Then it shouldn't
      // be in the cache.
      uncacheWhy = "deleted"
    }
    else {
      // Another thread has modified the value. We could put the new value in
      // the cache, however, thereafter we'd need to reload it again and see if it
      // changed again, and so on.  It's simpler & safer to just uncache it?
      uncacheWhy = "modified"
    }

    if (uncacheWhy.nonEmpty) {
      cache.invalidate(key.toString)
      logger.debug(
            s"s${key.siteId}: Mem cache: Data race: Cached, uncached: '${key.rest
              }' — was $uncacheWhy by other db tx")
    }

    anyNewValue2
  }


  /** Returns a cached value, if any, including the site cache version number,
    * so the value can be replaced atomically.
    */
  def lookupToReplace[A](key: MemCacheKey)(implicit classTag: ClassTag[A])
        : Option[MemCacheItem[A]] = {
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
        return Some(MemCacheItem[A](cachedValue.asInstanceOf[A], item.siteCacheVersion))

      // Cached value is stale.
      remove(key)
    }

    None
  }


  def put(key: MemCacheKey, value: DaoMemCacheAnyItem): Unit = {
    cache.put(key.toString, value)
    logger.trace(s"s${key.siteId}: Mem cache: Inserting: ${key.rest} ")
  }


  def putIfAbsent[A](key: MemCacheKey, value: DaoMemCacheAnyItem): Boolean = {
    val javaFn = new ju.function.Function[String, DaoMemCacheAnyItem] {
      override def apply(dummy: String): DaoMemCacheAnyItem = value
    }
    val itemInCacheAfter = cache.get(key.toString, javaFn)
    val wasInserted = itemInCacheAfter eq value
    if (wasInserted) {
      logger.trace(s"s${key.siteId}: Mem cache: Inserted, was absent: ${key.rest} ")
    }
    wasInserted
  }


  /** Iff oldValue is in the map, replaces it with newValue, atomically, and returns true.
    */
  def replace(key: MemCacheKey, oldValue: DaoMemCacheAnyItem, newValue: DaoMemCacheAnyItem)
        : Boolean = {
    logger.trace(s"s${key.siteId}: Mem cache: Replacing: ${key.rest} ")
    cache.asMap().replace(key.toString, oldValue, newValue)
  }


  def remove(key: MemCacheKey): Unit = {
    logger.trace(s"s${key.siteId}: Mem cache: Removing: ${key.rest}")
    cache.invalidate(key.toString)
  }


  def clearAllSites(): Unit = {
    logger.debug("Emptying the whole mem cache.")
    cache.invalidateAll()
  }


  def clearThisSite(): Unit = {
    clearSingleSite(siteId)
  }


  private def clearSingleSite(siteId: SiteId): Unit = {
    logger.debug(s"s$siteId: Emptying mem cache.")
    val siteCacheVersion = siteCacheVersionNow(siteId)
    val nextVersion = siteCacheVersion + 1  // BUG Race condition.
    cache.put(siteCacheVersionKey(siteId), MemCacheItem(nextVersion, -1))
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

