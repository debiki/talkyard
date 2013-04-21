/**
 * Copyright (c) 2012-2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import PageParts._
import FlagReason.FlagReason
import com.debiki.v0.{PostActionPayload => PAP}

/** Actions builds up a page: a page consists of various posts,
  * e.g. the title post, the body post, and comments posted, and actions
  * that edit and affect these posts. (This is the action, a.k.a. command,
  * design pattern.)
  *
  * PostActionDto is a rather stupid data transfer object (DTO): it's used
  * by DbDao, when saving and loading pages. — If you want some more
  * functionality, use the PostAction:s Post and Patch instead. (That's what you
  * almost have to do anyway because that's what Debate(/PageParts/whatever) gives you.)
  *
  * @param id A local id, unique per page. "?" means unknown (used when
  * creating new posts).
  * @param loginId the login session, which in turn identifies
  * the user and IP and session creation time.
  * @param newIp Always None, unless the post was sent from somewhere else than
  * the relevant Login.ip.
  * @param payload What this action does. For example, creates a new post,
  * edits a post, flags it, closes a thread, etcetera.
  */
case class PostActionDto[P]( // [P <: PostActionPayload] -> compilation errors for PostAction
  id: String,
  creationDati: ju.Date,
  payload: P,
  postId: String,
  loginId: String,
  userId: String,
  newIp: Option[String]) extends PostActionDtoOld {

  require(id != "0")
  require(id nonEmpty)

  def ctime = creationDati
}



object PostActionDto {

  def forNewPost(
      id: String,
      creationDati: ju.Date,
      loginId: String,
      userId: String,
      newIp: Option[String],
      parentPostId: String,
      text: String,
      markup: String,
      approval: Option[Approval],
      where: Option[String] = None) =
    PostActionDto(
      id, creationDati, postId = id, loginId = loginId, userId = userId, newIp = newIp,
      payload = PAP.CreatePost(
        parentPostId = parentPostId, text = text,
        markup = markup, approval = approval, where = where))


  def forNewTitleBySystem(text: String, creationDati: ju.Date) =
    forNewTitle(text, creationDati, loginId = SystemUser.Login.id,
      userId = SystemUser.User.id, approval = Some(Approval.AuthoritativeUser))


  def forNewPageBodyBySystem(text: String, creationDati: ju.Date, pageRole: PageRole) =
    forNewPageBody(text, creationDati, pageRole, loginId = SystemUser.Login.id,
      userId = SystemUser.User.id, approval = Some(Approval.AuthoritativeUser))


  def forNewTitle(text: String, creationDati: ju.Date,
               loginId: String, userId: String, approval: Option[Approval]) =
    forNewPost(PageParts.TitleId, creationDati, loginId = loginId, userId = userId,
      newIp = None, parentPostId = PageParts.TitleId, text = text,
      markup = Markup.DefaultForPageTitle.id, approval = approval)


  def forNewPageBody(text: String, creationDati: ju.Date, pageRole: PageRole,
                  loginId: String, userId: String, approval: Option[Approval]) =
    forNewPost(PageParts.BodyId, creationDati, loginId = loginId, userId = userId,
      newIp = None, parentPostId = PageParts.BodyId, text = text,
      markup = Markup.defaultForPageBody(pageRole).id, approval = approval)


  def copyCreatePost(
        old: PostActionDto[PAP.CreatePost],
        id: String = null,
        creationDati: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        newIp: Option[String] = null,
        parentPostId: String = null,
        text: String = null,
        markup: String = null,
        approval: Option[Approval] = null): PostActionDto[PAP.CreatePost] =
    PostActionDto(
      id = if (id ne null) id else old.id,
      postId = if (id ne null) id else old.id, // same as id
      creationDati =  if (creationDati ne null) creationDati else old.creationDati,
      loginId = if (loginId ne null) loginId else old.loginId,
      userId = if (userId ne null) userId else old.userId,
      newIp = if (newIp ne null) newIp else old.newIp,
      payload = PAP.CreatePost(
        parentPostId = if (parentPostId ne null) parentPostId else old.payload.parentPostId,
        text = if (text ne null) text else old.payload.text,
        markup = if (markup ne null) markup else old.payload.markup,
        approval = if (approval ne null) approval else old.payload.approval))


  def toEditPost(
        id: String, postId: String, ctime: ju.Date,
        loginId: String, userId: String, newIp: Option[String],
        text: String, autoApplied: Boolean, approval: Option[Approval],
        newMarkup: Option[String] = None) =
    PostActionDto(
      id, ctime, postId = postId, loginId = loginId, userId = userId, newIp = newIp,
      payload = PAP.EditPost(
        text = text, newMarkup = newMarkup, autoApplied = autoApplied, approval = approval))


  def copyEditPost(
        old: PostActionDto[PAP.EditPost],
        id: String = null,
        postId: String = null,
        createdAt: ju.Date = null,
        loginId: String = null,
        userId: String = null,
        newIp: Option[String] = null,
        text: String = null,
        autoApplied: Option[Boolean] = None,
        approval: Option[Approval] = null,
        newMarkup: Option[String] = null) =
    PostActionDto(
      id = if (id ne null) id else old.id,
      postId = if (postId ne null) postId else old.postId,
      creationDati =  if (createdAt ne null) createdAt else old.creationDati,
      loginId = if (loginId ne null) loginId else old.loginId,
      userId = if (userId ne null) userId else old.userId,
      newIp = if (newIp ne null) newIp else old.newIp,
      payload = PAP.EditPost(
        text = if (text ne null) text else old.payload.text,
        newMarkup = if (newMarkup ne null) newMarkup else old.payload.newMarkup,
        autoApplied = if (autoApplied.isDefined) autoApplied.get else old.payload.autoApplied,
        approval = if (approval ne null) approval else old.payload.approval))


  def forTemporaryApprovalOf(postAction: PostActionDto[_]) = ReviewPostAction(
    id = nextRandomString(),
    postId = postAction.postId,
    loginId = SystemUser.Login.id,
    userId = SystemUser.User.id,
    newIp = None,
    ctime = postAction.ctime,
    approval = Some(Approval.Preliminary))


  def toDeletePost(
        andReplies: Boolean,
        id: String,
        postIdToDelete: String,
        loginId: String,
        userId: String,
        newIp: Option[String],
        createdAt: ju.Date) =
    PostActionDto(
      id, creationDati = createdAt, postId = postIdToDelete,
      loginId = loginId, userId = userId, newIp = newIp,
      payload = if (andReplies) PAP.DeleteTree else PAP.DeletePost)

}



sealed abstract class PostActionPayload



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
    parentPostId: String,
    text: String,
    markup: String,
    approval: Option[Approval],
    where: Option[String] = None) extends PostActionPayload


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

    // override def textLengthUtf8: Int = text.getBytes("UTF-8").length

    // An edit that hasn't been applied cannot have been approved.
    // (It might have been applied, but not approved, however, if a
    // user edits his/her own comment, and the changes are then pending
    // moderator review.)
    require(approval.isEmpty || autoApplied)
  }


  class CollapseSomething extends PostActionPayload


  case object CollapsePost extends CollapseSomething


  /** Collapses a thread: collapses it, and perhaps tucks it away under a Collapsed Threads
    * section (which would be far away to the right?, if the thread is laid out horizontally).
    *
    * Use on old obsolete threads, e.g. a comment about a spelling mistake
    * that has since been fixed. Or on uninteresting off-topic threads.
    */
  case object CollapseTree extends CollapseSomething


  /** Deletes a single comment.
    */
  case object DeletePost extends PostActionPayload


  /** Deletes a comment and all replies, recursively.
    */
  case object DeleteTree extends PostActionPayload


  /** Deletes things an edit suggestion or a flag. (But not a post — use DeletePost
    * and DeleteTree instead.)
    */
  case class Delete(targetActionId: String) extends PostActionPayload


  /** Undoes another action, e.g. an Undo with targetActionId = a CloseTree action
    * would reopen the closed tree.
    *
    * Requires another coulmn in DW1_PAGE_ACTIONS, namely TARGET_ACTION_ID.
    */
  case class Undo(targetActionId: String) extends PostActionPayload

}



/** Should use PostActionDto + PostActionPayload instead; then it's much
  * easier to add new types of actions.
  */
sealed abstract class PostActionDtoOld {

  /** The post that this action affects. */
  def postId: String

  /** A local id, unique only in the Debate that this action modifies.
    * "?" means unknown.
    */
  def id: String
  require(id != "0")
  require(id nonEmpty)

  /**
   * Identifies the login session, which in turn identifies
   * the user and IP and session creation time.
   */
  def loginId: String

  /** The guest or role that did this action. */
  def userId: String

  /** Always None, unless the post was sent from somewhere else than
   *  the relevant Login.ip.
   */
  def newIp: Option[String]
  def ctime: ju.Date

  def textLengthUtf8: Int = 0

  def anyGuestId = if (userId.headOption == Some('-')) Some(userId drop 1) else None
  def anyRoleId =  if (userId.headOption == Some('-')) None else Some(userId)

}



/** Classifies an action, e.g. tags a Post as being "interesting" and "funny".
 *
 *  If you rate an action many times, only the last rating counts.
 *  - For an authenticated user, his/her most recent rating counts.
 *  - For other users, the most recent rating for the login id / session id
 *    counts.
 *  - Could let different non-authenticated sessions with the same
 *    user name, ip and email overwrite each other's ratings.
 *    But I might as well ask them to login instead? Saves my time, and CPU.
 */
case class Rating (
  id: String,
  postId: String,
  loginId: String,
  userId: String,
  newIp: Option[String],
  ctime: ju.Date,
  tags: List[String]
) extends PostActionDtoOld



/** Info on all ratings on a certain action, grouped and sorted in
 *  various manners.
 */
abstract class RatingsOnAction {

  /** The most recent rating, by authenticated users. */
  def mostRecentByUserId: collection.Map[String, Rating]

  /** The most recent rating, by non authenticated users. */
  // COULD rename to ...ByGuestId
  def mostRecentByNonAuLoginId: collection.Map[String, Rating]

  /** The most recent ratings, for all non authenticated users,
   *  grouped by IP address.
   */
  // COULD rename to ...ByIdtyId
  def allRecentByNonAuIp: collection.Map[String, List[Rating]]

  /** The most recent version of the specified rating.
   *  When you rate an action a second time, the most recent rating
   *  overwrites the older one.
   */
  def curVersionOf(rating: Rating): Rating
}



object FlagReason extends Enumeration {
  type FlagReason = Value
  val Spam, Illegal, /* Copyright Violation */ CopyVio, Other = Value
}



case class Flag(
  id: String,
  postId: String,
  loginId: String,
  userId: String,
  newIp: Option[String],
  ctime: ju.Date,
  reason: FlagReason,
  details: String
) extends PostActionDtoOld {
  override def textLengthUtf8: Int = details.getBytes("UTF-8").length
}



/** Edit applications (i.e. when edits are applied).
 *
 *  COULD make generic: applying a Post means it's published.
 *  Applying an Edit means the relevant Post is edited.
 *  Applying a Flag means the relevant Post is hidden.
 *  Applying a Delete means whatever is whatever-happens-when-it's-deleted.
 *  And each Action could have a applied=true/false field?
 *  so they can be applied directly on creation?
 */
case class EditApp(
  id: String,
  editId: String,
  postId: String,
  loginId: String,
  userId: String,
  newIp: Option[String],
  ctime: ju.Date,
  approval: Option[Approval],

  /** The text after the edit was applied. Needed, in case an `Edit'
   *  contains a diff, not the resulting text itself. Then we'd better not
   *  find the resulting text by applying the diff to the previous
   *  version, more than once -- that wouldn't be future compatible: the diff
   *  algorithm might functioni differently depending on software version
   *  (e.g. because of bugs).
   *  So, only apply the diff algorithm once, to find the EddidApplied.result,
   *  and thereafter always use EditApplied.result.
   *
   *  Update: What! I really don't think the diff alg will change in the
   *  future! Anyone changing the diff file format would be insane,
   *  and would not have been able to write a diff alg at all.
   *  So `result' is *not* needed, except for perhaps improving performance.
   *
   *  COULD change to an Option[String] and define it only one time out of ten?
   *  Then the entire post would be duplicated only 1 time out of 10 times,
   *  and that would hardly affect storage space requirements,
   *  but at the same time improving performance reasonably much ??
   *  Or store cached post texts in a dedicated db table.
   */
  result: String
) extends PostActionDtoOld



// COULD make a Deletion class, and a DelApp (deletion application) class.
// Then sometimes e.g. 3 people must delete a post for it to really
// be deleted. Perhaps DelSug = deletion suggestion?
// And rename Edit to EditSug?
// EditSug & EditApp, + DelSug & DelApp - or join these 4 classes to 2 generic?
// What about Flag and FlagApp? Eventually if flagged as spam e.g. 2 times
// then the post would be automatically hidden?
// What about only one ActionApp class, that applies the relevant action?
// But then e.g. EditApp.result (resulting text) would be gone!?
// And DelApp.wholeTree ... and FlagApp.reason + details.
// Perhaps better have many small specialized classes.


/**
 * Approves or rejects e.g. comments and edits to `postId`.
 */
case class ReviewPostAction(
  id: String,
  postId: String,
  loginId: String,
  userId: String,
  newIp: Option[String],
  ctime: ju.Date,
  approval: Option[Approval]) extends PostActionDtoOld {
}


/**
 * Moderators and the computer review posts and might approve them
 * Only the `Manual` approval is done manually by a human,
 * all others happen automatically, done by the computer.
 * (Should I prefix them with 'Auto'?)
 *
 * @param isPermanent true iff the approval is not preliminary. (If not, it was made by
 * some trusted user, and moderators therefore won't be asked to review it — the approval
 * will most likely uphold forever.)
 * @param isAuthoritative true iff the post was approved by a moderator or admin.
 */
sealed abstract class Approval(
  val isPermanent: Boolean = false,
  val isAuthoritative: Boolean = false)


object Approval {

  /**
   * The first few posts of a new user are approved preliminarily.
   * (An admin is notified though and might decide to delete the posts.)
   */
  case object Preliminary extends Approval

  /**
   * A user that has posted many useful comments will have a few of
   * his/her next comments approved automatically, and no admin is nodified.
   */
  case object WellBehavedUser extends Approval(isPermanent = true)

  /**
   * Posts by admins and moderators are always automatically approved.
   */
  case object AuthoritativeUser extends Approval(isPermanent = true, isAuthoritative = true)

  /**
   * When an authoritative user manually approved something.
   */
  case object Manual extends Approval(isPermanent = true, isAuthoritative = true)


  def parse(text: String): Approval = text match {
    case "Preliminary" => Preliminary
    case "WellBehavedUser" => WellBehavedUser
    case "AuthoritativeUser" => AuthoritativeUser
    case "Manual" => Manual
    case _ => illArgErr("DwE931k35", s"Bad approval value: `$text'")
  }

}



// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list
