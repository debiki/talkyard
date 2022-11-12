/**
 * Copyright (c) 2015, 2017 Kaj Magnus Lindberg
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

import scala.collection.immutable
import PostStatusBits._


object CollapsedStatus {
  val Open = new CollapsedStatus(0)
}
class CollapsedStatus(val underlying: Int) extends AnyVal {
  def isCollapsed = underlying != 0
  def isExplicitlyCollapsed = (underlying & TreeBits) != 0
  def isPostCollapsed = (underlying & SelfBit) != 0
  //def areRepliesCollapsed = underlying & ChildrenBit
  def isTreeCollapsed = (underlying & TreeBits) == TreeBits
  def areAncestorsCollapsed = (underlying & AncestorsBit) != 0
}


object ClosedStatus {
  val Open = new ClosedStatus(0)
}
class ClosedStatus(val underlying: Int) extends AnyVal {
  def isClosed = underlying != 0
  def isTreeClosed = (underlying & TreeBits) == TreeBits
  def areAncestorsClosed = (underlying & AncestorsBit) != 0
}


object DeletedStatus {
  val NotDeleted = new DeletedStatus(0)
}
class DeletedStatus(val underlying: Int) extends AnyVal {
  def toInt = underlying
  def isDeleted = underlying != 0
  def onlyThisDeleted = underlying == SelfBit
  def isPostDeleted = (underlying & SelfBit) != 0
  def isTreeDeleted = (underlying & TreeBits) == TreeBits
  def areAncestorsDeleted = (underlying & AncestorsBit) != AncestorsBit
}


object PostStatusBits {

  /** Means that only the current post (but not its children) has been collapsed or deleted. */
  val SelfBit = 1

  /** Means that all successor posts are collapsed or closed or deleted. */
  val SuccessorsBit = 2

  /** Means this post and all successors. */
  val TreeBits = SelfBit | SuccessorsBit

  /** Means that some ancestor post has been collapsed or closed or deleted and that therefore
    * the current post is also collapsed or closed or deleted. */
  val AncestorsBit = 4

  val AllBits = SelfBit | SuccessorsBit | AncestorsBit
}


/*
object PostBitFlags {
  val ChronologicalBitMask = 1 << 0
  val ChatBitMask = 1 << 1
  val ThreadedChatBitMask = ChatBitMask
  val ChronologicalChatBitMask = ChatBitMask | ChronologicalBitMask

  val AuthorHiddenBitMask = 1 << 2

  val GuestWikiBitMask = 1 << 3
  val MemberWikiBitMask = 1 << 4
  val StaffWikiBitMask = 1 << 5

  val BranchSidewaysBitMask = 1 << 6  // but what about showing the first X children only?

  val FormBitMask = 1 << 8
}


class PostBitFlags(val bits: Int) extends AnyVal {
  import PostBitFlags._

  def isChronologicalChat = (bits & ChronologicalChatBitMask) != 0   // 3
  def isAuthorHidden = (bits & AuthorHiddenBitMask) != 0             // 4
  def isGuestWiki = (bits & GuestWikiBitMask) != 0                   // 8
  def isMemberWiki = (bits & MemberWikiBitMask) != 0                 // 16
  def isStaffWiki = (bits & StaffWikiBitMask) != 0                   // 32
  def isBranchSideways = (bits & BranchSidewaysBitMask) != 0         // 64
  def isForm = (bits & FormBitMask) != 0                             // 256

  def isSelfCollapsed = bits & 10
  def isSuccessorsCollapsed = bits & 11
  def isAncestorCollapsed = bits & 12

  def isSelfClosed = bits & 10
  def isSuccessorsClosed = bits & 11
  def isAncestorClosed = bits & 12

  def isSelfHidden = bits & 10
  def isSuccessorsHidden = bits & 11
  def isAncestorHidden = bits & 12

  def isSelfDeleted = bits & 10
  def isSuccessorsDeleted = bits & 11
  def isAncestorDeleted = bits & 12

? def isFrozen = bits & 10
? def isSuccessorsFrozen = bits & 11
? def isAncestorFrozen = bits & 12

} */


sealed abstract class PostType(
  protected val IntValue: Int,
  val isChat: Bo = false,
  val isComment: Bo = false,
) {
  def toInt: Int = IntValue
  def isWiki = false

  RENAME // to isForTimeline  ?
  def placeLast = false
}


// REFACTOR. See harmless bug below. Should change to a bit field, or split into separate fields.
//
object PostType {

  // Maybe could be the same as PageType, + a higher bit set, if is a chat message, and another,
  // if is a timeline message?  — CompletedForm can be a post, and also a page,
  // if each form reply —> a page?
  case object Question_later // extends PostType(PageType.Question.toInt, isComment = true)
  case object Problem_later // extends PostType(PageType.Problem.toInt, isComment = true)
  case object Idea_later // extends PostType(PageType.Idea.toInt, isComment = true)
  case object Discussion_later // extends PostType(PageType.Discussion.toInt, isComment = true)

  // No, instead, nr < 0 and privateStaus set to something;
  //se object Private extends PostType(PageType.FormalMessage.toInt, isComment = true)

  /** A normal post, e.g. a forum topic or reply or blog post, whatever. */
  case object Normal extends PostType(1, isComment = true)

  /** A comment in the flat section below the threaded discussion section. */
  @deprecated("now", "delete?")
  case object Flat extends PostType(2, isComment = true)

  /** A chat message in a chat room.
    *
    * REFACTOR: Can't these be type Normal, and the page of type chat, and the OP of
    * type About, instead? Because if changing the page type from Chat to Discussion,
    * it's pointless to have to update all posts in the chat.
    */
  case object ChatMessage extends PostType(3, isChat = true)

  /** A Normal post but appended to the bottom of the page, not sorted best-first. */
  // RENAME to ProgressPost,  no,  TimelinePost.
  // Or should  isTimeline be a bool field?
  case object BottomComment extends PostType(4, isComment = true) {
    override def placeLast = true
  }

  CLEAN_UP // REMOVE StaffWiki, use the permission system instead.  [NOSTAFFWIKI]
  /** Any staff member can edit this post. No author name shown. */
  @deprecated("Use the permission system instead of StaffWiki post type.")
  case object StaffWiki extends PostType(11) {
    override def isWiki = true
  }

  /** Any community member (doesn't include guests) can edit this post. No author name shown.
    *
    * Harmless BUG: A progress post (BottomComment above) currently cannot also be a Wiki post.
    * Need to either 1) let PostType be a bit field, and 1 bit is the page section
    * (discussion or progress section), and one bit is 0 = not wiki, 1 = yes wiki.
    * Or 2) split PostType into separate fields:  isWiki: Boolean,  isProgressPost: Boolean.
    * And  isChatmessage could also be its own dedicated bit.
    */
  @deprecated("This should be a flag instead, not a separate post type.")
  case object CommunityWiki extends PostType(12) {
    override def isWiki = true
  }

  case object CompletedForm extends PostType(21)

  /** E.g. "Topic closed" or "Topic reopened" or "Nnn joined the chat".
    * Doesn't increment the reply count. */
  // COULD use separate db table: MetaPosts, so gets own seqence nrs & cannot bug-incr reply count,
  // & also can have a MetaPost.type field, e.g.  1 = delete topic, 2 = restore, 3 = close etc
  // so the software understands if 2 meta messages cancel each other (e.g. Delete & Restore
  // 5 seconds apart = don't show them).
  // If migrating to separate table, just delete all current MetaMessages, don't write any
  // compl script to move to the new format.
  // Or ... better? Just add another field to posts3: meta_post_type?
  case object MetaMessage extends PostType(31) { override def placeLast = true }

  // Later:
  // - FormSubmission(21)? Shown only to the page author(s) + admins? Cannot be voted on. Sorted by
  //    date. For FormSubmission pages only.
  // ? But isn't this CompletedForm above ?

  /** Later:
    *
    * Flags of posts and pats, will in the future be posts themselves [flags_as_posts] —
    * because when reporting (flagging) something, one can write a text, and this text
    * is best stored in a post — then it can be edited later, and staff can
    * *reply* to the flag text and maybe talk with the flagger about it, or
    * with each other in private comments.
    *
    * Such flag posts will point to the things they flag, via post_rels_t. Possibly many
    * things — can be good to be able to report e.g. many astroturfer accounts at once?
    * Or many spam posts apparently by the same person.
    *
    * Sub type:  Maybe a bitfield, each bit toggling a flag reason on-off?
    * E.g. both astroturfer and says 5G towers radiate covid viruses.
    * Ex:  0b0011 =  not-spammer, not-toxic, yes-astroturfer, yes-manipulator
    * or could be a json obj. But if updating the flagged-reasons, then, should that be under
    * version control? Should  posts_t  include a val_json_c  or  val_i32_c  (and maybe a  title_c),
    * in addition to  current_source_c?  And editing any, creates a new post revision?
    */
  case object Flag_later extends PostType(-1)   // probably not 51

  /** Later: Bookmarks.
    *
    * A tree of bookmarks would be nicely stored as posts? Posts form a tree already,
    * have edit history, sub threads can be moved to other places in the tree.
    * And can be shared with each other, by changing visibility.
    */
  case object Bookmark_later extends PostType(-1)


  def fromInt(value: Int): Option[PostType] = Some(value match {
    case Normal.IntValue => Normal
    case Flat.IntValue => Flat
    case ChatMessage.IntValue => ChatMessage
    case BottomComment.IntValue => BottomComment
    case StaffWiki.IntValue => StaffWiki
    case CommunityWiki.IntValue => CommunityWiki
    case CompletedForm.IntValue => CompletedForm
    case MetaMessage.IntValue => MetaMessage
    case Flag_later.IntValue => Flag_later
    case Bookmark_later.IntValue => Bookmark_later
    case _ => return None
  })
}


sealed abstract class DraftType (val IntVal: Int) { def toInt: Int = IntVal }
object DraftType {
  case object Scratch extends DraftType(1)
  case object Topic extends DraftType(2)
  case object DirectMessage extends DraftType(3)
  case object Edit extends DraftType(4)
  case object Reply extends DraftType(5)
  case object ProgressPost extends DraftType(6)
  // case object ChatMessage extends DraftType(?) — currently not needed, using Reply instead
  // case object Whisper extends DraftType(?)

  def fromInt(value: Int): Option[DraftType] = Some(value match {
    case Topic.IntVal => Topic
    case DirectMessage.IntVal => DirectMessage
    case Edit.IntVal => Edit
    case Reply.IntVal => Reply
    case ProgressPost.IntVal => ProgressPost
    // case ChatMessage.IntVal => ChatMessage
    // case Whisper.IntVal => Whisper
    case _ => return None
  })
}


/** COULD add altPageId: Set[String] for any embedding url or embedding discussion id.  [BLGCMNT1]
  *
  * @param draftType
  * @param categoryId
  * @param toUserId
  * @param pageId — for new topics, is the page id of the forum where the topic is to be created,
  *   in case there're many forums (sub communities). Hmm should lookup via category id instead,
  *   later when/if will be possible to move categories between forums? [subcomms]
  *   For replies and edits, is the page the user was at, when writing.
  *   Maybe, however, the post being edited, or replied to, will be moved elsewhere
  *   by staff — so postId will be used, when finding the post, later when resuming
  *   writing (rather than pageId and postNr). Still, nice to have pageId, in case staff
  *   moves the post to a page one may not access — then, good to know on which page it was
  *   located, originally, when starting typing the draft (so one knows what topic it concerns).
  * @param postNr
  * @param postId
  */
case class DraftLocator(
  draftType: DraftType,
  categoryId: Option[CategoryId] = None,
  toUserId: Option[UserId] = None,
  pageId: Option[PageId] = None,
  postNr: Option[PostNr] = None,
  postId: Option[PostId] = None) {

  draftType match {
    case DraftType.Scratch =>
      // Allow anything. Nice to be able to load drafts with weird state, as
      // a whatever-draft. So they won't just get lost or throw exceptions.
    case DraftType.Topic =>
      // Current page id doesn't matter — and there is no current page id,
      // if the new topic gets created from the API /-/* section.
      require(categoryId.isDefined, s"Bad new topic draft, no category id: $this [TyE4WABG701]")
      require(postId.isEmpty && postNr.isEmpty && toUserId.isEmpty,
        s"Bad new topic draft: $this [TyE4WABG702]")
    case DraftType.DirectMessage =>
      require(toUserId.isDefined, s"Bad direct message draft: $this [TyE6RKW201]")
      require(categoryId.isEmpty && postId.isEmpty && pageId.isEmpty && postNr.isEmpty,
        s"Bad direct message draft: $this [TyE6RKW202]")
    case DraftType.Edit | DraftType.Reply | DraftType.ProgressPost =>
      require(pageId.isDefined && postNr.isDefined && postId.isDefined,  // [NEEDEMBOP]
          s"Bad $draftType draft: $this [TyE5BKRT201]")
      require(categoryId.isEmpty && toUserId.isEmpty,
        s"Bad $draftType draft: $this [TyE5BKRT202]")
  }

  def isNewTopic: Boolean = draftType == DraftType.Topic || draftType == DraftType.DirectMessage
}


case class Draft(
  byUserId: UserId,
  draftNr: DraftNr,
  forWhat: DraftLocator,
  createdAt: When,
  lastEditedAt: Option[When] = None,
  deletedAt: Option[When] = None,
  topicType: Option[PageType] = None,
  postType: Option[PostType] = None,
  title: String,
  text: String) {

  require(draftNr >= 1 || draftNr == NoDraftNr, "TyEBDDRFT01")
  require(lastEditedAt.isEmpty || createdAt.millis <= lastEditedAt.get.millis, "TyEEDITBEFCREA")
  require(deletedAt.isEmpty || createdAt.millis <= deletedAt.get.millis, "TyEBDDRFT05")
  require(lastEditedAt.isEmpty || deletedAt.isEmpty ||
      lastEditedAt.get.millis <= deletedAt.get.millis, "TyEBDDRFT06")
  require(forWhat.isNewTopic == topicType.isDefined, "TyEBDDRFT08")
  require(!isReply || postType.isDefined, "Draft postType missing, for a reply draft [TyEBDDRFT09]")
  require(postType.isEmpty || isReply || isEdit, "Draft postType present [TyEBDDRFT10]")
  require(!isReply || text.trim.nonEmpty, "Empty draft, for replying — delete instead [TyEBDDRFT11]")
  require(!isEdit || text.trim.nonEmpty, "Empty draft, for edits — delete instead [TyEBDDRFT12]")
  require(isNewTopic || title.isEmpty, "Non new topic draft, with a title [TyEBDDRFT13]")

  def isNewTopic: Boolean = forWhat.isNewTopic
  def isReply: Boolean =
    forWhat.draftType == DraftType.Reply || forWhat.draftType == DraftType.ProgressPost
  def isEdit: Boolean = forWhat.draftType == DraftType.Edit
}



/** A post is a page title, a page body or a comment.
  * For example, a forum topic title, topic text, or a reply.
  *
  * SHOULD: If a post has been flagged, it gets hidden. People can click to view it anyway, so that
  * they can notify moderators if posts are being flagged and hidden inappropriately.
  *
  * @safeRevisionNr — The highest rev nr that got reviewed by a >= TrustedMember human.
  *
  * @privateStatus — Says if a private comment thread, or private message, may be made
  *     *less* private, by 1) adding more private thread members, and 2) if any new
  *     private members are allowed to see earlier private comments or not (if not,
  *     they'll see only comments posted after they were added).
  *     This is stored in Post, not in PermsOnPages, because this setting is outside
  *     the permission system, sort of — instead,the one who starts the private thread,
  *     decides. Admins can make private threads *more* private only, not less.
  *     Maybe 1 = may add more can-see people, incl see history, 2 = may add more,
  *     but cannot see history, 3 = can add more, with the thread starter's permission,
  *     4 = can add more, with everyone's permission. I guess all these details won't
  *     get implemented the nearest 7 years? Today is November 3 2022.
  */
case class Post(   // [exp] ok use
  id: PostId,
  extImpId: Option[ExtId] = None,   // RENAME extId
  pageId: PageId,
  nr: PostNr,
  parentNr: Option[PostNr],
  multireplyPostNrs: immutable.Set[PostNr],
  tyype: PostType,
  createdAt: ju.Date,
  createdById: UserId,
  // Also need:  [post_page_written_added_at]
  // pubSubmittedAt — the publicly shown submission date, if different from createdAt.
  // addedToPageAt — if moved from one page to another, this is when it got added to the new page,
  //                  helpful for debugging dates (and for bumping the page-bump-time).
  // pubAuthorId — if the publicly shown author should be different from the person who created the post.
  // ownedById — who may edit the pubAuthorId. Because if it's one's own anon post, one can change  .. hmm.
  currentRevisionById: UserId,
  currentRevStaredAt: ju.Date,
  currentRevLastEditedAt: Option[ju.Date],
  currentRevSourcePatch: Option[String],
  currentRevisionNr: Int,
  previousRevisionNr: Option[Int],
  lastApprovedEditAt: Option[ju.Date],
  lastApprovedEditById: Option[UserId],
  numDistinctEditors: Int,
  safeRevisionNr: Option[Int],
  // Needed for sorting by when the post appeared:  [first_last_apr_at]
  // firstApprovedAt: Opt[When]  — or maybe firstAppearedAt/firstVisibleAt: Opt[When]?
  approvedSource: Option[String],
  approvedHtmlSanitized: Option[String],
  approvedAt: Option[ju.Date],   // RENAME to lastApprovedAt  [first_last_apr_at]
  approvedById: Option[UserId],  // RENAME to lastApproved...
  approvedRevisionNr: Option[Int],
  // privateStatus: Opt[PrivateStatus],  // later  [priv_comts]
  collapsedStatus: CollapsedStatus,
  collapsedAt: Option[ju.Date],
  collapsedById: Option[UserId],
  closedStatus: ClosedStatus,
  closedAt: Option[ju.Date],
  closedById: Option[UserId],
  bodyHiddenAt: Option[ju.Date],
  bodyHiddenById: Option[UserId],
  bodyHiddenReason: Option[String],
  deletedStatus: DeletedStatus,
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId],
  pinnedPosition: Option[Int],
  branchSideways: Option[Byte],
  numPendingFlags: Int,
  numHandledFlags: Int,
  numPendingEditSuggestions: Int,
  numDoItVotes: i32 = 0,   // for now
  numDoNotVotes: i32 = 0,  // for now
  numLikeVotes: Int,
  numWrongVotes: Int,
  numBuryVotes: Int,
  numUnwantedVotes: Int,
  numTimesRead: Int) {

  require(id >= 1, "DwE4WEKQ8")

  if (isPrivate) {
    require(nr == PageParts.TitleNr || nr <= PageParts.MaxPrivateNr, s"Private post nr is: ${nr
          } but should be < ${PageParts.MaxPrivateNr} [TyEPRIVPONR]")
  }
  else {
    require(nr == PageParts.TitleNr || nr >= PageParts.BodyNr, s"Post nr: $nr [TyE4AKB28]")
  }

  require(!parentNr.contains(nr), "DwE5BK4")
  require(!multireplyPostNrs.contains(nr), "DwE4kWW2")
  require(multireplyPostNrs.size != 1, "DwE2KFE7") // size 1 = does not reply to many people
  require(multireplyPostNrs.isEmpty || parentNr.isDefined || isFlat, "DwE5GKF2")

  require(currentRevStaredAt.getTime >= createdAt.getTime, "DwE8UFYM5")
  require(!currentRevLastEditedAt.exists(_.getTime < currentRevStaredAt.getTime), "DwE7KEF3")
  require(currentRevisionById == createdById || currentRevisionNr > FirstRevisionNr, "DwE0G9W2")

  require(lastApprovedEditAt.isEmpty == lastApprovedEditById.isEmpty, "DwE9JK3")
  if (lastApprovedEditAt.isDefined && currentRevLastEditedAt.isDefined) {
    require(lastApprovedEditAt.get.getTime <= currentRevLastEditedAt.get.getTime, "DwE2LYG6")
  }

  // require(numPendingEditSuggestions == 0 || lastEditSuggestionAt.isDefined, "DwE2GK45)
  // require(lastEditSuggestionAt.map(_.getTime < createdAt.getTime) != Some(false), "DwE77fW2)

  //require(updatedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6KPw2)
  require(approvedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE8KGEI2")

  require(approvedRevisionNr.isEmpty == approvedAt.isEmpty, "DwE4KHI7")
  require(approvedRevisionNr.isEmpty == approvedById.isEmpty, "DwE2KI65")
  require(approvedRevisionNr.isEmpty == approvedSource.isEmpty, "DwE7YFv2")
  require(approvedHtmlSanitized.isEmpty || approvedSource.isDefined, "DwE0IEW1") //?why not == .isEmpty

  require(approvedSource.map(_.trim.length) != Some(0), "DwE1JY83")
  require(approvedHtmlSanitized.map(_.trim.length) != Some(0), "DwE6BH5")
  require(approvedSource.isDefined || currentRevSourcePatch.isDefined, "DwE3KI59")  // [40HKTPJ]
  require(currentRevSourcePatch.map(_.trim.length) != Some(0), "DwE2bNW5")

  // If the current version of the post has been approved, then one doesn't need to
  // apply any patch to get from the approved version to the current version (since they
  // are the same).
  require(approvedRevisionNr.isEmpty || (
    (currentRevisionNr == approvedRevisionNr.get) == currentRevSourcePatch.isEmpty), "DwE7IEP0")

  require(approvedRevisionNr.map(_ <= currentRevisionNr) != Some(false), "DwE6KJ0")
  require(safeRevisionNr.isEmpty || (
    approvedRevisionNr.isDefined && safeRevisionNr.get <= approvedRevisionNr.get), "DwE2EF4")

  require(previousRevisionNr.isEmpty || currentRevisionNr > FirstRevisionNr, "EsE7JYR3")
  require(!previousRevisionNr.exists(_ >= currentRevisionNr), "DwE7UYG3")

  require(0 <= collapsedStatus.underlying && collapsedStatus.underlying <= AllBits &&
    collapsedStatus.underlying != SuccessorsBit)
  require(collapsedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE0JIk3")
  require(collapsedAt.isDefined == collapsedStatus.isCollapsed, "DwE5KEI3")
  require(collapsedAt.isDefined == collapsedById.isDefined, "DwE60KF3")

  require(closedStatus.underlying >= 0 && closedStatus.underlying <= AllBits &&
    closedStatus.underlying != SuccessorsBit &&
    // Cannot close a single post only, needs to close the whole tree.
    closedStatus.underlying != SelfBit)
  require(closedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IKF3")
  require(closedAt.isDefined == closedStatus.isClosed, "DwE0Kf4")
  require(closedAt.isDefined == closedById.isDefined, "DwE4KI61")

  require(0 <= deletedStatus.underlying && deletedStatus.underlying <= AllBits &&
    deletedStatus.underlying != SuccessorsBit)
  require(deletedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IK84")
  require(deletedAt.isDefined == deletedStatus.isDeleted, "DwE0IGK2")
  require(deletedAt.isDefined == deletedById.isDefined, "DwE14KI7")

  require(bodyHiddenAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6K2I7")
  require(bodyHiddenAt.isDefined == bodyHiddenById.isDefined, "DwE0B7I3")
  require(bodyHiddenReason.isEmpty || bodyHiddenAt.isDefined, "DwE3K5I9")

  require(numDistinctEditors >= 0, "DwE2IkG7")
  require(numPendingEditSuggestions >= 0, "DwE0IK0P3")
  require(numPendingFlags >= 0, "DwE4KIw2")
  require(numHandledFlags >= 0, "DwE6IKF3")
  require(numLikeVotes >= 0, "DwEIK7K")
  require(numWrongVotes >= 0, "DwE7YQ08")
  require(numBuryVotes >= 0, "DwE5FKW2")
  require(numUnwantedVotes >= 0, "DwE4GKY2")
  require(numTimesRead >= 0, "DwE2ZfMI3")
  require(!(nr < PageParts.FirstReplyNr && shallAppendLast), "EdE2WTB064")
  require(!(isMetaMessage && isOrigPostReply), "EdE744GSQF")

  def isTitle: Boolean = nr == PageParts.TitleNr
  def isOrigPost: Boolean = nr == PageParts.BodyNr
  def isReply: Boolean = nr >= PageParts.FirstReplyNr && !isMetaMessage
  def isOrigPostReply: Boolean = isReply && parentNr.contains(PageParts.BodyNr) && !isBottomComment
  def isMultireply: Boolean = isReply && multireplyPostNrs.nonEmpty
  def isFlat: Boolean = tyype == PostType.Flat
  def isPrivate: Bo = false // privateStatus.isDefined  [priv_comts]
  def isMetaMessage: Boolean = tyype == PostType.MetaMessage
  def isBottomComment: Boolean = tyype == PostType.BottomComment   // RENAME to isProgressReply
  def shallAppendLast: Boolean = isMetaMessage || isBottomComment
  def isBodyHidden: Boolean = bodyHiddenAt.isDefined
  def isDeleted: Boolean = deletedStatus.isDeleted
  def isSomeVersionApproved: Boolean = approvedRevisionNr.isDefined
  def isCurrentVersionApproved: Boolean = approvedRevisionNr.contains(currentRevisionNr)
  def isVisible: Boolean = isSomeVersionApproved && !isBodyHidden && !isDeleted  // (rename to isActive? isInUse?)
  def isWiki: Boolean = tyype.isWiki

  def pagePostId = PagePostId(pageId, id)
  def pagePostNr = PagePostNr(pageId, nr)
  def hasAnId: Boolean = nr >= PageParts.LowestPostNr

  def lastApprovedAt: Option[When] =
    lastApprovedEditAt.map(When.fromDate) orElse {
      if (isSomeVersionApproved) Some(createdWhen)
      else None
    }

  def createdAtUnixSeconds: UnixMillis = createdAt.getTime / 1000
  def createdAtMillis: UnixMillis = createdAt.getTime
  def createdWhen: When = When.fromMillis(createdAt.getTime)

  def newChildCollapsedStatus = new CollapsedStatus(
    if ((collapsedStatus.underlying & (SuccessorsBit | AncestorsBit)) != 0) AncestorsBit else 0)

  def newChildClosedStatus = new ClosedStatus(
    if ((closedStatus.underlying & (SuccessorsBit | AncestorsBit)) != 0) AncestorsBit else 0)

  lazy val currentSource: String =
    currentRevSourcePatch match {
      case None => approvedSource.getOrElse("")
      case Some(patch) => applyPatch(patch, to = approvedSource.getOrElse(""))
    }

  def unapprovedSource: Option[String] = {
    if (isCurrentVersionApproved) None
    else Some(currentSource)
  }


  def numEditsToReview: Int = currentRevisionNr - approvedRevisionNr.getOrElse(0)

  def numFlags: Int = numPendingFlags + numHandledFlags


  /** The lower bound of an 80% confidence interval for the number of people that like this post
    * — taking into account not only Like votes, but also how many people actually read it.
    * This mitigates/solves the problem that the topmost reply gets most attention and upvotes.
    * [LIKESCORE]
    *
    * Details:
    * The topmost reply: All its Like votes won't matter much, if only a small fraction
    * of the people who read it, Like-voted it.
    * Whereas a reply further down, which got just some Like votes, but almost everyone
    * who read it liked it — then it can move up to the top (for a while).
    *
    * Tests here: modules/ed-core/src/test/scala/com/debiki/core/StatsCalcTest.scala
    * but they're commented out
    */
  lazy val likeScore: Float = {
    val numLikes = this.numLikeVotes
    // In case there for some weird reason are liked posts with no read count,
    // set numTimesRead to at least numLikes.
    val numTimesRead = math.max(this.numTimesRead, numLikes)
    val avgLikes = numLikes.toFloat / math.max(1, numTimesRead)
    val lowerBound = Distributions.binPropConfIntACLowerBound(
      sampleSize = numTimesRead, proportionOfSuccesses = avgLikes, percent = 80.0f)
    lowerBound
  }


  /** Setting any flag to true means that status will change to true. Leaving it
    * false means the status will remain unchanged (not that it'll be cleared).
    */
  def copyWithNewStatus(
    currentTime: ju.Date,
    userId: UserId,
    bodyHidden: Boolean = false,
    bodyUnhidden: Boolean = false,
    bodyHiddenReason: Option[String] = None,
    postCollapsed: Boolean = false,
    treeCollapsed: Boolean = false,
    ancestorsCollapsed: Boolean = false,
    treeClosed: Boolean = false,
    ancestorsClosed: Boolean = false,
    postDeleted: Boolean = false,
    treeDeleted: Boolean = false,
    ancestorsDeleted: Boolean = false): Post = {

    var newBodyHiddenAt = bodyHiddenAt
    var newBodyHiddenById = bodyHiddenById
    var newBodyHiddenReason = bodyHiddenReason
    if (bodyHidden && bodyUnhidden) {
      die("DwE6KUP2")
    }
    else if (bodyUnhidden && bodyHiddenReason.isDefined) {
      die("EdE4KF0YW5")
    }
    else if (bodyHidden && !isBodyHidden) {
      newBodyHiddenAt = Some(currentTime)
      newBodyHiddenById = Some(userId)
      newBodyHiddenReason = bodyHiddenReason
    }
    else if (bodyUnhidden && isBodyHidden) {
      newBodyHiddenAt = None
      newBodyHiddenById = None
      newBodyHiddenReason = None
    }

    // You can collapse a post, although an ancestor is already collapsed. Collapsing it,
    // simply means that it'll remain collapsed, even if the ancestor gets expanded.
    var newCollapsedUnderlying = collapsedStatus.underlying
    var newCollapsedAt = collapsedAt
    var newCollapsedById = collapsedById
    var collapsesNowBecauseOfAncestor = false
    if (ancestorsCollapsed) {
      newCollapsedUnderlying |= AncestorsBit
      collapsesNowBecauseOfAncestor = !collapsedStatus.isCollapsed
    }
    if (postCollapsed) {
      newCollapsedUnderlying |= SelfBit
    }
    if (treeCollapsed) {
      newCollapsedUnderlying |= TreeBits
    }
    if (collapsesNowBecauseOfAncestor || postCollapsed || treeCollapsed) {
      newCollapsedAt = Some(currentTime)
      newCollapsedById = Some(userId)
    }

    // You cannot close a post if an ancestor is already closed, because then the post
    // is closed already.
    var newClosedUnderlying = closedStatus.underlying
    var newClosedAt = closedAt
    var newClosedById = closedById
    if (ancestorsClosed) {
      newClosedUnderlying |= AncestorsBit
      if (!closedStatus.isClosed) {
        newClosedAt = Some(currentTime)
        newClosedById = Some(userId)
      }
    }
    if (!closedStatus.isClosed && treeClosed) {
      newClosedUnderlying |= TreeBits
      newClosedAt = Some(currentTime)
      newClosedById = Some(userId)
    }

    // You cannot delete a post if an ancestor is already deleted, because then the post
    // is deleted already.
    var newDeletedUnderlying = deletedStatus.underlying
    var newDeletedAt = deletedAt
    var newDeletedById = deletedById
    if (ancestorsDeleted) {
      newDeletedUnderlying |= AncestorsBit
    }
    if (postDeleted) {
      newDeletedUnderlying |= SelfBit
    }
    if (treeDeleted) {
      newDeletedUnderlying |= TreeBits
    }
    if ((ancestorsDeleted || postDeleted || treeDeleted) && !isDeleted) {
      newDeletedAt = Some(currentTime)
      newDeletedById = Some(userId)
    }

    copy(
      bodyHiddenAt = newBodyHiddenAt,
      bodyHiddenById = newBodyHiddenById,
      bodyHiddenReason = newBodyHiddenReason,
      collapsedStatus = new CollapsedStatus(newCollapsedUnderlying),
      collapsedById = newCollapsedById,
      collapsedAt = newCollapsedAt,
      closedStatus = new ClosedStatus(newClosedUnderlying),
      closedById = newClosedById,
      closedAt = newClosedAt,
      deletedStatus = new DeletedStatus(newDeletedUnderlying),
      deletedById = newDeletedById,
      deletedAt = newDeletedAt)
  }


  def copyWithUpdatedVoteAndReadCounts(actions: Iterable[PostAction],
        readStats: PostsReadStats): Post = {
    var numDoItVotes = 0
    var numDoNotVotes = 0
    var numLikeVotes = 0
    var numWrongVotes = 0
    var numBuryVotes = 0
    var numUnwantedVotes = 0
    for (action <- actions) {
      action match {
        case vote: PostVote =>
          vote.voteType match {
            /*
            case PostVoteType.DoIt =>
              numDoItVotes += 1
            case PostVoteType.DoNot =>
              numDoNotVotes += 1
             */
            case PostVoteType.Like =>
              numLikeVotes += 1
            case PostVoteType.Wrong =>
              numWrongVotes += 1
            case PostVoteType.Bury =>
              numBuryVotes += 1
            case PostVoteType.Unwanted =>
              numUnwantedVotes += 1
          }
        case _ => ()  // e.g. a flag. Skip.
      }
    }
    val numTimesRead = readStats.readCountFor(nr)
    copy(
      numDoItVotes = numDoItVotes,
      numDoNotVotes = numDoNotVotes,
      numLikeVotes = numLikeVotes,
      numWrongVotes = numWrongVotes,
      numBuryVotes = numBuryVotes,
      numUnwantedVotes = numUnwantedVotes,
      numTimesRead = numTimesRead)
  }
}


case class SimplePostPatch(
  extId: ExtId,
  postType: PostType,
  pageRef: ParsedRef,
  parentNr: Option[PostNr],
  authorRef: ParsedRef,
  bodySource: String,
  // Could incl this field when importing sites / lots-of-data too? [IMPCORH]
  bodyMarkupLang: Option[MarkupLang],
) {

  throwIllegalArgumentIf(bodySource.isEmpty, "TyE602MKDPA", "Text is empty")
  throwIllegalArgumentIf(postType == PostType.ChatMessage && parentNr.isDefined,
    "TyE50RKT0R2", o"""Currently chat messages cannot have a parentNr field; replying to other
    chat messages not yet implemented. Remove 'parentNr' please.""")

  throwIllegalArgumentIf(parentNr.exists(_ < BodyNr),
    "TyE6033MKSHUW2", s"parentNr is < $BodyNr (the Orig Post), parentNr: $parentNr")

  // COULD make the type system prevent this (and handle this higher up in the call stack).
  throwIllegalArgumentIf(pageRef.canOnlyBeToPat,
    "TyE630RKDNW2J", s"The *page* ref is to a user/participant: $pageRef")

  // Better not allow unexpected things, for now.
  throwIllegalArgumentIf(
    postType != PostType.Normal && postType != PostType.ChatMessage &&
      postType != PostType.BottomComment,
    "TyE306WKVHN6", s"Upserting posts of type $postType currently not supported via the API")

  Validation.findExtIdProblem(extId) foreach { problem =>
    throwIllegalArgument("TyE306DKZH", s"Bad post extId: $problem")
  }
}



object Post {

  val FirstVersion = 1

  def create(
        uniqueId: PostId,
        extImpId: Option[ExtId] = None,
        pageId: PageId,
        postNr: PostNr,
        parent: Option[Post],
        multireplyPostNrs: Set[PostNr],
        postType: PostType,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post = {

    require(multireplyPostNrs.isEmpty || parent.isDefined ||
      postType == PostType.Flat || postType == PostType.BottomComment, "DwE4KFK28")

    val currentSourcePatch: Option[String] =
      if (approvedById.isDefined) None
      else Some(makePatch(from = "", to = source))

    // If approved by a human, this initial version is safe.
    val safeVersion =
      approvedById.flatMap(id =>
        if (id != SystemUserId && id != SysbotUserId) Some(FirstVersion)
        else None)

    val (parentsChildrenCollapsedAt, parentsChildrenColllapsedById) = parent match {
      case None =>
        (None, None)
      case Some(parent) =>
        if (parent.newChildCollapsedStatus.areAncestorsCollapsed)
          (Some(createdAt), parent.collapsedById)
        else
          (None, None)
    }

    val (parentsChildrenClosedAt, parentsChildrenClosedById) = parent match {
      case None =>
        (None, None)
      case Some(parent) =>
        if (parent.newChildClosedStatus.areAncestorsClosed)
          (Some(createdAt), parent.closedById)
        else
          (None, None)
    }

    Post(    // dupl code [DUPPSTCRT]
      id = uniqueId,
      extImpId = extImpId,
      pageId = pageId,
      nr = postNr,
      parentNr = parent.map(_.nr),
      multireplyPostNrs = multireplyPostNrs,
      tyype = postType,
      createdAt = createdAt,
      createdById = createdById,
      currentRevisionById = createdById,
      currentRevStaredAt = createdAt,
      currentRevLastEditedAt = None,
      currentRevSourcePatch = currentSourcePatch,
      currentRevisionNr = FirstVersion,
      lastApprovedEditAt = None,
      lastApprovedEditById = None,
      numDistinctEditors = 1,
      safeRevisionNr = safeVersion,
      approvedSource = if (approvedById.isDefined) Some(source) else None,
      approvedHtmlSanitized = if (approvedById.isDefined) Some(htmlSanitized) else None,
      approvedAt = if (approvedById.isDefined) Some(createdAt) else None,
      approvedById = approvedById,
      approvedRevisionNr = if (approvedById.isDefined) Some(FirstVersion) else None,
      previousRevisionNr = None,
      collapsedStatus = parent.map(_.newChildCollapsedStatus) getOrElse CollapsedStatus.Open,
      collapsedAt = parentsChildrenCollapsedAt,
      collapsedById = parentsChildrenColllapsedById,
      closedStatus = parent.map(_.newChildClosedStatus) getOrElse ClosedStatus.Open,
      closedAt = parentsChildrenClosedAt,
      closedById = parentsChildrenClosedById,
      bodyHiddenAt = None,
      bodyHiddenById = None,
      bodyHiddenReason = None,
      deletedStatus = DeletedStatus.NotDeleted,
      deletedAt = None,
      deletedById = None,
      pinnedPosition = None,
      branchSideways = None,
      numPendingFlags = 0,
      numHandledFlags = 0,
      numPendingEditSuggestions = 0,
      numLikeVotes = 0,
      numWrongVotes = 0,
      numBuryVotes = 0,
      numUnwantedVotes = 0,
      numTimesRead = 0)
  }

  def createTitle(
        uniqueId: PostId,
        extImpId: Option[ExtId] = None,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post =
    create(uniqueId, extImpId = extImpId, pageId = pageId, postNr = PageParts.TitleNr, parent = None,
      multireplyPostNrs = Set.empty, postType = PostType.Normal,
      createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)

  def createBody(
        uniqueId: PostId,
        extImpId: Option[ExtId] = None,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId],
        postType: PostType = PostType.Normal): Post =
    create(uniqueId, extImpId = extImpId, pageId = pageId, postNr = PageParts.BodyNr, parent = None,
      multireplyPostNrs = Set.empty, postType,
      createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)




  /** Sorts posts so e.g. interesting ones appear first, and deleted ones last.
    *
    * NOTE: Keep in sync with  sortPostNrsInPlace()   [SAMESORT]
    * in client/app/ReactStore.ts.
    */
  def sortPosts(posts: immutable.Seq[Post], sortOrder: PostSortOrder)
        : immutable.Seq[Post] = {

    // The default is oldest first, see decisions.adoc  [why_sort_by_time].
    var sortFn: (Post, Post) => Bo = sortPostsOldestFirst

    if (sortOrder == PostSortOrder.BestFirst) {
      sortFn = sortPostsBestFirstFn
    }
    else if (sortOrder == PostSortOrder.NewestFirst) {
      sortFn = sortPostsNewestFirst
    }
    else {
      // Keep the default, oldest first.
    }

    posts.sortWith(sortFn)
  }


  private def sortPostsNewestFirst(postA: Post, postB: Post): Bo = {
    !postAppearedBefore(postA, postB)
  }

  private def sortPostsOldestFirst(postA: Post, postB: Post): Bo = {
    postAppearedBefore(postA, postB)
  }


  private def sortPostsBestFirstFn(postA: Post, postB: Post): Bo = {
    /* From app/debiki/HtmlSerializer.scala:
    if (a.pinnedPosition.isDefined || b.pinnedPosition.isDefined) {
      // 1 means place first, 2 means place first but one, and so on.
      // -1 means place last, -2 means last but one, and so on.
      val aPos = a.pinnedPosition.getOrElse(0)
      val bPos = b.pinnedPosition.getOrElse(0)
      assert(aPos != 0 || bPos != 0)
      if (aPos == 0) return bPos < 0
      if (bPos == 0) return aPos > 0
      if (aPos * bPos < 0) return aPos > 0
      return aPos < bPos
    } */

    // Place append-at-the-bottom and meta-message posts at the bottom, sorted by
    // when they were approved — rather than when they were posted, so that a
    // post that got posted early, but didn't get approved until after some
    // [auto approved posts by staff] won't get missed.
    if (!postA.tyype.placeLast && postB.tyype.placeLast)
      return true
    if (postA.tyype.placeLast && !postB.tyype.placeLast)
      return false
    if (postA.tyype.placeLast && postB.tyype.placeLast)
      return postAppearedBefore(postA, postB)

    // Place deleted posts last; they're rather uninteresting?
    if (!postA.deletedStatus.isDeleted && postB.deletedStatus.isDeleted)
      return true
    if (postA.deletedStatus.isDeleted && !postB.deletedStatus.isDeleted)
      return false

    // Place multireplies after normal replies. And sort multireplies by time,
    // for now, so it never happens that a multireply ends up placed before another
    // multireply that it replies to.
    // COULD place interesting multireplies first, if they're not constrained by
    // one being a reply to another.
    if (postA.multireplyPostNrs.nonEmpty && postB.multireplyPostNrs.nonEmpty) {
      if (postA.createdAt.getTime < postB.createdAt.getTime)
        return true
      if (postA.createdAt.getTime > postB.createdAt.getTime)
        return false
    }
    else if (postA.multireplyPostNrs.nonEmpty) {
      return false
    }
    else if (postB.multireplyPostNrs.nonEmpty) {
      return true
    }

    // Show unwanted posts last.
    val unwantedA = postA.numUnwantedVotes > 0
    val unwantedB = postB.numUnwantedVotes > 0
    if (unwantedA && unwantedB) {
      if (postA.numUnwantedVotes < postB.numUnwantedVotes)
        return true
      if (postA.numUnwantedVotes > postB.numUnwantedVotes)
        return false
    }
    else if (unwantedA) {
      return false
    }
    else if (unwantedB) {
      return true
    }

    // If super many people want to bury the post and almost no one likes it, then
    // count bury votes, instead of like votes, after a while.
    // For now however, only admins can bury vote. So count the very first bury vote.
    // (Later on: Only consider bury votes if ... 5x more Bury than Like? And only after
    // say 10 people have seen the comment, after it was bury voted? (Could have a vote
    // review queue for this.))
    val buryA = postA.numBuryVotes > 0 && postA.numLikeVotes == 0
    val buryB = postB.numBuryVotes > 0 && postB.numLikeVotes == 0
    if (buryA && buryB) {
      if (postA.numBuryVotes < postB.numBuryVotes)
        return true
      if (postA.numBuryVotes > postB.numBuryVotes)
        return false
    }
    else if (buryA) {
      return false
    }
    else if (buryB) {
      return true
    }

    // Place interesting posts first.
    if (postA.likeScore > postB.likeScore)
      return true

    if (postA.likeScore < postB.likeScore)
      return false

    // Newly added posts last. Use .nr, not createdAt, so a post that gets moved
    // from another page to this page, gets placed last (although maybe created first).
    /*
    if (postA.nr < postB.nr)
      true
    else
      false  */
    // No, moving posts is a very rare thing. Instead, sort by approval time.
    postAppearedBefore(postA, postB)
  }


  /** The post that appeared first (visible to all members, not only to
    * staff so they could review), might not be the one that got *posted*
    * first, but rather the one that got approved first.
    * Example: A new member posts a reply A, which gets queued for moderation,
    * not yet visible.
    * Then a trusted member posts a reply B, which gets auto approved, becomes
    * visible directly.
    * Thereafter a moderator approves reply A.
    * Then, although B was created after A, it became visible to all members
    * before A, and should get sorted be fore A. However because of
    * a bug  [first_last_apr_at]  currently A would appear before B.
    */
  private def postAppearedBefore(postA: Post, postB: Post): Boolean = {
    // Sync w Typescript [5BKZQF02]
    BUG //   [first_last_apr_at]
    // Should create & use a field  firstApprovedAt  instead,  otherwise
    // editing a post and approving the edits, changes the sort order.
    // For now, it's better, I think, to just sort by creation time instead.
    /*
    val postAApprAt: Long = postA.approvedAt.map(_.getTime).getOrElse(Long.MaxValue)
    val postBApprAt: Long = postB.approvedAt.map(_.getTime).getOrElse(Long.MaxValue)
    if (postAApprAt < postBApprAt)
      return true
    if (postAApprAt > postBApprAt)
      return false
    */
    // This should order posts by when they got inserted into the database, not
    // by their creation timestamps. Usually gives the same result. Could matter
    // though, if one import-appends more posts to an already existing page.
    postA.nr < postB.nr
  }
}

