// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._


object Debate {

  val RootPostId = "0"  // COULD change to 1

  def empty(id: String) = Debate(id)

  def fromActions(guid: String,
                  logins: List[Login],
                  loginIdtys: List[LoginCreds],
                  users: List[User],
                  actions: List[AnyRef]): Debate = {
    Debate(guid, logins, loginIdtys, users) ++ actions
  }
}

class AddVoteResults private[debiki] (
  val debate: Debate,
  val newEditsApplied: List[EditApplied]
)

case class Debate (
  guid: String,
  logins: List[Login] = Nil,
  loginCreds: List[LoginCreds] = Nil,
  users: List[User] = Nil,
  private[debiki] val posts: List[Post] = Nil,
  private[debiki] val ratings: List[Rating] = Nil,
  private[debiki] val edits: List[Edit] = Nil,
  private[debiki] val editVotes: List[EditVote] = Nil,
  private[debiki] val editsApplied: List[EditApplied] = Nil
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

  private lazy val editsAppliedById: imm.Map[String, EditApplied] = {
    val m = editsApplied.groupBy(_.editId)
    m.mapValues(list => {
      errorIf(list.tail.nonEmpty, "Two ore more EditApplied:s with "+
              "same edit id: "+ list.head.editId)
      list.head
    })
  }

  private lazy val editsPendingByPostId: imm.Map[String, List[Edit]] =
    edits.filterNot(editsAppliedById contains _.id).groupBy(_.postId)

  private lazy val editsAppliedByPostId
      : imm.Map[String, List[EditApplied]] =
    editsApplied.groupBy(ea => editsById(ea.editId).postId)

  def editsFor(postId: String): List[Edit] =
    edits.filter(_.postId == postId)

  def editsPendingFor(postId: String): List[Edit] =
    editsPendingByPostId.getOrElse(postId, Nil)

  /** Edits applied to the specified post, sorted by most-recent first.
   */
  def editsAppliedTo(postId: String): List[EditApplied] =
    // The list is probably already sorted, since new EditApplied:s are
    // prefixed to the editsApplied list.
    editsAppliedByPostId.getOrElse(postId, Nil).sortBy(- _.date.getTime)


  // -------- Construction

  def + (post: Post): Debate = copy(posts = post :: posts)
  //def - (post: Post): Debate = copy(posts = posts filter (_ != post))

  def + (rating: Rating): Debate = copy(ratings = rating :: ratings)
  //def - (rating: Rating): Debate = copy(ratings = ratings filter
  //                                                            (_ != rating))

  def ++[T >: AnyRef] (actions: List[T]): Debate = {
    var logins2 = logins
    var loginCreds2 = loginCreds
    var users2 = users
    var posts2 = posts
    var ratings2 = ratings
    var edits2 = edits
    var editVotes2 = editVotes
    var editsApplied2 = editsApplied
    for (a <- actions) a match {
      case l: Login => logins2 ::= l
      case i: LoginCreds => loginCreds2 ::= i
      case u: User => users2 ::= u
      case p: Post => posts2 ::= p
      case r: Rating => ratings2 ::= r
      case e: Edit => edits2 ::= e
      case v: EditVote => editVotes2 ::= v
      case a: EditApplied => editsApplied2 ::= a
      case x => error(
          "Unknown action type: "+ classNameOf(x) +" [debiki_error_8k3EC]")
    }
    Debate(guid, logins2, loginCreds2, users2, posts2, ratings2,
        edits2, editVotes2, editsApplied2)
  }

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
  }

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
  }

  // -------- Statistics

  lazy val stats = new StatsCalc(this)


  // -------- Misc

  def compareAuthors(edit: Edit, post: Post): Login.Comparison = {
    unimplemented
    /*(login(edit.loginId), login(post.loginId)) match {
      case (Some(el: Login), Some(pl: Login)) =>
        (user(el.userId), user(pl.userId)) match {
          case (Some(eu: User), Some(pu: User)) =>
            User.compare(eu, el, pu, pl)
          case _ => User.NotSame
        }
      case _ => User.NotSame
    } */
  }

  def hasSameAuthor(edit: Edit, post: Post): Boolean =
    compareAuthors(edit, post) == Login.IsSame

  /** Assigns ids to Post:s and Edit:s, and updates references from Edit:s
   *  to Post ids. COULD move to Debiki$, since ids are randomized, stateless.
   *  Does not remap the id of post "0", i.e. the root post.
   *  COULD remap only IDs starting with "?" or being empty ""?
   */
  def assignIdTo(xs: List[AnyRef]): List[AnyRef] = {
    val remaps = mut.Map[String, String]()
    def remap(id: String) {
      require(!remaps.contains(id))
      remaps(id) = nextRandomString()
    }
    // Generate new ids, and check for foreign objects.
    xs foreach (_ match {
      case p: Post => remaps(p.id) = if (p.id == "0") p.id
                                     else nextRandomString()
      case r: Rating => remap(r.id)
      case e: Edit => remaps(e.id) = nextRandomString()
      case a: EditApplied => // noop
      case x => assErr(  // Can this check be done at compile time instead?
        "Cannot remap ids for `"+ classNameOf(x) +"' [debiki_error_p8kKck3T]")
    })
    // Remap ids, and update references to ids.
    val xs2: List[AnyRef] = xs map (_ match {
      case p: Post => p.copy(id = remaps(p.id))
      case r: Rating => r.copy(id = remaps(r.id))
      case e: Edit => e.copy(id = remaps(e.id),
                            postId = remaps.getOrElse(e.postId, e.postId))
      case a: EditApplied => a.copy(editId = remaps(a.editId))
      case x => assErr("[debiki_error_3RSEKRS]")
    })
    xs2
  }

  private lazy val nextFreePostId: String = {
    var nextFree = 0
    for {
      post <- posts
      num: Int = Base26.toInt(post.id)
      if num + 1 > nextFree
    }{
      nextFree = num + 1
    }
    Base26.fromInt(nextFree)
  }

  private def nextFreeEditId(editeeId: String): String = {
    UNTESTED
    // Edit id format: <baseId> 'E' <subid>
    // Don't change the <baseId>. By not changing it, we can easily
    // identify what thing is being edited (the item with id = base-id).
    // By including 'E' between the base-id and the sub-id, we know,
    // only from looking at the ID, that the id identifies an Edit.
    val edits: List[Edit] = editsFor(editeeId)
    var nextFree = 0
    for {
      edit <- edits
      lastUpperIx: Int = edit.id.lastIndexWhere(_.isUpper)
      val (baseid, subid) = if (lastUpperIx == -1) ("", edit.id)
                            else edit.id splitAt lastUpperIx
      num: Int = Base26.toInt(subid drop 1) // drop 'E'
      if num + 1 > nextFree
    }{
      require(lastUpperIx == -1 || edit.id(lastUpperIx) == 'E',
              "Invalid Edit id, last upper is not `E': "+ safe(edit.id))
      require(editeeId == baseid, "Found bad id, when checking free ids: "+
              "Edit id ["+ safe(edit.id) + "] not prefixed by editee id ["+
              safe(editeeId) +"]")
      //else if (allBaseId != baseId) error("Different base id's: ["+
      //                        safe(allBaseId) +"] and ["+ safe(baseId) +"]")
      nextFree = num + 1
    }
    //if (allBaseId == null) allBaseId = ""
    editeeId +"E"+ Base26.fromInt(nextFree)
  }

  /** When the most recent post was made,
   *  or the mos recent edit was applied or reverted.
   */
  lazy val lastChangeDate: Option[ju.Date] = {
    def maxDate(a: ju.Date, b: ju.Date) = if (a.compareTo(b) > 0) a else b
    val allDates: Iterator[ju.Date] = editsApplied.iterator.map(_.date) ++
                                        posts.iterator.map(_.date)
    if (allDates isEmpty) None
    else Some(allDates reduceLeft (maxDate(_, _)))
  }

  /* With structural typing (I think this is very verbose code):
  def max(d1: ju.Date, d2: ju.Date) =
      if (d1.compareTo(d2) > 0) d1 else d2
  private def maxDate(list: List[{ def date: ju.Date }]): Option[ju.Date] = {
    if (list isEmpty) None
    else {
      val maxDate = (list.head.date /: list.tail)((d, o) => max(d, o.date))
            // ((d: ju.Date, o: WithDate) => max(d, o.date))
            // Results in: missing arguments for method foldLeft in
            // trait LinearSeqOptimized;
            // follow this method with `_' if you want to treat it
            // as a partially applied function
      // Date is mutable so return a copy
      Some(maxDate.clone.asInstanceOf[ju.Date])
    }
  }
  lazy val lastChangeDate = {
    val dateOpts = List(maxDate(ratings), maxDate(posts)).filter (!_.isEmpty)
    if (dateOpts isEmpty) None
    else dateOpts.tail.foldLeft(dateOpts.head.get)((d, o) => max(d, o.get))
  }
 */

}

/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class ViAc(val debate: Debate, val action: Action) {
  def id: String = action.id
  def login: Option[Login] = debate.login(action.loginId)
  def login_! : Login = login.get
  def user: Option[User] = login.flatMap(l => debate.user(l.loginCredsId))
  def user_! : User = debate.user_!(login_!.loginCredsId)
  def ip: Option[String] = action.newIp.orElse(login.map(_.ip))
  def ip_! : String = action.newIp.getOrElse(login_!.ip)
  def ipSaltHash: Option[String] = ip.map(saltAndHashIp(_))
  def ipSaltHash_! : String = saltAndHashIp(ip_!)
}

/** A Virtual Post into account all edits applied to the actual post.
 */
class ViPo(debate: Debate, val post: Post) extends ViAc(debate, post) {
  def parent: String = post.parent
  // def date = lastEditApl.map(ea => toIso8601(ea.date))
  def text: String = lastEditApl.map(_.result).getOrElse(post.text)
  def textInitially: String = post.text
  def where: Option[String] = post.where
  val lastEditApl = debate.editsAppliedTo(post.id).headOption
}

class ViEd(debate: Debate, val edit: Edit) extends ViAc(debate, edit) {

}

sealed abstract class Action {
  /** A local id, unique only in the Debate that this action modifies. */
  def id: String

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

// + EditApplication/Utilization/Introduction/Commit/PutOn?
// + EditRevocation/Reversal?
case class EditApplied (  // TODO extend Action
  editId: String,
  date: ju.Date,
  loginId: String,

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
)
