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

package ed.server.auth

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.{MemCacheKey, SiteDao}
import ed.server.auth.MayMaybe.{NoMayNot, NoNotFound, Yes}
import ed.server.http._
import scala.collection.immutable




trait AuthzSiteDaoMixin {
  /*
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao with
    debiki.dao.PagePathMetaDao with debiki.dao.PostsDao =>
    */
  self: SiteDao =>

  import context.security.throwIndistinguishableNotFound


  def getForumPublicAuthzContext(): ForumAuthzContext = {
    getForumAuthzContext(None)
  }


  def getForumAuthzContext(user: Option[Participant]): ForumAuthzContext = {
    val groupIds = getGroupIdsOwnFirst(user)
    val permissions = getPermsForPeople(groupIds)
    ForumAuthzContext(user, groupIds, permissions)
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Option[Participant], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
    maySeePageImpl(pageMeta, user, anyTransaction = None, maySeeUnlisted = maySeeUnlisted)
  }

  def maySeePageUseCacheAndAuthzCtx(pageMeta: PageMeta, authzContext: AuthzContext,
        maySeeUnlisted: Boolean = true): (Boolean, String) = {
    maySeePageWhenAuthContext(pageMeta, authzContext, anyTransaction = None,
        maySeeUnlisted = maySeeUnlisted)
  }


  /** Note: If may *probably* see the page. Returns true also for /-/user/... although perhaps
    * in the future in some cases strangers may not see all users.
    */
  def mayStrangerProbablySeeUrlPathUseCache(urlPath: String): Boolean = {
    if (urlPath.startsWith("/-/admin"))
      return false

    // Probably /-/user/some-username, which one may normally access.
    if (urlPath.startsWith("/-/"))
      return true

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


  def throwIfMayNotSeePage(page: Page, user: Option[Participant])(tx: SiteTx): Unit = {
    throwIfMayNotSeePage(page.meta, user)(tx)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, user: Option[Participant])(tx: SiteTx): Unit = {
    val (may, debugCode) = maySeePageImpl(pageMeta, user, Some(tx))
    if (!may)
      throwIndistinguishableNotFound(s"EdE5FKAW0-$debugCode")
  }


  private def maySeePageImpl(pageMeta: PageMeta, user: Option[Participant],
                             anyTransaction: Option[SiteTransaction], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
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
      anyTransaction.map(_.loadGroupIdsMemberIdFirst(user)) getOrElse {
        getGroupIdsOwnFirst(user)
      }

    // Even if we load all perms here, we only use the ones for groupIds later. [7RBBRY2].
    val permissions = anyTransaction.map(_.loadPermsOnPages()) getOrElse {
      getPermsForPeople(groupIds)
    }

    val authContext = ForumAuthzContext(user, groupIds, permissions)
    maySeePageWhenAuthContext(pageMeta, authContext, anyTransaction, maySeeUnlisted = maySeeUnlisted)
  }


  private def maySeePageWhenAuthContext(pageMeta: PageMeta, authzContext: AuthzContext,
        anyTransaction: Option[SiteTransaction], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
    if (authzContext.requester.exists(_.isAdmin))
      return (true, "")

    // Here we load some stuff that might not be needed, e.g. we don't need to load all page
    // members, if we may not see the page anyway because of in which category it's placed.
    // But almost always we need both, anyway, so that's okay, performance wise. And
    // loading everything first, makes it possible to implement AuthzmaySeePage() as
    // a pure function, easy to test.

    val categories: immutable.Seq[Category] =
      pageMeta.categoryId map { categoryId =>
        anyTransaction.map(_.loadCategoryPathRootLast(categoryId)) getOrElse {
          getAncestorCategoriesRootLast(categoryId)
        }
      } getOrElse Nil

    val memberIds: Set[UserId] =
      anyTransaction.map(_.loadAnyPrivateGroupTalkMembers(pageMeta)) getOrElse {
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
  def maySeePostUseCache(pageId: PageId, postNr: PostNr, user: Option[Participant])
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


  private def maySeePostImpl(pageId: PageId, postNr: PostNr, ppt: Option[Participant],
                             anyPost: Option[Post], anyPageMeta: Option[PageMeta] = None,
                             maySeeUnlistedPages: Boolean = true, anyTx: Option[SiteTransaction])
        : (MaySeeOrWhyNot, String) = {

    require(anyPageMeta.isDefined ^ (pageId ne null), "EdE25KWU24")
    require(anyPost.isDefined == (postNr == PageParts.NoNr), "TyE3DJ8A0")

    val pageMeta = anyPageMeta getOrElse {
      anyTx.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
        // Apparently the page was just deleted.
        return (MaySeeOrWhyNot.NopeUnspecified, "5KFUP2R0-Page-Not-Found")
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
    getAllPermsOnPages()
  }


  def getPermsForEveryone(): immutable.Seq[PermsOnPages] = {
    getPermsForPeople(Vector(Group.EveryoneId))
  }


  def getPermsForPeople(userIds: Iterable[UserId]): immutable.Seq[PermsOnPages] = {
    val perms = getAllPermsOnPages()
    perms.filter(p => userIds.exists(_ == p.forPeopleId))
  }


  def uncacheAllPermissions(): Unit = {
    memCache.remove(allPermsKey)
  }


  private def getAllPermsOnPages(): immutable.Seq[PermsOnPages] = {
    memCache.lookup(
      allPermsKey,
      orCacheAndReturn = {
        Some(readOnlyTransaction { tx =>
          tx.loadPermsOnPages()
        })
      }).get
  }


  // There typicaly aren't many permissinos — let's say 20 custom groups (unusually many)
  // with 10 permissions each (unusually many). 200 perms in total — that's not much,
  // better load all at once.
  private val allPermsKey: MemCacheKey = MemCacheKey(siteId, "AllPemrs")

}


