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
import debiki.dao.SiteDao
import ed.server.auth.MayMaybe.{NoMayNot, NoNotFound, Yes}
import ed.server.http._
import scala.collection.immutable




trait AuthzSiteDaoMixin {
  /*
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao with
    debiki.dao.PagePathMetaDao with debiki.dao.PostsDao =>
    */
  self: SiteDao =>


  def getForumAuthzContext(user: Option[User]): ForumAuthzContext = {
    val groupIds = getGroupIds(user)
    val permissions = getPermsForPeople(groupIds)
    ForumAuthzContext(user, groupIds, permissions)
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Option[User], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
    maySeePageImpl(pageMeta, user, anyTransaction = None, maySeeUnlisted = maySeeUnlisted)
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


  @deprecated("now", "use Authz instead and dieOrDenyIf")
  def throwIfMayNotSeePage(page: Page, user: Option[User])(transaction: SiteTransaction) {
    throwIfMayNotSeePage(page.meta, user)(transaction)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, user: Option[User])(transaction: SiteTransaction) {
    val (may, debugCode) = maySeePageImpl(pageMeta, user, Some(transaction))
    if (!may)
      throwIndistinguishableNotFound(s"EdE5FKAW0-$debugCode")
  }


  private def maySeePageImpl(pageMeta: PageMeta, user: Option[User],
        anyTransaction: Option[SiteTransaction], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
    if (user.exists(_.isAdmin))
      return (true, "")

    // Here we load some stuff that might not be needed, e.g. we don't need to load all page
    // members, if we may not see the page anyway because of in which category it's placed.
    // But almost always we need both, anyway, so that's okay, performance wise. And
    // loading everything first, makes it possible to implement AuthzmaySeePage() as
    // a pure function, easy to test.

    val categories: immutable.Seq[Category] =
      pageMeta.categoryId map { categoryId =>
        anyTransaction.map(_.loadCategoryPathRootLast(categoryId)) getOrElse {
          loadAncestorCategoriesRootLast(categoryId)
        }
      } getOrElse Nil

    val memberIds: Set[UserId] =
      anyTransaction.map(_.loadAnyPrivateGroupTalkMembers(pageMeta)) getOrElse {
        getAnyPrivateGroupTalkMembers(pageMeta)
      }

    val groupIds: immutable.Seq[UserId] =
      anyTransaction.map(_.loadGroupIds(user)) getOrElse {
        getGroupIds(user)
      }

    val permissions = anyTransaction.map(_.loadPermsOnPages()) getOrElse {
      getPermsOnPages(categories)
    }

    Authz.maySeePage(pageMeta, user, groupIds, memberIds, categories, permissions,
        maySeeUnlisted) match {
      case Yes => (true, "")
      case mayNot: NoMayNot => (false, mayNot.code)
      case mayNot: NoNotFound => (false, mayNot.debugCode)
    }
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePostUseCache(pageId: PageId, postNr: PostNr, user: Option[User]): (Boolean, String) = {
    maySeePostImpl(pageId, postNr, user, anyPost = None, anyTransaction = None)
  }


  def maySeePostUseCache(post: Post, pageMeta: PageMeta, user: Option[User],
        maySeeUnlistedPages: Boolean): (Boolean, String) = {
    maySeePostImpl(pageId = null, postNr = -1, user, anyPost = Some(post),
      anyPageMeta = Some(pageMeta), maySeeUnlistedPages = maySeeUnlistedPages,
      anyTransaction = None)
  }


  def throwIfMayNotSeePost(post: Post, author: Option[User])(transaction: SiteTransaction) {
    val (may, debugCode) =
      maySeePostImpl(post.pageId, postNr = -1, author, anyPost = Some(post),
        anyTransaction = Some(transaction))
    if (!may)
      throwIndistinguishableNotFound(s"EdE4KFA20-$debugCode")
  }


  def maySeePostImpl(pageId: PageId, postNr: PostNr, user: Option[User],
        anyPost: Option[Post], anyPageMeta: Option[PageMeta] = None,
        maySeeUnlistedPages: Boolean = true, anyTransaction: Option[SiteTransaction])
        : (Boolean, String) = {

    require(anyPageMeta.isDefined ^ (pageId ne null), "EdE25KWU24")
    require(anyPost.isDefined ^ (postNr >= 0), "EdE3DJ8A0")

    val pageMeta = anyPageMeta getOrElse {
      anyTransaction.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
        // Apparently the page was just deleted.
        return (false, "5KFUP2R0-Page-Not-Found")
      }
    }

    val (maySeePage, debugCode) = maySeePageImpl(pageMeta, user, anyTransaction,
          maySeeUnlisted = maySeeUnlistedPages)
    if (!maySeePage)
      return (false, s"$debugCode-ABX94WN")

    CLEAN_UP // Dupl code, this stuff repeated in Authz.mayPostReply. [8KUWC1]

    def thePageId = anyPageMeta.map(_.pageId) getOrElse pageId

    val post = anyPost orElse loadPost(thePageId, postNr) getOrElse {
      return (false, "7URAZ8S-Post-Not-Found")
    }

    def isStaffOrAuthor =
      user.exists(_.isStaff) || user.exists(_.id == post.createdById)

    if (post.isDeleted && !isStaffOrAuthor)
      return (false, "6PKJ2RU-Post-Deleted")

    // Later: else if is meta discussion ... [METADISC]

    (true, "")
  }


  @deprecated("now", "use getPermsForPeople instead?")
  def getPermsOnPages(categories: immutable.Seq[Category]): immutable.Seq[PermsOnPages] = {
    COULD_OPTIMIZE // For now
    readOnlyTransaction { transaction =>
      transaction.loadPermsOnPages()
    }
  }


  def getPermsForEveryone(): immutable.Seq[PermsOnPages] = {
    getPermsForPeople(Vector(Group.EveryoneId))
  }


  def getPermsForPeople(userIds: Iterable[UserId]): immutable.Seq[PermsOnPages] = {
    COULD_OPTIMIZE // For now
    val perms = readOnlyTransaction { transaction =>
      transaction.loadPermsOnPages()
    }
    perms.filter(p => userIds.exists(_ == p.forPeopleId))
  }

}


