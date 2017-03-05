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
  def requester: Option[User]
  def groupIds: immutable.Seq[GroupId]
  def permissions: immutable.Seq[PermsOnPages]
  def isStaff: Boolean = requester.exists(_.isStaff)
  def isAdmin: Boolean = requester.exists(_.isAdmin)

  // For now: If is stranger, then requester = None, and only allowed group id = Everyone.
  if (requester.isEmpty) {
    permissions foreach { permission =>
      require(permission.forPeopleId == Group.EveryoneId,
        s"Bad permission, not for Everyone: $permission [EdE2QSRB7]")
    }
  }
}

case class ForumAuthzContext(
  requester: Option[User],
  groupIds: immutable.Seq[GroupId],
  permissions: immutable.Seq[PermsOnPages]) extends AuthzContext

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


  def mayCreatePage(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    pageRole: PageRole,
    bodyPostType: PostType,
    pinWhere: Option[PinPageWhere],
    anySlug: Option[String],
    anyFolder: Option[String],
    inCategoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    val mayWhat = checkPermsOnPages(Some(user), groupIds, pageMeta = None, pageMembers = None,
      inCategoriesRootLast, permissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"EdEM0CR0SEE-${mayWhat.debugCode}")

    if (!mayWhat.mayCreatePage)
      return NoMayNot(s"EdEMN0CR-${mayWhat.debugCode}", "May not create a page in this category")

    if (!user.isStaff) {
      if (inCategoriesRootLast.isEmpty && pageRole != PageRole.FormalMessage)
        return NoMayNot("EsEM0CRNOCAT", "Only staff may create pages outside any category")

      if (anySlug.exists(_.nonEmpty))
        return NoMayNot("EdEM0CR0SLG", "Only staff may specify page slug")

      if (pageRole.staffOnly)
        return NoMayNot("EdEM0CRPAGETY", s"Forbidden page type: $pageRole")
    }

    Yes
  }


  def maySeePage(
    pageMeta: PageMeta,
    user: Option[User],
    groupIds: immutable.Seq[GroupId],
    pageMembers: Set[UserId],
    categoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Boolean = true): MayMaybe = {

    val mayWhat = checkPermsOnPages(user, groupIds, Some(pageMeta), Some(pageMembers),
      categoriesRootLast, permissions, maySeeUnlisted = maySeeUnlisted)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"EdEM0SEE-${mayWhat.debugCode}")

    Yes
  }


  def maySeeCategory(authzCtx: AuthzContext, categoriesRootLast: immutable.Seq[Category])
        : MayWhat = {
    checkPermsOnPages(authzCtx.requester, authzCtx.groupIds,
      pageMeta = None, pageMembers = None, categoriesRootLast, authzCtx.permissions,
      maySeeUnlisted = false)
  }


  def mayPostReply(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    postType: PostType,
    pageMeta: PageMeta,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    SHOULD // be check-perms-on pageid + postnr, not just page
    val mayWhat = checkPermsOnPages(Some(user), groupIds, Some(pageMeta),
      Some(privateGroupTalkMemberIds), inCategoriesRootLast, permissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"EdEM0RE0SEE-${mayWhat.debugCode}")

    if (!mayWhat.mayPostComment)
      return NoMayNot("EdEM0RE0RE", "You don't have permissions to post a reply on this page")

    // Mind maps can easily get messed up by people posting comments. So, for now, only
    // allow the page author + staff to add stuff to a mind map. [7KUE20]
    if (pageMeta.pageRole == PageRole.MindMap) {
      if (user.id != pageMeta.authorId && !user.isStaff)
        return NoMayNot("EsEMAY0REMINDM", "Only the page author and staff may edit this mind map")
    }

    if (!pageMeta.pageRole.canHaveReplies)
      return NoMayNot("EsEM0REPAGETY", s"Cannot post to page type ${pageMeta.pageRole}")

    Yes
  }


  def mayFlagPost(
    member: Member,
    groupIds: immutable.Seq[GroupId],
    post: Post,
    pageMeta: PageMeta,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    if (member.effectiveTrustLevel == TrustLevel.New) {
      COULD // Later: Check site settings to find out if members may flag stuff.
      // Small forums: everyone may flag. Medium/large: new users may not flag?
    }

    if (member.threatLevel.isSevereOrWorse)
      return NoMayNot(s"EdEM0FLGISTHRT", "You may not flag stuff, sorry")

    SHOULD // be maySeePost pageid, postnr, not just page
    val mayWhat = checkPermsOnPages(Some(member), groupIds, Some(pageMeta),
      Some(privateGroupTalkMemberIds), inCategoriesRootLast, permissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound("EdEM0FLG0SEE")

    Yes
  }


  def maySubmitCustomForm(
    userAndLevels: AnyUserAndThreatLevel,
    groupIds: immutable.Seq[GroupId],
    pageMeta: PageMeta,
    inCategoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    val mayWhat = checkPermsOnPages(user, groupIds, Some(pageMeta), None, inCategoriesRootLast,
      permissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound("EdEM0FRM0SEE")

    if (!mayWhat.mayPostComment)
      return NoMayNot("EdEM0FRM0RE", "You don't have permissions to submit this form")

    if (pageMeta.pageRole != PageRole.WebPage && pageMeta.pageRole != PageRole.Form) {
      return NoMayNot("EsEM0FRMPT", s"Cannot submit custom forms to page type ${pageMeta.pageRole}")
    }

    dieUnless(pageMeta.pageRole.canHaveReplies, "EdE5PJWK20")

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
    user: Option[User],
    groupIds: immutable.Seq[GroupId],
    pageMeta: Option[PageMeta],
    pageMembers: Option[Set[UserId]],
    categoriesRootLast: immutable.Seq[Category],
    permissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Boolean = true): MayWhat = {

    if (user.exists(_.isAdmin))
      return MayEverything

    val isStaff = user.exists(_.isStaff)
    val isAuthor = user.isDefined && pageMeta.exists(_.pageId == user.get.id)

    // For now, don't let people see pages outside any category. Hmm...?
    // (<= 1 not 0: don't count the root category, no pages should be placed directly in them.)
    /* Enable this later, need to migrate test cases first.
    if (categoriesRootLast.length <= 1 && !pageRole.exists(_.isPrivateGroupTalk))
      return MayWhat.mayNotSee("EdMNOCATS")
    */

    pageMeta foreach { meta =>
      categoriesRootLast.headOption foreach { parentCategory =>
        dieIf(!meta.categoryId.contains(parentCategory.id), "EdE5PBSW2")
      }

      // These page types are for admins only.
      if (meta.pageRole == PageRole.SpecialContent || meta.pageRole == PageRole.Code)
        return MayWhat.mayNotSee("EsE4YK02R-Code")

      if (meta.isHidden && !isStaff && !isAuthor)
        return MayWhat.mayNotSee("EsE7LFKW0-Hidden")

      // Only page participants may see things like private chats or private formal messages.
      if (meta.pageRole.isPrivateGroupTalk) {
        val thePageMembers = pageMembers getOrDie "EdE2SUH5G"
        val theUser = user getOrElse {
          return MayWhat.mayNotSee("EsE4YK032-No-User")
        }

        if (!theUser.isMember)
          return MayWhat.mayNotSee("EsE2GYF04-Is-Guest")

        if (!thePageMembers.contains(theUser.id))
          return MayWhat.mayNotSee("EsE5K8W27-Not-Page-Member")
      }
    }

    val relevantPermissions = permissions filter { permission =>
      groupIds.contains(permission.forPeopleId)
    }

    // We'll start with no permissions, at the top category, and loop through all categories
    // down to the category in which the page is placed, and add/remove permissions along the way.
    var mayWhat = MayPerhapsSee
    val isUsersPage = user.exists(u => pageMeta.exists(_.authorId == u.id))
    val isForumPage = pageMeta.exists(_.pageRole == PageRole.Forum)
    var isDeleted = pageMeta.exists(_.isDeleted)

    // Later: return may-not-see also if !published?
    if (isDeleted && !isUsersPage && !isStaff)
      return MayWhat.mayNotSee("EdEPAGEDELD")

    // For now, hardcode may-see the forum page, otherwise only admins would see it.
    if (isForumPage)
      mayWhat = mayWhat.copy(maySee = Some(true), debugCode = "EdMSEEFORUM")

    for (p <- relevantPermissions; if p.onWholeSite.is(true))
      mayWhat = mayWhat.addRemovePermissions(p, "EdMSITEPERM")

    // Hmm. !maySee here? Could happen if maySee is set to false for Everyone, but true for
    // trust-level >= 1. That'd mean only people who have signed up already, may see this website.
    if (mayWhat.maySee is false)
      return mayWhat

    // Skip the root category, cannot set permissions on it. [0YWKG21]
    if (categoriesRootLast.nonEmpty) for (category <- categoriesRootLast.reverseIterator.drop(1)) {
      for (p <- relevantPermissions; if p.onCategoryId.is(category.id)) {
        mayWhat = mayWhat.addRemovePermissions(p, "EdMCATLOOP")
      }

      if (category.isDeleted) {
        isDeleted = true
        if (!isStaff)
          return MayWhat.mayNotSee("EdECATDELD")
      }

      // [BACKW_COMPAT_PERMS] should remove !isStaff but first need to update some e2e tests.
      if (!isStaff && !maySeeUnlisted && category.unlisted)
        return MayWhat.mayNotSee("EdE6WKQ0-Unlisted")

      CLEAN_UP // deprecated, try to remove [5FKQWU02]
      if (!isStaff && category.staffOnly)
        return MayWhat.mayNotSee("EdE8YGK25-Staff-Only-Cat")

      CLEAN_UP // Deprecated
      if (!isStaff && category.onlyStaffMayCreateTopics)
        mayWhat = mayWhat.copy(mayCreatePage = false)

      // Abort if we may not see this category, or if we don't know.
      if (mayWhat.maySee isNot true)
        return mayWhat
    }

    // Do this first here, so the is-deleted changes won't get overwritten in later loop laps above.
    if (isDeleted) {
      mayWhat = mayWhat.copyAsDeleted
    }

    mayWhat
  }

}



case class MayWhat(
  mayEditPage: Boolean = false,
  mayEditComment: Boolean = false,
  mayEditWiki: Boolean = false,
  mayDeletePage: Boolean = false,
  mayDeleteComment: Boolean = false,
  mayCreatePage: Boolean = false,
  mayPostComment: Boolean = false,
  maySee: Option[Boolean] = None,
  debugCode: String = "") {

  require(maySee.isNot(false) || (!mayEditPage && !mayEditComment && !mayEditWiki &&
      !mayDeletePage && !mayDeleteComment && !mayCreatePage && !mayPostComment), "EdE2WKB5FD")

  def addRemovePermissions(permissions: PermsOnPages, debugCode: String) = MayWhat(
    mayEditPage = permissions.mayEditPage.getOrElse(mayEditPage),
    mayEditComment = permissions.mayEditComment.getOrElse(mayEditComment),
    mayEditWiki = permissions.mayEditWiki.getOrElse(mayEditWiki),
    mayDeletePage = permissions.mayDeletePage.getOrElse(mayDeletePage),
    mayDeleteComment = permissions.mayDeleteComment.getOrElse(mayDeleteComment),
    mayCreatePage = permissions.mayCreatePage.getOrElse(mayCreatePage),
    mayPostComment = permissions.mayPostComment.getOrElse(mayPostComment),
    maySee = permissions.maySee.orElse(maySee),
    debugCode)

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

  val MayPerhapsSee: MayWhat = MayWhat.mayNotSee("EdMMBYSEE").copy(maySee = None)

  val MayEverything: MayWhat = MayWhat(mayEditPage = true, mayEditComment = true,
    mayEditWiki = true, mayDeletePage = true, mayDeleteComment = true, mayCreatePage = true,
    mayPostComment = true, maySee = Some(true), "EdMMALL")

  def mayNotSee(debugCode: String) = MayWhat(
    mayEditPage = false, mayEditComment = false, mayEditWiki = false,
    mayDeletePage = false, mayDeleteComment = false, mayCreatePage = false,
    mayPostComment = false, maySee = Some(false), debugCode)

}
