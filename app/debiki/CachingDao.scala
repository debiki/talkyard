/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
//import controllers._
import java.{util => ju}
import play.{api => p}
import play.api.{cache => pc}
import play.api.Play.current
import scala.reflect.ClassTag
import Prelude._



trait CacheEvents {  // COULD move to separate file

  private var pageSavedListeners = List[(SitePageId => Unit)]()
  private var pageMovedListeners = List[(PagePath => Unit)]()


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

    pc.Cache.get(key) match {
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
        newValueOpt foreach(newValue => pc.Cache.set(key, newValue, expiration))
        newValueOpt
    }
  }


  def putInCache[A](key: String, value: A) {
    debugCheckKey(key)
    pc.Cache.set(key, value)
  }


  def putInCacheIfAbsent[A](key: String, value: A): Boolean = {
    debugCheckKey(key)
    val anyOldElem = ehcache.putIfAbsent(cacheElem(key, value))
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
    pc.Cache.remove(key)
  }


  private def debugCheckKey(key: String) {
    // I separate various parts of the cache key (e.g. tenant id and page id)
    // with "|", and append "|<cache-key-type>". If there is no "|", then
    // I have forgotten to build a key from some string, e.g. passed in
    // `pageId` instead of `makeKey(pageId)`.
    assert(key contains "|")
  }


  private def ehcache: net.sf.ehcache.Cache =
      net.sf.ehcache.CacheManager.create().getCache("play")


  private def cacheElem(key: String, value: Any) = {
    val elem = new net.sf.ehcache.Element(key, value)
    // For now, cache forever. These two lines is how Play Framework
    // specifies that `elem` is to be cached forever. By default, EHCache
    // otherwise removes the elem after a few seconds or minutes.
    elem.setEternal(true)
    elem.setTimeToLive(0)
    elem
  }

}

