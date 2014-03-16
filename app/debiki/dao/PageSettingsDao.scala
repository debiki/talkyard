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
import debiki._
import java.{util => ju}
import Prelude._


/**
  */
trait PageSettingsDao {
  self: SiteDao =>

  def loadSiteSettings(): Settings = {
    val rawSettingsMaps = siteDbDao.loadSettings(Vector(Section.WholeSite))
    Settings(SettingsChain(rawSettingsMaps))
  }

  def loadSectionSettings(pageId: PageId): Settings = {
    val pageAndAncestorIds = loadAncestorIdsParentFirst(pageId)
    val treeSections = pageAndAncestorIds.map(Section.PageTree(_))
    val allSections = treeSections ++ Vector(Section.WholeSite)
    val rawSettingsMaps = siteDbDao.loadSettings(allSections)
    Settings(SettingsChain(rawSettingsMaps))
  }

  def loadPageSettings(pageId: PageId): Settings = {
    val pageSection = Section.SinglePage(pageId)
    val pageAndAncestorIds = loadAncestorIdsParentFirst(pageId)
    val treeSections = pageAndAncestorIds.map(Section.PageTree(_))
    val allSections = Vector(pageSection) ++ treeSections ++ Vector(Section.WholeSite)
    val rawSettingsMaps = siteDbDao.loadSettings(allSections)
    Settings(SettingsChain(rawSettingsMaps))
  }

  def saveSetting(section: Section, name: String, value: Any) {
    siteDbDao.savePageSetting(section, name -> value)
  }
}


trait CachingPageSettingsDao extends PageSettingsDao {
  self: SiteDao with CachingDao =>

}

