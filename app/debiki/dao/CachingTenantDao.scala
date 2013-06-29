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

import com.debiki.v0._
import debiki._
import java.{util => ju}
import play.{api => p}
import play.api.{cache => pc}
import play.api.Play.current
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
  with CachingAssetBundleDao
  with CachingConfigValueDao
  with CachingPagePathMetaDao
  with CachingPageSummaryDao
  with CachingRenderedPageHtmlDao
  with CachingUserDao {


  override def createPage(page: Page): Page = {
    val pageWithIds = tenantDbDao.createPage(page)
    firePageCreated(pageWithIds)
    pageWithIds
  }


  override def savePageActionsGenNotfsImpl(page: PageNoPath, actions: List[PostActionDtoOld])
        : (PageNoPath, Seq[PostActionDtoOld]) = {

    if (actions isEmpty)
      return (page, Nil)

    val newPageAndActionsWithId =
      super.savePageActionsGenNotfsImpl(page, actions)

    // Possible optimization: Examine all actions, and refresh cache only
    // if there are e.g. EditApp:s or approved Post:s (but ignore Edit:s --
    // unless applied & approved)
    uncacheRenderedPage(pageId = page.id)

    // Who should know about all these uncache-this-on-change-
    // -of-that relationships? For now:
    uncachePageMeta(page.id)
    // ... Like so perhaps? Each module registers change listeners?
    firePageSaved(SitePageId(siteId = tenantId, pageId = page.id))

    // if (is _site.conf || is any stylesheet or script)
    // then clear all asset bundle related caches. For ... all websites, for now??

    // Would it be okay to simply overwrite the in mem cache with this
    // updated page? — Only if I make `++` avoid adding stuff that's already
    // present!
    //val pageWithNewActions =
    // page_! ++ actionsWithId ++ pageReq.login_! ++ pageReq.user_!

    // In the future, also refresh page index cache, and cached page titles?
    // (I.e. a cache for DW1_PAGE_PATHS.)

    // ------ Page action cache (I'll probably remove it)
    // COULD instead update value in cache (adding the new actions to
    // the cached page). But then `savePageActionsGenNotfs` also needs to know
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

   newPageAndActionsWithId
  }


  override def loadPage(pageId: String): Option[PageParts] =
    lookupInCache[PageParts](_pageActionsKey(pageId),
      orCacheAndReturn = {
        super.loadPage(pageId)
      })


  def _pageActionsKey(pageId: String): String = s"$pageId|$tenantId|PageActions"

}

