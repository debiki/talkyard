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



trait ActionReviews {
  this: ViAc =>

  def autoApproval: Option[AutoApproval]

  def initiallyAutoApproved: Boolean = autoApproval.isDefined


  /**
   * Currently mostly ignored, but in the future all actions *should* either
   * be approved automatically (e.g. well behaved users'  actions), or
   * manually (by moderators/admins).
   *
   * I think that right now / soon, approvals are needed only for
   * new posts by perhaps malicious users.
   */
  private lazy val _manualReviewsDescTime =
    page.reviewsFor(id).sortBy(-_.ctime.getTime)

  def lastReviewDati: Option[ju.Date] = {
    val _lastManualReview = _manualReviewsDescTime.headOption
    _lastManualReview.map(_.ctime) orElse {
      if (initiallyAutoApproved) Some(creationDati) else None
    }
  }

  def lastApprovalDati: Option[ju.Date] = {
    val lastManualApproval =
       _manualReviewsDescTime.filter(_.isApproved).headOption
    lastManualApproval.map(_.ctime) orElse {
      if (initiallyAutoApproved) Some(creationDati) else None
    }
  }

  def lastReviewWasApproval: Option[Boolean] =
    if (lastReviewDati.isEmpty) None
    else Some(lastReviewDati == lastApprovalDati)

}



/** A Virtual Post into account all edits applied to the actual post.
 */
class ViPo(debate: Debate, val post: Post)
  extends ViAc(debate, post) with ActionReviews {

  def parent: String = post.parent
  def tyype = post.tyype

  def autoApproval = post.autoApproval

  lazy val (text: String, markup: String) = _textAndMarkupAsOf(Long.MaxValue)

  lazy val (textApproved: String, markupApproved: String) =
    lastApprovalDati match {
      case None => ("", "")
      case Some(dati) => _textAndMarkupAsOf(dati.getTime)
    }

  /** Applies all edits up to, but not including, the specified date.
   *  Returns the resulting text and markup.
   *  Keep in sync with textAsOf in debiki.js.
   *    COULD make textAsOf understand changes in markup type,
   *    or the preview won't always work correctly.
   */
  private def _textAndMarkupAsOf(millis: Long): (String, String) = {
    var curText = post.text
    var curMarkup = post.markup
    val dmp = new name.fraser.neil.plaintext.diff_match_patch
    // Loop through with all edits that has been applied early enough,
    // and patch curText.
    for {
      edit <- editsAppliedAscTime
      if edit.applicationDati.get.getTime < millis
    } {
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
  def modfDatiPerhapsReviewed: ju.Date = {
    val maxTime = math.max(
       lastEditApplied.map(_.applicationDati.get.getTime).getOrElse(0: Long),
       lastEditReverted.map(_.revertionDati.get.getTime).getOrElse(0: Long))
    if (maxTime == 0) creationDati else new ju.Date(maxTime)
  }


  def currentVersionReviewed: Boolean = {
    // Use >= not > because a comment might be auto approved, and then
    // the approval dati equals the comment creationDati.
    lastReviewDati.isDefined && lastReviewDati.get.getTime >=
       modfDatiPerhapsReviewed.getTime
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

  def text = edit.text
  def newMarkup = edit.newMarkup
  def relatedPostAutoApproval = edit.relatedPostAutoApproval

  def isPending = !isApplied && !isDeleted

  private def _initiallyAutoApplied = edit.autoApplied

  val (isApplied, applicationDati, isReverted, revertionDati)
        : (Boolean, Option[ju.Date], Boolean, Option[ju.Date]) = {
    val allEditApps = page.editAppsByEdit(id)
    if (allEditApps isEmpty) {
      // This edit might have been auto applied, and deleted & reverted later.
      (_initiallyAutoApplied, isDeleted) match {
        case (false, _) => (false, None, false, None)
        case (true, false) =>
          // Auto applied at creation.
          (true, Some(creationDati), false, None)
        case (true, true) =>
          // Auto applied, but later deleted and implicitly reverted.
          (false, None, true, deletionDati)
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
        (true, Some(lastEditApp.ctime), false, None)
      else
        (false, None, true, Some(revertionDati.get))
    }
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

