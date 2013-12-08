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
  // - They don't start at 1, because I think it's nice to let ids 1, 2, 3 be
  // comment ids instead (so the very first comment can have id 1).
  // - They assume that usually one won't need more than 2 bytes to index
  // all comments on a page (2^16 = 65536). (So I won't have to write any code
  // that avoids these IDs in the nearest future.)
  // - Also seee `nextRandomActionId` later in this file.
  val TitleId = 65501
  val BodyId = 65502
  val ConfigPostId = 65503

  val NoId = 0

  // These are used when new comments or actions are submitted to the server.
  // When they're submitted, their ids are unknown (the server has not yet
  // assigned them any id).
  val UnassignedId = -1
  val UnassignedId2 = -2
  val UnassignedId3 = -3
  val UnassignedId4 = -4
  def isActionIdUnknown(id: ActionId) = id < 0


  def isArticleOrConfigPostId(id: ActionId) =
    id == PageParts.BodyId || id == PageParts.TitleId || id == PageParts.ConfigPostId


  def isReply(actionOld: PostActionDtoOld): Boolean = actionOld match {
    case post: PostActionDto[_] => post.payload match {
      case _: PAP.CreatePost if !isArticleOrConfigPostId(post.id) => true
      case _ => false
    }
    case _ => false
  }


  def fromActions(guid: PageId, people: People, actions: List[AnyRef]): PageParts =
    PageParts(guid, people) ++ actions


  /** Assigns ids to actions and updates references from e.g. Edits to Posts.
   *  Only remaps IDs that are unknown (< 0).
   */
  def assignIdsTo[T <: PostActionDtoOld](actionsToRemap: List[T], nextNewReplyId: Int): List[T] = {
    val remaps = mut.Map[ActionId, ActionId]()
    var nextReplyId = nextNewReplyId

    // Generate new ids.
    actionsToRemap foreach { a: T =>
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
    def updateIds(action: T): T = (action match {
      case r: Rating => r.copy(id = remaps(r.id), postId = rmpd(r.postId))
      case f: Flag => f.copy(id = remaps(f.id), postId = rmpd(f.postId))
      case a: EditApp => a.copy(id = remaps(a.id), editId = rmpd(a.editId),
        postId = rmpd(a.postId))
      case a: PostActionDto[_] =>
        val rmpdPaylad = a.payload match {
          case c: PAP.CreatePost => c.copy(parentPostId = rmpd(c.parentPostId))
          case d: PAP.Delete => d.copy(targetActionId = rmpd(d.targetActionId))
          case u: PAP.Undo => u.copy(targetActionId = rmpd(u.targetActionId))
          case x => x
        }
        a.copy(id = remaps(a.id), postId = rmpd(a.postId), payload = rmpdPaylad)
      case x => assErr("DwE3RSEK9")
    }).asInstanceOf[T]

    val actionsRemapped: List[T] = actionsToRemap map updateIds
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



/** Wraps PostActionDto:s in PostActions and groups them by post id.
  *
  * That is, for each PostActionDto, wraps it in a PostAction, and people
  * can then use the PostAction, instead of the rather non-user-friendly
  * PostActionDto (data-transfer-object).
  */
abstract class PostActionsWrapper { self: PageParts =>


  def actionDtos: List[PostActionDto[_]]


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

    for (actionDto <- actionDtos) {
      def actionAs[T <: PAP] = actionDto.asInstanceOf[PostActionDto[T]]
      val action = actionDto.payload match {
        case _: PAP.CreatePost => new Post(self, actionAs[PAP.CreatePost])
        case _: PAP.EditPost => new Patch(self, actionAs[PAP.EditPost])
        //case _: PAP.ApplyEdit => new ApplyPatchAction(self, actionAs[PAP.PAP.ApplyEdit])
        case _: PAP.ReviewPost => new Review(self, actionAs[PAP.ReviewPost])
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
        actionsByPostId(action.actionDto.postId) = action :: otherActionsSamePost

      def addActionByTargetId(targetId: ActionId) {
        val otherActionsSameTarget = actionsByTargetId(action.postId)
        actionsByTargetId(targetId) = action :: otherActionsSameTarget
      }

      action.payload match {
        case _: PAP.CreatePost => // doesn't affect any post; creates a new one
        case _: PAP.EditPost => addActionByTargetId(action.postId)
        case _: PAP.ReviewPost => addActionByTargetId(action.postId)
        case _: PAP.PinPostAtPosition => addActionByTargetId(action.postId)
        case PAP.CollapsePost => addActionByTargetId(action.postId)
        case PAP.CollapseTree => addActionByTargetId(action.postId)
        case PAP.CloseTree => addActionByTargetId(action.postId)
        case PAP.DeletePost => addActionByTargetId(action.postId)
        case PAP.DeleteTree => addActionByTargetId(action.postId)
        case PAP.Undo(targetActionId) => addActionByTargetId(targetActionId)
        case PAP.Delete(targetActionId) => addActionByTargetId(targetActionId)
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
  * @param ratings Deprecated, see below.
  * @param editApps Deprecated, see next line.
  * @param flags Deprecated? I should convert Ratings, EditApps and Flags to PostActionDto:s
  * and use only `actionDtos` instead?
  * @param actionDtos The actions that build up the page.
  */
case class PageParts (
  guid: PageId,  // COULD rename to pageId?
  people: People = People.None,
  ratings: List[Rating] = Nil,
  editApps: List[EditApp] = Nil,
  flags: List[Flag] = Nil,
  postStates: List[PostState] = Nil,
  actionDtos: List[PostActionDto[_]] = Nil) extends PostActionsWrapper {


  def actionCount: Int =
     ratings.size + editApps.size +
     flags.size + actionDtos.size


  def allActions: Seq[PostActionDtoOld] =
     flags:::editApps:::ratings:::actionDtos


  lazy val actionsByTimeAsc =
    actionDtos.toVector.sortBy(_.creationDati.getTime)


  // Try to remove/rewrite? Doesn't return e.g Post or Patch.
  def smart(action: PostActionDtoOld) = new PostActionOld(this, action)
  // ^ For the love of god, I have to rename this crap, this file is a mess.
  // Fixed (soon). Rewrite to PostActionDto and use PostActionsWrapper.


  lazy val (postsByParentId: Map[PostId, List[Post]]) = {
    // Sort posts by parent id.
    var postMap = mut.Map[PostId, mut.Set[Post]]()
    for (post <- getAllPosts) {
      def addNewSet() = {
        val set = mut.Set[Post]()
        postMap.put(post.parentId, set)
        set
      }
      postMap.getOrElse(post.parentId, addNewSet()) += post
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


  private class _RatingsOnActionImpl extends RatingsOnAction {
    val _mostRecentByUserId = mut.Map[UserId, Rating]()
    val _mostRecentByNonAuLoginId = mut.Map[LoginId, Rating]()
    val _allRecentByNonAuIp =
      mut.Map[String, List[Rating]]().withDefaultValue(Nil)

    override def mostRecentByUserId: collection.Map[UserId, Rating] =
      _mostRecentByUserId

    override lazy val mostRecentByNonAuLoginId: collection.Map[LoginId, Rating] =
      _mostRecentByNonAuLoginId

    override lazy val allRecentByNonAuIp: collection.Map[String, List[Rating]] =
      _allRecentByNonAuIp

    override def curVersionOf(rating: Rating): Rating = {
      val user = smart(rating).user_!
      val curVer = user.isAuthenticated match {
        case true => _mostRecentByUserId(user.id)
        case false => _mostRecentByNonAuLoginId(rating.loginId)
      }
      assert(rating.ctime.getTime <= curVer.ctime.getTime)
      assert(rating.postId == curVer.postId)
      curVer
    }
  }

  // Analyze ratings, per action.
  private lazy val _ratingsByActionId: col.Map[ActionId, _RatingsOnActionImpl] = {
    val mutRatsByPostId =
      mut.Map[ActionId, _RatingsOnActionImpl]()

    // Remember the most recent ratings per user and non-authenticated login id.
    for (rating <- ratings) {
      var singlePostRats = mutRatsByPostId.getOrElseUpdate(
        rating.postId, new _RatingsOnActionImpl)
      val user = smart(rating).user_!
      val (recentRatsMap, key) = user.isAuthenticated match {
        case true => (singlePostRats._mostRecentByUserId, user.id)
        case false => (singlePostRats._mostRecentByNonAuLoginId, rating.loginId)
      }

      val perhapsOtherRating = recentRatsMap.getOrElseUpdate(key, rating)
      if (perhapsOtherRating.ctime.getTime < rating.ctime.getTime) {
        // Different ctime, must be different ratings
        assert(perhapsOtherRating.id != rating.id)
        // But by the same login, or user
        assert(perhapsOtherRating.loginId == rating.loginId ||
           smart(perhapsOtherRating).user.map(_.id) ==
              smart(rating).user.map(_.id))
        // Keep the most recent rating only.
        recentRatsMap(key) = rating
      }
    }

    // Remember all unauthenticated ratings, per IP.
    // This cannot be done until the most recent ratings by each non-authn
    // user has been found (in the for loop just above).
    for {
      singleActionRats <- mutRatsByPostId.values
      nonAuRating <- singleActionRats._mostRecentByNonAuLoginId.values
    } {
      val byIp = singleActionRats._allRecentByNonAuIp
      val ip = smart(nonAuRating).ip_!
      val otherRatsSameIp = byIp(ip)
      byIp(ip) = nonAuRating :: otherRatsSameIp
    }

    mutRatsByPostId
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

  /** The page title, as plain text, but the empty string is changed to None. */
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


  // -------- Ratings

  private lazy val ratingsById: imm.Map[ActionId, Rating] =
    imm.Map[ActionId, Rating](ratings.map(x => (x.id, x)): _*)

  def rating(id: ActionId): Option[Rating] = ratingsById.get(id)

  def ratingsByActionId(actionId: ActionId): Option[RatingsOnAction] =
    _ratingsByActionId.get(actionId)

  def ratingsByUser(withId: UserId): Seq[Rating] =
    ratings.filter(smart(_).identity.map(_.userId) == Some(withId))


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

  def getPost_!(postId: PostId): Post =
    getPost(postId).getOrElse(runErr(
      "DwE3kR49", s"Post `$postId' not found on page `$id'"))

  def postsByUser(withId: UserId): Seq[Post] = {
    getAllPosts.filter(_.userId == withId)
  }

  lazy val (
      numPosters,
      numPostsDeleted,
      numRepliesVisible,
      numPostsToReview,
      lastVisiblePostDati) = {
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
        if (PageParts.isReply(post.action)) {
          numVisible += 1
        }
        else {
          // Ignore. We don't count the page body or title — it's rather uninteresting
          // to count them because they always exist (on normal pages) Num replies,
          // however, is interesting.
        }
        val isNewer = lastDati.isEmpty || lastDati.get.getTime < post.creationDati.getTime
        if (isNewer) lastDati = Some(post.creationDati)
      }
      else numPendingReview += 1
    }
    (posterUserIds.size, numDeleted, numVisible, numPendingReview, lastDati)
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

  def editAppsByEdit(id: ActionId) = _editAppsByEditId.getOrElse(id, Nil)

  private lazy val _editAppsByEditId: imm.Map[ActionId, List[EditApp]] = {
    editApps.groupBy(_.editId)
    // Skip this List --> head conversion. There might be > 1 app per edit,
    // since apps can be deleted -- then the edit can be applied again later.
    //m.mapValues(list => {
    //  errorIf(list.tail.nonEmpty, "Two ore more EditApps with "+
    //          "same edit id: "+ list.head.editId)
    //  list.head
    //})
  }

  private lazy val editAppsByPostId: imm.Map[PostId, List[EditApp]] =
    editApps.groupBy(ea => getPatch_!(ea.editId).postId)

  /** Edits applied to the specified post, sorted by most-recent first.
   */
  def editAppsTo(postId: PostId): List[EditApp] =
    // The list is probably already sorted, since new EditApp:s are
    // prefixed to the editApps list.
    editAppsByPostId.getOrElse(postId, Nil).sortBy(- _.ctime.getTime)

  def editApp(withId: ActionId): Option[EditApp] =
    editApps.filter(_.id == withId).headOption


  // -------- Flags

  private lazy val flagsById: imm.Map[ActionId, Flag] =
    imm.Map[ActionId, Flag](flags.map(x => (x.id, x)): _*)


  // -------- Reviews (manual approvals and rejections, no auto approvals)

  def getReview(reviewId: ActionId): Option[Review] = getActionById(reviewId) match {
    case p @ Some(_: Review) => p.asInstanceOf[Option[Review]]
    case None => None
    case x => runErr("DwE0GK43", s"Action `$reviewId' is no Review but a: ${classNameOf(x)}")
  }


  // -------- Construction

  def +(actionDto: PostActionDtoOld) = ++(actionDto::Nil)

  // Could try not to add stuff that's already included in this.people.
  def ++(people: People): PageParts = this.copy(people = this.people ++ people)
  def +(user: User) = this ++ People(users = user::Nil)
  def +(login: Login) = this ++ People(logins = login::Nil)
  def +(identity: Identity) = this ++ People(identities = identity::Nil)

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
    var ratings2 = ratings
    var editApps2 = editApps
    var flags2 = flags
    var actions2 = this.actionDtos
    type SthWithId = { def id: ActionId }
    def dieIfIdClash(olds: Seq[SthWithId], a: SthWithId) =
      olds.find(_.id == a.id) match {
        case None => // fine, `a` is not present in `olds`
        case Some(old) =>
          assErr("DwE4BFY8", s"Cannot add new action $a; there is an old with same id: $old")
      }

    for (a <- actions) a match {
      case r: Rating =>
        dieIfIdClash(ratings2, r)
        ratings2 ::= r
      case a: EditApp =>
        dieIfIdClash(editApps2, a)
        editApps2 ::= a
      case f: Flag =>
        dieIfIdClash(flags2, f)
        flags2 ::= f
      case a: PostActionDto[_] =>
        dieIfIdClash(actions2, a)
        actions2 ::= a
      case x => runErr(
        "DwE8k3EC", "Unknown action type: "+ classNameOf(x))
    }
    PageParts(id, people, ratings2,
        editApps2, flags2, postStates, actions2)
  }


  // -------- Time


  /** This page, as it was at some time in the past (everything more recent is dropped).
    */
  def asOf(dati: ju.Date): PageParts = {
    def happenedInTime(action: PostActionDtoOld) =
      action.ctime.getTime <= dati.getTime

    val (ratingsBefore, ratingsAfter) = ratings partition happenedInTime
    val (editAppsBefore, editAppsAfter) = editApps partition happenedInTime
    val (flagsBefore, flagsAfter) = flags partition happenedInTime
    val (actionsBefore, actionsAfter) = actionDtos partition happenedInTime

    val pageUpToAndInclDati = copy(
      ratings = ratingsBefore,
      editApps = editAppsBefore,
      flags = flagsBefore,
      actionDtos = actionsBefore)

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
  lazy val lastAction: Option[PostActionDtoOld] = oldestOrLatestAction(latest = true)


  /**
   * The action with the oldest creation dati.
   */
  private def oldestAction: Option[PostActionDtoOld] = oldestOrLatestAction(latest = false)


  private def oldestOrLatestAction(latest: Boolean): Option[PostActionDtoOld] = {
    def latestOrOldestAction(a: PostActionDtoOld, b: PostActionDtoOld) = {
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



/**
 * Which post to use as the root post, e.g. when viewing a page, or when
 * sending updates of a page back to the browser (only posts below the
 * root post would be sent).
 */
sealed abstract class AnyPageRoot {
  // COULD rename to `id`? Why did I call it `subId`?
  def subId: PostId
  // Why did I name it "...OrCreate..."?
  def findOrCreatePostIn(page: PageParts): Option[Post]
  def findChildrenIn(page: PageParts): List[Post]
  def isDefault: Boolean = subId == PageParts.BodyId
  def isPageConfigPost: Boolean = subId == PageParts.ConfigPostId
}


// No longer needed? Was used in the past when post ids were strigns. Ok remove.
object AnyPageRoot {

  val TheBody = Real(PageParts.BodyId)

  /** A real post, e.g. the page body post. */
  case class Real(subId: PostId) extends AnyPageRoot {
    def findOrCreatePostIn(page: PageParts): Option[Post] = page.getPost(subId)
    def findChildrenIn(page: PageParts): List[Post] = page.repliesTo(subId)
  }

  // In the future, something like this:
  // case class FlaggedPosts -- creates a virtual root post, with all
  // posts-with-flags as its children.
  // And lots of other virtual roots that provide whatever info on
  // the page?

  // No longer needed; was used in the past when post ids were strigns. Ok remove.
  def apply(id: PostId) = Real(id)

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
