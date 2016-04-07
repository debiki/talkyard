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
import java.{util => ju}
import play.{api => p}
import CachingDao.{CacheKey, CacheValue}


/** Builds site specific data access objects that cache stuff in-memory.
  */
class CachingSiteDaoFactory(
  private val _dbDaoFactory: DbDaoFactory,
  private val cache: net.sf.ehcache.Ehcache) extends SiteDaoFactory {

  def newSiteDao(siteId: SiteId): CachingSiteDao = {
    new CachingSiteDao(siteId, _dbDaoFactory, cache)
  }

}


class CachingSiteDao(
  val siteId: SiteId,
  val dbDaoFactory: DbDaoFactory,
  val ehcache: net.sf.ehcache.Ehcache)
  extends SiteDao
  with CachingDao
  with CachingAssetBundleDao
  with CachingSettingsDao
  with CachingSpecialContentDao
  with CachingCategoriesDao
  with CachingPagesDao
  with CachingPagePathMetaDao
  with CachingPageStuffDao
  with CachingPostsDao
  with CachingRenderedPageHtmlDao
  with CachingUserDao
  with CachingWatchbarDao {

  def dbDao2 = dbDaoFactory.newDbDao2()

  onUserCreated { user =>
    if (loadSiteStatus().isInstanceOf[SiteStatus.OwnerCreationPending] && user.isOwner) {
      uncacheSiteStatus()
    }
  }

  onPageCreated { page =>
    if (loadSiteStatus() == SiteStatus.ContentCreationPending) {
      uncacheSiteStatus()
    }
  }


  override def refreshPageInAnyCache(pageId: PageId) {
    firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }


  override def emptyCache() {
    readWriteTransaction(_.bumpSiteVersion())
    emptyCache(siteId)
  }


  override def updateSite(changedSite: Site) = {
    super.updateSite(changedSite)
    uncacheSiteStatus()
  }


  override def loadSiteStatus(): SiteStatus = {
    lookupInCache(
      siteStatusKey,
      orCacheAndReturn = Some(super.loadSiteStatus())) getOrDie "DwE5CB50"
  }


  private def uncacheSiteStatus() {
    removeFromCache(siteStatusKey)
  }


  private def siteStatusKey = CacheKey(this.siteId, "|SiteId")

}
