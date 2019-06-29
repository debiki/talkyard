/**
 * Copyright (c) 2015-2019 Kaj Magnus Lindberg
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

package talkyard.server.backup

import com.debiki.core._
import com.debiki.core.Prelude._


case class SiteBackup(  // RENAME to SiteDmup, and all related classes too
  site: Option[SiteInclDetails],
  settings: Option[SettingsToSave],
  summaryEmailIntervalMins: Int, // for now [7FKB4Q1]
  summaryEmailIfActive: Boolean, // for now [7FKB4Q1]
  guests: Seq[Guest],
  guestEmailPrefs: Map[String, EmailNotfPrefs],
  users: Seq[UserInclDetails],
  categories: Seq[Category],
  pages: Seq[PageMeta],
  pagePaths: Seq[PagePathWithId],
  posts: Seq[Post],
  permsOnPages: Seq[PermsOnPages]) {

  def theSite: SiteInclDetails = site.getOrDie("TyE053KKPSA6")
}


case object SiteBackup {
  val empty = SiteBackup(
    site = None,
    settings = None,
    summaryEmailIntervalMins = 60, // for now [7FKB4Q1]
    summaryEmailIfActive = false, // for now [7FKB4Q1]
    guests = Nil,
    guestEmailPrefs = Map.empty,
    users = Nil,
    pages = Nil,
    pagePaths = Nil,
    categories = Nil,
    posts = Nil,
    permsOnPages = Nil)
}
