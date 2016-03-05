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
import debiki.dao.CachingDao.CacheKey


/** Loads and saves settings for the whole website, a section of the website (e.g.
  * a forum or a blog) and individual pages.
  */
trait SettingsDao {
  self: SiteDao =>

  def loadWholeSiteSettings(): Settings = {
    readOnlyTransaction { transaction =>
      loadWholeSiteSettings(transaction)
    }
  }

  class FirstPostSettings(val numToAllow: Int, val numToApprove: Int, val numToNotify: Int)

  def loadFirstPostSettings(): FirstPostSettings = {
    val settings = loadWholeSiteSettings()
    new FirstPostSettings(
      numToAllow = settings.numFirstPostsToAllow.asInt,
      numToApprove = settings.numFirstPostsToApprove.asInt,
      numToNotify = settings.numFirstPostsToReview.asInt)
  }


  def loadWholeSiteSettings(transaction: SiteTransaction): Settings = {
    val rawSettingsMaps = transaction.loadSettings(Vector(SettingsTarget.WholeSite))
    Settings(SettingsChain(rawSettingsMaps))
  }


  def loadPageTreeSettings(pageId: PageId): Settings = {
    // Categories now in separate table, loadCategoriesRootLast(pageId) is gone.
    // Currently there are no category settings. Fix later when/if needed.
    val pageAndAncestorIds = List(pageId) // :: loadCategoriesRootLast(pageId)
    val treeTargets = pageAndAncestorIds.map(SettingsTarget.PageTree)
    val allTargets = treeTargets ++ Vector(SettingsTarget.WholeSite)
    val rawSettingsMaps = readOnlyTransaction(_.loadSettings(allTargets))
    Settings(SettingsChain(rawSettingsMaps))
  }


  def loadSinglePageSettings(pageId: PageId): Settings = {
    val pageTarget = SettingsTarget.SinglePage(pageId)
    // Categories now in separate table, loadCategoriesRootLast(pageId) is gone.
    // Currently there are no category settings. Fix later when/if needed.
    val pageAndAncestorIds = List(pageId) //:: loadCategoriesRootLast(pageId)
    val treeTargets = pageAndAncestorIds.map(SettingsTarget.PageTree)
    val allTargets = Vector(pageTarget) ++ treeTargets ++ Vector(SettingsTarget.WholeSite)
    val rawSettingsMaps = readOnlyTransaction(_.loadSettings(allTargets))
    Settings(SettingsChain(rawSettingsMaps))
  }


  def saveSetting(target: SettingsTarget, name: String, value: Option[Any]) {
    readWriteTransaction(_.saveSetting(target, name -> value))
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


  override def saveSetting(target: SettingsTarget, name: String, value: Option[Any]) {
    super.saveSetting(target, name, value)
    emptyCache(siteId)
  }


  private def siteSettingsKey = CacheKey(siteId, "SiteSettingsKey")
  private def pageTreeSettingsKey(rootId: PageId) = CacheKey(siteId, s"$rootId|PgTrStngsKey")
  private def singlePageSettingsKey(pageId: PageId) = CacheKey(siteId, s"$pageId|SnglPgStngsKey")

}

