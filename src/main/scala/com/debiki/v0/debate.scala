// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import _root_.net.liftweb.common.{Box, Full, Empty, EmptyBox, Failure}
import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import Debate._
import FlagReason.FlagReason


object Debate {

  val RootPostId = "1"

  def empty(id: String) = Debate(id)

  def fromActions(guid: String,
                  logins: List[Login],
                  identities: List[Identity],
                  users: List[User],
                  actions: List[AnyRef]): Debate = {
    Debate(guid, logins, identities, users) ++ actions
  }

  /** Assigns ids to actions and updates references from Edits to Posts.
   *  Does not remap the id of post "1", i.e. the root post.
   *  COULD remap only IDs starting with "?" or being empty ""?
   */
  def assignIdsTo(xs: List[AnyRef]): List[AnyRef] = {
    val remaps = mut.Map[String, String]()
    def remap(id: String) {
      require(!remaps.contains(id))
      remaps(id) = nextRandomString()
    }
    // Generate new ids, and check for foreign objects.
    xs foreach (_ match {
      case p: Post => remaps(p.id) = if (p.id == RootPostId) p.id
                                     else nextRandomString()
      case a: Action => remap(a.id)
      case x => assErr(  // Can this check be done at compile time instead?
        // Yes if I let EditApp extend Action.
        "Cannot remap ids for `"+ classNameOf(x) +"' [debiki_error_p8kKck3T]")
    })
    // Remap ids, and update references to ids.
    // (Can this be done in a generic manner: once `case' for most Action:s?)
    def rmpd(id: String) = remaps.getOrElse(id, id)
    val xs2: List[AnyRef] = xs map (_ match {
      case p: Post => p.copy(id = remaps(p.id), parent = rmpd(p.parent))
      case r: Rating => r.copy(id = remaps(r.id), postId = rmpd(r.postId))
      case f: Flag => f.copy(id = remaps(f.id), postId = rmpd(f.postId))
      case e: Edit => e.copy(id = remaps(e.id), postId = rmpd(e.postId))
      case a: EditApp => a.copy(id = remaps(a.id), editId = rmpd(a.editId))
      case d: Delete => d.copy(id = remaps(d.id), postId = rmpd(d.postId))
      case x => assErr("[debiki_error_3RSEKRS]")
    })
    xs2
  }
}


/*
class AddVoteResults private[debiki] (
  val debate: Debate,
  val newEditsApplied: List[EditApplied]
) */

// Could rename to Page.
case class Debate (
  guid: String,
  logins: List[Login] = Nil,
  identities: List[Identity] = Nil,
  users: List[User] = Nil,
  private[debiki] val posts: List[Post] = Nil,
  private[debiki] val ratings: List[Rating] = Nil,
  private[debiki] val edits: List[Edit] = Nil,
  private[debiki] val editVotes: List[EditVote] = Nil,
  private[debiki] val editApps: List[EditApp] = Nil,
  private[debiki] val flags: List[Flag] = Nil,
  private[debiki] val deletions: List[Delete] = Nil
) extends People {
  private lazy val postsById =
      imm.Map[String, Post](posts.map(x => (x.id, x)): _*)

  private lazy val postsByParentId: imm.Map[String, List[Post]] = {
    // Add post -> replies mappings to a mutable multimap.
    var mmap = mut.Map[String, mut.Set[Post]]()
    for (p <- posts)
      mmap.getOrElse(
        p.parent, { val s = mut.Set[Post](); mmap.put(p.parent, s); s }) += p
    // Copy to an immutable version.
    imm.Map[String, List[Post]](
        (for ((parentId, children) <- mmap)
          yield (parentId, children.toList)).toList: _*)
  }

  private class RatingCacheItem {
    var ratings: List[Rating] = Nil
    var valueSums: imm.Map[String, Int] = null
  }

  private lazy val ratingCache: mut.Map[String, RatingCacheItem] = {
    val cache = mut.Map[String, RatingCacheItem]()
    // Gather ratings
    for (r <- ratings) {
      var ci = cache.get(r.postId)
      if (ci.isEmpty) {
        cache(r.postId) = new RatingCacheItem
        ci = cache.get(r.postId)
      }
      ci.get.ratings = r :: ci.get.ratings
    }
    // Sum rating tags
    for ((postId, cacheItem) <- cache) cacheItem.valueSums = {
      val mutmap = mut.Map[String, Int]()
      for (r <- cacheItem.ratings; value <- r.tags) {
        val sum = mutmap.getOrElse(value, 0)
        mutmap(value) = sum + 1
      }
      imm.Map[String, Int](mutmap.toSeq: _*)
    }
    cache
  }

  /** The guid prefixed with a dash.
   *
   * A debate page can be identified either by "-guid"
   * or "/path/to/page/".
   */
  def guidd = "-"+ guid

  // -------- Posts

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def vipo_!(postId: String): ViPo =
    vipo(postId).getOrElse(error("[debiki_error_3krtEK]"))

  def vipo(postId: String): Option[ViPo] =
    post(postId).map(new ViPo(this, _))

  // -------- Ratings

  // Currently using only by the DAO TCK, need not be fast.
  def rating(id: String): Option[Rating] = ratings.find(_.id == id)

  def ratingsOn(postId: String): List[Rating] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.ratings else Nil
  }

  def ratingSumsFor(postId: String): imm.Map[String, Int] = {
    val ci = ratingCache.get(postId)
    if (ci.isDefined) ci.get.valueSums else imm.Map.empty
  }

  // -------- Replies

  def repliesTo(id: String): List[Post] =
    postsByParentId.getOrElse(id, Nil).filterNot(_.id == id)

  def successorsTo(postId: String): List[Post] = {
    val res = repliesTo(postId)
    res.flatMap(r => successorsTo(r.id)) ::: res
  }

  // -------- Edits

  def vied_!(editId: String): ViEd =
    vied(editId).getOrElse(error("[debiki_error_08k32w2]"))

  def vied(editId: String): Option[ViEd] =
    editsById.get(editId).map(new ViEd(this, _))

  lazy val editsById: imm.Map[String, Edit] = {
    val m = edits.groupBy(_.id)
    m.mapValues(list => {
      errorIf(list.tail.nonEmpty,
              "Two ore more Edit:s with this id: "+ list.head.id)
      list.head
    })
  }

  def editAppsByEdit(id: String) = _editAppsByEditId.getOrElse(id, Nil)

  private lazy val _editAppsByEditId: imm.Map[String, List[EditApp]] = {
    editApps.groupBy(_.editId)
    // Skip this List --> head conversion. There might be > 1 app per edit,
    // since apps can be deleted -- then the edit can be applied again later.
    //m.mapValues(list => {
    //  errorIf(list.tail.nonEmpty, "Two ore more EditApps with "+
    //          "same edit id: "+ list.head.editId)
    //  list.head
    //})
  }

  private lazy val editsByPostId: imm.Map[String, List[Edit]] =
    edits.groupBy(_.postId)

  private lazy val editAppsByPostId: imm.Map[String, List[EditApp]] =
    editApps.groupBy(ea => editsById(ea.editId).postId)

  def editsFor(postId: String): List[Edit] =
    editsByPostId.getOrElse(postId, Nil)

  /** Edits applied to the specified post, sorted by most-recent first.
   */
  def editAppsTo(postId: String): List[EditApp] =
    // The list is probably already sorted, since new EditApp:s are
    // prefixed to the editApps list.
    editAppsByPostId.getOrElse(postId, Nil).sortBy(- _.date.getTime)


  // -------- Deletions

  /** If actionId was explicitly deleted (not indirectly, via
   *  wholeTree/recursively = true).
   */
  def deletionFor(actionId: String): Option[Delete] =
    deletions.find(_.postId == actionId).headOption
    // COULD check if the deletion itself was deleted!?
    // That is, if the deletion was *undone*. Delete, undo, redo... a redo
    // would be a deleted deletion of a deletion?


  // -------- Construction

  def + (post: Post): Debate = copy(posts = post :: posts)

  def + (rating: Rating): Debate = copy(ratings = rating :: ratings)

  def ++[T >: AnyRef] (actions: List[T]): Debate = {
    var logins2 = logins
    var identities2 = identities
    var users2 = users
    var posts2 = posts
    var ratings2 = ratings
    var edits2 = edits
    var editVotes2 = editVotes
    var editApps2 = editApps
    var flags2 = flags
    var dels2 = deletions
    for (a <- actions) a match {
      case l: Login => logins2 ::= l
      case i: Identity => identities2 ::= i
      case u: User => users2 ::= u
      case p: Post => posts2 ::= p
      case r: Rating => ratings2 ::= r
      case e: Edit => edits2 ::= e
      case v: EditVote => editVotes2 ::= v
      case a: EditApp => editApps2 ::= a
      case f: Flag => flags2 ::= f
      case d: Delete => dels2 ::= d
      case x => error(
          "Unknown action type: "+ classNameOf(x) +" [debiki_error_8k3EC]")
    }
    Debate(guid, logins2, identities2, users2, posts2, ratings2,
        edits2, editVotes2, editApps2, flags2, dels2)
  }

  /* COULD remove
  def addEdit(edit: Edit): AddVoteResults = {
    // Apply edit directly, if editing own post with no replies.
    val post = postsById(edit.postId)  // throw unless found
    val replies = repliesTo(edit.postId)
    val editsOwnPost = hasSameAuthor(edit, post)
    var newEditsApplied = List[EditApplied]()
    if (replies.isEmpty && editsOwnPost)
      newEditsApplied ::= EditApplied(editId = edit.id, date = edit.date,
          loginId = edit.loginId,
          result = edit.text, // in the future perahps apply a diff?
          debug = "Applying own edit directly, since no replies")
    val d2 = copy(edits = edit :: edits,
                  editsApplied = newEditsApplied ::: editsApplied)
    new AddVoteResults(d2, newEditsApplied)
  } */

  /* COULD remove
  def addVote(vote: EditVote, applyEdits: Boolean): AddVoteResults = {
    var editsToApply = List[EditApplied]()
    //var editsToRevert = List[EditReverted]()  ??

    def findEditsToApply(editId: String, likes: Boolean) {
      val edit = editsById(editId)  // throw unless found
      val post = postsById(edit.postId)  // throw unless found
      val ea = editsAppliedById.get(editId)
      val lastEditApplied = editsAppliedTo(edit.postId).headOption
      val isApplied = ea.isDefined
      val isLastApplied = isApplied && ea == lastEditApplied.headOption
      if (isApplied && !isLastApplied) {
        // This vote doesn't matter; can revert only the last edit applied.
        return
      }
      var shouldApply = false;
      var shouldRevert = false;
      var liking: Option[EditLiking] = None

      // Apply or revert edit?
      val replies = repliesTo(edit.postId)
      val votesOnOwnPost = hasSameAuthor(edit, post)
      if (replies.isEmpty && votesOnOwnPost) {
        UNTESTED // Can't test this before edits can be reverted, since
                // own edit applied instantly, if the post has no replies.
        // No reply can lose its context; okay to apply/revert.
        if (likes && !isApplied) shouldApply = true;
        if (!likes && isApplied) shouldRevert = true;
      }
      else {
        liking = Some(stats.likingFor(edit))  // rather expensive calcs?
        if (!isApplied) {
          if (likes && liking.get.lowerBound > 0.5) {  // 0.5 for now
            // Most people seem to like this edit.
            shouldApply = true;
          }
        }
        else if (!likes && liking.get.upperBound < 0.5) {  // 0.5 for now
          // Most people don't like this edit. And it's the last one applied.
          shouldRevert = true;
        }
      }

      if (shouldApply) {
        val a = EditApplied(editId = editId, date = vote.date,
            loginId = edit.loginId,
            result = edit.text, // in the future perahps apply a diff?
            debug = liking.map(_.toString).getOrElse(
                      "Own edit, own vote, no replies"))
        editsToApply ::= a
      }
      if (shouldRevert) {
        // TODO: val r = EditReverted(...)
        // d2 = d2.copy(...)
      }
    }

    // TODO: Something better than applying all popular edits in random order?
    for (editId <- vote.like) findEditsToApply(editId, likes = true)
    for (editId <- vote.diss) findEditsToApply(editId, likes = false)
    val d2 = copy(
      editVotes = vote :: editVotes,
      editsApplied = if (applyEdits) editsToApply ::: editsApplied
                      else editsApplied
    )
    new AddVoteResults(d2, editsToApply)
  } */

  // -------- Statistics

  lazy val stats = new PageStats(this)


  // -------- Misc

  /** When the most recent post was made,
   *  or the mos recent edit was applied or reverted.
   */
  lazy val lastChangeDate: Option[ju.Date] = {
    def maxDate(a: ju.Date, b: ju.Date) = if (a.compareTo(b) > 0) a else b
    val allDates: Iterator[ju.Date] = editApps.iterator.map(_.date) ++
                                        posts.iterator.map(_.date)
    if (allDates isEmpty) None
    else Some(allDates reduceLeft (maxDate(_, _)))
  }

}

/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class ViAc(val debate: Debate, val action: Action) {
  def id: String = action.id
  def login: Option[Login] = debate.login(action.loginId)
  def login_! : Login = login.get
  def identity: Option[Identity] = login.flatMap(l =>
                                    debate.identity(l.identityId))
  def identity_! : Identity = debate.identity_!(login.get.identityId)
  def user : Option[User] = identity.flatMap(i => debate.user(i.userId))
  def user_! : User = debate.user_!(identity_!.userId)
  def ip: Option[String] = action.newIp.orElse(login.map(_.ip))
  def ip_! : String = action.newIp.getOrElse(login_!.ip)
  def ipSaltHash: Option[String] = ip.map(saltAndHashIp(_))
  def ipSaltHash_! : String = saltAndHashIp(ip_!)

  def isTreeDeleted = {
    // In case there are > 1 deletions, consider the first one only.
    // (Once an action has been deleted, it isn't really possible to
    // delete it again in some other manner? However non transactional
    // (nosql) databases might return many deletions? and we should
    // care only about the first.)
    firstDelete.map(_.wholeTree) == Some(true)
  }

  def isDeleted = deletions nonEmpty

  // COULD optimize this, do once for all posts, store in map.
  lazy val deletions = debate.deletions.filter(_.postId == action.id)

  /** Deletions, the most recent first. */
  lazy val deletionsSorted = deletions.sortBy(- _.date.getTime)

  lazy val lastDelete = deletionsSorted.headOption
  lazy val firstDelete = deletionsSorted.lastOption
}

/** A Virtual Post into account all edits applied to the actual post.
 */
class ViPo(debate: Debate, val post: Post) extends ViAc(debate, post) {
  def parent: String = post.parent
  // def date = lastEditApp.map(ea => toIso8601(ea.date))
  lazy val text: String = textAsOf(Long.MaxValue)

  /** Applies all edits up to, but not including, the specified date.
   *  Returns the resulting text.
   *  Keep in sync with textAsOf in debiki.js.
   */
  def textAsOf(millis: Long): String = {
    var origText = post.text
    var curText = origText
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    for ((edit, eapp) <- editsAppdAsc; if eapp.date.getTime < millis) {
      val patchText = edit.text
      // COULD check [1, 2, 3, …] to find out if the patch applied
      // cleanaly. (The result is in [0].)
      type P = name.fraser.neil.plaintext.diff_match_patch.Patch
      val patches: ju.List[P] = dmp.patch_fromText(patchText) // silly API, ...
      val p2 = patches.asInstanceOf[ju.LinkedList[P]] // returns List but needs...
      val result = dmp.patch_apply(p2, curText) // ...a LinkedList
      val newText = result(0).asInstanceOf[String]
      curText = newText
    }
    curText
  }

  def textInitially: String = post.text
  def where: Option[String] = post.where
  def edits: List[Edit] = debate.editsFor(post.id)
  lazy val (editsDeleted, editsPending, editsAppdDesc, editsAppdRevd) = {
    var deleted = List[(Edit, Delete)]()
    var pending = List[Edit]()
    var applied = List[(Edit, EditApp)]()
    var appdRevd = List[(Edit, EditApp, Delete)]()
    edits foreach { e =>
      val del = debate.deletionFor(e.id)
      if (del isDefined) {
        deleted ::= e -> del.get
      } else {
        var eappsLive = List[(Edit, EditApp)]()
        var eappsDeleted = List[(Edit, EditApp, Delete)]()
        val eapps = debate.editAppsByEdit(e.id)
        eapps foreach { ea =>
          val del = debate.deletionFor(ea.id)
          if (del isEmpty) eappsLive ::= e -> ea
          else eappsDeleted ::= ((e, ea, del.get))
        }
        if (eappsLive isEmpty) pending ::= e
        else applied ::= eappsLive.head
        if (eappsDeleted nonEmpty) {
          appdRevd :::= eappsDeleted
        }
      }
    }

    // Sort by 1) deletion, 2) application, 3) edit creation, most recent
    // first.
    (deleted.sortBy(- _._2.date.getTime),
      pending.sortBy(- _.date.getTime),
      applied.sortBy(- _._2.date.getTime),
      appdRevd.sortBy(- _._3.date.getTime))
  }

  def editsAppdAsc = editsAppdDesc.reverse

  lazy val lastEditApp = editsAppdDesc.headOption.map(_._2)

  // COULD optimize this, do once for all flags.
  lazy val flags = debate.flags.filter(_.postId == post.id)

  lazy val lastFlag = flags.sortBy(- _.date.getTime).headOption

  lazy val flagsByReason: imm.Map[FlagReason, List[Flag]] = {
    // Add reasons and flags to a mutable map.
    var mmap = mut.Map[FlagReason, mut.Set[Flag]]()
    for (f <- flags)
      mmap.getOrElse(f.reason, {
        val s = mut.Set[Flag]()
        mmap.put(f.reason, s)
        s
      }) += f
    // Copy to an immutable version.
    imm.Map[FlagReason, List[Flag]](
      (for ((reason, flags) <- mmap)
      yield (reason, flags.toList)).toList: _*)
  }

  /** Pairs of (FlagReason, flags-for-that-reason), sorted by
   *  number of flags, descending.
   */
  lazy val flagsByReasonSorted: List[(FlagReason, List[Flag])] = {
    flagsByReason.toList.sortWith((a, b) => a._2.length > b._2.length)
  }
}

class ViEd(debate: Debate, val edit: Edit) extends ViAc(debate, edit) {

}

sealed abstract class Action {
  /** A local id, unique only in the Debate that this action modifies.
    * "?" means unknown.
    */
  def id: String
  require(id != "0")
  require(id nonEmpty)

  /** An id that identifies the login session, which in turn identifies
   *  the user and IP and session creation time.
   */
  def loginId: String

  /** Always None, unless the post was sent from somewhere else than
   *  the relevant Login.ip.
   */
  def newIp: Option[String]
  def date: ju.Date
}

case class Rating (
  id: String,
  postId: String,
  loginId: String,
  newIp: Option[String],
  date: ju.Date,
  tags: List[String]
) extends Action

object FlagReason extends Enumeration {
  type FlagReason = Value
  val Spam, Illegal, /* Copyright Violation */ CopyVio, Other = Value
}

case class Flag(
  id: String,
  postId: String,
  loginId: String,
  newIp: Option[String],
  date: ju.Date,
  reason: FlagReason,
  details: String
) extends Action

case class Post(
  id: String,
  parent: String,
  date: ju.Date,
  loginId: String,
  newIp: Option[String],
  text: String,

  /** The markup language to use when rendering this post.
   *
   *  `code' - render code
   *  `code-javascript/whatever' - javascript/whatever highlighting
   *  `plain' - split in <p>s, linkify urls.
   *  `dfmd-0' - Debiki flavored markdown version 0
   */
  markup: String,

  /** If defined, this is an inline comment and the value
   *  specifies where in the parent post it is to be placed.
   */
  where: Option[String] = None
) extends Action {
}

// Could rename to Patch? or Diff?
case class Edit (
  id: String,
  postId: String,
  date: ju.Date,
  loginId: String,
  newIp: Option[String],
  text: String,
  /** The author's description and motivation for this edit */
  desc: String
) extends Action

// Verify: No duplicate like/diss ids, no edit both liked and dissed
// COULD remove! Instead, introduce Action.Status = Suggestion/Published,
// and instead of EditVote, use EditApp.status = Suggestion.
// (Then you cannot vote on > 1 edit at once, but perhaps that's a good thing?)
// When there are X EditApp suggestions, automatically create one
// with status = Published?
// "status=Suggestion/Published"? or "weight=Suggestion/Publication"?
// or "effect=Immediate/SuggestionOnly"?
case class EditVote(  // should extend Action
  id: String,
  loginId: String,
  ip: String,  // should change to newIp Option[String]
  date: ju.Date,
  /** Ids of edits liked */
  like: List[String],
  /** Ids of edits disliked */
  diss: List[String]
)

/** Edit applications (i.e. when edits are applied).
 *
 *  COULD make generic: applying a Post means it's published.
 *  Applying an Edit means the relevant Post is edited.
 *  Applying a Flag means the relevant Post is hidden.
 *  Applying a Delete means whatever is whatever-happens-when-it's-deleted.
 *  And each Action could have a applied=true/false field?
 *  so they can be applied directly on creation?
 */
case class EditApp(   // COULD rename to Appl?
  id: String,
  editId: String,  // COULD rename to actionId?
  loginId: String,
  newIp: Option[String],
  date: ju.Date,

  /** The text after the edit was applied. Needed, in case an `Edit'
   *  contains a diff, not the resulting text itself. Then we'd better not
   *  find the resulting text by applying the diff to the previous
   *  version, more than once -- that wouldn't be future compatible: the diff
   *  algorithm might functioni differently depending on software version
   *  (e.g. because of bugs).
   *  So, only apply the diff algorithm once, to find the EddidApplied.result,
   *  and thereafter always use EditApplied.result.
   */
  result: String,

  debug: String = ""
) extends Action

/** Deletes an action. When actionId (well, postId right now)
 *  is a post, it won't be rendered. If `wholeTree', no reply is shown either.
 *  If actionId is an EditApp, that edit is undone.
 *  --- Not implemented: --------
 *  If `wholeTree', all edit applications from actionId and up to
 *  delete.date are undone.
 *  If actionId is an Edit, the edit will no longer appear in the list of
 *  edits you can choose to apply.
 *  If `wholeTree', no Edit from actionId up to delete.date will appear
 *  in the list of edits that can be applied.
 *  -----------------------------
 */
case class Delete(
  id: String,
  postId: String,  // COULD rename to actionId
  loginId: String,
  newIp: Option[String],
  date: ju.Date,
  wholeTree: Boolean,  // COULD rename to `recursively'?
  reason: String  // COULD replace with a Post that is a reply to this Delete?
) extends Action


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

