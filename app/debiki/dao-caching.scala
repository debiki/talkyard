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
import scala.xml.NodeSeq
import Prelude._



class CachingTenantDaoFactory(
  private val _dbDaoFactory: DbDaoFactory,
  private val _quotaCharger: QuotaCharger
  /* _cacheConfig: CacheConfig */)
  extends TenantDaoFactory {

  def newTenantDao(quotaConsumers: QuotaConsumers): TenantDao = {
    val dbDao = _dbDaoFactory.newTenantDbDao(quotaConsumers)
    val chargingDbDao = new ChargingTenantDbDao(dbDao, _quotaCharger)
    new CachingTenantDao(chargingDbDao)
  }

}


class CachingTenantDao(tenantDbDao: ChargingTenantDbDao)
  extends TenantDao(tenantDbDao)
  with CachingDao
  with CachingConfigValueDao
  with CachingPagePathDao
  with CachingRenderedPageHtmlDao
  with CachingUserDao {


  override def savePageActions(request: DebikiRequest[_], page: Debate,
        actions: List[Action]): Seq[Action] = {

    if (actions isEmpty)
      return Nil

    val actionsWithId = super.savePageActions(request, page, actions)

    // Possible optimization: Examine all actions, and refresh cache only
    // if there are e.g. EditApp:s or approved Post:s (but ignore Edit:s --
    // unless applied & approved)
    uncacheRenderedPage(pageId = page.id, origin = request.host)

    // Who should know about all these uncache-this-on-change-
    // -of-that relationships? For now:
    uncacheConfigMap(pageId = page.id)

    // Would it be okay to simply overwrite the in mem cache with this
    // updated page? — Only if I make `++` avoid adding stuff that's already
    // present!
    //val pageWithNewActions =
    // page_! ++ actionsWithId ++ pageReq.login_! ++ pageReq.user_!

    // In the future, also refresh page index cache, and cached page titles?
    // (I.e. a cache for DW1_PAGE_PATHS.)

    // ------ Page action cache (I'll probably remove it)
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
    pc.Cache.remove(_pageActionsKey(page.id))
    // ------ /Page action cache

    actionsWithId
  }


  override def loadPage(pageId: String): Option[Debate] =
    lookupInCache[Debate](_pageActionsKey(pageId),
      orCacheAndReturn = {
        super.loadPage(pageId)
      })


  def _pageActionsKey(pageId: String): String = s"$pageId|$tenantId|PageActions"

}

