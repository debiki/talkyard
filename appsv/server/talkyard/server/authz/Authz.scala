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

package talkyard.server.authz

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp.throwForbidden
import scala.collection.immutable
import MayMaybe._
import MayWhat._


sealed abstract class MayMaybe(private val may: Boolean) { def mayNot: Boolean = !may }
object MayMaybe {
  case object Yes extends MayMaybe(true)
  case class NoMayNot(code: String, reason: String) extends MayMaybe(false)
  case class NoNotFound(debugCode: String) extends MayMaybe(false)
}


sealed trait AuthzCtx {
  def requester: Opt[Pat]
  def groupIdsUserIdFirst: immutable.Seq[GroupId]

  final def isStaff: Bo = requester.exists(_.isStaff)
  final def isAdmin: Bo = requester.exists(_.isAdmin)

  if (requester.isEmpty) {
    // Strangers cannot be members of any group except for the Everyone group.
    require(groupIdsUserIdFirst == List(Group.EveryoneId),
      s"Bad stranger groups, should be [EveryoneId] but is: $groupIdsUserIdFirst [TyE30KRGV2]")
    // It's fine, though, if tooManyPermissions includes permissions for
    // other groups — such permissions get excluded, later [7RBBRY2].
  }

  final def groupIdsEveryoneLast: immutable.Seq[GroupId] = {
    if (requester.exists(_.isGroup)) {
      die("TyEs024HRS25", "Trying to authz as a group")  // [imp-groups]
    }
    else if (requester.exists(_.isAnon)) {
      die("TyEs024HRS28", "Trying to authz as an anonym")
    }
    else if (groupIdsUserIdFirst.length >= 2) {
      dieIf(requester.map(_.id) isNot groupIdsUserIdFirst.head, "TyE2AKBR05")
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

  // [who_sees_refid]
  final def maySeeExtIds: Bo = requester.exists(_.isAdmin)
}


/** Says what details about a person, the requester may see — maybe only username,
  * or also full name? Bio? Location? Posting history? Etc.
  * That is, members will be able to configure how visible their user profile should be
  * e.g. one can let only >= Trusted members see one's full name or bio.
  * Currently not so very implemented.  [perms_thoughts] [private_pats]
  * Will use the  group_participants3  table renamed to  perms_on_pats_t.
  */
trait AuthzCtxOnPats extends AuthzCtx {
}


/** Quicker to create than a full AuthzCtxOnForum, but lacks info about what cats
  * and forum pages the reqer may see. However, enough for access checking DM:s
  * (then, having been added to a DM, or being member of a group that's been
  * added to the DM, is enough).
  */
case class AuthzCtxOnPatsNoReqer(
  groupIdsUserIdFirst: ImmSeq[GroupId],
  // tooManyPermsOnPats: ImmSeq[PermsOnPats], — later
  )
  extends AuthzCtx with AuthzCtxOnPats {

  def requester: Opt[Pat] = None
}


sealed trait WithReqer {
  def theReqer: Pat
}


trait AuthzCtxWithReqer extends AuthzCtx with AuthzCtxOnPats with WithReqer {
  def requester: Opt[Pat] = Some(theReqer)
}

case class AuthzCtxOnPatsWithReqer(theReqer: Pat, groupIdsUserIdFirst: ImmSeq[MemId])
  extends AuthzCtxWithReqer {}


trait AuthzCtxOnPages extends AuthzCtx {
  def tooManyPermissions: ImmSeq[PermsOnPages]
}


/** AuthZ info about the requester (if any) on both contents and other participants.
  */
trait AuthzCtxOnAll extends AuthzCtx with AuthzCtxOnPats with AuthzCtxOnPages {
  def isPublic: Bo = requester.isEmpty
}

/** Includes permission info about all types of things in the community,
  * e.g. not just pages, but also pats and tags/badges.
  */
// REFACTOR: Change to AuthzCtxOnAllNoReqer and use AuthzCtxOnAllWithReqer if there is a requer?
// And use trait AuthzCtxOnAll at other places, insetad of this impl class.
// groupIdsUserIdFirst would be just Some(EveryoneId)? (a list of len 1)
case class AuthzCtxOnForum(
  requester: Opt[Pat],
  groupIdsUserIdFirst: immutable.Seq[GroupId],
  // rename to tooManyPermsOnPages? Will also be a tooManyPermsOnPats, see above.
  tooManyPermissions: immutable.Seq[PermsOnPages],
  )
  extends AuthzCtxOnAll {}


case class AuthzCtxOnAllWithReqer(
  theReqer: Pat,
  groupIdsUserIdFirst: ImmSeq[GroupId],
  tooManyPermissions: ImmSeq[PermsOnPages],
  )
  extends AuthzCtxOnAll with AuthzCtxWithReqer {
}



/*  Delete this?
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
    var canSeeOthersEmailAdrs = false
    for (group <- groupsAnyOrder) {
      val perms = group.perms
      maxUpl = maxOfAnyInt32(maxUpl, perms.maxUploadBytes)
      uplExts ++= perms.allowedUplExtensionsAsSet
      canSeeOthersEmailAdrs ||= perms.canSeeOthersEmailAdrs.is(true) || group.isAdmin
    }

    maxUpl = minOfAnyInt32(maxUpl, Some(permsOnSite.maxUploadSizeBytes))

    EffPatPerms(
          maxUploadSizeBytes = maxUpl.get,
          allowedUploadExtensions = uplExts.toSet,
          canSeeOthersEmailAdrs = canSeeOthersEmailAdrs)
  }



  def mayCreatePage(
    userAndLevels: AnyUserAndLevels,
    asAlias: Opt[WhichAliasPat],
    groupIds: immutable.Seq[GroupId],
    pageRole: PageType,
    bodyPostType: PostType,
    pinWhere: Option[PinPageWhere],
    anySlug: Option[String],
    anyFolder: Option[String],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val anyUser: Opt[Pat] = userAndLevels.anyUser

    val mayWhat = checkPermsOnPages(
          anyUser, asAlias = asAlias, groupIds,
          // Doesnt' yet exist.
          pageMeta = None, pageAuthor = None, pageMembers = None,
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

    if (!anyUser.exists(_.isStaff)) {
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


  /* Wasn't needed?
  def maySeePage(pageMeta: PageMeta, authzCtx: ForumAuthzContext, pageMembers: Set[UserId],
          catsRootLast: immutable.Seq[Category], maySeeUnlisted: Bo,
          ): MayWhat = {
    checkPermsOnPages(authzCtx.requester, authzCtx.groupIdsUserIdFirst,
          Some(pageMeta), pageMembers = Some(pageMembers), catsRootLast = catsRootLast,
          authzCtx.tooManyPermissions, maySeeUnlisted = false)
  } */


  COULD_OPTIMIZE // Check many pages in the same cat at once?  [authz_chk_mny_pgs]
  // That is, pageMeta —> pageMetas: Seq[PageMeta]. But they must all be in
  // the same cat (or no cat).
  def maySeePage(
    pageMeta: PageMeta,
    user: Opt[Pat],
    groupIds: immutable.Seq[GroupId],
    pageAuthor: Pat,
    pageMembers: Set[UserId],
    catsRootLast: immutable.Seq[Cat],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Bo = true): MayMaybe = {

    val mayWhat = checkPermsOnPages(
          user,
          // [pseudonyms_later] Maybe should matter, for pseudonyms? If a pseudonym
          // gets added to a group, maybe it's good if one's true user cannot
          // accidentally post in a new category, just because one's pseudonym got
          // added there? [deanon_risk]  But for a start, simpler to just not
          // support granting permissions to pseuonyms.
          asAlias = None, // doesn't matter when deriving `maySee`
          groupIds, Some(pageMeta), pageAuthor = Some(pageAuthor), Some(pageMembers),
          catsRootLast = catsRootLast, tooManyPermissions,
          maySeeUnlisted = maySeeUnlisted)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0SEE_-${mayWhat.debugCode}")

    Yes
  }


  COULD // add a new permission that says if sbd may edit page properties, [page_props_perms]
  // e.g. move to another category, or change the page type? But might not be
  // allowed to edit the title or OriginalPost?
  // mayEditPageBody, mayEditPageTitle, mayEditPageProps? Maybe unless the admins
  // enable "complicated settings", by default, mayEditPageTitle & mayEditPageProps
  // would be the same — or all 3 would be the same, like now?
  //
  /** If pat may edit the page title & body, and settings e.g. page type,
    * and open/close it, delete/undeleted, move to another category.
    *
    * @param pat The user or guest who wants to edit the page.
    * @param asAlias If pat is editing the page anonymously or pseudonymously.
    * @param pageAuthor Needed, to know if `pat` is actually the true page author,
    *     but maybe created the page anonymously or pseudonymously, using alias `asAlias`.
    * @param groupIds `pat`s group ids.
    */
  def mayEditPage(
        pageMeta: PageMeta,
        pat: Pat,
        asAlias: Opt[WhichAliasPat],
        pageAuthor: Pat,
        groupIds: immutable.Seq[GroupId],
        pageMembers: Set[UserId],
        catsRootLast: immutable.Seq[Cat],
        tooManyPermissions: immutable.Seq[PermsOnPages],
        changesOnlyTypeOrStatus: Bo,
        maySeeUnlisted: Bo): MayMaybe = {

    // Any `asAlias` "inherits" may-see-page permissions from the real user (`pat`).
    val mayWhat = checkPermsOnPages(
          Some(pat), asAlias = asAlias, groupIds = groupIds, Some(pageMeta),
          pageAuthor = Some(pageAuthor), pageMembers = Some(pageMembers),
          catsRootLast = catsRootLast, tooManyPermissions,
          maySeeUnlisted = maySeeUnlisted)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0SEE2-${mayWhat.debugCode}")

    val (isOwnPage, ownButWrongAlias) =  _isOwn(pat, asAlias, postAuthor = pageAuthor)

    // For now, Core Members can change page type and doing status, if they
    // can see the page (which we checked just above).  Later, this will be
    // the [alterPage] permission. [granular_perms]
    if (changesOnlyTypeOrStatus && pat.isStaffOrCoreMember) {
      // Fine (skip the checks below).
    }
    else if (isOwnPage) {
      // Do this check in mayEditPost() too?  [.mayEditOwn] [granular_perms]
      BUG // Too restrictive: Might still be ok to edit, if `mayEditPage`.
      if (!mayWhat.mayEditOwn)
        return NoMayNot(s"TyEM0EDOWN-${mayWhat.debugCode}", "")

      // Fine, may edit — if using the correct alias, see _checkDeanonRiskOfEdit().
    }
    // else if (is mind map) — doesn't matter here
    // else if (is wiki) — doesn't matter (mayEditWiki is only for the page text,
    //                      but not the title, page type, category etc)
    else {
      if (!mayWhat.mayEditPage)
        return NoMayNot(s"TyEM0EDPG-${mayWhat.debugCode}", "")
    }

    _checkDeanonRiskOfEdit(isOwn = isOwnPage, ownButWrongAlias = ownButWrongAlias,
          asAlias = asAlias) foreach { mayNot =>
            return mayNot
          }

    // [wiki_perms] Maybe the whole page, and not just each post individually,
    // could be wiki-editable? Then those with wiki-edit-permissions,
    // could change the page type, doing-status, answer-post, title, etc.
    // (But not turning off wiki status or deleting the page?)
    // Or maybe it's better to just grant the Edit Page permission to the
    // relevant people — and wiki means only editing the title & text,
    // maybe doing-status and page-type. What about moving to another category?
    // Would that be incl in wiki persm?

    Yes
  }


  def maySeeCategory(authzCtx: ForumAuthzContext, catsRootLast: immutable.Seq[Category])
        : MayWhat = {
    checkPermsOnPages(authzCtx.requester, asAlias = None, authzCtx.groupIdsUserIdFirst,
          pageMeta = None, pageAuthor = None, pageMembers = None, catsRootLast = catsRootLast,
          authzCtx.tooManyPermissions, maySeeUnlisted = false)
  }


  def maySeePost(): MayMaybe = {
    // Later. For now, can use talkyard.server.auth.AuthzSiteDaoMixin
    // maySeePostUseCache.
    unimpl("maySeePost TyE28456rMP")
  }


  def maySeePostIfMaySeePage(pat: Opt[Pat], post: Post): (MaySeeOrWhyNot, St) = {
    CLEAN_UP // Dupl code, this stuff repeated in Authz.mayPostReply. [8KUWC1]

    // Below: Since the requester may see the page, it's ok if hen learns
    // if a post has been deleted or it never existed? (Probably hen can
    // figure that out anyway, just by looking for holes in the post nr
    // sequence.)

    // Staff may see all posts, if they may see the page. [5I8QS2A]
    ANON_UNIMPL // if post.createdById  is pat's own alias, han is the author and can see it.
    // Don't fix now — wait until true author id is incl in posts3/nodes_t? [posts3_true_id]
    def isStaffOrAuthor =
          pat.exists(_.isStaff) || pat.exists(_.id == post.createdById)

    // Later, [priv_comts]: Exclude private sub threads, also if is staff.

    if (post.isDeleted && !isStaffOrAuthor)
      return (MaySeeOrWhyNot.NopePostDeleted, "6PKJ2RU-Post-Deleted")

    if (!post.isSomeVersionApproved && !isStaffOrAuthor)
      return (MaySeeOrWhyNot.NopePostNotApproved, "6PKJ2RW-Post-0Apr")

    // Later: else if is meta discussion ... [METADISC]

    (MaySeeOrWhyNot.YesMaySee, "")
  }


  /** Sync w ts:  store_mayIReply()
    */
  def mayPostReply(
    userAndLevels: UserAndLevels,
    asAlias: Opt[WhichAliasPat],
    groupIds: immutable.Seq[GroupId],
    postType: PostType,
    pageMeta: PageMeta,
    replyToPosts: immutable.Seq[Post],
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    SHOULD // check perms on post too, not just page.  Need post author. [posts3_true_id]
    val mayWhat = checkPermsOnPages(
          Some(user), asAlias = asAlias, groupIds,
          Some(pageMeta),
          // ANON_UNIMPL: Needed, for maySeeOwn [granular_perms], and later, if there'll be
          // a mayReplyOnOwn permission?
          // But let's wait until true author id is incl in posts3/nodes_t. [posts3_true_id]
          pageAuthor = None,
          pageMembers = Some(privateGroupTalkMemberIds),
          catsRootLast = inCategoriesRootLast, tooManyPermissions)

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


  /* Maybe later:
  def mayAlterPost((    [alterPage]
        ...
        ): MayMaybe = {
  }
  */


  /** Used also for pages, if editing the *text*.
    * Otherwise, for pages, mayEditPage() is used, e.g. to alter page type or
    * move the page to another category.
    *
    * @param ignoreAlias Helpful when just loading the source text to show in
    *   the editor — later, pat can choose [a persona to use for editing the post]
    *   that is allowed to edit it.
    * @param pageAuthor Needed, because of the `maySeeOwn` and `mayEditOwn` permissions.
    * @param postAuthor Needed, because of the `mayEditOwn`.
    */
  def mayEditPost(
    userAndLevels: UserAndLevels,  // CLEAN_UP: just use Pat instead?
    asAlias: Opt[WhichAliasPat],
    groupIds: immutable.Seq[GroupId],
    post: Post,
    postAuthor: Pat,
    pageMeta: PageMeta,
    pageAuthor: Pat,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    ignoreAlias: Bo = false,
    ): MayMaybe = {

    val user = userAndLevels.user

    if (post.isDeleted && !user.isStaff)
      return NoNotFound("TyEM0EDPOSTDELD")

    val mayWhat = checkPermsOnPages(
          Some(user), asAlias = asAlias, groupIds, Some(pageMeta),
          pageAuthor = Some(pageAuthor),
          pageMembers = Some(privateGroupTalkMemberIds), catsRootLast = inCategoriesRootLast,
          tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound(s"TyEM0ED0SEE-${mayWhat.debugCode}")

    val (isOwnPost, ownButWrongAlias) = _isOwn(user, asAlias, postAuthor = postAuthor)
    var mayBecauseWiki = false

    if (isOwnPost) {
      // Fine, may edit — if using the correct alias, see _checkDeanonRiskOfEdit().

      // But shouldn't:  isOwnPost && mayWhat[.mayEditOwn] ?  (2020-07-17)
    }
    else if (pageMeta.pageType == PageType.MindMap) {  // [0JUK2WA5]
      BUG // Too restrictive: Might still be ok to edit, if `mayEditWiki.
      if (!mayWhat.mayEditPage)
        return NoMayNot("TyEM0ED0YOURMINDM", "You may not edit other people's mind maps")
    }
    else if (post.isWiki && mayWhat.mayEditWiki && !post.isTitle) {
      // Fine, may edit.  But exclude titles, for now. Otherwise, could be
      // surprising if an attacker renames a page to sth else, and edits it,
      // and the staff don't realize which page got edited, since renamed?
      // I think titles aren't wikifiable at all, currently, anyway. [alias_ed_wiki]
      mayBecauseWiki = true
    }
    else if (post.isOrigPost || post.isTitle) {
      if (!mayWhat.mayEditPage)
        return NoMayNot("EdEM0ED0YOURORIGP_", "You may not edit other people's pages")
    }
    // Later: else if is meta discussion ... [METADISC]
    else {
      if (!mayWhat.mayEditComment)
        return NoMayNot("EdEM0ED0YOURPOST", "You may not edit other people's comments")
    }

    if (ignoreAlias) {
      // Skip the deanon risk check. (Pat is e.g. just *loading* the source text
      // of something to edit — then, not important to specify the correct alias, since
      // not modifying anything.
    }
    else if (mayBecauseWiki) {
      // The problem that others might guess that your anonym is you, if you
      // edit [a post originally posted as yourself] anonymously, doesn't apply to
      // wiki posts, since "everyone" can edit wiki posts.  [deanon_risk]
    }
    else {
      _checkDeanonRiskOfEdit(isOwn = isOwnPost, ownButWrongAlias = ownButWrongAlias,
            asAlias = asAlias) foreach { mayNot =>
              return mayNot
            }
    }

    Yes
  }


  def mayFlagPost(
    member: User,
    // asAlias — anonymous flags not yet supported
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
          Some(member), asAlias = None, groupIds, Some(pageMeta),
          // Needed for maySeeOwn? [granular_perms]
          // Wait until true author id in posts3/nodes_t. [posts3_true_id]
          pageAuthor = None,
          Some(privateGroupTalkMemberIds), catsRootLast = inCategoriesRootLast,
          tooManyPermissions)

    if (mayWhat.maySee isNot true)
      return NoNotFound("EdEM0FLG0SEE")

    Yes
  }


  def maySubmitCustomForm(
    userAndLevels: AnyUserAndLevels,
    // asAlias — not supported
    groupIds: immutable.Seq[GroupId],
    pageMeta: PageMeta,
    inCategoriesRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val mayWhat = checkPermsOnPages(
          userAndLevels.anyUser, asAlias = None, groupIds,
          Some(pageMeta), pageAuthor = None, pageMembers = None,
          catsRootLast = inCategoriesRootLast,
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
    asAlias: Opt[WhichAliasPat],
    groupIds: immutable.Seq[GroupId],
    pageMeta: Opt[PageMeta],
    pageAuthor: Opt[Pat],
    pageMembers: Opt[Set[UserId]],
    catsRootLast: immutable.Seq[Category],
    tooManyPermissions: immutable.Seq[PermsOnPages],
    maySeeUnlisted: Bo = true,
    ): MayWhat = {

    require(pageMeta.isDefined || pageAuthor.isEmpty, "TyEAUTHORMETA")

    val anyAnonAlias: Opt[Anonym] = asAlias.flatMap(_.anyPat.flatMap(_.asAnonOrNone))
    require(anyAnonAlias.forall(_.anonForPatId == user.getOrDie("TyEALI0USR").id),
          "Anon true id != user id  [TyEANONFORID]")  // [throw_or_may_not]

    // Admins, but not moderators, have access to everything.
    // Why not mods? Can be good with a place for members to bring up problems
    // with misbehaving mods, where those mods cannot read and edit & delete
    // the discussions. [mods_not_all_perms]
    if (user.exists(_.isAdmin))
      return MayEverything

    val isStaff = user.exists(_.isStaff)

    // (We ignore `_ownPageWrongAlias`, because it's about the *page* but we might be
    // interested in a comment on the page. Instead, the caller looks at the comment or
    // page. [alias_0_ed_others])
    //
    val (isOwnPage, _ownPageWrongAlias) = user.flatMap(u => pageAuthor map { thePageAuthor =>
        _isOwn(u, asAlias, postAuthor = thePageAuthor)
    }) getOrElse (false, false)

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
      // Later: If some page members are aliases,  [anon_priv_msgs][anon_chats]
      // need to consider true ids.
      if (meta.pageType.isPrivateGroupTalk) {
        val thePageMembers: Set[MembId] = pageMembers getOrDie "EdE2SUH5G"
        val theUser = user getOrElse {
          return MayWhat.mayNotSee("EdE0SEE0USER")
        }

        if (!theUser.isMember)
          return MayWhat.mayNotSee("EdE0SEE0MBR")

        val userIsMember: Bo = thePageMembers contains theUser.id
        // This is O(n) if `contains` is O(1), otherwise O(n log m), right. [OnLogn]
        val groupIsMember = () => groupIds.exists(gId => thePageMembers contains gId)
        if (!userIsMember && !groupIsMember())
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
      val deletedOwnPage = isOwnPage && user.exists({ theUser =>
        pageMeta.exists(page =>
              // Pat deleted the page as hanself?
              page.deletedById.is(theUser.id) ||
              // Pat deleted the page using an alias? — Since its pat's page (`isOwnPage`),
              // the page author must be pat's alias. Don't think needed: [posts3_true_id]
              pageAuthor.exists(a => page.deletedById.is(a.id)))
      })

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

    // If it's the wrong alias, it's still ok for the requester to look at the thing,
    // but han can't edit anything.
    for (thePageMeta <- pageMeta; anon <- anyAnonAlias) {
      // Is the anonym for this page? (We've checked `anon.anonForPatId` above already.)
      if (anon.anonOnPageId != thePageMeta.pageId)
        // Is it best to throw, or set mayWhat to false?  [throw_or_may_not]
        mayWhat = mayWhat.copyAsMayNothingOrOnlySee("-TyEANONPAGEID")
    }

    // Check if page or category settings allows anonyms. [derive_node_props_on_server]
    // [pseudonyms_later]
    val anyComtsStartAnon: Opt[NeverAlways] =
            pageMeta.flatMap(_.comtsStartAnon).orElse(
                // (Root last — so, the *first* category with `.comtsStartAnon` defined,
                // is the most specific one.)
                catsRootLast.find(_.comtsStartAnon.isDefined).flatMap(_.comtsStartAnon))
    val comtsStartAnon = anyComtsStartAnon getOrElse NeverAlways.NeverButCanContinue

    // Later:
    // if (comtsStartAnon.toInt <= NeverAlways.Never.toInt) {
    //   // Can't even continue being anonymous.
    //   throwForbiddenIf(asAlias.isDefined, ...)
    // }
    // else
    if (comtsStartAnon.toInt <= NeverAlways.NeverButCanContinue.toInt) {
      asAlias foreach {
        case _: WhichAliasPat.LazyCreatedAnon =>
          // Can't create new anonyms here — anon comments aren't enabled, ...
          // (This might be a browser tab left open for long, and category settings
          // got changed, and thereafter the user submitted an anon comment which
          // was previously allowed but now isn't.)
          // (Throw or set mayWhat to false?  [throw_or_may_not])
          throwForbidden("TyEM0MKANON_", "You cannot be anonymous in this category (any longer)")
        case _: WhichAliasPat.SameAnon =>
          // ... But it's ok to continue replying as an already existing anonym —
          // that's the "can continue" in `NeverAlways.NeverButCanContinue`.
          // (So, noop.)
      }
    }
    else {
      // COULD require an alias, if `cat.comtsStartAnon >= NeverAlways.AlwaysButCanContinue`,
      // but not really important now.
    }


    mayWhat
  }


  /** Says if a user or hans alias is the same as a post author. Or if the user
    * is using the wrong alias:
    *
    * Returns two bools, the first says if the post is trueUser' posts. If it is,
    * then, the 2nd says if trueUser is using the wrong alias. Look:
    * - (false, false) = sbd else's post
    * - (true, false) = is trueUser's page, created under alias `asAlias` if defined.
    * - (true, true) = problem: It's trueUser's page, but the wrong alias
    *       (wrong alias includes specifying an alias, when originally posting as oneself).
    * - (false, true) = can't happen: can't be both someone else's page and also
    *     tueUser's alias' page.
    *
    * @param trueUser the one who wants to view/edit/alter the post, possibly using
    *   an anonym or pseudonym `asAlias`.
    * @param asAlias must be `trueUser`s anonym or pseudonym.
    * @param postAuthor – so we can compare the author's true id with trueUser,
    *   for better error messages.
    */
  private def _isOwn(trueUser: Pat, asAlias: Opt[WhichAliasPat], postAuthor: Pat): (Bo, Bo) = {
    val isTrueUsers = trueUser.id == postAuthor.trueId2.trueId
    asAlias.flatMap(_.anyPat) match {
      case None =>
        val isByTrueUsersAlias = isTrueUsers && trueUser.id != postAuthor.id
        // If by an alias, then, we've specified the wrong alias, namely no alias or
        // a not-yet-created `LazyCreatedAnon`.
        val wrongAlias = isByTrueUsersAlias
        (isTrueUsers, wrongAlias)

      case Some(alias) =>
        require(alias.trueId2.trueId == trueUser.id, s"Not trueUser's alias. True user: ${
              trueUser.trueId2}, alias: ${alias.trueId2} [TyE0OWNALIAS1]")
        val correctAlias = alias.id == postAuthor.id
        val ownButWrongAlias = isTrueUsers && !correctAlias
        (isTrueUsers, ownButWrongAlias)
    }
  }


  /** Returns `Some(NoMayNot)` if editing the post using the persona specified
    * (either an alias, if asAlias defined, or as oneself) would mean that others
    * might guess that the anonym you were/are using, is actually you. [deanon_risk] 
    */
  private def _checkDeanonRiskOfEdit(isOwn: Bo, ownButWrongAlias: Bo,
        asAlias: Opt[WhichAliasPat]): Opt[NoMayNot] = {

    // If true user U wrote something as hanself, han should edit it as hanself (as U).
    // Otherwise others might guess that [U's anonym or pseudonym doing the edits], is U.
    //
    ANON_UNIMPL // [mods_ed_own_anon] If user U can edit the page as hanself for
    // *other reasons than* `mayWhat.mayEditOwn`, then, that _is_ok. For example,
    // if U is a mod, then, others can see that han can edit the page because han is
    // a mod — and they can't conclude that han and [the anonym who posted the page]
    // are the same.  Not yet impl though. Currently, need to continue editing
    // anonymously (also if U is admin / mod).
    //
    if (ownButWrongAlias)
      return Some(asAlias.isEmpty
          ? NoMayNot("TyEM0ALIASEDTRUE", // [true_0_ed_alias]
            // (This _is_ok, actually — if pat is a mod or admin. See comment above.)
            o"""You're trying to edit your post as yourself, but you posted it
                      anonymously. Then you should edit it anonymously too.""")
          | NoMayNot("TyEM0TRUEEDALIAS",
            // [pseudonyms_later] Need to edit this message, if might be the wrong
            // pseudonym, not an anonym, that tries to edit.
            o"""You're trying to edit your own post anonymously, but you posted it
                      as yourself. Then you should edit it as yourself too."""))

    // Typically, only few users, say, moderators, can edit *other* people's posts.
    // So, if a mod edits others' posts anonymously, the others could guess that the
    // anonym is one of the moderators, that's no good. [alias_0_ed_others]
    if (!isOwn && asAlias.isDefined)
      return Some(NoMayNot("TyEM0ALIASEDOTHR",
                    "You cannot edit other people's pages anonymously, as of now"))

    // Fine. Posted as oneself, is editing as oneself. Or posted as anon, edits as anon.
    None
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
  // mayAlterPage — later. [alterPage]
  // mayMovePage?
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
    mayPostComment = false,
    debugCode = debugCode + "-CPDELD")

  /** Sets everything to false (no-you-may-not), except for `maySee` and `maySeeOwn` which
    * are left as-is.
    */
  def copyAsMayNothingOrOnlySee(debugCode: St): MayWhat =
    MayWhat().copy( // everything false by default
          maySee = maySee,
          maySeeOwn = maySeeOwn,
          debugCode = this.debugCode + debugCode)

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

