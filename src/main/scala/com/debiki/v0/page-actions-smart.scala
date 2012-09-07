// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import Debate._
import FlagReason.FlagReason


object SmartAction {

  def apply(page: Debate, action: Action): ViAc = action match {
    case p: Post => new ViPo(page, p)
    case a: Action => new ViAc(page, a)
  }

}


// COULD rename all these ViAc/NiPo/whatever to SmartAction/Post/Whatever.
// COULD take an Action subclass type param, so it'd be possible to use e.g. a
// SmartPageAction[Rating].
// COULD rename Action to RawAction or PlainAction, and ViAc to Action.
/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class ViAc(val debate: Debate, val action: Action) {
  def page = debate // should rename `debate` to `page`
  def id: String = action.id
  def creationDati = action.ctime
  def loginId = action.loginId
  def login: Option[Login] = debate.people.login(action.loginId)
  def login_! : Login = login.getOrElse(runErr(
     "DwE6gG32", "No login with id "+ safed(action.loginId) +
     " for action "+ safed(id)))
  def identity: Option[Identity] = login.flatMap(l =>
                                    debate.people.identity(l.identityId))
  def identity_! : Identity = debate.people.identity_!(login_!.identityId)
  def user : Option[User] = identity.flatMap(i => debate.people.user(i.userId))
  def user_! : User = debate.people.user_!(identity_!.userId)
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
  lazy val deletionsDescTime = deletions.sortBy(- _.ctime.getTime)

  lazy val lastDelete = deletionsDescTime.headOption
  lazy val firstDelete = deletionsDescTime.lastOption

  def deletionDati: Option[ju.Date] = firstDelete.map(_.ctime)
}



/** A Virtual Post into account all edits applied to the actual post.
 */
class ViPo(debate: Debate, val post: Post) extends ViAc(debate, post) {

  def parent: String = post.parent
  def tyype = post.tyype

  def approval = post.approval
  def initiallyApproved: Boolean = approval.isDefined

  lazy val (text: String, markup: String) = _applyEdits


  /**
   * Applies all edits and returns the resulting text and markup.
   *
   * Keep in sync with textAsOf in debiki.js.
   *    COULD make textAsOf understand changes in markup type,
   *    or the preview won't always work correctly.
   *
   * (It's not feasible to apply only edits that have been approved,
   * or only edits up to a certain dati. Because
   * then the state of all edits at that dati would have to be computed.
   * But at a given dati, an edit might or might not have been applied and
   * approved, and taking that into account results in terribly messy code.
   * Instead, use Page.partitionByVersion(), to get a version of the page
   * at a certain point in time.)
   */
  private def _applyEdits: (String, String) = {
    var curText = post.text
    var curMarkup = post.markup
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    // Loop through all edits and patch curText.
    for (edit <- editsAppliedAscTime) {
      curMarkup = edit.newMarkup.getOrElse(curMarkup)
      val patchText = edit.patchText
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
  def edits: List[ViEd] = page.editsFor(post.id)

  lazy val (
      editsDeletedDescTime: List[ViEd],
      editsPendingDescTime: List[ViEd],
      editsAppliedDescTime: List[ViEd],
      editsRevertedDescTime: List[ViEd]) = {

    var deleted = List[ViEd]()
    var pending = List[ViEd]()
    var applied = List[ViEd]()
    var reverted = List[ViEd]()

    edits foreach { edit =>
      // (Cannot easily move the below `assert`s to Edit, because
      // the values they test are computed lazily.)

      // An edit cannot be both applied and reverted at the same time.
      assErrIf(edit.isApplied && edit.isReverted, "DwE4FW21")
      if (edit.isReverted) reverted ::= edit
      if (edit.isApplied) applied ::= edit

      // An edit can have been reverted and then deleted,
      // but an edit that is currently in effect cannot also be deleted.
      assErrIf(edit.isApplied && edit.isDeleted, "DwE09IJ3")
      if (edit.isDeleted) deleted ::= edit

      // An edit that has been applied and then reverted, is pending again.
      // But an edit that is in effect, or has been deleted, cannot be pending.
      assErrIf(edit.isApplied && edit.isPending, "DwE337Z2")
      assErrIf(edit.isDeleted && edit.isPending, "DwE8Z3B2")
      if (edit.isPending) pending ::= edit
    }

    (deleted.sortBy(- _.deletionDati.get.getTime),
       pending.sortBy(- _.creationDati.getTime),
       applied.sortBy(- _.applicationDati.get.getTime),
       reverted.sortBy(- _.revertionDati.get.getTime))
  }

  def editsAppliedAscTime = editsAppliedDescTime.reverse

  lazy val lastEditApplied = editsAppliedDescTime.headOption
  lazy val lastEditReverted = editsRevertedDescTime.headOption


  /**
   * Modification date time: When the text of this Post was last changed
   * (that is, an edit was applied, or a previously applied edit was reverted).
   */
  def modificationDati: ju.Date = {
    val maxTime = math.max(
       lastEditApplied.map(_.applicationDati.get.getTime).getOrElse(0: Long),
       lastEditReverted.map(_.revertionDati.get.getTime).getOrElse(0: Long))
    if (maxTime == 0) creationDati else new ju.Date(maxTime)
  }


  private lazy val _reviewsDescTime: List[MaybeApproval] = {
    // (If a Review.approval.isEmpty, this Post was rejected.
    // An Edit.approval or EditApp.approval being empty, however,
    // means only that this Post has not yet been reviewed — so the Edit
    // or EditApp is simply ignored.)
    var explicitReviews = page.explicitReviewsOf(id).sortBy(-_.ctime.getTime)
    var implicitApprovals = List[MaybeApproval]()
    if (post.approval.isDefined)
      implicitApprovals ::= post
    for (edit <- edits) {
      if (edit.edit.approval.isDefined)
        implicitApprovals ::= edit.edit
      for (editApp <- page.editAppsByEdit(edit.id)) {
        if (editApp.approval.isDefined)
          implicitApprovals ::= editApp
        for (editAppReview <- page.explicitReviewsOf(editApp)) {
          explicitReviews ::= editAppReview
        }

        // In the future, deletions (and any other actions?) should also
        // be considered:
        //for (deletion <- page.deletionsFor(editApp)) {
        //  if (deletion.approval.isDefined)
        //    implicitApprovals ::= deletion
        //  ... check explicit reviews of `deletion`.
        //}
      }

      // In the future, also consider deletions?
      //for (deletion <- page.deletionsFor(edit)) {
      //  if (deletion.approval.isDefined)
      //    implicitApprovals ::= deletion
      //  ... check explicit reviews of `deletion`.
      //}
    }

    // In the future, consider deletions of `this.action`?
    // for (deletion <- page.deletionsFor(action)) ...

    val allReviews = explicitReviews ::: implicitApprovals
    allReviews.sortBy(- _.ctime.getTime)
  }


  /**
   * Moderators need only be informed about things that happened after
   * this dati.
   */
  def lastReviewDati: Option[ju.Date] =
    _reviewsDescTime.headOption.map(_.ctime)


  /**
   * All actions that affected this Post and didn't happen after
   * this dati should be considered when rendering this Post.
   */
  def lastApprovalDati: Option[ju.Date] =
    _reviewsDescTime.filter(_.approval.isDefined).headOption.map(_.ctime)


  def lastReviewWasApproval: Option[Boolean] =
    if (lastReviewDati.isEmpty) None
    else Some(lastReviewDati == lastApprovalDati)


  def currentVersionReviewed: Boolean = {
    // Use >= not > because a comment might be auto approved, and then
    // the approval dati equals the comment creationDati.
    lastReviewDati.isDefined && lastReviewDati.get.getTime >=
       modificationDati.getTime
  }


  def currentVersionApproved: Boolean =
    currentVersionReviewed && lastReviewWasApproval.get


  def currentVersionRejected: Boolean =
    currentVersionReviewed && !lastReviewWasApproval.get


  def someVersionApproved: Boolean = {
    // A rejection cancels all edits since the previous approval,
    // or effectively deletes the post, if it has never been approved.
    // To completely "unapprove" a post that has previously been approved,
    // delete it instead.
    lastApprovalDati.nonEmpty
  }


  lazy val depth: Int = {
    var depth = 0
    var curId = id
    var nextParent = page.vipo(parent)
    while (nextParent.nonEmpty && nextParent.get.id != curId) {
      depth += 1
      curId = nextParent.get.id
      nextParent = page.vipo(nextParent.get.parent) //nextParent.parent
    }
    depth
  }


  def replies: List[ViPo] =
    debate.repliesTo(id) map (new ViPo(page, _))


  def siblingsAndMe: List[ViPo] =
    debate.repliesTo(parent) map (new ViPo(page, _))


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

  def flagsDescTime: List[Flag] = flags.sortBy(- _.ctime.getTime)

  lazy val (
      flagsPendingReview: List[Flag],
      flagsReviewed: List[Flag]) =
    flagsDescTime span { flag =>
      if (lastReviewDati isEmpty) true
      else lastReviewDati.get.getTime <= flag.ctime.getTime
    }

  lazy val lastFlag = flagsDescTime.headOption

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

  def patchText = edit.text
  def newMarkup = edit.newMarkup

  def isPending = !isApplied && !isDeleted

  private def _initiallyAutoApplied = edit.autoApplied

  /**
   * The result of applying patchText to the related Post, as it was
   * when this Edit was submitted (with other later edits ignored, even
   * if they were actually applied before this edit).
   */
  def intendedResult: String =
    // Apply edits to the related post up to this.creationDati,
    // then apply this edit, and return the resulting text.
    "(not implemented)"

  /**
   * The result of applying patchText to the related Post,
   * taking into account other Edits that were applied before this edit,
   * and they made it impossible to correctly
   * apply the patchText of this Edit.
   */
  def actualResult: Option[String] =
    // Apply edits to the related post up to this.applicationDati,
    // then apply this edit, and return the resulting text.
    if (isApplied) Some("(not implemented)") else None


  val (isApplied, applicationDati,
      applierLoginId, applicationActionId,
      isReverted, revertionDati)
        : (Boolean, Option[ju.Date], Option[String], Option[String],
          Boolean, Option[ju.Date]) = {
    val allEditApps = page.editAppsByEdit(id)
    if (allEditApps isEmpty) {
      // This edit might have been auto applied, and deleted & reverted later.
      (_initiallyAutoApplied, isDeleted) match {
        case (false, _) => (false, None, None, None, false, None)
        case (true, false) =>
          // Auto applied at creation. This edit itself is its own application.
          (true, Some(creationDati), Some(loginId), Some(id), false, None)
        case (true, true) =>
          // Auto applied, but later deleted and implicitly reverted.
          (false, None, None, None, true, deletionDati)
      }
    } else {
      // Consider the most recent EditApp only. If it hasn't been deleted,
      // this Edit is in effect. However, if the EditApp has been deleted,
      // there should be no other EditApp that has not also been deleted,
      // because you cannot apply an edit that's already been applied.
      val lastEditApp = allEditApps.maxBy(_.ctime.getTime)
      val revertionDati =
        page.deletionFor(lastEditApp.id).map(_.ctime) orElse deletionDati
      if (revertionDati isEmpty)
        (true, Some(lastEditApp.ctime),
           Some(lastEditApp.loginId), Some(lastEditApp.id), false, None)
      else
        (false, None, None, None, true, Some(revertionDati.get))
    }
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

