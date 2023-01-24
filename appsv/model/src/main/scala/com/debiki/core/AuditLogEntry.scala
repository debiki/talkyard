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


// RENAME to  EventSubtype.
sealed abstract class AuditLogEntryType(protected val IntVal: Int) { def toInt: Int = IntVal }
object AuditLogEntryType {
  case class Unknown(badInt: i32) extends AuditLogEntryType(badInt)

  // Let 1-999 be about content?  No, instead:  [event_id_nrs]
  // Content:
  //    nnn = new site, site read only, deleted, undeleted, etc?
  //   1nnn = site sections, e.g. forum, blog, wiki sections?
  //   2nnn = categories
  //   3nnn = pages
  //   4nnn = posts
  //   6nnn = votes, flags  (not collapse-post/hide-replies — that's a post property)
  //   8nnn = tags & badges  ?
  // People:
  //  10 nnn = pats
  //  14 nnn = mod events
  // Other:
  //  17 nnn = admin events
  //  30 nnn = meta events,  e.g. emails bouncing, indexin too slow, IDP problem,
  //                            repeated webhook send failures
  case object CreateSite extends AuditLogEntryType(1)
  case object ThisSiteCreated extends AuditLogEntryType(2)
  case object CreateForum extends AuditLogEntryType(12)
  case object NewPage extends AuditLogEntryType(3)
  case object NewReply extends AuditLogEntryType(4)
  case object NewChatMessage extends AuditLogEntryType(5)
  case object EditPost extends AuditLogEntryType(6)
  case object ChangePostSettings extends AuditLogEntryType(7)
  case object MovePost extends AuditLogEntryType(11)
  case object UploadFile extends AuditLogEntryType(8)
  //se object HardDeletePage extends AuditLogEntryType(3997)

  // PageApproved?

  //se object PagePublished
  //se object PagePublicationScheduled
  //se object PageUnpublished extends AuditLogEntryType(3027)

  //se object PageListed extends AuditLogEntryType(30nn)
  //se object PageUnlisted extends AuditLogEntryType(30nn)

  //se object PageUnhidden extends AuditLogEntryType(30nn)
  //se object PageHidden extends AuditLogEntryType(30nn)

  // PageMovedCat
  // PageMovedUrlSlug

  case object PageAnswered extends AuditLogEntryType(3143)
  case object PageUnanswered extends AuditLogEntryType(3145)

  case object PagePlanned extends AuditLogEntryType(3153)
  case object PageStarted extends AuditLogEntryType(3155)
  case object PageDone extends AuditLogEntryType(3157)
  // Maybe maybe — let's say a software feature that's been implemented,
  // but not released, then, one more Doing status could make sense?
  //se object PageDelivered/Available/Released/Published, hmm, extends AuditLogEntryType(3048)

  //se object PagePostponed extends AuditLogEntryType(3161)

  // Maybe there'll be an array with events, e.g. [PageClosed, PageAnswered]?
  // (Since a page gets closed, once an answer has been selected.)
  // But that could be a client side thing?
  // Here, should be enough to store actiosn by the users.
  case object PageReopened extends AuditLogEntryType(3901)
  case object PageClosed extends AuditLogEntryType(3903)
  // SoftLocked: If replying, there's a popup that says "do you really want to ...
  // .. better to start a new topic instead" ?
  //case object PageSoftLocked extends AuditLogEntryType(3904)
  //se object PageLocked extends AuditLogEntryType(3906)
  //se object PageFrozen extends AuditLogEntryType(3908)

  case object UndeletePage extends AuditLogEntryType(10)   // 3992
  case object DeletePage extends AuditLogEntryType(9)      // 3994


  // PostApproved?


  // Let 1001-1999 be about people?   No, 10nnn, see above.
  case object CreateUser extends AuditLogEntryType(1001)
  // later ----
  case object ApproveUser extends AuditLogEntryType(1002)
  case object SuspendUser extends AuditLogEntryType(1003)
  case object UnsuspendUser extends AuditLogEntryType(1004)
  // Block, unblock.
  // Edit profile. etc.
  //-----------
  case object DeactivateUser extends AuditLogEntryType(1997)
  case object ReactivateUser extends AuditLogEntryType(1998)
  case object DeleteUser extends AuditLogEntryType(1999)
  // (Cannot undelete.)

  // Let 2001-2999 be admin & staff actions? No. Change, se above.
  case object SaveSiteSettings extends AuditLogEntryType(2001)
  case object MakeReviewDecision extends AuditLogEntryType(2002)
  case object UndoReviewDecision extends AuditLogEntryType(2003)


  def fromInt(value: Int): Option[AuditLogEntryType] = Some(value match {
    case CreateSite.IntVal => CreateSite
    case ThisSiteCreated.IntVal => ThisSiteCreated
    case CreateForum.IntVal => CreateForum
    case NewPage.IntVal => NewPage
    case NewReply.IntVal => NewReply
    case NewChatMessage.IntVal => NewChatMessage
    case EditPost.IntVal => EditPost
    case ChangePostSettings.IntVal => ChangePostSettings
    case MovePost.IntVal => MovePost
    case UploadFile.IntVal => UploadFile

    //se PagePublished ...

    //se PageListed.IntVal => PageListed
    //se PageUnlisted.IntVal => PageUnlisted

    //se PageUnhidden.IntVal => PageUnhidden
    //se PageHidden.IntVal => PageHidden

    case PageAnswered.IntVal => PageAnswered
    case PageUnanswered.IntVal => PageUnanswered

    case PagePlanned.IntVal => PagePlanned
    case PageStarted.IntVal => PageStarted
    case PageDone.IntVal => PageDone

    case PageClosed.IntVal => PageClosed
    case PageReopened.IntVal => PageReopened
    //se PageLocked.IntVal => PageLocked
    //se PageFrozen.IntVal => PageFrozen

    case UndeletePage.IntVal => UndeletePage
    case DeletePage.IntVal => DeletePage
    //se HardDeletePage.IntVal => HardDeletePage

    case CreateUser.IntVal => CreateUser
    case ApproveUser.IntVal => ApproveUser
    case SuspendUser.IntVal => SuspendUser
    case UnsuspendUser.IntVal => UnsuspendUser
    case DeactivateUser.IntVal => DeactivateUser
    case ReactivateUser.IntVal => ReactivateUser
    case DeleteUser.IntVal => DeleteUser
    case SaveSiteSettings.IntVal => SaveSiteSettings
    case MakeReviewDecision.IntVal => MakeReviewDecision
    case UndoReviewDecision.IntVal => UndoReviewDecision
    case _ => return None
  })
}


case class AuditLogEntry(
  siteId: SiteId,
  id: AuditLogEntryId,
  didWhat: AuditLogEntryType,
  doerId: TrueId,
  doneAt: ju.Date,
  browserIdData: BrowserIdData,
  browserLocation: Option[BrowserLocation] = None,
  emailAddress: Option[String] = None,
  pageId: Option[PageId] = None,
  pageType: Option[PageType] = None,
  uniquePostId: Option[PostId] = None,
  postNr: Option[PostNr] = None,
  uploadHashPathSuffix: Option[String] = None,
  uploadFileName: Option[String] = None,
  sizeBytes: Option[Int] = None,
  targetUniquePostId: Option[PostId] = None,
  targetSiteId: Option[SiteId] = None, // CLEAN_UP ought to RENAME to otherSiteId, rename db column too
  targetPageId: Option[PageId] = None,
  targetPostNr: Option[PostNr] = None,
  targetUserId: Option[TrueId] = None,
  batchId: Option[AuditLogEntryId] = None,
  isLoading: Boolean = false) {

  RENAME // to postId
  def postId: Opt[PostId] = uniquePostId

  CLEAN_UP // change doneAt to type When
  def doneAtWhen: When = When.fromDate(doneAt)

  if (!isLoading) {
    val T = AuditLogEntryType
    emailAddress.foreach(Validation.requireOkEmail(_, "EsE5YJK2"))
    require(pageType.isEmpty || pageId.isDefined, "DwE4PFKW7")
    require(postNr.isEmpty || pageId.isDefined, "DwE3574FK2")
    require(postNr.isEmpty || uniquePostId.isDefined, "DwE2WKEFW8")
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
  val FirstId = 1
}

