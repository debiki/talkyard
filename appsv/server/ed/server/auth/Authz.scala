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
  catsRootLast: immutable.Seq[Category]) extends AuthzContext

case class PageAuthzContext(
  requester: Option[User],
  permissions: immutable.Seq[PermsOnPages],
  catsRootLast: immutable.Seq[Category],
  pageMeta: PageMeta,
  pageMembers: Option[Set[UserId]]) extends AuthzContext {

  require(!pageMeta.pageRole.isPrivateGroupTalk || pageMembers.isDefined, "EdE6LPK2A0")
  require(pageMeta.categoryId.isDefined == catsRootLast.nonEmpty, "EdE0WYK15")
  require(!pageMeta.categoryId.exists(_ != catsRootLast.head.id), "EdE3GPJU0")
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

    val mayWhat = checkPermsOnPages(
          Some(user), groupIds, pageMeta = None, pageMembers = None,
          catsRootLast = inCategoriesRootLast, tooManyPermissions)

    def isPrivate = pageRole.isPrivateGroupTalk && groupIds.nonEmpty &&
      inCategoriesRootLast.isEmpty

    if (mayWhat.maySee.isEmpty && isPrivate) {
      // Ok, may see.
    }
    else if (mayWhat.maySee isNot true) {
      return NoNotFound(s"TyEM0CR0SEE_-${mayWhat.debugCode}")
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


  def maySeePage(
    pageMeta: PageMeta,
    user: Opt[Pat],
    groupIds: immutable.Seq[GroupId],
    pageMembers: Set[UserId],
    catsRootLast: immutable.Seq[Cat],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Bo = true): MayMaybe = {

    val mayWhat = checkPermsOnPages(
          user, groupIds, Some(pageMeta), Some(pageMembers),
          catsRootLast = catsRootLast, tooManyPermissions,
          maySeeUnlisted = maySeeUnlisted)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0SEE_-${mayWhat.debugCode}")

    Yes
  }


  def maySeeCategory(authzCtx: AuthzContext, catsRootLast: immutable.Seq[Category])
        : MayWhat = {
    checkPermsOnPages(authzCtx.requester, authzCtx.groupIdsUserIdFirst,
          pageMeta = None, pageMembers = None, catsRootLast = catsRootLast,
          authzCtx.tooManyPermissions, maySeeUnlisted = false)
  }


  def maySeePost(): MayMaybe = {
    // Later. For now, can use ed.server.auth.AuthzSiteDaoMixin
    // maySeePostUseCache.
    unimpl("maySeePost TyE28456rMP")
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
    val mayWhat = checkPermsOnPages(
          Some(user), groupIds, Some(pageMeta),
          Some(privateGroupTalkMemberIds), catsRootLast = inCategoriesRootLast,
          tooManyPermissions)

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
    val mayWhat = checkPermsOnPages(
          Some(user), groupIds, Some(pageMeta),
          Some(privateGroupTalkMemberIds), catsRootLast = inCategoriesRootLast,
          tooManyPermissions)

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
    val mayWhat = checkPermsOnPages(
          Some(member), groupIds, Some(pageMeta),
          Some(privateGroupTalkMemberIds), catsRootLast = inCategoriesRootLast,
          tooManyPermissions)

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

    val mayWhat = checkPermsOnPages(
          user, groupIds, Some(pageMeta), None, catsRootLast = inCategoriesRootLast,
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
    user: Opt[Pat],
    groupIds: immutable.Seq[GroupId],
    pageMeta: Opt[PageMeta],
    pageMembers: Opt[Set[UserId]],
    catsRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Bo = true): MayWhat = {

    // Admins, but not moderators, have access to everything.
    // Why not mods? Can be good with a place for members to bring up problems
    // with misbehaving mods, where those mods cannot read and edit & delete
    // the discussions. [mods_not_all_perms]
    if (user.exists(_.isAdmin))
      return MayEverything

    val isStaff = user.exists(_.isStaff)
    val isOwnPage = user.exists(u => pageMeta.exists(_.authorId == u.id))

    // For now, don't let people see pages outside any category. Hmm...?
    // (<= 1 not 0: don't count the root category, no pages should be placed directly in them.)
    /* Enable this later, need to migrate test cases first.
    if (catsRootLast.length <= 1 && !pageRole.exists(_.isPrivateGroupTalk))
      return MayWhat.mayNotSee("EdMNOCATS")
    */

    var mayWhatForPage = MayPerhapsSee
    var isPageMember = false


    // ----- Check page

    pageMeta foreach { meta =>
      // The parent category must be the same in the page meta, as in catsRootLast.
      catsRootLast.headOption foreach { parentCategory =>
        dieIf(!meta.categoryId.contains(parentCategory.id), "EdE5PBSW2")
      }

      // These page types are for admins only.
      if (meta.pageType == PageType.SpecialContent || meta.pageType == PageType.Code)
        return MayWhat.mayNotSee("EdE0SEEISCODE")

      if (meta.isHidden && !isStaff && !isOwnPage)
        return MayWhat.mayNotSee("EdE0SEEPAGEHIDDEN_")

      // In one's own mind map, one may edit all nodes, even if posted by others. [0JUK2WA5]
      if (meta.pageType == PageType.MindMap && (isOwnPage || isStaff))
        mayWhatForPage = mayWhatForPage.copy(
              mayEditPage = true,
              debugCode = "EdMEDOWNMINDM")

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

        isPageMember = true
        mayWhatForPage = mayWhatForPage.copy(
            mayPostComment = true,
            maySee = Some(true),
            debugCode = "EdMMMEMBR")
      }
    }


    // ----- Check whole site

    var mayWhatForSite = MayPerhapsSee

    val relevantPermissions = tooManyPermissions filter { permission =>  // [7RBBRY2]
      groupIds.contains(permission.forPeopleId)
    }

    // We'll start with no permissions, at the top category, and loop through all categories
    // down to the category in which the page is placed, and add/remove permissions along the way.
    // Move these pageMeta checks to 'Check page' above?
    val isForumPage = pageMeta.exists(_.pageType == PageType.Forum)
    val isPageDeleted = pageMeta.exists(_.isDeleted)

    // Later: return may-not-see also if !published?
    if (isPageDeleted && !isStaff) {
      // We need to check both authorId and deletedById: deletedBy == user,
      // but page-author != user, can happen, if the user deletes hens own page
      // — and thereafter, an admin sets the page author to someone else. Then,
      // the user should not able to see or undelete the page any longer.
      // Tests:  delete-pages.2br  TyTE2EDELPG602
      val deletedOwnPage = user exists { theUser =>
        pageMeta.exists(p => p.authorId == theUser.id && p.deletedById.is(theUser.id))
      }
      if (!deletedOwnPage)
        return MayWhat.mayNotSee("TyEPAGEDELD_")
    }

    // For now, hardcode may-see the forum page, otherwise only admins would see it.
    if (isForumPage) {
      mayWhatForSite = mayWhatForSite.copy(
            maySee = Some(true),
            debugCode = "EdMMSEEFORUM")
    }

    val relPermsWholeSite = relevantPermissions.filter(_.onWholeSite.is(true))
    for (p <- relPermsWholeSite) {
      // Random order? So better add permissions only (not remove).  [2LG5F04W]
      mayWhatForSite = mayWhatForSite.addPermissions(p, "EdMMSITEPERM")
    }

    var mayWhat = mayWhatForPage.mergeYes(mayWhatForSite, "TyMMMSSEMGD")

    // Hmm. !maySee here? Could happen if maySee is set to false for Everyone, but true for
    // trust-level >= 1. That'd mean only people who have signed up already, may see this website.
    if (mayWhat.maySee is false) {
      // But maySeeOwn=true has precedence over maySee=false.
      if (!isOwnPage || !mayWhat.maySeeOwn)
        return mayWhat
    }


    // ----- Check categories

    // Skip the root category, cannot set permissions on it. [0YWKG21]
    val catsRootFirst = catsRootLast.reverseIterator
    val catsBaseFirst = catsRootFirst.drop(1)
    var anyCatMayWhat: Opt[MayWhat] = None
    var anyAncestorCatDeleted = false

    for (category <- catsBaseFirst) {
      // Start with a fresh MayWhat here — if pat doesn't somehow have
      // a permission to see this exact category, hen cannot see it, and none
      // of its sub categories (if any).  [see_sub_cat]
      var mayWhatThisCat = MayPerhapsSee

      // What if one permission says Some(yes), another says Some(no), then, may, or not?
      // Currently only Some(yes) or None.  Some(no) not impl [2LG5F04W]
      val relPermsThisCat = relevantPermissions.filter(_.onCategoryId.is(category.id))
      for (p <- relPermsThisCat) {
        mayWhatThisCat = mayWhatThisCat.addPermissions(p, "EdMMSEEADDCATPERM")
      }

      if (category.isDeleted) {
        anyAncestorCatDeleted = true
        if (!isStaff)
          return MayWhat.mayNotSee("TyECATDELD_")
      }

      // (Skip category.unlistTopics here — one may access those topics; they're just
      // sometimes not listed.)
      // [BACKW_COMPAT_PERMS] should remove !isStaff but first need to update some e2e tests.
      if (!isStaff && !maySeeUnlisted && category.unlistCategory)
        return MayWhat.mayNotSee("TyE6WKC0-Unlisted")

      // Abort if we may not see this category — also if maySee is None;
      // that'd mean no permissions have been granted to pat on this category,
      // then, pat may not see it, or any sub cat.  [see_sub_cat]
      if (mayWhatThisCat.maySee isNot true) {
        // But maySeeOwn=true has precedence over maySee=false.
        if (isOwnPage && mayWhatThisCat.maySeeOwn) {
          // Fine, continue.
        }
        else
          return mayWhatThisCat
      }
      anyCatMayWhat = Some(mayWhatThisCat)
    }

    // Only merge with the permissions set directly on the category the page is in.
    // This means it's possible to let people post topics in a sub cat,
    // although they may not post topics in the base cat.
    // (However if they cannot *see* the base cat, then they cannot access any
    // sub cat at all [see_sub_cat].
    anyCatMayWhat foreach { catMayWhat =>
      mayWhat = mayWhat.mergeYes(catMayWhat, "TyMMSEEMRGCATPRM")
    }

    // Do first here, so is-deleted mayWhat fields won't get overwritten
    // in the cat loop above.
    if (isPageDeleted || anyAncestorCatDeleted) {
      mayWhat = mayWhat.copyAsDeleted
    }

    mayWhat
  }

}


/**
  * If maySeeOwn=true, then one may see one's own stuff, even if maySee=false.
  * If maySeePagesOneIsMembOf=true, then one may see pages one has been added to,
  *      even if maySee=false.
  * if mayListUnlistedCat, one get to see a list of topics in the category,
  *      also if the category is unlisted.
  * if mayListUnlistedPages, one get to list pages that are otherwise unlisted.
  *
  * if maySeeSubCatsThatAllow, then, even if pat may not see this cat,
  * hen can still se sub cats that are configured to let pat see them.
  * And maybe reply and create topics in such sub cats,  [see_sub_cat]
  * depending on their permission settings.
  * But by default, if pat cannot see the base cat, then pat cannot see any sub cat,
  * regardless of how the sub cats have been configured.
  * Because it'd be unexpected if an admin moved a Cat C into a Staff-Only cat,
  * and then topics in Cat C stayed publicly visible. Better by default "inherit"
  * the base cat's more restrictive cannot-be-seen behavior.
  * Don't implement  maySeeSubCatsThatAllow  unless really needed!
  */
case class MayWhat(
  mayEditPage: Bo = false,
  mayEditComment: Bo = false,
  mayEditWiki: Bo = false,
  mayEditOwn: Bo = false,
  mayDeletePage: Bo = false,
  mayDeleteComment: Bo = false,
  mayCreatePage: Bo = false,
  mayPostComment: Bo = false,
  maySee: Opt[Bo] = None,
  maySeeOwn: Bo = false,
  // maySeePagesOneIsMembOf: Bo = false
  // mayListUnlistedCat
  // mayListUnlistedPages   [maySeeUnlisted]
  // maySeeSubCatsThatAllow
  debugCode: St = "") {

  require(maySee.isNot(false) || (!mayEditPage && !mayEditComment && !mayEditWiki &&
        !mayDeletePage && !mayDeleteComment && !mayCreatePage && !mayPostComment),
        "TyE2WKB5FD")

  def addPermissions(perms: PermsOnPages, debugCode: St): MayWhat = {
    // Currently there's only:  None  or  Some(true)  but no Some(false),  [2LG5F04W]
    // so we're *adding* permissions, only  — the getOrElse below cannot
    // change the maySomething to false.
    // Later: If any permission is Some(false), then, that has precedence
    // over everything else (except for being admin)  ?  [may_not_perms]
    dieIf(com.debiki.core.isDevOrTest && (
          perms.mayEditPage.is(false) ||
          perms.mayEditComment.is(false) ||
          perms.mayEditWiki.is(false) ||
          perms.mayEditOwn.is(false) ||
          perms.mayDeletePage.is(false) ||
          perms.mayDeleteComment.is(false) ||
          perms.mayCreatePage.is(false) ||
          perms.mayPostComment.is(false) ||
          perms.maySee.is(false) ||
          perms.maySeeOwn.is(false)), "TyE502MSKP5", s"Weird perms: $perms")

    MayWhat(
          mayEditPage = perms.mayEditPage.getOrElse(mayEditPage),
          mayEditComment = perms.mayEditComment.getOrElse(mayEditComment),
          mayEditWiki = perms.mayEditWiki.getOrElse(mayEditWiki),
          mayEditOwn = perms.mayEditOwn.getOrElse(mayEditOwn),
          mayDeletePage = perms.mayDeletePage.getOrElse(mayDeletePage),
          mayDeleteComment = perms.mayDeleteComment.getOrElse(mayDeleteComment),
          mayCreatePage = perms.mayCreatePage.getOrElse(mayCreatePage),
          mayPostComment = perms.mayPostComment.getOrElse(mayPostComment),
          maySee = perms.maySee.orElse(maySee),
          maySeeOwn = perms.maySeeOwn.getOrElse(maySeeOwn),
          debugCode = s"${this.debugCode}-$debugCode")
    }

  def mergeYes(other: MayWhat, debugCode: St): MayWhat = {
    // Currently all perms are additive: Yes or absent (implicit No).  [may_not_perms]
    MayWhat(
          mayEditPage = other.mayEditPage || mayEditPage,
          mayEditComment = other.mayEditComment || mayEditComment,
          mayEditWiki = other.mayEditWiki || mayEditWiki,
          mayEditOwn = other.mayEditOwn || mayEditOwn,
          mayDeletePage = other.mayDeletePage || mayDeletePage,
          mayDeleteComment = other.mayDeleteComment || mayDeleteComment,
          mayCreatePage = other.mayCreatePage || mayCreatePage,
          mayPostComment = other.mayPostComment || mayPostComment,
          maySee = PermsOnPages.merge(other.maySee, maySee),
          maySeeOwn = other.maySeeOwn || maySeeOwn,
          debugCode = s"${this.debugCode}-${other.debugCode}-$debugCode")
  }


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

  def mayNotSee(debugCode: St): MayWhat = MayWhat(
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

  case object NopeNoSuchPage extends MaySeeOrWhyNot(5)
  case object NopeNoPostWithThatNr extends MaySeeOrWhyNot(3)  // RENAME NopeNoSuchPost
  case object NopePostNotApproved extends MaySeeOrWhyNot(6)
  case object NopePostDeleted extends MaySeeOrWhyNot(4)

}

