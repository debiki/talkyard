/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import com.debiki.v0._
import java.{util => ju}
import play.{api => p}
import play.api.{cache => pc}
import play.api.Play.current
import scala.reflect.ClassTag
import Prelude._



class CachingDaoFactory(
  private val _dbDaoFactory: DbDaoFactory,
  private val _quotaCharger: QuotaCharger
  /* _cacheConfig: CacheConfig */)
  extends DaoFactory {

  def systemDao = _dbDaoFactory.systemDbDao

  def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao = {
    val dbDao = _dbDaoFactory.newTenantDbDao(quotaConsumers)
    new CachingTenantDao(dbDao, _quotaCharger)
  }

}


class CachingTenantDao(tenantDbDao: TenantDbDao, quotaCharger: QuotaCharger)
  extends TenantDao(tenantDbDao, quotaCharger) {


  override def savePageActions[T <: Action](
        debateId: String, xs: List[T]): List[T] = {
    pc.Cache.remove(_pageActionsKey(debateId))
    return super.savePageActions(debateId, xs)

    // COULD instead update value in cache (adding the new actions to
    // the cached page). But then `savePageActions` also needs to know
    // which users created the actions, so their login/idty/user instances
    // can be cached as well (or it won't be possible to render the page,
    // later, when it's retrieved from the cache).
    // So: COULD save login, idty and user to databaze *lazily*.
    // Also, logins that doesn't actually do anything won't be saved
    // to db, which is goood since they waste space.
    // (They're useful for statistics, but that should probably be
    // completely separated from the "main" db?)

    /*  Updating the cache would be something like: (with ~= Google Guava cache)
      val key = Key(tenantId, debateId)
      var replaced = false
      while (!replaced) {
        val oldPage =
           _cache.tenantDaoDynVar.withValue(this) {
             _cache.cache.get(key)
           }
        val newPage = oldPage ++ actions ++ people-who-did-the-actions
        // newPage might == oldPage, if another thread just refreshed
        // the page from the database.
        replaced = _cache.cache.replace(key, oldPage, newPage)
    */
  }


  override def loadPage(pageId: String): Option[Debate] = {
    _lookup[Debate](_pageActionsKey(pageId),
      orInsertAndReturn = super.loadPage(pageId)
    )
  }


  private def _lookup[A](key: String, orInsertAndReturn: => Option[A],
        expiration: Int = 0)(implicit classTag: ClassTag[A]): Option[A] = {
    pc.Cache.get(key) match {
      case someValue @ Some(value) =>
        if (!(classTag.runtimeClass.isInstance(value)))
          throwNoSuchElem("DwE902k3", s"""Found a ${classNameOf(value)},
            expected a ${classNameOf(classTag.runtimeClass)},
            when looking up: `$key`""")
        someValue.asInstanceOf[Option[A]]
      case None =>
        val newValueOpt = orInsertAndReturn
        // – In case some other thread just inserted another value,
        // overwrite it, because `newValue` is probably more recent.
        // – For now, don't store info on cache misses.
        newValueOpt foreach(newValue => pc.Cache.set(key, newValue, expiration))
        newValueOpt
    }
  }


  def _pageActionsKey(pageId: String): String = s"$pageId.$tenantId.PAGEID"

}

