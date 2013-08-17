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
import scala.reflect.ClassTag
import Prelude._



trait CacheEvents {  // COULD move to separate file

  private var pageCreatedListeners = List[(Page => Unit)]()
  private var pageSavedListeners = List[(SitePageId => Unit)]()
  private var pageMovedListeners = List[(PagePath => Unit)]()


  def onPageCreated(callback: (Page => Unit)) {
    pageCreatedListeners ::= callback
  }


  def firePageCreated(page: Page) {
    pageCreatedListeners foreach (_(page))
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


}



/**
 * Functions that lookup, add and remove stuff to/from a cache.
 *
 * Cache keys must contain a '|' (otherwise CachingDao believes you've
 * accidentally passed in a raw string, not yet converted to a cache key).
 * Use e.g. this key format:  (tenant-id)|(page-id)|(cache-entry-type).
 */
trait CachingDao extends CacheEvents {


  /**
   * Looks up something in the cache. If not found, and
   * if `orCacheAndReturn` has been specified, evaluates it,
   * and caches the resulting value (if any) and returns it.
   */
  def lookupInCache[A](
        key: String,
        orCacheAndReturn: => Option[A] = null,
        expiration: Int = 0)(
        implicit classTag: ClassTag[A])
        : Option[A] = {
    debugCheckKey(key)

    // (See class EhCachePlugin in play/api/cache/Cache.scala, for how Play Framework
    // does with `getObjectValue`. Namely exactly as on the next line.)
    Option(ehcache.get(key)).map(_.getObjectValue) match {
      case someValue @ Some(value) =>
        if (!(classTag.runtimeClass.isInstance(value)))
          throwNoSuchElem("DwE8ZX02", s"""Found a ${classNameOf(value)},
            expected a ${classTag.runtimeClass.getName},
            when looking up: `$key`""")
        someValue.asInstanceOf[Option[A]]

      case None =>
        val newValueOpt = orCacheAndReturn
        if (newValueOpt eq null)
          return None

        // – In case some other thread just inserted another value,
        // overwrite it, because `newValue` is probably more recent.
        // – For now, don't store info on cache misses.
        newValueOpt foreach(newValue => putInCache(key, newValue, expiration))
        newValueOpt
    }
  }


  def putInCache[A](key: String, value: A, expiration: Int = 0) {
    debugCheckKey(key)
    ehcache.put(cacheElem(key, value, expiration))
  }


  def putInCacheIfAbsent[A](key: String, value: A, expiration: Int = 0): Boolean = {
    debugCheckKey(key)
    val anyOldElem = ehcache.putIfAbsent(cacheElem(key, value, expiration))
    val wasInserted = anyOldElem eq null
    wasInserted
  }


  def replaceInCache[A](key: String, oldValue: A, newValue: A): Boolean = {
    debugCheckKey(key)
    val oldElem = cacheElem(key, oldValue)
    val newElem = cacheElem(key, newValue)
    val wasReplaced = ehcache.replace(oldElem, newElem)
    wasReplaced
  }


  def removeFromCache(key: String) {
    debugCheckKey(key)
    ehcache.remove(key)
  }


  private def debugCheckKey(key: String) {
    // I separate various parts of the cache key (e.g. tenant id and page id)
    // with "|", and append "|<cache-key-type>". If there is no "|", then
    // I have forgotten to build a key from some string, e.g. passed in
    // `pageId` instead of `makeKey(pageId)`.
    assert(key contains "|")
  }


  /** An EhCache instance. Right now, all caches use the same instance, could change that.
    * However doesn't matter? Won't have 2 applications running in the same JVM.
    * I suppose/guess it's good w.r.t. performance to have only 1 EhCache instance?
    * So might as well reuse Play's?
    *
    * In class EhCachePlugin in play/api/cache/Cache.scala you'll see how Play
    * creates its per-application cache, namely exactly like below.
    */
  private val ehcache: net.sf.ehcache.Cache =
      net.sf.ehcache.CacheManager.create().getCache("play")


  private def cacheElem(key: String, value: Any, expiration: Int = 0) = {
    val elem = new net.sf.ehcache.Element(key, value)
    // This is what Play Framework does, see class  EhCachePlugin
    // in play/api/cache/Cache.scala. Without this code, I think EHCache removes
    // the elem after a few seconds or minutes.
    if (expiration == 0) elem.setEternal(true)
    elem.setTimeToLive(expiration)
    elem
  }

}

