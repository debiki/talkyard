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

import Prelude._

//  RENAME  this file to  PatRelType.scala,  later.


/** Relationships ("rel"s) between a pat and whatever, e.g. a user VotedOn a post,
  * or hen is AssignedTo do the stuff described in a post.
  * Will be stored in  post_actions3, but renamed to [pat_rels_t].
  *
  * (This corresponds to edges in a graph database, from nodes of type Pat.)
  */
sealed abstract class PatRelType_later(val IntVal: i32) { def toInt: i32 = IntVal }

object PatRelType_later {

  /** Like votes, Disagree votes etc.
    *  - Sub type is vote type.
    *  - There could be a Gerrit style Review vote type, with an optional amount:
    *      +1, +2, -1, -2,  and, optionally a custom type too, so can add
    *      custom Review vote types, e.g. Code-Style or Verified a la Gerrit,
    *      see:  https://docs.google.com/presentation/d/1C73UgQdzZDw0gzpaEqIC6SPujZJhqamyqO1XOHjH-uk/edit#slide=id.g4d6c16487b_1_508
    *  - For Do-It votes, the value could mean how important is it to the voter that the thing
    *      gets done — if each person has, say, 10 Do-It votes to distribute among the
    *      ideas/bugs hen cares about.
    */
  case object VotedOn extends PatRelType_later(-1)

  /** If a user (or group) is assigned to do something related to a post or category.
    *  - Sub type could be assigned-to-do-*what*?
    *     - AssignedTo.DoIt (the default) — To do the work described in a post, or
    *     - AssignedTo.ReviewIt — To review the results afterwards, or maybe
    *         But don't we want more fields, then:
    *           Did review or not? How much? When? See "Value can ..." below.
    *     - AssignedTo.Verify — To compile the code, run all tests (a la Gerrit).
    *     - AssignedTo.Publish — To e.g. make an article visible after it's been reviewed,
    *         or to merge source code into the main branch?
    *     - AssignedTo.AnswerQuestions — Responsible for answering questions appearing
    *         in a category or page?  Or is this is maybe better kept in  notf_prefs_t,
    *         no, maybe not? I think notf_prefs_t is something one edits oneself primarily,
    *         whilst AssignedTo.* is something someone else can do.
    *         And if one is AssignedTo.AnswerQuestions, Ty would send notifications, also
    *         if one hadn't subscribed to notifications oneself?  Unless one mutes
    *         or snoozes such notifications (maybe away on vacation)?
    *     - AssignedTo.Moderate —
    *         Let's say there're 20 moderators in a Ty community. They could get
    *         annoyed if they all got notified immediately about something to moderate.
    *         Instead, Ty could start with notifying mods who has been  AssignedTo.Moderate,
    *         and if many, start with those with the highest  priority (link numeric value).
    *         (Unlike AssignedTo.AnswerQuestions, they don't need to reply to anyone
    *         — instead, just review and moderate).
    *     - Custom type:  pat_rels_t.rel_type_c  values > 1000 could be foreign keys to
    *         types_t  with site specific types and meanings.
    *         Type ids < 1000 would be built-in types. This requires (I think)
    *             PostgreSQL *generated columns* [pg_15] which can be set to null
    *             for built-in types, so they won't have to link to types_t (there'd be
    *             no custom type to foreign-key link to, for a built-in type).
    *         E.g. custom-type AssignedTo Review-Code, or custom-type Check-Code-Style
    *         or Review-Dependencies maybe? — Then, if using Gerrit,
    *         Ty can understand and show all Gerrit pull request states?
   *          (Gerrit has custom review vote types, e.g. Code-Style above.)
    *         But should there then be sub sub types: AssignedTo.Review.Code or
    *         AssignedTo.Review.Dependencies — Ty might treat Review and all sub
    *         types differently: not notifying any AssignedTo.Publish person until
    *         all AssignedTo.Review.* have been completed?
    *         Or is Review.Deps an enumeration value, in a AssignedTo.Review value field?
    *         No, I think AssignedTo.Review is the type & a verb, and
    *         e.g. Code or Dependencies is another enum value, could be stored in
    *         a relationship property. Then would need new tables?
    *         Or Review could be a property of the type? types_t could have an
    *         is_review_c: bool column. — Maybe better with custom jsonb fields and
    *         plugins [review_plugin], and then see what works or not.
    *         New tables?: reviews_required_t: cat_id_c, type_c,
    *         and  reviews_done_t: post_id_c, type_c, vote_c in [-2, +2]
    *         But let's wait.
    *
    *  - Value can optionally be amount of responsibility?  E.g. Alice 20, Bob 10,
    *      Clara 10, means it's Alice who's primarily responsible to get a task done,
    *      or should be notified first about new comments to moderate, etc.
    *      Some external scheduling software, could update these links via Ty's API —
    *      when Alice isn't working, her links are deleted or priority is lowered,
    *      so Bob and Clara gets notified instead.
    *  - Do we want more values? Namely, what actually happened:  How much did Alice
    *      review, and Bob, maybe in the end 15 & 15.  And when?
    *      And did they have any comments — where are they? (As replies to the post?)
    *      Maybe assignments could be in a separate table, even, if they're this
    *      special. ?
    *      But that'd be another rel, type VotedOn, sub type Review, and value +-1, +-2 ?
    *      And thereafter the AssignedTo maybe would become dormant?
    *
    *  - A custom value could be e.g. AssignedTo.Review { what = dependencies }, or
    *      AssignedTo.Review what = code. And VotedOn.Review { what = dependencies },
    *      for custom plugins [review_plugin]
    */
  case object AssignedTo extends PatRelType_later(-1)

  /** If a pat wants to get notified about posts from another pat.  Hmm but
    * shouldn't this be in  notf_prefs_t?  So can follow someone *in a specific cat* only,
    * and choose how often to get notified, other notf prefs things.
    * Or should be in  pat_pat_rels_t?
    */
  // object FollowerOf extends PatRelType_later(-1)

  /** If pat has been added as author of a post.  (Value could maybe say if is
    * primary author, or secondary author?)

    * The person who posted a post, is the author, by default.  [post_authors]
    * But others can be made authors instead, by adding this AuthorOf relationship.
    */
  case object AuthorOf extends PatRelType_later(-1)

  /** If pat has been added as owner of a post. The owners of a post,
    * can edit it, change the authors, make it  private (but not make a private
    * post public), add/remove owners, etc.
    *
    *  Changing the owner, can be good if 1) someone starts working on an article,
    *  and leaves for vacation, and another person is to finish the article,
    *  publish it etc.  Or if 2) mods have deleted a post, and want to prevent
    *  the original author from un-deleting it or editing it any further. Then,
    *  the mods can make the Moderators group the owner of the post —
    *  thereafter the original author cannot edit it, un/delete it or anything.
    */
  case object OwnerOf extends PatRelType_later(-1)
}



// This'll get replaced by PatRelType.
sealed abstract class PostActionType { def toInt: Int }
// fromInt: see  [402KTHRNPQw]


sealed abstract class PostVoteType(val IntVal: Int) extends PostActionType { def toInt: Int = IntVal }
object PostVoteType {

  // Page votes? (These votes are cast on posts, although they are for pages
  // — so won't be lost if merging two pages, and splitting them again.)
  //case object DoIt extends PostVoteType(31)
  //case object DoNot extends PostVoteType(32)

  // dupl numbers [2PKWQUT0] perhaps use 1,2,4,8 instead? [8FEX1Q4]
  case object Like extends PostVoteType(41)
  case object Wrong extends PostVoteType(42) // RENAME to Disagree
  case object Bury extends PostVoteType(43)  // rename to MoveDown? [.ren_bury]
  case object Unwanted extends PostVoteType(44)

  // case object Promote/Boost/PinAtTop + priority value?  For curating the discussion
  // case object Demote/MoveDown — but there's Bury for that alreayd,
  // maybe rename to MoveDownwards? sounds more neutral / less negative [.ren_bury]

  def fromInt(value: Int): Option[PostVoteType] = Some(value match {
    //case DoIt.IntVal => DoIt
    //case DoNot.IntVal => DoNot
    case Like.IntVal => Like
    case Wrong.IntVal => Wrong
    case Bury.IntVal => Bury
    case Unwanted.IntVal => Unwanted
    case _ => return None
  })

  def apiV0_fromStr(value: St): Option[PostVoteType] = Some(value match {
    //case DoIt.IntVal => DoIt
    //case DoNot.IntVal => DoNot
    case "Like" => Like
    // case "Disagree" => Wrong
    // case "Bury" => Bury — rename to MoveDown
    // case "Unwanted" => Unwanted
    case _ => return None
  })
}


sealed abstract class PostFlagType extends PostActionType { def toInt: Int }
object PostFlagType {
  // dupl numbers [2PKWQUT0]
  case object Spam extends PostFlagType { val toInt = 51 }
  case object Inapt extends PostFlagType { val toInt = 52 }
  case object Other extends PostFlagType { val toInt = 53 }

  // Disqus' flag types: https://disqus.com/api/docs/posts/report/
  // harassment, threat, impersonation, private info (doxxing?), spam, inappropriate_content
  // + disagree (why? for silly flaggers?)
}

// val toInt = 61, 62, 63, .. ?
sealed abstract class PostStatusAction(val affectsSuccessors: Boolean)
object PostStatusAction {
  case object HidePost extends PostStatusAction(affectsSuccessors = false)
  case object UnhidePost extends PostStatusAction(affectsSuccessors = false)
  case object CloseTree extends PostStatusAction(affectsSuccessors = true)
  case object CollapsePost extends PostStatusAction(affectsSuccessors = false)
  case object CollapseTree extends PostStatusAction(affectsSuccessors = true)
  case class DeletePost(clearFlags: Boolean) extends PostStatusAction(affectsSuccessors = false)
  case object DeleteTree extends PostStatusAction(affectsSuccessors = true)
  // UndeletePost extends PostStatusAction(affectsSuccessors = false)  [UNDELPOST]
  // UndeleteTree extends PostStatusAction(affectsSuccessors = true)?
  //  — but what about individually deleted posts in the tree? Well, there's
  // Post.deletedStatus: DeletedStatus, which tells if the post was deleted explicitly,
  // or implicitly because an ancestor got tree-deleted.  UndoTree = undeletes the post selected,
  // + all descendants that got tree-deleted.
}


// RENAME to  PatNodeRel
// Stored in  post_actions3, will rename to pat_rels_t, no to  pat_post_rels_t?
abstract class PostAction {
  def uniqueId: PostId
  def pageId: PageId
  def postNr: PostNr
  def doerId: UserId
  def doneAt: When
  def actionType: PostActionType
}


object PostAction {
  def apply(uniqueId: PostId, pageId: PageId, postNr: PostNr, doerId: UserId,
        doneAt: When, actionType: PostActionType)
        : PostAction = actionType match {
    case voteType: PostVoteType =>
      PostVote(uniqueId, pageId, postNr, doneAt, voterId = doerId, voteType = voteType)
    case flagType: PostFlagType =>
      PostFlag(uniqueId, pageId, postNr, doneAt, flaggerId = doerId, flagType = flagType)
    case x =>
      die("DwE7GPK2", s"Bad action type: '$actionType'")
  }
}

// [exp] delete field:  action_id (alw null), sub_id (always 1), updated_at, deleted_at, deleted_by_id
case class PostVote(  // [exp] ok to use
  uniqueId: PostId,   // RENAME to postId
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  voterId: UserId,
  voteType: PostVoteType) extends PostAction {

  def actionType: PostVoteType = voteType
  def doerId: UserId = voterId
}

/** Post id missing — nice to not have to specify, when constructing tests, since the post id is
  * undecided, when importing the site.  */
case class PostVoteToInsert(
  // postId: Opt[PostId], // later not now
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  voterId: UserId,
  voteType: PostVoteType) {

  def toPostAction(postId: PostId): PostVote = PostVote(
    uniqueId = postId,
    pageId = pageId,
    postNr = postNr,
    doneAt = doneAt,
    voterId = voterId,
    voteType = voteType)
}


case class PostFlag(  // [exp] ok to use
  uniqueId: PostId,   // RENAME to postId
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  flaggerId: UserId,
  flagType: PostFlagType) extends PostAction {

  def actionType: PostFlagType = flagType
  def doerId: UserId = flaggerId
  def flaggedAt: When = doneAt
}

