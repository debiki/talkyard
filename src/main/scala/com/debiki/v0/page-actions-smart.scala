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
/** A virtual Action, that is, an Action plus some utility methods that
 *  look up other stuff in the relevant Debate.
 */
class ViAc(val debate: Debate, val action: Action) {
  def page = debate // should rename `debate` to `page`
  def id: String = action.id
  def ctime = action.ctime
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


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

