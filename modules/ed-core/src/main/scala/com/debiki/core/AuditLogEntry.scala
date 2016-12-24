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

import com.debiki.core.Prelude._
import java.{util => ju}


/** Derived from the browser ip address, via something like http://ipinfo.io/.
  */
case class BrowserLocation(
  country: String,
  region: Option[String],
  city: Option[String])


sealed abstract class AuditLogEntryType(protected val IntVal: Int) { def toInt = IntVal }
object AuditLogEntryType {
  case object CreateSite extends AuditLogEntryType(1)
  case object ThisSiteCreated extends AuditLogEntryType(2)
  case object NewPage extends AuditLogEntryType(3)
  case object NewReply extends AuditLogEntryType(4)
  case object NewChatMessage extends AuditLogEntryType(5)
  case object EditPost extends AuditLogEntryType(6)
  case object ChangePostSettings extends AuditLogEntryType(7)
  case object MovePost extends AuditLogEntryType(11)
  case object UploadFile extends AuditLogEntryType(8)
  case object DeletePage extends AuditLogEntryType(9)
  case object UndeletePage extends AuditLogEntryType(10)

  def fromInt(value: Int): Option[AuditLogEntryType] = Some(value match {
    case AuditLogEntryType.CreateSite.IntVal => AuditLogEntryType.CreateSite
    case AuditLogEntryType.ThisSiteCreated.IntVal => AuditLogEntryType.ThisSiteCreated
    case AuditLogEntryType.NewPage.IntVal => AuditLogEntryType.NewPage
    case AuditLogEntryType.NewReply.IntVal => AuditLogEntryType.NewReply
    case AuditLogEntryType.NewChatMessage.IntVal => AuditLogEntryType.NewChatMessage
    case AuditLogEntryType.EditPost.IntVal => AuditLogEntryType.EditPost
    case AuditLogEntryType.ChangePostSettings.IntVal => AuditLogEntryType.ChangePostSettings
    case AuditLogEntryType.UploadFile.IntVal => AuditLogEntryType.UploadFile
    case AuditLogEntryType.DeletePage.IntVal => AuditLogEntryType.DeletePage
    case AuditLogEntryType.UndeletePage.IntVal => AuditLogEntryType.UndeletePage
    case _ => return None
  })
}


case class AuditLogEntry(
  siteId: SiteId,
  id: AuditLogEntryId,
  didWhat: AuditLogEntryType,
  doerId: UserId,
  doneAt: ju.Date,
  browserIdData: BrowserIdData,
  browserLocation: Option[BrowserLocation] = None,
  emailAddress: Option[String] = None,
  pageId: Option[PageId] = None,
  pageRole: Option[PageRole] = None,
  uniquePostId: Option[UniquePostId] = None,
  postNr: Option[PostNr] = None,
  uploadHashPathSuffix: Option[String] = None,
  uploadFileName: Option[String] = None,
  sizeBytes: Option[Int] = None,
  targetUniquePostId: Option[UniquePostId] = None,
  targetSiteId: Option[SiteId] = None, // ought to rename to otherSiteId, rename db column too
  targetPageId: Option[PageId] = None,
  targetPostNr: Option[PostNr] = None,
  targetUserId: Option[UserId] = None,
  batchId: Option[AuditLogEntryId] = None,
  isLoading: Boolean = false) {

  if (!isLoading) {
    val T = AuditLogEntryType
    emailAddress.foreach(Validation.requireOkEmail(_, "EsE5YJK2"))
    require(pageRole.isEmpty || pageId.isDefined, "DwE4PFKW7")
    require(postNr.isEmpty || pageId.isDefined, "DwE3574FK2")
    require(postNr.isDefined == uniquePostId.isDefined, "DwE2WKEFW8")
    requireIf(didWhat == T.NewPage, pageId.isDefined && uniquePostId.isDefined, "EdE5PFK2")
    requireIf(didWhat == T.DeletePage || didWhat == T.UndeletePage,
                pageId.isDefined && uniquePostId.isEmpty, "EdE7ZXCY4")
    // COULD check uploaded file hash-path-suffix regex, see UploadsDao in debiki-server.
    require(!uploadHashPathSuffix.exists(_.trim.isEmpty), "DwE0PMF2")
    require(!uploadFileName.exists(_.trim.isEmpty), "DwE7UPM1")
    require(!sizeBytes.exists(_ < 0), "DwE7UMF4")
    require(targetPostNr.isDefined == targetUniquePostId.isDefined, "DwE4QU38")
    require(targetPostNr.isEmpty || targetPageId.isDefined, "DwE5PFK2")
    require(!batchId.exists(_ > id), "EsE5PK2L8")
    require(!batchId.exists(_ <= 0), "EsE8YJK52")
  }
}


object AuditLogEntry {
  val UnassignedId = 0
}

