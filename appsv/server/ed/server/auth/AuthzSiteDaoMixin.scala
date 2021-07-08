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

package ed.server.auth   // RENAME to talkyard.server.authz

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{MemCacheKey, SiteDao, CacheOrTx}
import ed.server.auth.MayMaybe.{NoMayNot, NoNotFound, Yes}
import ed.server.http._
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


  def getForumPublicAuthzContext(): ForumAuthzContext = {
    getForumAuthzContext(None)
  }


  def getForumAuthzContext(pat: Opt[Pat]): ForumAuthzContext = {
    val groupIds = getGroupIdsOwnFirst(pat)
    val permissions = getPermsForPeople(groupIds)
    ForumAuthzContext(pat, groupIds, permissions)
  }


  /** Returns (may-see, debug-code) where debug-code is any
    * why-forbidden reason code..
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
          maySeeUnlisted: Bo = true): (Bo, St) = {
    maySeePageImpl(pageMeta, pat, anyTx = cacheOrTx.anyTx,
          maySeeUnlisted = maySeeUnlisted)
  }


  /** Returns (may-see: Bo, debug-code: St)
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Opt[Pat], maySeeUnlisted: Bo = true)
        : (Bo, St) = {
    maySeePageImpl(pageMeta, user, anyTx = None, maySeeUnlisted = maySeeUnlisted)
  }

  def maySeePageUseCacheAndAuthzCtx(pageMeta: PageMeta, authzContext: AuthzContext,
        maySeeUnlisted: Bo = true): (Bo, St) = {
    maySeePageWhenAuthContext(pageMeta, authzContext, anyTx = None,
        maySeeUnlisted = maySeeUnlisted)
  }


  /** Note: If may *probably* see the page. Returns true also for /-/user/... although perhaps
    * in the future in some cases strangers may not see all users.
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

    val (maySee, debugCode) = maySeePageUseCache(pageMeta, user = None, maySeeUnlisted = true)
    maySee
  }


  def throwIfMayNotSeePage(page: Page, pat: Opt[Pat])(tx: SiteTx): U = {
    throwIfMayNotSeePage(page.meta, pat)(tx)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, pat: Opt[Pat])(tx: SiteTx): U = {
    val (may, debugCode) = maySeePageImpl(pageMeta, pat, Some(tx))
    if (!may)
      throwIndistinguishableNotFound(s"TyEM0SEEPG_-$debugCode")
  }


  /** Returns (may-see, debug-code).  If anyTx defined, uses the
    * database, otherwise uses the mem cache.
    */
  private def maySeePageImpl(pageMeta: PageMeta, user: Opt[Pat],
          anyTx: Opt[SiteTx], maySeeUnlisted: Bo = true): (Bo, St) = {

    if (user.exists(_.isAdmin))
      return (true, "")

    val settings = getWholeSiteSettings()
    if (settings.userMustBeAuthenticated) {
      if (!user.exists(u => u.isAuthenticated))
        return (false, "TyMLOGINREQ")

      if (settings.userMustBeApproved && !user.exists(_.isApprovedOrStaff))
        return (false, "TyMNOTAPPR")
    }

    val groupIds: immutable.Seq[UserId] =
      anyTx.map(_.loadGroupIdsMemberIdFirst(user)) getOrElse {
        getGroupIdsOwnFirst(user)
      }

    // Even if we load all perms here, we only use the ones for groupIds later. [7RBBRY2].
    val permissions = anyTx.map(_.loadPermsOnPages()) getOrElse {
      getPermsForPeople(groupIds)
    }

    val authContext = ForumAuthzContext(user, groupIds, permissions)
    maySeePageWhenAuthContext(pageMeta, authContext, anyTx,
          maySeeUnlisted = maySeeUnlisted)
  }


  private def maySeePageWhenAuthContext(pageMeta: PageMeta, authzContext: AuthzContext,
        anyTx: Opt[SiteTx], maySeeUnlisted: Bo = true): (Bo, St) = {

    if (authzContext.requester.exists(_.isAdmin))
      return (true, "")

    // Here we load some stuff that might not be needed, e.g. we don't need to load all page
    // members, if we may not see the page anyway because of in which category it's placed.
    // But almost always we need both, anyway, so that's okay, performance wise. And
    // loading everything first, makes it possible to implement AuthzmaySeePage() as
    // a pure function, easy to test.

    val categories: immutable.Seq[Category] =
      pageMeta.categoryId map { categoryId =>
        anyTx.map(_.loadCategoryPathRootLast(categoryId, inclSelfFirst = true)) getOrElse {
          getAncestorCategoriesRootLast(categoryId)
        }
      } getOrElse Nil

    // (Could optionally also let [someone added to a page by a staff user]
    // see that page, also if it's an open chat (not a private group talk page)
    // [page_members_t].)
    val memberIds: Set[UserId] =
      anyTx.map(_.loadAnyPrivateGroupTalkMembers(pageMeta)) getOrElse {
        getAnyPrivateGroupTalkMembers(pageMeta)
      }

    Authz.maySeePage(pageMeta, authzContext.requester, authzContext.groupIdsUserIdFirst, memberIds,
        categories, authzContext.tooManyPermissions, maySeeUnlisted) match {
      case Yes => (true, "")
      case mayNot: NoMayNot => (false, mayNot.code)
      case mayNot: NoNotFound => (false, mayNot.debugCode)
    }
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePostUseCache(pageId: PageId, postNr: PostNr, user: Opt[Pat]) // ReqerInfo = AuthnMtd + Reqer = Pat ?
        : (MaySeeOrWhyNot, String) = {
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

    val (maySeePage, debugCode) = maySeePageImpl(pageMeta, ppt, anyTx,
          maySeeUnlisted = maySeeUnlistedPages)
    if (!maySeePage)
      return (MaySeeOrWhyNot.NopeUnspecified, s"$debugCode-ABX94WN")

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


