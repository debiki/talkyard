/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import java.{util => ju}



/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
  */
trait SettingsDao {
  self: SiteDao =>

  def loadWholeSiteSettings(): Settings = {
    val rawSettingsMaps = siteDbDao.loadSettings(Vector(SettingsTarget.WholeSite))
    Settings(SettingsChain(rawSettingsMaps))
  }


  def loadPageTreeSettings(pageId: PageId): Settings = {
    val pageAndAncestorIds = pageId :: loadAncestorIdsParentFirst(pageId)
    val treeTargets = pageAndAncestorIds.map(SettingsTarget.PageTree(_))
    val allTargets = treeTargets ++ Vector(SettingsTarget.WholeSite)
    val rawSettingsMaps = siteDbDao.loadSettings(allTargets)
    Settings(SettingsChain(rawSettingsMaps))
  }


  def loadSinglePageSettings(pageId: PageId): Settings = {
    val pageTarget = SettingsTarget.SinglePage(pageId)
    val pageAndAncestorIds = pageId :: loadAncestorIdsParentFirst(pageId)
    val treeTargets = pageAndAncestorIds.map(SettingsTarget.PageTree(_))
    val allTargets = Vector(pageTarget) ++ treeTargets ++ Vector(SettingsTarget.WholeSite)
    val rawSettingsMaps = siteDbDao.loadSettings(allTargets)
    Settings(SettingsChain(rawSettingsMaps))
  }


  def saveSetting(target: SettingsTarget, name: String, value: Any) {
    siteDbDao.saveSetting(target, name -> value)
  }
}



trait CachingSettingsDao extends SettingsDao {
  self: CachingSiteDao =>


  override def loadWholeSiteSettings(): Settings = {
    lookupInCache(
      siteSettingsKey,
      orCacheAndReturn =
        Some(super.loadWholeSiteSettings())) getOrDie "DwE52WK8"
  }


  override def loadPageTreeSettings(pageId: PageId): Settings = {
    lookupInCache(
      pageTreeSettingsKey(pageId),
      orCacheAndReturn =
        Some(super.loadPageTreeSettings(pageId))) getOrDie "DwE77GY3"
  }


  override def loadSinglePageSettings(pageId: PageId): Settings = {
    lookupInCache(
      singlePageSettingsKey(pageId),
      orCacheAndReturn =
        Some(super.loadSinglePageSettings(pageId))) getOrDie "DwE3WCS0"
  }


  override def saveSetting(target: SettingsTarget, name: String, value: Any) {
    super.saveSetting(target, name, value)
    // SHOULD update a per-site cached timestamp that means that everything cached [freshcache]
    // before that timestamp should be discarded.
    // All other caches should also check that whole-site cache invalidation timestamp.
    // But for now, simply require ... a server restart :-( if a config value is changed
  }


  private def siteSettingsKey = s"$siteId|SiteSettingsKey"
  private def pageTreeSettingsKey(rootId: PageId) = s"$rootId|$siteId|PageTreeSettingsKey"
  private def singlePageSettingsKey(pageId: PageId) = s"$pageId|$siteId|SinglePageSettingsKey"

}

