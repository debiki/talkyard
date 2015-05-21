/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package com.debiki.core

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.User.SystemUserId
import java.{util => ju}
import scala.collection.immutable
import PostStatusBits._



/** Derived from the browser ip address, via something like http://ipinfo.io/.
  */
case class BrowserLocation(
  country: String,
  region: Option[String],
  city: Option[String])


sealed abstract class AuditLogEntryType
object AuditLogEntryType {
  case object NewPage extends AuditLogEntryType
  case object NewPost extends AuditLogEntryType
  case object EditPost extends AuditLogEntryType
}

case class AuditLogEntry(
  siteId: SiteId,
  id: AuditLogEntryId,
  tyype: AuditLogEntryType,
  doerId: UserId,
  doneAt: ju.Date,
  browserIdData: BrowserIdData,
  browserLocation: Option[BrowserLocation] = None,
  pageId: Option[PageId] = None,
  pageRole: Option[PageRole] = None,
  postId: Option[PostId] = None,
  targetPostId: Option[PostId] = None) {
}


object AuditLogEntry {
  val UnassignedId = 0
}

