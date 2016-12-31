/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
import debiki.DebikiHttp._
import io.efdi.server.http._




trait AuthzSiteDaoMixin {
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao with
    debiki.dao.PagePathMetaDao with debiki.dao.PostsDao =>


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Option[User]): (Boolean, String) = {
    maySeePageImpl(pageMeta, user, anyTransaction = None)
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
        anyTransaction: Option[SiteTransaction]): (Boolean, String) = {
    // delete other impl:  [2KWU043YU1]
    if (user.exists(_.isAdmin))
      return (true, "")

    if (!user.exists(_.isStaff)) {
      pageMeta.categoryId match {
        case Some(categoryId) =>
          val categories = anyTransaction.map(_.loadCategoryPathRootLast(categoryId)) getOrElse
              loadCategoriesRootLast(categoryId)
          if (categories.exists(_.staffOnly))
            return (false, "EsE8YGK25-Staff-Only-Cat")
          if (categories.exists(_.isDeleted))
            return (false, "EdE5PK2WS-Cat-Deleted")
        case None =>
        // Fine, as of now, let everyone view pages not placed in any category, by default.
      }

      pageMeta.pageRole match {
        case PageRole.SpecialContent | PageRole.Code =>
          return (false, "EsE4YK02R-Code")
        case _ =>
        // Fine.
      }

      val onlyForAuthor = pageMeta.isDeleted // later: or if !isPublished
      if (onlyForAuthor && !user.exists(_.id == pageMeta.authorId))
        return (false, "EsE5GK702-Page-Deleted")
    }

    if (pageMeta.pageRole.isPrivateGroupTalk) {
      val theUser = user getOrElse {
        return (false, "EsE4YK032-No-User")
      }

      if (!theUser.isMember)
        return (false, "EsE2GYF04-Is-Guest")

      val memberIds = loadMessageMembers(pageMeta.pageId)
      if (!memberIds.contains(theUser.id))
        return (false, "EsE5K8W27-Not-Page-Member")
    }
    else {
      // Later:
      // return (false, "EdE0YK25-No-Category")? Merge with `pageRole match ...` above.
    }

    (true, "")
  }


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePostUseCache(pageId: PageId, postNr: PostNr, user: Option[User]): (Boolean, String) = {
    maySeePostImpl(pageId, postNr, user, anyPost = None, anyTransaction = None)
  }


  def maySeePostUseCache(post: Post, pageMeta: PageMeta, user: Option[User]): (Boolean, String) = {
    maySeePostImpl(null, -1, user, anyPost = Some(post), anyPageMeta = Some(pageMeta),
      anyTransaction = None)
  }


  def throwIfMayNotSeePost(post: Post, author: Option[User])(transaction: SiteTransaction) {
    val (may, debugCode) =
      maySeePostImpl(post.pageId, post.nr, author, anyPost = Some(post),
        anyTransaction = Some(transaction))
    if (!may)
      throwIndistinguishableNotFound(s"EdE4KFA20-$debugCode")
  }


  def maySeePostImpl(pageId: PageId, postNr: PostNr, user: Option[User],
        anyPost: Option[Post], anyPageMeta: Option[PageMeta] = None,
        anyTransaction: Option[SiteTransaction]): (Boolean, String) = {

    require(anyPageMeta.isDefined ^ (pageId ne null), "EdE25KWU24")
    require(anyPost.isDefined ^ (postNr >= 0), "EdE3DJ8A0")

    val pageMeta = anyPageMeta getOrElse {
      anyTransaction.map(_.loadPageMeta(pageId)).getOrElse(getPageMeta(pageId)) getOrElse {
        // Apparently the page was just deleted.
        return (false, "5KFUP2R0-Page-Not-Found")
      }
    }

    val (maySeePage, debugCode) = maySeePageImpl(pageMeta, user, anyTransaction)
    if (!maySeePage)
      return (false, s"$debugCode-ABX94WN")

    val post = anyPost orElse loadPost(pageId, postNr) getOrElse {
      return (false, "7URAZ8S-Post-Not-Found")
    }

    def isStaffOrAuthor =
      user.exists(_.isStaff) || user.exists(_.id == post.createdById)

    if (post.isDeleted && !isStaffOrAuthor)
      return (false, "6PKJ2RU-Post-Deleted")

    (true, "")
  }


  def throwIfMayNotCreatePageIn(categoryId: CategoryId, user: Option[User])(
        transaction: SiteTransaction) {
    if (user.exists(_.isStaff))
      return

    val categories = transaction.loadCategoryPathRootLast(categoryId)
    if (categories.exists(_.staffOnly))
      throwIndistinguishableNotFound("EsE5PWX29")
    if (categories.exists(_.onlyStaffMayCreateTopics))
      throwForbidden2("EsE8YK3W2", "You may not start new topics in this category")
  }

  def throwIfMayNotPostTo(page: Page, postAuthor: User)(transaction: SiteTransaction) {
    throwIfMayNotSeePage(page, Some(postAuthor))(transaction)
    if (!page.role.canHaveReplies)
      throwForbidden2("EsE8YGK42", s"Cannot post to page type ${page.role}")

    // Mind maps can easily get messed up by people posting comments. So, for now, only
    // allow the page author + staff to add stuff to a mind map. [7KUE20]
    if (page.role == PageRole.MindMap) {
      if (postAuthor.id != page.meta.authorId && !postAuthor.isStaff)
        throwForbidden("EsE6JK4I0", s"Only the page author and staff may edit this mind map")
    }

  }

}


