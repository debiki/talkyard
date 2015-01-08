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


/** Builds site specific data access objects that cache stuff in-memory.
  */
class CachingSiteDaoFactory(
  private val _dbDaoFactory: DbDaoFactory,
  private val _quotaCharger: QuotaCharger
  /* _cacheConfig: CacheConfig */)
  extends SiteDaoFactory {

  def newSiteDao(quotaConsumers: QuotaConsumers): SiteDao = {
    val dbDao = _dbDaoFactory.newSiteDbDao(quotaConsumers)
    val chargingDbDao = new ChargingSiteDbDao(dbDao, _quotaCharger)
    new CachingSiteDao(chargingDbDao)
  }

}


class CachingSiteDao(val siteDbDao: ChargingSiteDbDao)
  extends SiteDao
  with CachingDao
  with CachingAssetBundleDao
  with CachingConfigValueDao
  with CachingSettingsDao
  with CachingSpecialContentDao
  with CachingPageDao
  with CachingPagePathMetaDao
  with CachingPageSummaryDao
  with CachingRenderedPageHtmlDao
  with CachingUserDao
