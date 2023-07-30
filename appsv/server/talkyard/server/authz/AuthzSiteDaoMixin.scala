/**
 * Copyright (C) 2016-2017 Kaj Magnus Lindberg
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
import debiki.dao.{MemCacheKey, SiteDao, CacheOrTx}
import MayMaybe.{NoMayNot, NoNotFound, Yes}
import talkyard.server.http._
import scala.collection.immutable
import scala.collection.immutable.Seq




trait AuthzSiteDaoMixin {
  /*
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao with
    debiki.dao.PagePathMetaDao with debiki.dao.PostsDao =>
    */
  self: SiteDao =>

  import context.security.throwIndistinguishableNotFound


  def deriveEffPatPerms(groupIdsAnyOrder: Iterable[GroupId]): EffPatPerms = {
    val groups = groupIdsAnyOrder map getTheGroup
    val permsOnSite = getPermsOnSiteForEveryone()
    Authz.deriveEffPatPerms(groups, permsOnSite)
  }


  def getAuthzContextOnPats(pat: Opt[Pat]): AuthzCtxOnPats = {
    val groupIds = getGroupIdsOwnFirst(pat)
    pat match {
      case None => AuthzCtxOnPatsNoReqer(groupIds)
      case Some(thePat) => AuthzCtxOnPatsWithReqer(thePat, groupIds)
    }
  }


  def getAuthzCtxWithReqer(reqer: Pat): AuthzCtxWithReqer = {
    val groupIds = getGroupIdsOwnFirst(Some(reqer))
    AuthzCtxOnPatsWithReqer(reqer, groupIds)
  }


  RENAME // to  ... getPublicAuthzCtxOnAll maybe?
  def getForumPublicAuthzContext(): ForumAuthzContext = {
    getForumAuthzContext(None)
  }


  def getForumAuthzContext(pat: Opt[Pat]): ForumAuthzContext = {
    val groupIds = getGroupIdsOwnFirst(pat)
    val permissions = getPermsForPeople(groupIds)
    AuthzCtxOnForum(pat, groupIds, permissions)
  }


  def anyAuthCtxOnPagesForPat(anyPat: Opt[Pat]): Opt[AuthzCtxOnAllWithReqer] = Some {
    val pat = anyPat getOrElse { return None }
    getAuthzCtxOnPagesForPat(pat)
  }


  def getAuthzCtxOnPagesForPat(pat: Pat): AuthzCtxOnAllWithReqer = {
    val groupIds = getGroupIdsOwnFirst(Some(pat))
    val permissions = getPermsForPeople(groupIds)
    AuthzCtxOnAllWithReqer(pat, groupIds, permissions)
  }


  /** Returns 1) NotSeePage, or 2) if may see it, a PageCtx, which includes
    * page ancestor categories, which typically are needed again in the same request.
    *
    * One may see a page if one has PermsOnPages.maySee on the page's
    * category or tags, or if the page is a private group talk and one was
    * added to it.
    *
    * But if one has added oneself to an open chat, and one can no longer see
    * the category it is in — then one cannot see the chat any longer.
    *
    * (and then one gets removed from the chat: [leave_opn_cht]
    * BUT probably should skip that for open chats?  [page_members_t]  Instead,
    * just look at who have subscribed to chat channel notifications — they'll be
    * members of that chat topic if they can see it, depending on access perms.)
    */
  def maySeePage(pageMeta: PageMeta, pat: Opt[Pat], cacheOrTx: CacheOrTx,
          maySeeUnlisted: Bo = true): SeePageResult = {
    maySeePageImpl(pageMeta, pat, anyTx = cacheOrTx.anyTx,
          maySeeUnlisted = maySeeUnlisted)
  }


  RENAME // to  mayOtherUserSeePage_useCache  ?
  /** Looks up permissions and categories in the mem cache.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Opt[Pat], maySeeUnlisted: Bo = true)
        : SeePageResult = {
    maySeePageImpl(pageMeta, user, anyTx = None, maySeeUnlisted = maySeeUnlisted)
  }

  RENAME // to  mayReqrSeePage_useCache  ?  & explain is only for the current requester
  // — since maySeePageWhenAuthContext() assumes the  [authn_aprvd_checks] checks
  // have been done already.
  //
  // Or combine mayOtherUserSeePage_useCache and mayReqrSeePage_useCache to one: ?
  //
  //   maySeePage_useCache(reqrInf: Opt[ReqrInf], otherPat: Opt[Pat], pageMeta, maySeeUnlisted)
  //
  def maySeePageUseCacheAndAuthzCtx(pageMeta: PageMeta, authzContext: AuthzCtxOnPages,
        maySeeUnlisted: Bo = true): SeePageResult = {
    // This skips the checks in maySeePageImpl() — those checks were done already, for
    // the requester, in PlainApiActions.runBlockIfAuthOk().  [authn_aprvd_checks]
    maySeePageWhenAuthContext(pageMeta, authzContext, anyTx = None,
        maySeeUnlisted = maySeeUnlisted)
  }

  // Hmm should there be a SiteTxDao and a SiteCacheDao? And the TxDao doesn't
  // have any access to the mem cache? (Just to avoid accidentally using it)
  //
  def canStrangersSeePagesInCat_useTxMostly(anyCatId: Opt[CatId], tx: SiteTx): Bo = {
    val everyoneCanSee = anyCatId match {
      case None =>
        // Publicly visible pages are always in some category.
        false
      case Some(catId) =>
        val cats = getAncestorCategoriesRootLast(catId, inclSelfFirst = true, anyTx = Some(tx))
        val result = Authz.maySeeCategory(getForumPublicAuthzContext(), catsRootLast = cats)
        result.maySee is true
    }
    everyoneCanSee
  }

  /*
  def canSeeCategory(catId: CatId, reqr: ReqrInf, otherPat: Opt[Pat], tx: SiteTx): Bo ?
  def canOtherUserSeeCategory(catId: CatId, pa: Opt[Pat], tx: SiteTx): Bo ?
  def canSeeCategory_useTxMostly(catId: CatId, pa: Opt[Pat], tx: SiteTx): Bo ?
  */


  /** Note: If may *probably* see the page. Returns true also for /-/user/... although perhaps
    * in the future in some cases strangers may not see all users. [private_pats]
    */
  def mayStrangerProbablySeeUrlPathUseCache(urlPath: String): Boolean = {
    // Tests:  sso-login-required-w-logout-url.2browsers  TyTE2ESSOLGOURL.TyTE2ELGOURL

    if (urlPath.startsWith("/-/admin"))
      return false

    // If we may see the embedding page, then probably we may see the embedded
    // contents on that page, too.
    if (urlPath.startsWith("/-/embedded-"))
      return true

    // Probably /-/user/some-username — which one may normally access,
    // unless the site requires login to read.
    if (urlPath.startsWith("/-/")) {
      val settings = getWholeSiteSettings()
      return !settings.userMustBeAuthenticated
    }

    val specifiedPath = PagePath.fromUrlPath(siteId, urlPath) match {
      case PagePath.Parsed.Good(path) => path
      case _ => return false
    }

    val validPagePath = checkPagePath(specifiedPath) getOrElse {
      return false
    }

    val pageMeta = getPageMeta(validPagePath.thePageId) getOrElse {
      return false
    }

    val result = maySeePageUseCache(pageMeta, user = None, maySeeUnlisted = true)
    result.maySee
  }


  def throwIfMayNotSeePage(page: Page, pat: Opt[Pat])(tx: SiteTx): U = {
    throwIfMayNotSeePage(page.meta, pat)(tx)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, pat: Opt[Pat])(tx: SiteTx): U = {
    val result = maySeePageImpl(pageMeta, pat, Some(tx))
    if (!result.maySee)
      throwIndistinguishableNotFound(s"TyEM0SEEPG_-${result.debugCode}")
  }


  /** Returns (may-see, debug-code).  If anyTx defined, uses the
    * database, otherwise uses the mem cache.
    */
  private def maySeePageImpl(pageMeta: PageMeta, user: Opt[Pat],
          anyTx: Opt[SiteTx], maySeeUnlisted: Bo = true): SeePageResult = {

    // If `user` is a stranger or suspended, hen may still see the page
    // — if it's public. So don't block user `None` here.  [susp_see_pub]

    if (user.exists(_.isAdmin))
      return PageCtx(anyCats(pageMeta, anyTx))

    val settings = getWholeSiteSettings()
    if (settings.userMustBeAuthenticated) {  // [authn_aprvd_checks]
      if (!user.exists(u => u.isAuthenticated))
        return NotSeePage("TyMLOGINREQ")
    }

    if (settings.userMustBeApproved && !user.exists(_.isApprovedOrStaff))
      return NotSeePage("TyMNOTAPPR")

    val groupIds: immutable.Seq[UserId] =
      anyTx.map(_.loadGroupIdsMemberIdFirst(user)) getOrElse {
        getGroupIdsOwnFirst(user)
      }

    // Even if we load all perms here, we only use the ones for groupIds later. [7RBBRY2].
    val permissions = anyTx.map(_.loadPermsOnPages()) getOrElse {
      getPermsForPeople(groupIds)
    }

    // This gets reconstructed a bit much. [reuse_authz_ctx]
    val authContext = AuthzCtxOnForum(user, groupIds, permissions)
    maySeePageWhenAuthContext(pageMeta, authContext, anyTx,
          maySeeUnlisted = maySeeUnlisted)
  }


  /** Call directly, only if `authzContext` is for the current requester — then,
    * some authn checks have been done already,  in  PlainApiActions.runBlockIfAuthOk().
    * But otherwise, they wouldn't happen.  [authn_aprvd_checks]
    */
  private def maySeePageWhenAuthContext(pageMeta: PageMeta, authzContext: AuthzCtxOnPages,
        anyTx: Opt[SiteTx], maySeeUnlisted: Bo = true): SeePageResult = {

    // Here we load some stuff that might not be needed, e.g. we don't need to load all page
    // members, if we may not see the page anyway because of in which category it's placed.
    // But almost always we need both, anyway, so that's okay, performance wise. And
    // loading everything first, makes it possible to implement Authz.maySeePage() as
    // a pure function, easy to test.

    val categories: immutable.Seq[Category] = anyCats(pageMeta, anyTx)

    if (authzContext.requester.exists(_.isAdmin))
      return PageCtx(categories)

    // (Could optionally also let [someone added to a page by a staff user]
    // see that page, also if it's an open chat (not a private group talk page)
    // [page_members_t].)
    val memberIds: Set[UserId] =
      anyTx.map(_.loadAnyPrivateGroupTalkMembers(pageMeta)) getOrElse {
        getAnyPrivateGroupTalkMembers(pageMeta)
      }

    Authz.maySeePage(pageMeta, authzContext.requester, authzContext.groupIdsUserIdFirst, memberIds,
        categories, authzContext.tooManyPermissions, maySeeUnlisted) match {
      case Yes => PageCtx(categories)
      case mayNot: NoMayNot => NotSeePage(mayNot.code)
      case mayNot: NoNotFound => NotSeePage(mayNot.debugCode)
    }
  }


  private def anyCats(pageMeta: PageMeta, anyTx: Opt[SiteTx]): ImmSeq[Cat] =
    pageMeta.categoryId map { categoryId =>
      anyTx.map(_.loadCategoryPathRootLast(categoryId, inclSelfFirst = true)) getOrElse {
        getAncestorCategoriesRootLast(categoryId, inclSelfFirst = true)
      }
    } getOrElse Nil


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    *
    * Also needs any authn strength? Maybe: WhoInfo = ReqerInfo = Opt[(Pat, Opt[AuthnStrength])]?
    * Maybe Opt[(Pat, AuthnStrength)] where AuthnStrength can be [InternalJob], instead of None?
    */
  def maySeePostUseCache(pageId: PageId, postNr: PostNr, user: Opt[Pat])
        : (MaySeeOrWhyNot, St) = {
    maySeePostImpl(pageId, postNr, user, anyPost = None, anyTx = None)
  }


  def maySeePostUseCache(post: Post, pageMeta: PageMeta, ppt: Option[Participant],
                         maySeeUnlistedPages: Boolean): (MaySeeOrWhyNot, String) = {
    maySeePostImpl(pageId = null, postNr = PageParts.NoNr, ppt, anyPost = Some(post),
      anyPageMeta = Some(pageMeta), maySeeUnlistedPages = maySeeUnlistedPages,
      anyTx = None)
  }


  def throwIfMayNotSeePost(post: Post, ppt: Option[Participant])(tx: SiteTransaction): Unit = {
    val (result, debugCode) = maySeePost(post, ppt, maySeeUnlistedPages = true)(tx)
    if (!result.may)
      throwIndistinguishableNotFound(s"EdE4KFA20-$debugCode")
  }


  def maySeePost(post: Post, ppt: Option[Participant], maySeeUnlistedPages: Boolean)
        (tx: SiteTransaction): (MaySeeOrWhyNot, String) = {
    maySeePostImpl(post.pageId, postNr = PageParts.NoNr, ppt, anyPost = Some(post),
      anyTx = Some(tx))
  }


  private def maySeePostImpl(pageId: PageId, postNr: PostNr, ppt: Opt[Pat],
        anyPost: Opt[Post], anyPageMeta: Opt[PageMeta] = None,
        maySeeUnlistedPages: Bo = true, anyTx: Opt[SiteTx])
        : (MaySeeOrWhyNot, St) = {

    require(anyPageMeta.isDefined ^ (pageId ne null), "EdE25KWU24")
    require(anyPost.isDefined == (postNr == PageParts.NoNr), "TyE3DJ8A0")

    val pageMeta = anyPageMeta getOrElse {
      anyTx.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
        return (MaySeeOrWhyNot.NopeNoSuchPage, "5KFUP2R0-Page-Not-Found")
      }
    }

    val seePageResult = maySeePageImpl(pageMeta, ppt, anyTx,
          maySeeUnlisted = maySeeUnlistedPages)
    if (!seePageResult.maySee)
      return (MaySeeOrWhyNot.NopeUnspecified, s"${seePageResult.debugCode}-ABX94WN")

    CLEAN_UP // Dupl code, this stuff repeated in Authz.mayPostReply. [8KUWC1]

    def thePageId = anyPageMeta.map(_.pageId) getOrElse pageId

    // Below: Since the requester may see the page, it's ok if hen learns
    // if a post has been deleted or it never existed? (Probably hen can
    // figure that out anyway, just by looking for holes in the post nr
    // sequence.)

    val post = anyPost orElse loadPost(thePageId, postNr) getOrElse {
      return (MaySeeOrWhyNot.NopeNoPostWithThatNr, "7URAZ8S-Post-Not-Found")
    }

    // Staff may see all posts, if they may see the page. [5I8QS2A]
    def isStaffOrAuthor =
      ppt.exists(_.isStaff) || ppt.exists(_.id == post.createdById)

    if (post.isDeleted && !isStaffOrAuthor)
      return (MaySeeOrWhyNot.NopePostDeleted, "6PKJ2RU-Post-Deleted")

    if (!post.isSomeVersionApproved && !isStaffOrAuthor)
      return (MaySeeOrWhyNot.NopePostNotApproved, "6PKJ2RW-Post-0Apr")

    // Later: else if is meta discussion ... [METADISC]

    (MaySeeOrWhyNot.YesMaySee, "")
  }


  def throwIfMayNotSeeReviewTaskUseCache(task: ReviewTask, forWho: Who): Unit = {
    TESTS_MISSING // add security test, not e2e test?
    val postId = task.postId getOrElse { return }
    val post = loadPostByUniqueId(postId) getOrDie "TyE5WKBGP"  // there's a foreign key
    // If one has activated a pseudonym, one might need to activate one's main user account
    // instead, to get to review this. — But won't the access-denied error message confusing?
    // Should also lookup one's true account and check if it has access. [pseudonyms_later]
    val requester = getTheParticipant(forWho.id)
    val (result, debugCode) =
      maySeePostImpl(post.pageId, postNr = PageParts.NoNr, Some(requester), anyPost = Some(post),
        anyTx = None)
    if (!result.may)
      throwIndistinguishableNotFound(s"TyEM0REVTSK-$debugCode")
  }


  @deprecated("now", "use getPermsForPeople instead?")
  def getPermsOnPages(categories: immutable.Seq[Category]): immutable.Seq[PermsOnPages] = {
    getAllPermsOnPages().permsOnPages
  }


  def getPermsForEveryone(): immutable.Seq[PermsOnPages] = {
    getPermsForPeople(Vector(Group.EveryoneId))
  }


  // RENAME to getPermsOnPagesFor(...)
  def getPermsForPeople(userIds: Iterable[UserId]): immutable.Seq[PermsOnPages] = {
    val perms = getAllPermsOnPages().permsOnPages
    perms.filter(p => userIds.exists(_ == p.forPeopleId))
  }


  @deprecated("now", "config site wide perms per group instead")  // [more_pat_perms]
  def getPermsOnSiteForEveryone(): PermsOnSite = {
    // Config such perms per group insetad.  Old:  userIds: Iterable[UserId]
    val perms = getAllPermsOnPages().permsOnSite
    // perms.filter(p => userIds.exists(_ == p.forPeopleId))
    // For now:
    dieIf(perms.size != 1, "TyE305RSKGJ2")
    perms.head
  }


  def uncacheAllPermissions(): Unit = {
    memCache.remove(allPermsKey)
  }


  private def getAllPermsOnPages(): PatsDirectPerms = {
    memCache.lookup(
      allPermsKey,
      orCacheAndReturn = {
        Some(readOnlyTransaction { tx =>
          // Deprecated, nowadays per group instead.  [more_pat_perms]
          val everyonesUploadPerms =
                PermsOnSite(
                    forPeopleId = Group.EveryoneId,
                    maxUploadSizeBytes = {
                      if (globals.config.uploads.mayUploadLargeFiles(siteId))
                        globals.config.uploads.maxBytesLargeFile
                      else
                        globals.config.uploads.maxBytesSmallFile
                    })

          PatsDirectPerms(
                permsOnPages = tx.loadPermsOnPages(),
                permsOnSite = Vector(everyonesUploadPerms))
        })
      }).get
  }


  // There typicaly aren't many permissinos — let's say 20 custom groups (unusually many)
  // with 10 permissions each (unusually many). 200 perms in total — that's not much,
  // better load all at once.
  private val allPermsKey: MemCacheKey = MemCacheKey(siteId, "AllPemrs")

}


