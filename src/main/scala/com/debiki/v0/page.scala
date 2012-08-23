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
          if (a.id.head == '?') nextRandomString()
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
  private[debiki] val editApps: List[EditApp] = Nil,
  private[debiki] val flags: List[Flag] = Nil,
  private[debiki] val deletions: List[Delete] = Nil
) extends People {
  private lazy val postsById =
      imm.Map[String, Post](posts.map(x => (x.id, x)): _*)

  def actionCount: Int =
     posts.size + ratings.size + edits.size + editApps.size +
     flags.size + deletions.size

  def allActions: Seq[Action] =
     deletions:::flags:::editApps:::edits:::ratings:::posts

  def smart(action: Action) = new ViAc(this, action)

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


  private class _SingleActionRatings extends SingleActionRatings {
    val _mostRecentByUserId = mut.Map[String, Rating]()
    val _mostRecentByNonAuLoginId = mut.Map[String, Rating]()
    val _allRecentByNonAuIp =
      mut.Map[String, List[Rating]]().withDefaultValue(Nil)

    override def mostRecentByUserId: collection.Map[String, Rating] =
      _mostRecentByUserId

    override lazy val mostRecentByNonAuLoginId: collection.Map[String, Rating] =
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
  // (Never change this mut.Map once it's been constructed.)
  private lazy val _ratingsByActionId: mut.Map[String, _SingleActionRatings] = {
    val mutRatsByPostId =
      mut.Map[String, _SingleActionRatings]()

    // Remember the most recent ratings per user and non-authenticated login id.
    for (rating <- ratings) {
      var singlePostRats = mutRatsByPostId.getOrElseUpdate(
        rating.postId, new _SingleActionRatings)
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


  /** The guid prefixed with a dash.
   *
   * A debate page can be identified either by "-guid"
   * or "/path/to/page/".
   */
  def guidd = "-"+ guid

  // Use these instead.
  def id = guid
  def idd = guidd

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
    pageTemplatePost.map(TemplateSrcHtml(_, "/"+ idd +"?view=template"))


  // -------- Ratings

  // Currently using only by the DAO TCK, need not be fast.
  def rating(id: String): Option[Rating] = ratings.find(_.id == id)

  def ratingsByActionId(actionId: String): Option[SingleActionRatings] =
    _ratingsByActionId.get(actionId)

  def ratingsByUser(withId: String): Seq[Rating] =
    ratings.filter(smart(_).identity.map(_.userId) == Some(withId))


  // ====== Older stuff below (everything in use though!) ======

  // Instead of the stuff below, simply use
  //   postsById  /  publsById  /  etc.
  // and place utility functions in NiPo.


  // -------- Posts

  def postCount = posts.length

  def post(id: String): Option[Post] = postsById.get(id)

  def vipo_!(postId: String): ViPo =  // COULD rename to post_!(withId = ...)
    vipo(postId).getOrElse(runErr(
      "DwE3kR49", "Post not found: "+ safed(postId)))

  def vipo(postId: String): Option[ViPo] = // COULD rename to post(withId =...)
    post(postId).map(new ViPo(this, _))

  def postsByUser(withId: String): Seq[Post] =
    posts.filter(smart(_).identity.map(_.userId) == Some(withId))


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
      case a: EditApp => editApps2 ::= a
      case f: Flag => flags2 ::= f
      case d: Delete => dels2 ::= d
      case x => runErr(
        "DwE8k3EC", "Unknown action type: "+ classNameOf(x))
    }
    Debate(guid, logins2, identities2, users2, posts2, ratings2,
        edits2, editApps2, flags2, dels2)
  }


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


/**
 * Which post to use as the root post, e.g. when viewing a page, or when
 * sending updates of a page back to the browser (only posts below the
 * root post would be sent).
 */
sealed abstract class PageRoot {
  def subId: String
  def findOrCreatePostIn(page: Debate): Option[ViPo]
  def findChildrenIn(page: Debate): List[Post]
  def isDefault: Boolean = subId == Page.BodyId
  def isPageTemplate: Boolean = subId == Page.TemplateId
}


object PageRoot {

  val TheBody = Real(Page.BodyId)

  /** A real post, e.g. the page body post. */
  case class Real(subId: String) extends PageRoot {
    // Only virtual ids may contain hyphens, e.g. "page-template".
    assErrIf3(subId contains "-", "DwE0ksEW3", "Real id contains hyphen: "+
          safed(subId))

    def findOrCreatePostIn(page: Debate): Option[ViPo] = page.vipo(subId)

    def findChildrenIn(page: Debate): List[Post] = page.repliesTo(subId)
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


