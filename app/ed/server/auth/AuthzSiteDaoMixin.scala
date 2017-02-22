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
import ed.server.http._
import scala.collection.immutable




trait AuthzSiteDaoMixin {
  /*
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao with
    debiki.dao.PagePathMetaDao with debiki.dao.PostsDao =>
    */
  self: SiteDao =>


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Option[User], maySeeUnlisted: Boolean = true)
        : (Boolean, String) = {
    maySeePageImpl(pageMeta, user, anyTransaction = None, maySeeUnlisted = maySeeUnlisted)
  }


  def throwIfMayNotSeePageUseCache(pageId: PageId, user: Option[User]) {
    val pageMeta = getThePageMeta(pageId)
    val (may, debugCode) = maySeePageUseCache(pageMeta, user)
    if (!may)
      throwIndistinguishableNotFound(s"EdE2WA7GF4-$debugCode")
  }


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

    val categories: Seq[Category] =
      pageMeta.categoryId map { categoryId =>
        anyTransaction.map(_.loadCategoryPathRootLast(categoryId)) getOrElse {
          loadCategoriesRootLast(categoryId)
        }
      } getOrElse Nil

    val memberIds: Set[UserId] =
      anyTransaction.map(_.loadAnyPrivateGroupTalkMembers(pageMeta)) getOrElse {
        getAnyPrivateGroupTalkMembers(pageMeta)
      }

    Authz.maySeePage(pageMeta, user, categories, memberIds, maySeeUnlisted)
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

    SECURITY; SHOULD // run these tests from Authz.mayPostReply, so cannot reply to sth one mustn't see.

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

    def thePageId = anyPageMeta.map(_.pageId) getOrElse pageId

    val post = anyPost orElse loadPost(thePageId, postNr) getOrElse {
      return (false, "7URAZ8S-Post-Not-Found")
    }

    def isStaffOrAuthor =
      user.exists(_.isStaff) || user.exists(_.id == post.createdById)

    if (post.isDeleted && !isStaffOrAuthor)
      return (false, "6PKJ2RU-Post-Deleted")

    (true, "")
  }


  def getPermsOnPages(categories: immutable.Seq[Category]): immutable.Seq[PermsOnPages] = {
    COULD_OPTIMIZE // For now
    readOnlyTransaction { transaction =>
      transaction.loadPermsOnPages()
    }
  }

}


