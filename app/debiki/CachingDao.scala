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


/**
 * Functions that lookup, add and remove stuff to/from a cache.
 */
trait CachingDao {


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

    pc.Cache.get(key) match {
      case someValue @ Some(value) =>
        if (!(classTag.runtimeClass.isInstance(value)))
          throwNoSuchElem("DwE8ZX02", s"""Found a ${classNameOf(value)},
            expected a ${classTag.runtimeClass.getName},
            when looking up: `$key`""")
        someValue.asInstanceOf[Option[A]]

      case None =>
        if (orCacheAndReturn eq null)
          return None

        val newValueOpt = orCacheAndReturn
        // – In case some other thread just inserted another value,
        // overwrite it, because `newValue` is probably more recent.
        // – For now, don't store info on cache misses.
        newValueOpt foreach(newValue => pc.Cache.set(key, newValue, expiration))
        newValueOpt
    }
  }


  def putInCache[A](key: String, value: A) {
    pc.Cache.set(key, value)
  }


  def removeFromCache(key: String) {
    pc.Cache.remove(key)
  }

}
