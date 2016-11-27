/**
 * Copyright (c) 2014-2016 Kaj Magnus Lindberg
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
import debiki._
import io.efdi.server.http.throwForbidden2


/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
  */
trait SettingsDao {
  self: SiteDao =>

  def loadWholeSiteSettings(): EffectiveSettings = {
    memCache.lookup(
      siteSettingsKey,
      orCacheAndReturn = {
        readOnlyTransaction { transaction =>
          Some(loadWholeSiteSettings(transaction))
        }
      }) getOrDie "DwE52WK8"
  }


  def loadWholeSiteSettings(transaction: SiteTransaction): EffectiveSettings = {
    val editedSettings = transaction.loadSiteSettings()
    EffectiveSettings(editedSettings.toVector, AllSettings.Default)
  }


  def saveSiteSettings(settingsToSave: SettingsToSave) {
    // ... test settings ...
    readWriteTransaction { transaction =>
      transaction.upsertSiteSettings(settingsToSave)
      val newSettings = loadWholeSiteSettings(transaction)
      newSettings.findAnyError foreach { error =>
        // This'll rollback the transaction.
        throwForbidden2("EsE40GY28", s"Bad settings: $error")
      }
      memCache.clearSingleSite(siteId)
    }
  }



  private def siteSettingsKey = MemCacheKey(siteId, "SiteSettingsKey")
  /* Later?
  private def pageTreeSettingsKey(rootId: PageId) = CacheKey(siteId, s"$rootId|PgTrStngsKey")
  private def singlePageSettingsKey(pageId: PageId) = CacheKey(siteId, s"$pageId|SnglPgStngsKey")
  */

}

