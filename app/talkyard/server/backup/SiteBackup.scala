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


case class SiteBackup(  // RENAME to SiteDmup, and all related classes too
  site: SiteInclDetails,
  settings: SettingsToSave,
  summaryEmailIntervalMins: Int, // for now [7FKB4Q1]
  summaryEmailIfActive: Boolean, // for now [7FKB4Q1]
  guests: Seq[Guest],
  users: Seq[UserInclDetails],
  pages: Seq[PageMeta],
  pagePaths: Seq[PagePathWithId],
  categories: Seq[Category],
  posts: Seq[Post],
  permsOnPages: Seq[PermsOnPages])


