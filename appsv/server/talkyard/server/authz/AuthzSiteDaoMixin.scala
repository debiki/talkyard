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
import debiki.EdHttp.{throwNotFound, throwForbidden, throwForbiddenIf}
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

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}


  def getPatAndPrivPrefs(pat: Pat, allGroups: Vec[Group]): PatAndPrivPrefs = {

    COULD_OPTIMIZE // Cache a by-id map instead / too? (in getAllGroups()) [cache_groups_by_id]
    val allGroupsById: Map[PatId, Group] = Map(allGroups.map(g => g.id -> g): _*)

    val patsGroupIdsMaybeRestr = this.getOnesGroupIds(pat).drop(1) // [own_id_bef_groups]
    val patsGroupsMaybeRestr = patsGroupIdsMaybeRestr flatMap { id =>
            val g = allGroupsById.get(id)
            bugWarnIf(g.isEmpty, "TyENOGROUP0761", s"s$siteId: Group $id missing")
            g
          }

    val patsPrivPrefs = Authz.derivePrivPrefs(pat, patsGroupsMaybeRestr)

    PatAndPrivPrefs(
          pat,
          privPrefsOfPat = patsPrivPrefs,
          patsGroupIds = patsGroupIdsMaybeRestr,
          patsGroups = patsGroupsMaybeRestr)
  }


  /** Derives prefs, like `getPatAndPrivPrefs`, but efficiently for many users at once.
    *
    * Shouldn't this be a pure fn? Doesn't currently need `this`, will it ever?
    */
  def derivePrivPrefs(users: Iterable[UserBr], allGroups: Vec[Group]): ImmSeq[PatAndPrivPrefs] = {
    COULD_OPTIMIZE // Cache a by-id map instead / too? (in getAllGroups()) [cache_groups_by_id]
    val allGroupsById: Map[PatId, Group] = Map(allGroups.map(g => g.id -> g): _*)
    users.to(Vec) map { user =>
      val usersGroupIdsMaybeRestr = Pat.getBuiltInGroupIdsForUser(user)
      val usersGroupsMaybeRestr = usersGroupIdsMaybeRestr flatMap { id =>
        val g = allGroupsById.get(id)
        bugWarnIf(g.isEmpty, "TyENOGROUP0761", s"s$siteId: Group $id missing")
        g
      }

      val usersPrivPrefs = Authz.derivePrivPrefs(user, usersGroupsMaybeRestr)

      PatAndPrivPrefs(
            user,
            usersPrivPrefs,
            usersGroupIdsMaybeRestr,
            usersGroupsMaybeRestr)
    }
  }


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


  def throwIfMayNotSeeCategory2(catId: CatId, reqrTgt: ReqrAndTgt, checkOnlyReqr: Bo = false
          )(anyTx: Opt[SiteTx]): U = {
    val cats = getAncestorCategoriesRootLast(catId, inclSelfFirst = true, anyTx = anyTx)
    def catName = cats.headOption.map(_.idName) getOrElse {
      throwIndistinguishableNotFound(s"TyEM0SEECAT0-0FND")
    }

    {
      val reqrCtx = getForumAuthzContext(Some(reqrTgt.reqr))
      val result: MayWhat = Authz.maySeeCategory(reqrCtx, catsRootLast = cats)
      if (result.maySee isNot true)
        throwIndistinguishableNotFound(s"TyEM0SEECAT1-${result.debugCode}")
    }

    if (reqrTgt.areNotTheSame && !checkOnlyReqr) {
      val targCtx = getForumAuthzContext(reqrTgt.otherTarget)
      val result: MayWhat =  Authz.maySeeCategory(targCtx, catsRootLast = cats)
      if (result.maySee isNot true)
        throwNotFound(s"TyEM0SEECAT2-${result.debugCode}",
              o"${reqrTgt.target.nameParaId} may not see category $catName")
    }
  }


  /** @return the page meta — the caller sort of always needs it.
    */
  def throwIfMayNotSeePage2(pageId: PageId, reqrTgt: AnyReqrAndTgt, checkOnlyReqr: Bo = false
          )(anyTx: Opt[SiteTx]): PageMeta = {
    val pageMeta: PageMeta =
          anyTx.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
            throwIndistinguishableNotFound(s"TyEM0SEEPG1")
          }
    {
      val seePageResult = maySeePageImpl(pageMeta, reqrTgt.anyReqr, anyTx)
      if (!seePageResult.maySee)
        throwIndistinguishableNotFound(s"TyEM0SEEPG2-${seePageResult.debugCode}")
    }

    if (reqrTgt.areNotTheSame && !checkOnlyReqr) {
      COULD_OPTIMIZE // Getting categories and permissions a 2nd time here.
      val res2 = maySeePageImpl(pageMeta, reqrTgt.otherTarget, anyTx)
      if (!res2.maySee) {
        // (It's ok with a more detailed Not Fond message —  we already know that the
        // requester can see the page, so han can figure out that `otherTarget`
        // can't see it, in any case.)
        throwNotFound(s"TyEM0SEEPG3-${res2.debugCode}", s"${reqrTgt.otherTarget.getOrDie(
              "TyE70SKJF4").nameParaId} may not see page $pageId")
      }
    }

    pageMeta
  }


  @deprecated("Use throwIfMayNotSeePage2 instead?")
  def throwIfMayNotSeePage(page: Page, pat: Opt[Pat])(tx: SiteTx): U = {
    throwIfMayNotSeePage(page.meta, pat)(tx)
  }


  RENAME // to throwIfReqrMayNotSeePage ?
  @deprecated("Use throwIfMayNotSeePage2 instead?")
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

    val pageAuthor = this.getParticipant(pageMeta.authorId, anyTx) getOrElse {
      return NotSeePage("TyE0PGAUTHOR2")
    }

    Authz.maySeePage(pageMeta, authzContext.requester,
          authzContext.groupIdsUserIdFirst, pageAuthor = pageAuthor, memberIds,
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
    _maySeePostImpl(ThePost.OnPageWithNr(pageId, postNr), user, anyTx = None)
  }


  def maySeePostUseCache(post: Post, pageMeta: PageMeta, ppt: Option[Participant],
                         maySeeUnlistedPages: Boolean): (MaySeeOrWhyNot, String) = {
    _maySeePostImpl(ThePost.Here(post), ppt,
          anyPageMeta = Some(pageMeta),
          maySeeUnlistedPages = maySeeUnlistedPages, anyTx = None)
  }


  def throwIfMayNotSeePost2(whatPost: WhatPost, reqrTgt: AnyReqrAndTgt,
          checkOnlyReqr: Bo = false)(tx: SiteTx): U = {
    {
      val (result, debugCode) = _maySeePostImpl(
            whatPost, reqrTgt.anyReqr, maySeeUnlistedPages = true, anyTx = Some(tx))
      if (!result.may)
        throwIndistinguishableNotFound(s"TyEREQR0SEEPO-$debugCode")
    }

    // If the request is on behalf of sbd else, e.g. an admin subscribing someone to
    // notifications, require that that other someone can see whatever-it-is.  [2_perm_chks]
    // (Except for some cases, when an admin *removes* e.g. a tag or vote or comment by
    // sbd else — then, it's not necessary for that other person to have access (any longer).)
    if (!checkOnlyReqr && reqrTgt.otherTarget.isDefined) {
      val (res2, code2) = _maySeePostImpl(
            whatPost, reqrTgt.otherTarget, maySeeUnlistedPages = true, anyTx = Some(tx))
      if (!res2.may) {
        // These errors can be confusing? If you *can* see whatever-it-is, but you
        // still get a not-found error? (If the target user can't see it.)
        // So, if the reqr is admin, show the error code anyway.
        throwIndistinguishableNotFound(s"TyETGT0SEEPO-$code2",
              showErrCodeAnyway = reqrTgt.reqrIsAdmin)
      }
    }
  }


  REMOVE // use throwIfMayNotSeePost2() instead.
  def throwIfMayNotSeePost(post: Post, ppt: Option[Participant])(tx: SiteTransaction): Unit = {
    val (result, debugCode) = maySeePost(post, ppt, maySeeUnlistedPages = true)(tx)
    if (!result.may)
      throwIndistinguishableNotFound(s"EdE4KFA20-$debugCode")
  }


  def maySeePost(post: Post, ppt: Opt[Pat],
        // REMOVE `maySeeUnlistedPages` from all `maySee...()`?   It's always true.
        maySeeUnlistedPages: Boolean)
        (tx: SiteTx): (MaySeeOrWhyNot, St) = {
    _maySeePostImpl(ThePost.Here(post), ppt, anyTx = Some(tx))
  }


  private def _maySeePostImpl(whatPost: WhatPost, ppt: Opt[Pat],
        anyPageMeta: Opt[PageMeta] = None,
        maySeeUnlistedPages: Bo = true, anyTx: Opt[SiteTx])
        : (MaySeeOrWhyNot, St) = {

    val post = whatPost match {
      case ThePost.Here(post) => post
      case ThePost.WithId(postId) =>
        loadPostByUniqueId(postId, anyTx) getOrElse {
          return (MaySeeOrWhyNot.NopeNoPostWithThatNr, "7URAZ8T-Post-Id-Not-Found")
        }
      case ThePost.OnPageWithNr(pageId, postNr) =>
        // Or is it better to look up the page first?
        loadPost(pageId, postNr, anyTx) getOrElse {
          return (MaySeeOrWhyNot.NopeNoPostWithThatNr, "7URAZ8S-Post-Not-Found")
        }
    }

    val pageId = post.pageId
    require(anyPageMeta.forall(_.pageId == pageId), "TyE25KWU24")

    val pageMeta = anyPageMeta getOrElse {
      anyTx.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
        return (MaySeeOrWhyNot.NopeNoSuchPage, "5KFUP2R0-Page-Not-Found")
      }
    }

    val seePageResult = maySeePageImpl(pageMeta, ppt, anyTx,
          maySeeUnlisted = maySeeUnlistedPages)
    if (!seePageResult.maySee)
      return (MaySeeOrWhyNot.NopeUnspecified, s"${seePageResult.debugCode}-ABX94WN_")

    Authz.maySeePostIfMaySeePage(ppt, post)
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
          _maySeePostImpl(ThePost.Here(post), Some(requester), anyTx = None)
    if (!result.may)
      throwIndistinguishableNotFound(s"TyEM0REVTSK-$debugCode")
  }


  def throwIfMayNotAlterPage(user: Pat, asAlias: Opt[WhichAliasPat], pageMeta: PageMeta,
         changesOnlyTypeOrStatus: Bo, tx: SiteTx): U = {
    val pageAuthor =
          if (pageMeta.authorId == user.id) user
          else this.getTheParticipant(pageMeta.authorId)

    val catsRootLast = this.getAncestorCategoriesSelfFirst(pageMeta.categoryId)
    val requestersGroupIds = this.getOnesGroupIds(user)
    throwNoUnless(Authz.mayEditPage(
          pageMeta = pageMeta,
          pat = user,
          asAlias = asAlias,
          pageAuthor = pageAuthor,
          groupIds = requestersGroupIds,
          pageMembers = this.getAnyPrivateGroupTalkMembers(pageMeta),
          catsRootLast = catsRootLast,
          tooManyPermissions = this.getPermsOnPages(catsRootLast),
          changesOnlyTypeOrStatus = changesOnlyTypeOrStatus,
          maySeeUnlisted = true), "TyE0ALTERPGP01")
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


