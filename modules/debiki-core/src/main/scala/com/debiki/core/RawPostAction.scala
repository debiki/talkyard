/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import com.debiki.core.{PostActionPayload => PAP}
import Prelude._
import PageParts._
import FlagType.FlagType


/** Actions builds up a page: a page consists of various posts,
  * e.g. the title post, the body post, and comments posted, and actions
  * that edit and affect these posts. (This is the action, a.k.a. command,
  * design pattern.)
  *
  * RawPostAction is used by DbDao (database data-access-object), when saving and loading pages.
  * If you want some more functionality, use the PostAction:s Post and Patch instead.
  * (That's what you almost have to do anyway because that's what
  * Debate(/PageParts/whatever) gives you.)
  *
  * @param id A local id, unique per page. "?" means unknown (used when
  * creating new posts).
  * @param payload What this action does. For example, creates a new post,
  * edits a post, flags it, closes a thread, etcetera.
  */
case class RawPostAction[P](   // caused weird compilation errors:  [P <: PostActionPayload](
  id: ActionId,
  creationDati: ju.Date,
  payload: P,
  postId: ActionId,
  userIdData: UserIdData) {

  require(id != PageParts.NoId)
  require(payload.isInstanceOf[PAP]) // for now, until above template constraint works

  def ctime = creationDati

  def loginId = userIdData.loginId
  def userId = userIdData.userId
  def ip = userIdData.ip

  def anyGuestId = userIdData.anyGuestId
  def anyRoleId = userIdData.anyRoleId

  def browserFingerprint = userIdData.browserFingerprint
  def browserIdCookie = userIdData.browserIdCookie

  def textLengthUtf8: Int = payload.asInstanceOf[PAP].textLengthUtf8
}



object RawPostAction {

  def forNewPost(
      id: ActionId,
      creationDati: ju.Date,
      userIdData: UserIdData,
      parentPostId: Option[ActionId],
      text: String,
      markup: String,
      approval: Option[Approval],
      where: Option[String] = None) = {
    if (Some(id) == parentPostId)
      assErr("DwE23GFf0")

    RawPostAction(
      id, creationDati, postId = id, userIdData = userIdData,
      payload = PAP.CreatePost(
        parentPostId = parentPostId, text = text,
        markup = markup, approval = approval, where = where))
  }


  def forNewTitleBySystem(text: String, creationDati: ju.Date) =
    forNewTitle(text, creationDati, userIdData = SystemUser.UserIdData,
      approval = Some(Approval.AuthoritativeUser))


  def forNewPageBodyBySystem(text: String, creationDati: ju.Date, pageRole: PageRole) =
    forNewPageBody(text, creationDati, pageRole, userIdData = SystemUser.UserIdData,
      approval = Some(Approval.AuthoritativeUser))


  def forNewTitle(text: String, creationDati: ju.Date,
               userIdData: UserIdData, approval: Option[Approval]) =
    forNewPost(PageParts.TitleId, creationDati, userIdData = SystemUser.UserIdData,
      parentPostId = None, text = text,
      markup = Markup.DefaultForPageTitle.id, approval = approval)


  def forNewPageBody(text: String, creationDati: ju.Date, pageRole: PageRole,
                  userIdData: UserIdData, approval: Option[Approval]) =
    forNewPost(PageParts.BodyId, creationDati, userIdData = userIdData,
      parentPostId = None, text = text,
      markup = Markup.defaultForPageBody(pageRole).id, approval = approval)


  def copyCreatePost(
        old: RawPostAction[PAP.CreatePost],
        id: ActionId = PageParts.NoId,
        creationDati: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        parentPostId: Option[PostId] = null,
        text: String = null,
        markup: String = null,
        approval: Option[Approval] = null): RawPostAction[PAP.CreatePost] = {
    val theCopy = RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (id != PageParts.NoId) id else old.id, // same as id
      creationDati =  if (creationDati ne null) creationDati else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.CreatePost(
        parentPostId = if (parentPostId ne null) parentPostId else old.payload.parentPostId,
        text = if (text ne null) text else old.payload.text,
        markup = if (markup ne null) markup else old.payload.markup,
        approval = if (approval ne null) approval else old.payload.approval))

    if (Some(theCopy.id) == theCopy.payload.parentPostId)
      assErr("DwE65DK2")

    theCopy
  }


  def toEditPost(
        id: ActionId, postId: ActionId, ctime: ju.Date,
        userIdData: UserIdData,
        text: String, autoApplied: Boolean, approval: Option[Approval],
        newMarkup: Option[String] = None) =
    RawPostAction(
      id, ctime, postId = postId, userIdData = userIdData,
      payload = PAP.EditPost(
        text = text, newMarkup = newMarkup, autoApplied = autoApplied, approval = approval))


  def copyEditPost(
        old: RawPostAction[PAP.EditPost],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        createdAt: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        text: String = null,
        autoApplied: Option[Boolean] = None,
        approval: Option[Approval] = null,
        newMarkup: Option[String] = null) =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      creationDati =  if (createdAt ne null) createdAt else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.EditPost(
        text = if (text ne null) text else old.payload.text,
        newMarkup = if (newMarkup ne null) newMarkup else old.payload.newMarkup,
        autoApplied = if (autoApplied.isDefined) autoApplied.get else old.payload.autoApplied,
        approval = if (approval ne null) approval else old.payload.approval))


  def copyApplyEdit(
        old: RawPostAction[PAP.EditApp],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        createdAt: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        ip: String = null,
        editId: ActionId = PageParts.NoId,
        approval: Option[Approval] = null) =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      creationDati =  if (createdAt ne null) createdAt else old.creationDati,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = PAP.EditApp(
        editId = if (editId != PageParts.NoId) editId else old.payload.editId,
        approval = if (approval ne null) approval else old.payload.approval))


  def toReviewPost(
        id: ActionId,
        postId: ActionId,
        userIdData: UserIdData,
        ctime: ju.Date,
        approval: Option[Approval]): RawPostAction[PAP.ReviewPost] =
    RawPostAction(
      id, creationDati = ctime, postId = postId, userIdData = userIdData,
      payload = PAP.ReviewPost(approval))


  def copyReviewPost(
        old: RawPostAction[PAP.ReviewPost],
        id: ActionId = PageParts.NoId,
        postId: ActionId = PageParts.NoId,
        loginId: String = null,
        userId: String = null,
        createdAt: ju.Date = null,
        ip: String = null,
        approval: Option[Approval] = null): RawPostAction[PAP.ReviewPost] =
    RawPostAction(
      id = if (id != PageParts.NoId) id else old.id,
      creationDati = if (createdAt ne null) createdAt else old.creationDati,
      postId = if (postId != PageParts.NoId) postId else old.postId,
      userIdData = UserIdData(
        loginId = if (loginId ne null) Some(loginId) else old.userIdData.loginId,
        userId = if (userId ne null) userId else old.userIdData.userId,
        ip = if (ip ne null) ip else old.userIdData.ip,
        browserIdCookie = old.userIdData.browserIdCookie,
        browserFingerprint = old.userIdData.browserFingerprint),
      payload = if (approval ne null) PAP.ReviewPost(approval) else old.payload)


  def toDeletePost(
        andReplies: Boolean,
        id: ActionId,
        postIdToDelete: ActionId,
        userIdData: UserIdData,
        createdAt: ju.Date) =
    RawPostAction(
      id, creationDati = createdAt, postId = postIdToDelete, userIdData = userIdData,
      payload = if (andReplies) PAP.DeleteTree else PAP.DeletePost)

}



sealed abstract class PostActionPayload {
  def textLengthUtf8: Int = 0
}



object PostActionPayload {


  /** Creates a page title, a page body, a comment, or a page config post.
    *
    * @param markup The markup language to use when rendering this post.
    * @param approval Defined iff the post was approved on creation, and clarifies why it was.
    * @param where If defined, this is an inline comment and the value specifies where
    *  in the parent post it is to be placed. COULD move to separate Meta post?
    *  Benefits: Editing and versioning of `where', without affecting this Post.text.
    *  Benefit 2: There could be > 1 meta-Where for each post, so you could make e.g. a
    *  generic comment that results in ?? arrows to e.g. 3 other comments ??
    */
  case class CreatePost(
    parentPostId: Option[PostId],
    text: String,
    markup: String,
    approval: Option[Approval],
    where: Option[String] = None) extends PostActionPayload {

      override def textLengthUtf8: Int = text.getBytes("UTF-8").length
  }


  /** Edits the text of a post, and/or changes the markup (from e.g. Markdown to HTML).
    *
    * @param text A diff from the current post text to the new. (Should rename to .diff?)
    * @param newMarkup Changes the markup henceforth applied to postId's text.
    * None means reuse the current markup.
    * @param autoApplied If this edit was applied automatically on creation, e.g. because
    * someone edited his/her own comment.
    * Currently not in use (yes it is!?? or?) And I'd have to
    * refactor page-actions-smart.scala fairly much for `autoApplied`to work,
    * since currently all appl info is instead handled via EditApp:s.
    *   - Perhaps easier to remove this field, and construct
    * an additional EditApp action when reading an Edit from database,
    * if the db says it was auto approved? But I might need this field
    * anyway, when *saving* an edit, so the db knows it should mark it as
    * auto applied.
    * @param approval If the related post is to be automatically approved, when this
    * edit is auto applied. (Example: a moderator edits a comment
    * that is already approved, then the edit would be
    * auto applied, and the related post would be approved implicitly,
    * (since it was already approved, and a *moderator* did the edit.))
    */
  case class EditPost(
    text: String, // (Should rename to `diff`?)
    newMarkup: Option[String],
    autoApplied: Boolean,
    approval: Option[Approval]) extends PostActionPayload {

    override def textLengthUtf8: Int = text.getBytes("UTF-8").length

    // An edit that hasn't been applied cannot have been approved.
    // (It might have been applied, but not approved, however, if a
    // user edits his/her own comment, and the changes are then pending
    // moderator review.)
    require(approval.isEmpty || autoApplied)
  }


  /** Edit applications (i.e. when edits are applied).
    * COULD rename to ApplyEdit
    */
  case class EditApp(editId: ActionId, approval: Option[Approval]) extends PostActionPayload


  /** Approves and rejects comments and edits of the related post.
    */
  case class ReviewPost(approval: Option[Approval]) extends PostActionPayload

  val RejectPost = ReviewPost(approval = None)
  val PrelApprovePost = ReviewPost(Some(Approval.Preliminary))
  val WellBehavedApprovePost = ReviewPost(Some(Approval.WellBehavedUser))
  val ManuallyApprovePost = ReviewPost(Some(Approval.Manual))


  class Vote extends PostActionPayload

  /** The user liked the post, e.g. because it's funny or informative. */
  case object VoteLike extends Vote

  /** The user e.g. thinks the comment has factual errors, or disagrees with it. */
  case object VoteWrong extends Vote

  case object VoteOffTopic extends Vote


  /** Pins a post at e.g. position 3. This pushes any other posts already pinned
    * at e.g. positions 3, 4, and 5 one step to the right, to positions 4, 5 and 6.
    * So after a while, the effective position of a pinned post might have changed
    * from X to X + Y where Y is the number of new posts pinned at or before X.
    * The effective position of a post is computed lazily when the page is rendered.
    *
    * @param position 1 means place first, 2 means place first but one, and so on.
    *   -1 means place last, -2 means last but one, and so on.
    */
  case class PinPostAtPosition(position: Int) extends PostActionPayload {
    illArgIf(position == 0, "DwE25FK8")
  }


  /** Gives extra votes to a post. A negative value means downvotes. Can be used
    * to promote or demote things the admin / moderator likes or dislikes.
    * However, a pushpin icon shows that the post has been pinned. So one
    * cannot use this functionality to fool other people into believing a post is
    * more (or less) popular that what it actually is.
    *  Concerning pinning downvotes, if you think that's unfair, because the
    * post will be moved away and fewer people will see it and read it (and notice it's
    * pinned): well, the moderator can *delete* it as well. It's more "fair" and
    * more honest to pin visible downvotes, than to outright delete the whole
    * comment/thread?
    *//*
  case class PinVotesToPost(extraVotes: Int) extends PostActionPayload {
    illArgIf(extraVotes == 0, "DwE71Fb0")
  }*/


  ///case object UnpinPost extends PostActionPayload


  class CollapseSomething extends PostActionPayload


  case object CollapsePost extends CollapseSomething


  /** Collapses a thread: collapses it, and perhaps tucks it away under a Collapsed Threads
    * section (which would be far away to the right?, if the thread is laid out horizontally).
    *
    * Use on old obsolete threads, e.g. a comment about a spelling mistake
    * that has since been fixed. Or on uninteresting off-topic threads.
    */
  case object CollapseTree extends CollapseSomething


  /** Closes a thread. It'll be tucked away under a Closed Threads section,
    * and perhaps not shown when rendering page.
    */
  case object CloseTree extends PostActionPayload


  /** Deletes a single comment.
    */
  case object DeletePost extends PostActionPayload


  /** Deletes a comment and all replies, recursively.
    */
  case object DeleteTree extends PostActionPayload


  /** Deletes things an edit suggestion or a flag. (But not a post — use DeletePost
    * and DeleteTree instead.)
    */
  case class Delete(targetActionId: ActionId) extends PostActionPayload


  /** Undoes another action, e.g. an Undo with targetActionId = a CloseTree action
    * would reopen the closed tree.
    *
    * Requires another coulmn in DW1_PAGE_ACTIONS, namely TARGET_ACTION_ID.
    */
  case class Undo(targetActionId: ActionId) extends PostActionPayload


  /** Flags a post as e.g. spam, or inappropriate (offensive, illegal, whatever).
    */
  case class Flag(tyype: FlagType, reason: String) extends PostActionPayload

}



object FlagType extends Enumeration {
  type FlagType = Value
  val Spam, Illegal, /* Copyright Violation */ CopyVio, Other = Value
}


