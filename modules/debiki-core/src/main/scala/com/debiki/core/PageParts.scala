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
import com.debiki.core.{PostActionPayload => PAP}
import com.debiki.core.PostActionPayload.EditPost
import scala.{collection => col}
import scala.collection.{immutable => imm, mutable => mut}
import Prelude._
import PageParts._


object PageParts {


  // IDs for some magic posts: page title, page body and page config post.
  // - The firt post is the page title and body, with numbers 0 and 1, and the second post
  // (which is the first reply) has id 2, and so on, for compatibility with Discourse.
  // - Also seee `nextRandomActionId` later in this file.
  val TitleId = 0
  val BodyId = 1

  // This assume that usually one won't need more than 2 bytes to index
  // all comments on a page (2^16 = 65536). (So I won't have to write any code
  // that avoids these IDs in the nearest future.)
  @deprecated("Use DW1_SETTINGS instead", "Mars 2014")
  val ConfigPostId = 65503

  val NoId = -1

  // These are used when new comments or actions are submitted to the server.
  // When they're submitted, their ids are unknown (the server has not yet
  // assigned them any id).
  val UnassignedId = -1001
  val UnassignedId2 = -1002
  val UnassignedId3 = -1003
  val UnassignedId4 = -1004
  def isActionIdUnknown(id: ActionId) = id <= UnassignedId


  def isArticleOrConfigPostId(id: ActionId) =
    id == PageParts.BodyId || id == PageParts.TitleId || id == PageParts.ConfigPostId


  def isReply(rawAction: RawPostAction[_]): Boolean = rawAction.payload match {
    case _: PAP.CreatePost if !isArticleOrConfigPostId(rawAction.id) => true
    case _ => false
  }


  def fromActions(pageId: PageId, postReadStats: PostsReadStats, people: People,
        actions: List[AnyRef]): PageParts =
    PageParts(pageId, Some(postReadStats), people) ++ actions


  /** Assigns ids to actions and updates references from e.g. Edits to Posts.
   *  Only remaps IDs that are unknown (< 0).
   */
  def assignIdsTo(actionsToRemap: Seq[RawPostAction[_]], nextNewReplyId: Int)
        : Seq[RawPostAction[_]] = {
    val remaps = mut.Map[ActionId, ActionId]()
    var nextReplyId = nextNewReplyId

    // Generate new ids.
    actionsToRemap foreach { a: RawPostAction[_] =>
      require(!remaps.contains(a.id)) // each action must be remapped only once
      remaps(a.id) =
          if (isActionIdUnknown(a.id)) {
            if (PageParts.isReply(a)) {
              // Reply ids should be small consecutive numbers that can be used
              // as indexes into a bitset, or as parts of permalinks, or to
              // show in which order comments were posted and to refer to other
              // people's comments. That's why they're allocated in this manner.
              nextReplyId += 1
              nextReplyId - 1
            }
            else {
              nextRandomActionId
            }
          }
          else {
            assert(PageParts.isArticleOrConfigPostId(a.id))
            a.id
          }
    }

    // Remap ids and update references to ids.
    def rmpd(id: ActionId) = remaps.getOrElse(id, id)
    def updateIds(action: RawPostAction[_]): RawPostAction[_] = {
      val remappedPayload = action.payload match {
        case c: PAP.CreatePost =>
          c.parentPostId match {
            case None => c
            case Some(parentPostId) => c.copy(parentPostId = Some(rmpd(parentPostId)))
          }
        case a: PAP.EditApp => a.copy(editId = rmpd(a.editId))
        case d: PAP.Delete => d.copy(targetActionId = rmpd(d.targetActionId))
        case x => x
      }
      action.copy(id = remaps(action.id), postId = rmpd(action.postId), payload = remappedPayload)
    }

    val actionsRemapped: Seq[RawPostAction[_]] = actionsToRemap map updateIds
    actionsRemapped
  }


  /** Ids 1, 2, 3 and upwards are for comments. Other actons, e.g. edits and flags,
    * start elsewhere:
    *   If we restrict num comments to 2^16, then we could use as non-post action ids
    * values from 65536 and upwards (= 2^16). However, let's start at 10e6, so we
    * can create really huge discussions, should someone want to do that in the
    * future some day. Some forums have threads that are 5000 pages long,
    * and if there are 100 comments on each page, there'd be 500 000 comments!
    * So 10 000 000 should be reasonably safe?
    */
  def nextRandomActionId =
    MaxNumPostsPerPage + (math.random * (Int.MaxValue - MaxNumPostsPerPage)).toInt

  val MaxNumPostsPerPage = 10*1000*1000


  // Doesn't currently work, because there are old ids that breaks this rule:
  //def isPostId(id: PostId) = id < MaxNumPostsPerPage


  /** Returns true iff a post with id a might be an ancestor of b. Useful if
    * sorting posts so parents appear before children.
    */
  def canBeAncestorOf(a: PostId, b: PostId): Boolean = {
    // Could:  require(isPostId(a) && isPostId(b))
    if (isArticleOrConfigPostId(a))
      return !isArticleOrConfigPostId(b)
    else if (isArticleOrConfigPostId(b))
      return false
    a < b
  }

}



/** Wraps RawPostAction:s in PostActions and groups them by post id.
  *
  * That is, for each RawPostAction, wraps it in a PostAction, and people
  * can then use the PostAction, instead of the rather non-user-friendly
  * RawPostAction (data-transfer-object).
  */
abstract class PostActionsWrapper { self: PageParts =>


  def rawActions: List[RawPostAction[_]]


  def getActionById(id: ActionId): Option[PostAction[_]] =
    actionsById.get(id)


  def getActionsByPostId(postId: ActionId): List[PostAction[_]] =
    actionsByPostId(postId)


  def getActionsByTargetId(targetId: ActionId): List[PostAction[_]] =
    actionsByTargetActionId(targetId)


  // /** WARNING Doesn't include any PostActionOld */
  def getAllActions: Seq[PostAction[_]] =
    actionsByPostId.valuesIterator.toSeq.flatten


  // Maps data-transfer-objects to PostAction:s. Never mutated once constructed.
  private lazy val (
    actionsById,
    actionsByPostId,
    actionsByTargetActionId): (
      mut.Map[ActionId, PostAction[_]],
      mut.Map[ActionId, List[PostAction[_]]],
      mut.Map[ActionId, List[PostAction[_]]]) = {

    var actionsById = mut.Map[ActionId, PostAction[_]]()
    var actionsByPostId = mut.Map[ActionId, List[PostAction[_]]]().withDefaultValue(Nil)
    val actionsByTargetId = mut.Map[ActionId, List[PostAction[_]]]().withDefaultValue(Nil)

    for (state <- self.postStates) {
      addAction(new Post(self, state))
    }

    for (actionDto <- rawActions) {
      def actionAs[T <: PAP] = actionDto.asInstanceOf[RawPostAction[T]]
      val action = actionDto.payload match {
        case _: PAP.CreatePost => new Post(self, actionAs[PAP.CreatePost])
        case _: PAP.EditPost => new Patch(self, actionAs[PAP.EditPost])
        //case _: PAP.ApplyEdit => new ApplyPatchAction(self, actionAs[PAP.PAP.ApplyEdit])
        case _: PAP.ApprovePost => new ApprovePostAction(self, actionAs[PAP.ApprovePost])
        case _: PAP.RejectEdits => new RejectEditsAction(self, actionAs[PAP.RejectEdits])
        case _ => new PostAction(self, actionDto)
      }
      addAction(action)
    }

    def addAction(action: PostAction[_]) {
      val anyOldAction = actionsById.get(action.id)
      anyOldAction foreach { oldAction =>
        // This would fail if a Post is added both via a cached PostState and
        // via a create-new-post-action.
        if (oldAction != action)
          assErr("DwE75BW0", o"""Cannot map action `${action.id}' to two different actions:
            the first: $oldAction, and the second: $action""")
      }
      actionsById(action.id) = action
      val otherActionsSamePost = actionsByPostId(action.postId)
      if (otherActionsSamePost.find(_.id == action.id).isEmpty)
        actionsByPostId(action.rawAction.postId) = action :: otherActionsSamePost

      def addActionByTargetId(targetId: ActionId) {
        val otherActionsSameTarget = actionsByTargetId(action.postId)
        actionsByTargetId(targetId) = action :: otherActionsSameTarget
      }

      action.payload match {
        case _: PAP.CreatePost => // doesn't affect any post; creates a new one
        case PAP.Delete(targetActionId) => addActionByTargetId(targetActionId)
        case e: PAP.EditApp => addActionByTargetId(e.editId)
        case _: PAP => addActionByTargetId(action.postId)
      }
    }

    (actionsById, actionsByPostId, actionsByTargetId)
  }

}



/** A page. It is constructed via actions (the Action/Command design pattern).
  * The actions create "posts", e.g. title, body, comments. The actions also
  * edit them, and review, close, flag, delete, etcetera.
  *
  * @param guid The page's id, unique per website.
  * @param people People who has contributed to the page. If some people are missing,
  * certain functions might fail (e.g. a function that fetches the name of the author
  * of the page body). — This class never fetches anything lazily from database.
  * @param rawActions The actions that build up the page.
  */
case class PageParts (
  guid: PageId,  // COULD rename to pageId?
  postReadStats: Option[PostsReadStats] = None,
  people: People = People.None,
  postStates: List[PostState] = Nil,
  rawActions: List[RawPostAction[_]] = Nil) extends PostActionsWrapper {


  def actionCount: Int = rawActions.size


  @deprecated("use rawActions instead", "now")
  def allActions: Seq[RawPostAction[_]] = rawActions


  lazy val actionsByTimeAsc =
    rawActions.toVector.sortBy(_.creationDati.getTime)


  // Try to remove/rewrite? Doesn't return e.g Post or Patch.
  @deprecated("use getActionById instead?", "now")
  def smart(action: RawPostAction[_]) = new PostAction(this, action)


  lazy val (postsByParentId: Map[PostId, List[Post]]) = {
    // Sort posts by parent id, use PageParts.NoId if there's no parent.
    var postMap = mut.Map[PostId, mut.Set[Post]]()
    for (post <- getAllPosts) {
      def addNewSet() = {
        val set = mut.Set[Post]()
        postMap.put(post.parentIdOrNoId, set)
        set
      }
      postMap.getOrElse(post.parentIdOrNoId, addNewSet()) += post
    }
    // Copy to immutable versions.
    def buildImmMap(mutMap: mut.Map[PostId, mut.Set[Post]]): Map[PostId, List[Post]] = {
      // COULD sort the list in ascenting ctime order?
      // Then list.head would be e.g. the oldest title -- other code
      // assume posts ase sorted in this way?
      // See Post.templatePost, titlePost.
      Map[PostId, List[Post]](
        (for ((parentId, postsSet) <- mutMap)
        yield (parentId, postsSet.toList // <-- sort this list by ctime asc?
              )).toList: _*).withDefaultValue(Nil)
    }
    val immPostMap = buildImmMap(postMap)
    immPostMap
  }


  private lazy val pinnedPositionCalcer = {
    val calcer = new PinnedPositionCalcer
    for (action <- actionsByTimeAsc)
      action.payload match {
        case pinPost: PAP.PinPostAtPosition =>
          val anyPost = getPost(action.postId)
          anyPost foreach { post =>
            calcer.pinPost(post, pinPost.position)
          }
        case _ =>
      }
    calcer
  }


  def getPinnedPositionOf(post: Post): Option[Int] =
    pinnedPositionCalcer.effectivePositionOf(post)


  /** The guid prefixed with a dash.
   *
   * A debate page can be identified either by "-guid"
   * or "/path/to/page/".
   */
  def guidd = "-"+ guid

  // Use these instead.
  def id = guid
  def idd = guidd
  def pageId = id  // when/if I rename Debate to PageActions.

  def body: Option[Post] = getPost(PageParts.BodyId)

  def body_! = getPost(PageParts.BodyId) getOrDie "DwE30XF5"

  def approvedBodyText: Option[String] = body.flatMap(_.approvedText)


  def title_! = getPost(PageParts.TitleId) getOrDie "DwE72RP3"

  /** The page title if any. */
  def title = titlePost // COULD remove `titlePost`
  def titlePost: Option[Post] = getPost(PageParts.TitleId)

  /** The page title, as plain text. */
  def approvedTitleText: Option[String] =
    titlePost.flatMap(_.approvedText).filter(_.nonEmpty)

  def unapprovedTitleText: Option[String] =
    titlePost.flatMap(_.unapprovedText).filter(_.nonEmpty)

  def maybeUnapprovedTitleText: Option[String] =
    unapprovedTitleText orElse approvedTitleText

  def approvedTitleTextOrNoTitle = approvedTitleText getOrElse {
    if (unapprovedTitleText.isEmpty) "(No title)"
    else "(Page title pending approval)"
  }


  /** A Post with template engine source code, for the whole page. */
  def pageConfigPost: Option[Post] = getPost(PageParts.ConfigPostId)


  // -------- Votes

  /** Returns a map postId => UserPostVotes, with all votes by user userId.
    */
  def userVotesMap(userIdData: UserIdData): Map[PostId, UserPostVotes] = {
    val voteBitsByPostId = mut.HashMap[PostId, Int]()
    for {
      action <- rawActions
      if action.payload.isInstanceOf[PAP.Vote]
      if userIdData.userId != UnknownUser.Id && action.userId == userIdData.userId
    } {
      val bits = action.payload match {
        case PAP.VoteLike => 1
        case PAP.VoteWrong => 2
        case PAP.VoteOffTopic => 4
      }
      var voteBits = voteBitsByPostId.getOrElseUpdate(action.postId, 0)
      voteBits |= bits
      assert(voteBits <= 7)
      voteBitsByPostId.put(action.postId, voteBits)
    }

    val postIdsAndVotes = voteBitsByPostId.toVector map { case (key: PostId, voteBits: Int) =>
      val votes = UserPostVotes(
        votedLike = (voteBits & 1) == 1,
        votedWrong = (voteBits & 2) == 2,
        votedOffTopic = (voteBits & 4) == 4)
      (key, votes)
    }

    Map(postIdsAndVotes: _*)
  }


  // ====== Older stuff below (everything in use though!) ======


  // -------- Posts

  def getPost(id: ActionId): Option[Post] =
    getActionById(id) match {
      case p @ Some(_: Post) => p.asInstanceOf[Option[Post]]
      case None => None
      case x => runErr("DwE57BI0", s"Action `$id' is not a Post but a: ${classNameOf(x)}")
    }

  def getAllPosts: Seq[Post] =
    getAllActions.filter(_.isInstanceOf[Post]).asInstanceOf[Seq[Post]]

  def postCount = getAllPosts.length

  def commentCount = getAllPosts.filterNot(post => {
    PageParts.isArticleOrConfigPostId(post.id)
  }).length

  def thePost(postId: PostId): Post = getPost_!(postId)

  def getPost_!(postId: PostId): Post =
    getPost(postId).getOrElse(runErr(
      "DwE3kR49", s"Post `$postId' not found on page `$id'"))

  def postsByUser(withId: UserId): Seq[Post] = {
    getAllPosts.filter(_.userId == withId)
  }

  lazy val (
      numLikes,
      numWrongs,
      numPosters,
      numPostsDeleted,
      numRepliesVisible,
      numPostsToReview,
      lastVisiblePostDati) = {
    var numLikes = 0
    var numWrongs = 0
    var numDeleted = 0
    var numVisible = 0
    var numPendingReview = 0
    var lastDati: Option[ju.Date] = None
    var posterUserIds = mut.Set[UserId]()
    for (post <- getAllPosts) {
      // Minor BUG: I think this won't ignore posts whose whole ancestor tree has been deleted.
      if (post.isDeletedSomehow) numDeleted += 1
      else if (post.someVersionApproved) {
        // posterUserIds.add(post.user_!.id) — breaks, users sometimes absent.
        // Wait until I've added DW1_PAGE_ACTIONS.USER_ID?
        if (PageParts.isReply(post.rawAction)) {
          numVisible += 1
        }
        else {
          // Ignore. We don't count the page body or title — it's rather uninteresting
          // to count them because they always exist (on normal pages) Num replies,
          // however, is interesting.
        }

        val isNewer = lastDati.isEmpty || lastDati.get.getTime < post.creationDati.getTime
        if (isNewer) lastDati = Some(post.creationDati)

        numLikes += post.numLikeVotes
        numWrongs += post.numWrongVotes
      }
      else numPendingReview += 1
    }
    (numLikes, numWrongs, posterUserIds.size, numDeleted, numVisible, numPendingReview, lastDati)
  }

  def topLevelComments: Seq[Post] =
    postsByParentId.get(PageParts.NoId).map(_ filterNot { post =>
      PageParts.isArticleOrConfigPostId(post.id)
    }) getOrElse Nil


  def findCommonAncestorPost(postIds: Seq[PostId]): PostId = {
    TESTS_MISSING
    if (postIds.isEmpty || postIds.contains(PageParts.NoId))
      return PageParts.NoId

    val firstPost = getPost_!(postIds.head)
    var commonAncestorIds: Seq[PostId] = firstPost.id :: firstPost.ancestorPosts.map(_.id)
    for (nextPostId <- postIds.tail) {
      val nextPost = getPost_!(nextPostId)
      var ancestorIds = nextPost.id :: nextPost.ancestorPosts.map(_.id)
      var commonAncestorFound = false
      while (ancestorIds.nonEmpty && !commonAncestorFound) {
        val nextAncestorId = ancestorIds.head
        if (commonAncestorIds.contains(nextAncestorId)) {
          commonAncestorIds = commonAncestorIds.dropWhile(_ != nextAncestorId)
          commonAncestorFound = true
        }
        else {
          ancestorIds = ancestorIds.tail
        }
      }
      if (ancestorIds.isEmpty)
        return NoId
    }
    commonAncestorIds.head
  }


  // -------- Replies

  def repliesTo(id: PostId): List[Post] =
    // Filter out title, body config post. (Parent id = its own id)
    postsByParentId.getOrElse(id, Nil).filterNot(_.id == id)

  def successorsTo(postId: PostId): List[Post] = {
    val res = repliesTo(postId)
    res.flatMap(r => successorsTo(r.id)) ::: res
  }


  // -------- Edits

  def getPatch_!(editId: ActionId): Patch =
    getPatch(editId).getOrElse(assErr(
      "DwE03kE1", s"Edit id `$editId' not found on page `$pageId'"))

  def getPatch(editId: ActionId): Option[Patch] = getActionById(editId) match {
    case p @ Some(_: Patch) => p.asInstanceOf[Option[Patch]]
    case None => None
    case x => runErr("DwE0GK43", s"Action `$editId' is not a Patch but a: ${classNameOf(x)}")
  }

  def editAppsByEdit(id: ActionId) =
    getActionsByTargetId(id).filter(_.payload.isInstanceOf[PAP.EditApp])
      .asInstanceOf[Seq[PostAction[PAP.EditApp]]]

  private def editAppsByPostId(postId: PostId): Seq[RawPostAction[PAP.EditApp]] =
    getActionsByPostId(postId).filter(_.payload.isInstanceOf[PAP.EditApp])
      .asInstanceOf[Seq[RawPostAction[PAP.EditApp]]]

  /** Edits applied to the specified post, sorted by most-recent first.
   */
  def editAppsTo(postId: PostId): Seq[RawPostAction[PAP.EditApp]] =
    // The list is probably already sorted, since new EditApp:s are
    // prefixed to the editApps list.
    editAppsByPostId(postId).sortBy(- _.ctime.getTime)

  def editApp(withId: ActionId): Option[RawPostAction[PAP.EditApp]] =
    getActionById(withId).filter(_.payload.isInstanceOf[PAP.EditApp])
      .asInstanceOf[Option[RawPostAction[PAP.EditApp]]]


  // -------- Reviews (manual approvals and rejections, no auto approvals)
/*
  def getReview(reviewId: ActionId): Option[ApprovePostAction] = getActionById(reviewId) match {
    case p @ Some(_: ApprovePostAction) => p.asInstanceOf[Option[ApprovePostAction]]
    case None => None
    case x => runErr("DwE0GK43", s"Action `$reviewId' is no Review but a: ${classNameOf(x)}")
  } */


  // -------- Construction

  def +(actionDto: RawPostAction[_]) = ++(actionDto::Nil)

  // Could try not to add stuff that's already included in this.people.
  def ++(people: People): PageParts = this.copy(people = this.people ++ people)
  def +(user: User) = this ++ People(users = user::Nil)

  def ++(page: PageParts): PageParts = this ++ page.allActions

  /** Adds many actions to this page.
    *
    * Takes O(n^2) time but I think there must be perhaps 10 000 posts for this to
    * matter, and long before that ever happens there'll be some other bottleneck?
    * Anyway could avoid loading more than e.g. 1 000 posts at a time,
    * because of this O(n^2).
    */
  // COULD [T <: Action] instead of >: AnyRef?
  def ++[T >: AnyRef] (actions: Seq[T]): PageParts = {
    var actions2 = this.rawActions
    type SthWithId = { def id: ActionId }
    def dieIfIdClash(olds: Seq[SthWithId], a: SthWithId) =
      olds.find(_.id == a.id) match {
        case None => // fine, `a` is not present in `olds`
        case Some(old) =>
          assErr("DwE4BFY8", s"Cannot add new action $a; there is an old with same id: $old")
      }

    for (a <- actions) a match {
      case a: RawPostAction[_] =>
        dieIfIdClash(actions2, a)
        actions2 ::= a
      case x => runErr(
        "DwE8k3EC", "Unknown action type: "+ classNameOf(x))
    }
    PageParts(id, postReadStats, people, postStates, actions2)
  }


  // -------- Time


  /** This page, as it was at some time in the past (everything more recent is dropped).
    */
  def asOf(dati: ju.Date): PageParts = {
    def happenedInTime(action: RawPostAction[_]) =
      action.ctime.getTime <= dati.getTime
    val (actionsBefore, actionsAfter) = rawActions partition happenedInTime
    val pageUpToAndInclDati = copy(rawActions = actionsBefore)
    pageUpToAndInclDati
  }


  /**
   * The most recent outwardly visible action, e.g. the last edit application,
   * or the last reversion of an applied edit. Might also
   * return an even more recent action that does actually not affect
   * how this page is being rendered (e.g. a deletion of a pending edit).
   */
  //def lastOrLaterVisibleAction: Option[Action] = lastAction  // for now


  /**
   * The action with the most recent creation dati.
   */
  lazy val lastAction: Option[RawPostAction[_]] = oldestOrLatestAction(latest = true)


  /**
   * The action with the oldest creation dati.
   */
  private def oldestAction: Option[RawPostAction[_]] = oldestOrLatestAction(latest = false)


  private def oldestOrLatestAction(latest: Boolean): Option[RawPostAction[_]] = {
    def latestOrOldestAction(a: RawPostAction[_], b: RawPostAction[_]) = {
      if (latest) {
        if (a.ctime.getTime < b.ctime.getTime) b else a
      }
      else {
        if (a.ctime.getTime < b.ctime.getTime) a else b
      }
    }

    // Edits might be auto applied, so check their dates.
    // Deletions might revert edit applications, so check their dates.
    // Hmm, check everything, or a bug will pop up, later on.
    val all = allActions
    if (all isEmpty) None
    else Some(all reduceLeft (latestOrOldestAction(_, _)))
  }


  /**
   * When the most recent change to this page was made —
   * but unappliied (i.e. pending) edits are ignored.
   * Might return a somewhat more recent date, e.g. for a pending edit
   * that was deleted (but not an earlier date, that'd be a bug).
   */
  //lazy val lastOrLaterChangeDate: Option[ju.Date] =
  //  lastOrLaterVisibleAction.map(_.ctime)


  lazy val modificationDati: Option[ju.Date] =
    lastAction.map(_.ctime)


  lazy val oldestDati: Option[ju.Date] =
    oldestAction.map(_.ctime)

}


case class UserPostVotes(
  votedLike: Boolean,
  votedWrong: Boolean,
  votedOffTopic: Boolean)

