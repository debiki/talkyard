// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import Debate._
import FlagReason.FlagReason


// Preparing to rename Debate to Page:
object Page {
  val BodyId = "1"
  val TitleId = "2"
  val TemplateId = "3"
  type Page = Debate   // import Page.Page and type ": Page", not ": Debate"
}


object Debate {

  val PageBodyId = "1"

  def empty(id: String) = Debate(id)

  def fromActions(guid: String,
                  logins: List[Login],
                  identities: List[Identity],
                  users: List[User],
                  actions: List[AnyRef]): Debate = {
    Debate(guid, logins, identities, users) ++ actions
  }

  /** Assigns ids to actions and updates references from e.g. Edits to Posts.
   *  Only remaps IDs that start with "?".
   */
  def assignIdsTo[T <: Action](actionsToRemap: List[T]): List[T] = {
    val remaps = mut.Map[String, String]()

    // Generate new ids.
    actionsToRemap foreach { a: T =>
      require(!remaps.contains(a.id)) // each action must be remapped only once
      remaps(a.id) =
          if (a.id.first == '?') nextRandomString()
          else a.id
    }

    // Remap ids, and update references to ids.
    // (Can this be done in a generic manner: once `case' for most Action:s?)
    // Yes, if I introduce Action.parentId and targetId and destId.)
    def rmpd(id: String) = remaps.getOrElse(id, id)
    def updateIds(action: T): T = (action match {
      case p: Post => p.copy(id = remaps(p.id), parent = rmpd(p.parent))
      case r: Rating => r.copy(id = remaps(r.id), postId = rmpd(r.postId))
      case f: Flag => f.copy(id = remaps(f.id), postId = rmpd(f.postId))
      case e: Edit => e.copy(id = remaps(e.id), postId = rmpd(e.postId))
      case a: EditApp => a.copy(id = remaps(a.id), editId = rmpd(a.editId))
      case d: Delete => d.copy(id = remaps(d.id), postId = rmpd(d.postId))
      case x => assErr("DwE3RSEK9]")
    }).asInstanceOf[T]
    val actionsRemapped: List[T] = actionsToRemap map updateIds

    actionsRemapped
  }

}


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

  lazy val (
      // COULD rename postsByParentId to textByParentId.
      postsByParentId: imm.Map[String, List[Post]],
      publsByParentId: imm.Map[String, List[Post]],
      metaByParentId: imm.Map[String, List[Post]]
        ) = {
    // Add post -> replies/meta mappings to mutable multimaps.
    var postMap = mut.Map[String, mut.Set[Post]]()
    var publMap = mut.Map[String, mut.Set[Post]]()
    var metaMap = mut.Map[String, mut.Set[Post]]()
    for (p <- posts) {
      val mmap = p.tyype match {
        case PostType.Text => postMap  // COULD rename to comment/text/artclMap
        case PostType.Publish => publMap
        case PostType.Meta => metaMap
      }
      mmap.getOrElse(
        p.parent, { val s = mut.Set[Post](); mmap.put(p.parent, s); s }) += p
    }
    // Copy to immutable versions.
    def buildImmMap(mutMap: mut.Map[String, mut.Set[Post]]
                       ): imm.Map[String, List[Post]] = {
      // COULD sort the list in ascenting ctime order?
      // Then list.head would be e.g. the oldest title -- other code
      // assume posts ase sorted in this way?
      // See ViPo.templatePost, titlePost and publd.
      imm.Map[String, List[Post]](
        (for ((parentId, postsSet) <- mutMap)
        yield (parentId, postsSet.toList // <-- sort this list by ctime asc?
              )).toList: _*).withDefaultValue(Nil)
    }
    val immPostMap = buildImmMap(postMap)
    val immPublMap = buildImmMap(publMap)
    val immMetaMap = buildImmMap(metaMap)
    (immPostMap, immPublMap, immMetaMap)
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

  def body: Option[ViPo] = vipo(PageBodyId)

  def body_! = vipo_!(PageBodyId)

  /** The page title if any. */
  def titlePost: Option[ViPo] = vipo(Page.TitleId)

  /** The page title, as plain text. */
  def titleText: Option[String] = titlePost.map(_.text)

  /** The page title, as XML. */
  //def titleXml: Option[xml.Node] = body.flatMap(_.titleXml)

  /** A Post with template engine source code, for the whole page. */
  def pageTemplatePost: Option[ViPo] = vipo(Page.TemplateId)

  /** If there is a page template for this page,
   * returns its template source. */
  def pageTemplateSrc: Option[TemplateSource] =
    pageTemplatePost.map(TemplateSrcHtml(_))


  // ====== Older stuff below (everything in use though!) ======

  // Instead of the stuff below, simply use
  //   postsById  /  publsById  /  etc.
  // and place utility functions in NiPo.


  // -------- Posts

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def vipo_!(postId: String): ViPo =  // COULD rename to post_!(withId = ...)
    vipo(postId).getOrElse(error("[error DwE3krtEK]"))

  def vipo(postId: String): Option[ViPo] = // COULD rename to post(withId =...)
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

  // -------- Meta

  def metaFor(id: String): List[Post] =
    metaByParentId.getOrElse(id, Nil).filterNot(_.id == id)

  def metaFor(action: ViAc): List[Post] = metaFor(action.id)


  // -------- Edits

  def vied_!(editId: String): ViEd =
    vied(editId).getOrElse(assErr("DwE03ke1"))

  def vied(editId: String): Option[ViEd] =
    editsById.get(editId).map(new ViEd(this, _))

  lazy val editsById: imm.Map[String, Edit] = {
    val m = edits.groupBy(_.id)
    m.mapValues(list => {
      runErrIf3(list.tail.nonEmpty,
        "DwE9ksE53", "Two ore more Edit:s with this id: "+ list.head.id)
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
    editAppsByPostId.getOrElse(postId, Nil).sortBy(- _.ctime.getTime)

  def editApp(withId: String): Option[EditApp] =
    editApps.filter(_.id == withId).headOption

  // -------- Deletions

  /** If actionId was explicitly deleted (not indirectly, via
   *  wholeTree/recursively = true).
   */
  def deletionFor(actionId: String): Option[Delete] =
    deletions.find(_.postId == actionId).headOption
    // COULD check if the deletion itself was deleted!?
    // That is, if the deletion was *undone*. Delete, undo, redo... a redo
    // would be a deleted deletion of a deletion?

  def deletion(withId: String): Option[Delete] =
    deletions.filter(_.id == withId).headOption

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
          "Unknown action type: "+ classNameOf(x) +" [error DwE8k3EC]")
    }
    Debate(guid, logins2, identities2, users2, posts2, ratings2,
        edits2, editVotes2, editApps2, flags2, dels2)
  }

  // -------- Statistics

  lazy val stats = new PageStats(this)


  // -------- Misc

  /** When the most recent post was made,
   *  or the mos recent edit was applied or reverted.
   */
  lazy val lastChangeDate: Option[ju.Date] = {
    def maxDate(a: ju.Date, b: ju.Date) = if (a.compareTo(b) > 0) a else b
    val allDates: Iterator[ju.Date] = editApps.iterator.map(_.ctime) ++
                                        posts.iterator.map(_.ctime)
    if (allDates isEmpty) None
    else Some(allDates reduceLeft (maxDate(_, _)))
  }

}

/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class ViAc(val debate: Debate, val action: Action) {
  def id: String = action.id
  def ctime = action.ctime
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

  def metaPosts = debate.metaFor(this)
  lazy val metaText: String = metaPosts.foldLeft("")(_ + _.text)

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
  lazy val deletionsSorted = deletions.sortBy(- _.ctime.getTime)

  lazy val lastDelete = deletionsSorted.headOption
  lazy val firstDelete = deletionsSorted.lastOption
}

/** A Virtual Post into account all edits applied to the actual post.
 */
class ViPo(debate: Debate, val post: Post) extends ViAc(debate, post) {
  def parent: String = post.parent
  def tyype = post.tyype
  // def ctime = lastEditApp.map(ea => toIso8601(ea.ctime))
  lazy val (text: String, markup: String) = textAndMarkupAsOf(Long.MaxValue)

  /** Applies all edits up to, but not including, the specified date.
   *  Returns the resulting text and markup.
   *  Keep in sync with textAsOf in debiki.js.
   *    COULD make textAsOf understand changes in markup type,
   *    or the preview won't always work correctly.
   */
  def textAndMarkupAsOf(millis: Long): (String, String) = {
    var curText = post.text
    var curMarkup = post.markup
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    for ((edit, eapp) <- editsAppdAsc; if eapp.ctime.getTime < millis) {
      curMarkup = edit.newMarkup.getOrElse(curMarkup)
      val patchText = edit.text
      if (patchText nonEmpty) {
        // COULD check [1, 2, 3, …] to find out if the patch applied
        // cleanaly. (The result is in [0].)
        type P = name.fraser.neil.plaintext.diff_match_patch.Patch
        val patches: ju.List[P] = dmp.patch_fromText(patchText) // silly API, ...
        val p2 = patches.asInstanceOf[ju.LinkedList[P]] // returns List but needs...
        val result = dmp.patch_apply(p2, curText) // ...a LinkedList
        val newText = result(0).asInstanceOf[String]
        curText = newText
      }
    }
    (curText, curMarkup)
  }

  def textInitially: String = post.text
  def where: Option[String] = post.where
  def edits: List[Edit] = debate.editsFor(post.id)
  // COULD rename editsAppdRevd to editsAppdRevtd (Revtd instead of Revd).
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
    (deleted.sortBy(- _._2.ctime.getTime),
      pending.sortBy(- _.ctime.getTime),
      applied.sortBy(- _._2.ctime.getTime),
      appdRevd.sortBy(- _._3.ctime.getTime))
  }

  def editsAppdAsc = editsAppdDesc.reverse

  lazy val lastEditApp = editsAppdDesc.headOption.map(_._2)

  /** Whether or not this Post has been published.
   *
   *  If the root post is published, then the whole page is published.
   *  If a comment is published, then it's been approved (it's not spam).
   */
  lazy val publd: Option[Boolean] = {
    if (publs isEmpty) None
    else Some(true)  // for now, don't consider deletions of publications
  }

  /** Only the first (w.r.t. its ctime) non-deleted publication has any effect.
   */
  lazy val publs: List[Post] = debate.publsByParentId(id)

  // COULD optimize this, do once for all flags.
  lazy val flags = debate.flags.filter(_.postId == post.id)

  lazy val lastFlag = flags.sortBy(- _.ctime.getTime).headOption

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

  private val _FixPosRegex = """fixed-position: ?(\d+)""".r

  lazy val meta: PostMeta = {
    var fixedPos: Option[Int] = None
    var isArticleQuestion = false
    for (m <- metaPosts ; line <- m.text.lines) line match {
      case "article-question" => isArticleQuestion = true
      case _FixPosRegex(pos) => fixedPos = Some(pos.toInt)
      case _ =>
    }
    PostMeta(isArticleQuestion = isArticleQuestion, fixedPos = fixedPos)
  }
}

class ViEd(debate: Debate, val edit: Edit) extends ViAc(debate, edit) {

}

sealed abstract class Action {  // COULD delete, replace with Post:s?
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
  def ctime: ju.Date
}

case class Rating (
  id: String,
  postId: String,
  loginId: String,
  newIp: Option[String],
  ctime: ju.Date,
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
  ctime: ju.Date,
  reason: FlagReason,
  details: String
) extends Action

sealed abstract class PostType  // rename to ActionType?
object PostType {

  /** A blog post, or forum questiom or comment. */
  case object Text extends PostType

  /** Edits a Post.text. */
  //case object Edit extends PostType

  /** Makes an Action suggestion take effect.
   */
  case object Publish extends PostType

  /** Meta information describes another Post. */
  // COULD use dedicated PostType:s instead, then the computer/database
  // would understand what is it (but it'd have to parse the Meta.text to
  // understand what is it.
  case object Meta extends PostType

  /** Deletes something, e.g. a post.
   *
   * Instead of the deleted thing information that the thing
   * was deleted is shown, e.g. "3 comments deleted by <someone>".
   */
  // case object Deletion extends PostType

  /** Undoes an action, as if had it never been done.
   *
   * This is different from Delete, because if you delete a post,
   * information is shown on the page that here is a deleted post.
   * However, if you Undo a post, there'll be not a trace of it
   * on the generated page.
   * Initially, though, only Undo:s of Deletion:s and Flag:s will be
   * implemented (so you can undelete an unflag stuff).
   */
  // case object Undo extends PostType

  //sealed abstract trait FlagReason
  //case object FlagSpam extends PostType with FlagReason
}

case class Post(  // COULD merge all actions into Post,
                  // and use different PostType:s (which would include
                  // the payload) for various different actions.
                  // And rename to ... Action? PageAction?

  // is "?" if unknown, or e.g. "?x" if it's unknown.
  // COULD replace w case classes e.g. IdKnown(id)/IdPending(tmpId)/IdUnknown,
  // then it would not be possible to forget to check for "?".
  id: String,
  parent: String,
  ctime: ju.Date,
  loginId: String,
  newIp: Option[String],
  text: String,

  /** The markup language to use when rendering this post.
   */
  markup: String,

  tyype: PostType,

  /** If defined, this is an inline comment and the value
   *  specifies where in the parent post it is to be placed.
   */
  where: Option[String] = None   // COULD move to separate Meta post?
                                 // Benefits: Editing and versioning of
                                 // `where', without affecting this Post.text.
                                // Benefit 2: There could be > 1 meta-Where
                                // for each post, so you could make e.g. a
                                // generic comment that results in ...
                                // ...?? arrows to e.g. 3 other comments ??
) extends Action {
}

case class PostMeta(
  isArticleQuestion: Boolean = false,
  fixedPos: Option[Int] = None
)

// Could rename to Patch? or Diff?
// SHOULD merge into Post and PostType.Edit
case class Edit (
  id: String,
  postId: String,
  ctime: ju.Date,
  loginId: String,
  newIp: Option[String],
  text: String,

  /** Changes the markup henceforth applied to postId's text.
   *
   * None means reuse the current markup.
   */
  newMarkup: Option[String]
) extends Action

// Verify: No duplicate like/diss ids, no edit both liked and dissed
// COULD remove! Instead, introduce Action.Status = Suggestion/Published,
// and instead of EditVote, use EditApp.status = Suggestion.
// (Then you cannot vote on > 1 edit at once, but perhaps that's a good thing?)
// When there are X EditApp suggestions, automatically create one
// with status = Published?
// "status=Suggestion/Published"? or "weight=Sugstn/Publ"?
// or "effect=Immediate/SuggestionOnly"?
case class EditVote(  // should extend Action
  id: String,
  loginId: String,
  ip: String,  // should change to newIp Option[String]
  ctime: ju.Date,
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
// SHOULD merge into Post and use case class PostType.Appl?
case class EditApp(   // COULD rename to Appl?
  id: String,
  editId: String,  // COULD rename to actionId?
  loginId: String,
  newIp: Option[String],
  ctime: ju.Date,

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
) extends Action

/** Deletes an action. When actionId (well, postId right now)
 *  is a post, it won't be rendered. If `wholeTree', no reply is shown either.
 *  If actionId is an EditApp, that edit is undone.
 *  --- Not implemented: --------
 *  If `wholeTree', all edit applications from actionId and up to
 *  delete.ctime are undone.
 *  If actionId is an Edit, the edit will no longer appear in the list of
 *  edits you can choose to apply.
 *  If `wholeTree', no Edit from actionId up to delete.ctime will appear
 *  in the list of edits that can be applied.
 *  -----------------------------
 */
// SHOULD merge into Post and use case class PostType.Deletion?
case class Delete(
  id: String,
  postId: String,  // COULD rename to actionId
  loginId: String,
  newIp: Option[String],
  ctime: ju.Date,
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


sealed abstract class PageRoot {
  def id: String
  def findOrCreatePostIn(page: Debate): Option[ViPo]
  def findChildrenIn(page: Debate): List[Post]
  def isPageTemplate: Boolean = id == Page.TemplateId
}


object PageRoot {

  val TheBody = Real(Page.BodyId)

  /** A real post, e.g. the page body post. */
  case class Real(id: String) extends PageRoot {
    // Only virtual ids may contain hyphens, e.g. "page-template".
    assErrIf3(id contains "-", "DwE0ksEW3", "Real id contains hyphen: "+
          safed(id))

    def findOrCreatePostIn(page: Debate): Option[ViPo] = page.vipo(id)

    def findChildrenIn(page: Debate): List[Post] = page.repliesTo(id)
  }

  // In the future, something like this:
  // case class FlaggedPosts -- creates a virtual root post, with all
  // posts-with-flags as its children.
  // And lots of other virtual roots that provide whatever info on
  // the page?

  def apply(id: String): PageRoot = {
    id match {
      case null => assErr("DwE0392kr53", "Id is null")
      // COULD check if `id' is invalid, e.g.contains a hyphen,
      // and if so show an error page root post.
      case "" => Real(Page.BodyId)  // the default, if nothing specified
      case "title" => Real(Page.TitleId)
      case "template" => Real(Page.TemplateId)
      case id => Real(id)
    }
  }
}

