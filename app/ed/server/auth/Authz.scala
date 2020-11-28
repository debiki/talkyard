/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package ed.server.auth

import com.debiki.core._
import com.debiki.core.Prelude._
import scala.collection.immutable
import MayMaybe._
import MayWhat._


sealed abstract class MayMaybe(private val may: Boolean) { def mayNot: Boolean = !may }
object MayMaybe {
  case object Yes extends MayMaybe(true)
  case class NoMayNot(code: String, reason: String) extends MayMaybe(false)
  case class NoNotFound(debugCode: String) extends MayMaybe(false)
}



sealed abstract class AuthzContext {
  def requester: Option[Participant]
  def groupIdsUserIdFirst: immutable.Seq[GroupId]
  def tooManyPermissions: immutable.Seq[PermsOnPages]
  def isStaff: Boolean = requester.exists(_.isStaff)
  def isAdmin: Boolean = requester.exists(_.isAdmin)

  if (requester.isEmpty) {
    // Strangers cannot be members of any group except for the Everyone group.
    require(groupIdsUserIdFirst == List(Group.EveryoneId),
      s"Bad stranger groups, should be [EveryoneId] but is: $groupIdsUserIdFirst [TyE30KRGV2]")
    // It's fine, though, if tooManyPermissions includes permissions for
    // other groups — such permissions get excluded, later [7RBBRY2].
  }
}

case class ForumAuthzContext(
  requester: Option[Participant],
  groupIdsUserIdFirst: immutable.Seq[GroupId],
  tooManyPermissions: immutable.Seq[PermsOnPages]) extends AuthzContext {

  def groupIdsEveryoneLast: immutable.Seq[GroupId] = {
    if (requester.exists(_.isGroup)) {
      die("TyEs024HRS25", "Trying to authz as a group")  // [imp-groups]
    }
    else if (groupIdsUserIdFirst.length >= 2) {
      dieIf(requester.map(_.id) isNot groupIdsUserIdFirst(0), "TyE2AKBR05")
      groupIdsUserIdFirst.tail
    }
    else {
      // This must be a guest — otherwise, there'd be a user id, and the Everyone group, at least.
      // Guests are in just one group: the Everyone group.
      dieIf(requester.map(_.isGuest).isSomethingButNot(true), "TyE5HNKTSF2")
      dieIf(groupIdsUserIdFirst.headOption.isSomethingButNot(Group.EveryoneId), "TyE4ABFK02")
      groupIdsUserIdFirst
    }
  }
}


/*
case class CategoryAuthzContext(
  requester: Option[User],
  permissions: immutable.Seq[PermsOnPages],
  categoriesRootLast: immutable.Seq[Category]) extends AuthzContext

case class PageAuthzContext(
  requester: Option[User],
  permissions: immutable.Seq[PermsOnPages],
  categoriesRootLast: immutable.Seq[Category],
  pageMeta: PageMeta,
  pageMembers: Option[Set[UserId]]) extends AuthzContext {

  require(!pageMeta.pageRole.isPrivateGroupTalk || pageMembers.isDefined, "EdE6LPK2A0")
  require(pageMeta.categoryId.isDefined == categoriesRootLast.nonEmpty, "EdE0WYK15")
  require(!pageMeta.categoryId.exists(_ != categoriesRootLast.head.id), "EdE3GPJU0")
} */



/** Checks if a member may e.g. create pages, post replies, wikify, ... and so on.
  * And, if not, tells you why not: all functions returns a why-may-not reason.
  */
object Authz {


  def deriveEffPatPerms(groupsAnyOrder: Iterable[Group],
          permsOnSite: PermsOnSite): EffPatPerms = {

    // Right now.
    dieIf(permsOnSite.forPeopleId != Group.EveryoneId, "TyE305MRTK",
          s"permsOnSite not for Everyone: $permsOnSite")

    var maxUpl: Opt[i32] = Some(0)
    val uplExts = MutHashSet[St]()
    for (group <- groupsAnyOrder) {
      val perms = group.perms
      maxUpl = maxOfAnyInt32(maxUpl, perms.maxUploadBytes)
      uplExts ++= perms.allowedUplExtensionsAsSet
    }

    maxUpl = minOfAnyInt32(maxUpl, Some(permsOnSite.maxUploadSizeBytes))

    EffPatPerms(
          maxUploadSizeBytes = maxUpl.get,
          allowedUploadExtensions = uplExts.toSet)
  }



  def mayCreatePage(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    pageRole: PageType,
    bodyPostType: PostType,
    pinWhere: Option[PinPageWhere],
    anySlug: Option[String],
    anyFolder: Option[String],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    val mayWhat = checkPermsOnPages(Some(user), groupIds, pageMeta = None, pageMembers = None,
      inCategoriesRootLast, tooManyPermissions)

    def isPrivate = pageRole.isPrivateGroupTalk && groupIds.nonEmpty &&
      inCategoriesRootLast.isEmpty

    if (mayWhat.maySee.isEmpty && isPrivate) {
      // Ok, may see.
    }
    else if (mayWhat.maySee isNot true) {
      return NoNotFound(s"EdEM0CR0SEE-${mayWhat.debugCode}")
    }

    if (!mayWhat.mayCreatePage && !isPrivate)
      return NoMayNot(s"EdEMN0CR-${mayWhat.debugCode}", "May not create a page in this category")

    if (!user.isStaff) {
      if (inCategoriesRootLast.isEmpty && !isPrivate)
        return NoMayNot("EsEM0CRNOCAT", "Only staff may create pages outside any category")

      if (anyFolder.exists(f => f.nonEmpty && f != "/"))
        return NoMayNot("EdEM0CRFLDR", "Only staff may specify page folder")

      if (anySlug.exists(_.nonEmpty))
        return NoMayNot("EdEM0CR0SLG", "Only staff may specify page slug")

      if (pageRole.staffOnly)
        return NoMayNot("EdEM0CRPAGETY", s"Forbidden page type: $pageRole")

      if (bodyPostType != PostType.Normal)
        return NoMayNot("EdEM0CRPOSTTY", s"Forbidden post type: $bodyPostType")

      if (pinWhere.isDefined)
        return NoMayNot("EdEM0CRPIN", "Only staff may pin pages")
    }

    Yes
  }


  SECURITY // not important for the moment, but should be a maySeePost also?
  def maySeePage(
    pageMeta: PageMeta,
    user: Option[Participant],
    groupIds: immutable.Seq[GroupId],
    pageMembers: Set[UserId],
    categoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Boolean = true): MayMaybe = {

    val mayWhat = checkPermsOnPages(user, groupIds, Some(pageMeta), Some(pageMembers),
      categoriesRootLast, tooManyPermissions, maySeeUnlisted = maySeeUnlisted)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0SEE_-${mayWhat.debugCode}")

    Yes
  }


  def maySeeCategory(authzCtx: AuthzContext, categoriesRootLast: immutable.Seq[Category])
        : MayWhat = {
    checkPermsOnPages(authzCtx.requester, authzCtx.groupIdsUserIdFirst,
      pageMeta = None, pageMembers = None, categoriesRootLast, authzCtx.tooManyPermissions,
      maySeeUnlisted = false)
  }


  def mayPostReply(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    postType: PostType,
    pageMeta: PageMeta,
    replyToPosts: immutable.Seq[Post],
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    SHOULD // be check-perms-on pageid + postnr, not just page
    val mayWhat = checkPermsOnPages(Some(user), groupIds, Some(pageMeta),
      Some(privateGroupTalkMemberIds), inCategoriesRootLast, tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0RE0SEE_-${mayWhat.debugCode}")

    if (pageMeta.pageType == PageType.MindMap) {
      // Mind maps could easily get messed up by people posting new stuff to the mind map, so,
      // only allow people with edit-*page* permission to add stuff to a mind map. [7KUE20]
      if (!mayWhat.mayEditPage) // before: user.id != pageMeta.authorId && !user.isStaff)
        return NoMayNot("EsEMAY0REMINDM", "Not allowed to add more items to this mind map")
    }
    else {
      if (!mayWhat.mayPostComment)
        return NoMayNot("EdEM0RE0RE", "You don't have permissions to post a reply on this page")
    }

    if (!pageMeta.pageType.canHaveReplies)
      return NoMayNot("EsEM0REPAGETY", s"Cannot post to page type ${pageMeta.pageType}")

    // Dupl code, a bit repeated in AuthzSiteDaoMixin. [8KUWC1]
    replyToPosts foreach { post =>
      if (post.isDeleted && !user.isStaff)
        return NoMayNot("EsEM0REPSTDLD", s"Cannot reply to post nr ${post.nr}: it has been deleted")

      // Later?:  COULD let staff/mods meta-discuss things [METADISC] e.g. if a comment should be
      // allowed or not. Then could use post nrs < 0, and not loade them by default when rendering the
      // page. Only loaded for staff, if they click some small "View meta discussion" button.
      // def isStaffOrAuthor = user.isStaff || user.id == post.createdById
      // if (post is staff-only visible && !isStaffOrAuthor)
      //   return NoMayNot("EsEM0REPSTDLD", s"Cannot reply to post nr ${post.nr}: it's been deleted")
    }

    Yes
  }


  def mayEditPost(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    post: Post,
    pageMeta: PageMeta,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    if (post.isDeleted)
      return NoNotFound("TyEM0EDPOSTDELD")

    val user = userAndLevels.user
    val mayWhat = checkPermsOnPages(Some(user), groupIds, Some(pageMeta),
      Some(privateGroupTalkMemberIds), inCategoriesRootLast, tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0ED0SEE-${mayWhat.debugCode}")

    val isOwnPost = user.id == post.createdById  // [8UAB3WG2]
    if (isOwnPost) {
      // Fine, may edit.
      // But shouldn't:  isOwnPost && mayWhat.mayEditOwn ?  (2020-07-17)
    }
    else if (pageMeta.pageType == PageType.MindMap) {  // [0JUK2WA5]
      if (!mayWhat.mayEditPage)
        return NoMayNot("TyEM0ED0YOURMINDM", "You may not edit other people's mind maps")
    }
    else if (post.isWiki && mayWhat.mayEditWiki && !post.isTitle) {
      // Fine, may edit.  But exclude titles, for now. Otherwise, could be
      // surprising if an attacker renames a page to sth else, and edits it,
      // and the staff don't realize which page got edited, since renamed?
      // I think titles aren't wikifiable at all, currently, anyway.
    }
    else if (post.isOrigPost || post.isTitle) {
      if (!mayWhat.mayEditPage)
        return NoMayNot("EdEM0ED0YOURORIGP_", "You may not edit other people's pages")
    }
    // Later: else if is meta discussion ... [METADISC]
    else {
      if (!mayWhat.mayEditComment)
        return NoMayNot("EdEM0ED0YOURPOST", "You may not edit other people's posts")
    }

    Yes
  }


  def mayFlagPost(
    member: User,
    groupIds: immutable.Seq[GroupId],
    post: Post,
    pageMeta: PageMeta,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    if (post.isDeleted)
      return NoMayNot("TyEM0FLGDELDPST", "You cannot flag deleted posts")

    if (pageMeta.deletedAt.isDefined)
      return NoMayNot("TyEM0FLGDELDPG", "You cannot flag posts on delted pages")

    if (member.effectiveTrustLevel.isStrangerOrNewMember) {
      COULD // Later: Check site settings to find out if members may flag stuff.
      // Small forums: everyone may flag. Medium/large: new users may not flag?
    }

    if (member.threatLevel.isSevereOrWorse)
      return NoMayNot(s"EdEM0FLGISTHRT", "You may not flag stuff, sorry")

    SHOULD // be maySeePost pageid, postnr, not just page
    val mayWhat = checkPermsOnPages(Some(member), groupIds, Some(pageMeta),
      Some(privateGroupTalkMemberIds), inCategoriesRootLast, tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound("EdEM0FLG0SEE")

    Yes
  }


  def maySubmitCustomForm(
    userAndLevels: AnyUserAndThreatLevel,
    groupIds: immutable.Seq[GroupId],
    pageMeta: PageMeta,
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    val mayWhat = checkPermsOnPages(user, groupIds, Some(pageMeta), None, inCategoriesRootLast,
      tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound("EdEM0FRM0SEE")

    if (!mayWhat.mayPostComment)
      return NoMayNot("EdEM0FRM0RE", "You don't have permissions to submit this form")

    if (pageMeta.pageType != PageType.WebPage && pageMeta.pageType != PageType.Form) {
      return NoMayNot("EsEM0FRMPT", s"Cannot submit custom forms to page type ${pageMeta.pageType}")
    }

    dieUnless(pageMeta.pageType.canHaveReplies, "EdE5PJWK20")

    Yes
  }


  /** Calculates what a user may do. All permissions starts as false, except for maySee which
    * starts as None = unknown. Then we we check all categories and permissions, and update
    * the permissions to true, perhaps back to false, as we proceed.
    *
    * 'maySee' however, is special: if, for a category, it becomes Some(false),
    * we abort, because if one may not see a category, then one may not see anything inside it.
    * If maySee becomes Some(true), that might later be changed to Some(false), when
    * any sub category is considered (if we're doing something in a sub category).
    *
    * When all calculations are ready, if maySee is still None, the callers handle that
    * as Some(false), so don't-know-if-may-see = may-Not-see.
    */
  private def checkPermsOnPages(
    user: Option[Participant],
    groupIds: immutable.Seq[GroupId],
    pageMeta: Option[PageMeta],
    pageMembers: Option[Set[UserId]],
    categoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Boolean = true): MayWhat = {

    // Admins, but not moderators, have access to everything.
    // Why? Might sometimes be good with a place for members to bring up problems
    // with weird behaving moderators, where those mods cannot read and edit & delete
    // the discussions. [mods_not_all_perms]
    if (user.exists(_.isAdmin))
      return MayEverything

    val isStaff = user.exists(_.isStaff)
    val isOwnPage = user.exists(u => pageMeta.exists(_.authorId == u.id))

    // For now, don't let people see pages outside any category. Hmm...?
    // (<= 1 not 0: don't count the root category, no pages should be placed directly in them.)
    /* Enable this later, need to migrate test cases first.
    if (categoriesRootLast.length <= 1 && !pageRole.exists(_.isPrivateGroupTalk))
      return MayWhat.mayNotSee("EdMNOCATS")
    */

    var mayWhat = MayPerhapsSee

    pageMeta foreach { meta =>
      categoriesRootLast.headOption foreach { parentCategory =>
        dieIf(!meta.categoryId.contains(parentCategory.id), "EdE5PBSW2")
      }

      // These page types are for admins only.
      if (meta.pageType == PageType.SpecialContent || meta.pageType == PageType.Code)
        return MayWhat.mayNotSee("EdE0SEEISCODE")

      if (meta.isHidden && !isStaff && !isOwnPage)
        return MayWhat.mayNotSee("EdE0SEEPAGEHIDDEN_")

      // In one's own mind map, one may edit all nodes, even if posted by others. [0JUK2WA5]
      if (meta.pageType == PageType.MindMap && (isOwnPage || isStaff))
        mayWhat = mayWhat.copy(mayEditPage = true, debugCode = "EdMEDOWNMINDM")

      // Only page participants may see things like private chats. [PRIVCHATNOTFS]
      if (meta.pageType.isPrivateGroupTalk) {
        val thePageMembers = pageMembers getOrDie "EdE2SUH5G"
        val theUser = user getOrElse {
          return MayWhat.mayNotSee("EdE0SEE0USER")
        }

        if (!theUser.isMember)
          return MayWhat.mayNotSee("EdE0SEE0MBR")

        if (!thePageMembers.contains(theUser.id))
          return MayWhat.mayNotSee("EdE0SEE0PAGEMBR")

        mayWhat = mayWhat.copyWithMaySeeAndReply(debugCode = "EdMMMEMBR")
      }
    }

    val relevantPermissions = tooManyPermissions filter { permission =>  // [7RBBRY2]
      groupIds.contains(permission.forPeopleId)
    }

    // We'll start with no permissions, at the top category, and loop through all categories
    // down to the category in which the page is placed, and add/remove permissions along the way.
    val isForumPage = pageMeta.exists(_.pageType == PageType.Forum)
    var isDeleted = pageMeta.exists(_.isDeleted)

    // Later: return may-not-see also if !published?
    if (isDeleted && !isStaff)
      return MayWhat.mayNotSee("TyEPAGEDELD_")

    // For now, hardcode may-see the forum page, otherwise only admins would see it.
    if (isForumPage)
      mayWhat = mayWhat.copy(maySee = Some(true), debugCode = "EdMMSEEFORUM")

    for (p <- relevantPermissions; if p.onWholeSite.is(true))
      mayWhat = mayWhat.addRemovePermissions(p, "EdMMSITEPERM")

    // Hmm. !maySee here? Could happen if maySee is set to false for Everyone, but true for
    // trust-level >= 1. That'd mean only people who have signed up already, may see this website.
    if (mayWhat.maySee is false) {
      // But maySeeOwn=true has precedence over maySee=false.
      if (!isOwnPage || !mayWhat.maySeeOwn)
        return mayWhat
    }

    // Skip the root category, cannot set permissions on it. [0YWKG21]
    if (categoriesRootLast.nonEmpty) for (category <- categoriesRootLast.reverseIterator.drop(1)) {
      // What if one permission says Some(yes) and another says Some(no), then, may or may not?
      // Currently there's either Some(yes) or None, only, though. Some(no) = not impl [2LG5F04W]
      for (p <- relevantPermissions; if p.onCategoryId.is(category.id)) {
        mayWhat = mayWhat.addRemovePermissions(p, "EdMCATLOOP")
      }

      if (category.isDeleted) {
        isDeleted = true
        if (!isStaff)
          return MayWhat.mayNotSee("TyECATDELD_")
      }

      // (Skip category.unlistTopics here — one may access those topics; they're just
      // sometimes not listed.)
      // [BACKW_COMPAT_PERMS] should remove !isStaff but first need to update some e2e tests.
      if (!isStaff && !maySeeUnlisted && category.unlistCategory)
        return MayWhat.mayNotSee("EdE6WKQ0-Unlisted")

      // Abort if we may not see this category, or if we don't know.
      if (mayWhat.maySee isNot true) {
        // But maySeeOwn=true has precedence over maySee=false.
        if (isOwnPage && mayWhat.maySeeOwn) {
          // Fine, continue.
        }
        else
          return mayWhat
      }
    }

    // Do this first here, so the is-deleted changes won't get overwritten in later loop laps above.
    if (isDeleted) {
      mayWhat = mayWhat.copyAsDeleted
    }

    mayWhat
  }

}


/**
  * If maySeeOwn=true, then one may see one's own stuff, even if maySee=false.
  */
case class MayWhat(
  mayEditPage: Boolean = false,
  mayEditComment: Boolean = false,
  mayEditWiki: Boolean = false,
  mayEditOwn: Boolean = false,
  mayDeletePage: Boolean = false,
  mayDeleteComment: Boolean = false,
  mayCreatePage: Boolean = false,
  mayPostComment: Boolean = false,
  maySee: Option[Boolean] = None,
  maySeeOwn: Boolean = false,
  debugCode: String = "") {

  require(maySee.isNot(false) || (!mayEditPage && !mayEditComment && !mayEditWiki &&
      !mayDeletePage && !mayDeleteComment && !mayCreatePage && !mayPostComment), "EdE2WKB5FD")

  def addRemovePermissions(permissions: PermsOnPages, debugCode: String) = MayWhat(
    mayEditPage = permissions.mayEditPage.getOrElse(mayEditPage),
    mayEditComment = permissions.mayEditComment.getOrElse(mayEditComment),
    mayEditWiki = permissions.mayEditWiki.getOrElse(mayEditWiki),
    mayEditOwn = permissions.mayEditOwn.getOrElse(mayEditOwn),
    mayDeletePage = permissions.mayDeletePage.getOrElse(mayDeletePage),
    mayDeleteComment = permissions.mayDeleteComment.getOrElse(mayDeleteComment),
    mayCreatePage = permissions.mayCreatePage.getOrElse(mayCreatePage),
    mayPostComment = permissions.mayPostComment.getOrElse(mayPostComment),
    maySee = permissions.maySee.orElse(maySee),
    maySeeOwn = permissions.maySeeOwn.getOrElse(maySeeOwn),
    debugCode)

  def copyWithMaySeeAndReply(debugCode: String): MayWhat = copy(
    mayPostComment = true,
    maySee = Some(true),
    debugCode = debugCode)

  def copyWithMaySeeReplyEdit(debugCode: String): MayWhat = copy(
    mayEditPage = true,
    mayPostComment = true,
    maySee = Some(true),
    debugCode = debugCode)

  /** Copies this MayWhat to permissions = those for a deleted page (mostly may-do-nothing).
    **/
  def copyAsDeleted: MayWhat = copy(
    mayEditPage = false,
    mayEditComment = false,
    mayEditWiki = false,
    mayDeletePage = false,
    mayDeleteComment = false,
    mayCreatePage = false,
    mayPostComment = false)
}


object MayWhat {

  val MayPerhapsSee: MayWhat = MayWhat.mayNotSee("TyMMBYSEE_").copy(maySee = None)

  val MayEverything: MayWhat = MayWhat(mayEditPage = true, mayEditComment = true,
    mayEditWiki = true, mayEditOwn = true,
    mayDeletePage = true, mayDeleteComment = true, mayCreatePage = true,
    mayPostComment = true, maySee = Some(true), maySeeOwn = true, "EdMMALL")

  def mayNotSee(debugCode: String) = MayWhat(
    mayEditPage = false, mayEditComment = false, mayEditWiki = false, mayEditOwn = false,
    mayDeletePage = false, mayDeleteComment = false, mayCreatePage = false,
    mayPostComment = false, maySee = Some(false), maySeeOwn = false, debugCode)

}


sealed abstract class MaySeeOrWhyNot(val IntVal: Int, val may: Boolean = false) {
  def toInt: Int = IntVal
}

object MaySeeOrWhyNot {
  case object YesMaySee extends MaySeeOrWhyNot(1, true)

  /** One may not see the post or page, or even know if it exists or not. */
  case object NopeUnspecified extends MaySeeOrWhyNot(2)

  case object NopeNoPostWithThatNr extends MaySeeOrWhyNot(3)
  case object NopePostDeleted extends MaySeeOrWhyNot(4)
}

