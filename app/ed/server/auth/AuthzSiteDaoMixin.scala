/**
 * Copyright (c) 2012-2016 Kaj Magnus Lindberg
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
  self: debiki.dao.CategoriesDao with debiki.dao.MessagesDao =>


  /** Returns true/false, + iff false, a why-forbidden debug reason code.
    */
  def maySeePageUseCache(pageMeta: PageMeta, user: Option[User]): (Boolean, String) = {
    COULD; REFACTOR; // move this fn to PageDao?  [2KWU043YU1]
    if (user.exists(_.isAdmin))
      return (true, "")

    if (!user.exists(_.isStaff)) {
      pageMeta.categoryId match {
        case Some(categoryId) =>
          val categories = loadCategoriesRootLast(categoryId)
          if (categories.exists(_.staffOnly))
            return (false, "EsE8YGK25")
          if (categories.exists(_.isDeleted))
            return (false, "EdE5PK2WS")
        case None =>
        // Fine, as of now, let everyone view pages not placed in any category, by default.
      }

      pageMeta.pageRole match {
        case PageRole.SpecialContent | PageRole.Code =>
          return (false, "EsE4YK02R")
        case _ =>
        // Fine.
      }

      val onlyForAuthor = pageMeta.isDeleted // later: or if !isPublished
      if (onlyForAuthor && !user.exists(_.id == pageMeta.authorId))
        return (false, "EsE5GK702")
    }

    if (pageMeta.pageRole.isPrivateGroupTalk) {
      val theUser = user getOrElse {
        return (false, "EsE4YK032-No-User")
      }

      if (!theUser.isAuthenticated)
        return (false, "EsE2GYF04-Is-Guest")

      val memberIds = loadMessageMembers(pageMeta.pageId)
      if (!memberIds.contains(theUser.id))
        return (false, "EsE5K8W27-Not-Page-Member")
    }

    (true, "")
  }


  def throwIfMayNotSeePost(post: Post, author: Option[User])(transaction: SiteTransaction) {
    val pageMeta = transaction.loadPageMeta(post.pageId) getOrElse
      throwIndistinguishableNotFound("EsE8YJK40")
    throwIfMayNotSeePage(pageMeta, author)(transaction)
    def isStaffOrAuthor = author.exists(_.isStaff) || author.exists(_.id == post.createdById)
    if (post.isDeleted && !isStaffOrAuthor)
      throwIndistinguishableNotFound("EsE8YK04W")
  }


  def throwIfMayNotSeePage(page: Page, user: Option[User])(transaction: SiteTransaction) {
    throwIfMayNotSeePage(page.meta, user)(transaction)
  }


  def throwIfMayNotSeePage(pageMeta: PageMeta, user: Option[User])(transaction: SiteTransaction) {
    SECURITY ; BUG // staff shouldn't get access to private topics   // xx
    // — use ViewPageController.maySeePage instead?  [2KWU043YU1]
    if (!user.exists(_.isStaff)) {
      val ancestors = pageMeta.categoryId match {
        case Some(id) =>
          throwIfMayNotSeeCategory(id, user)(transaction)
        case None =>
          // Deny access unless this is a private messages page.
          if (!pageMeta.pageRole.isPrivateGroupTalk)
            throwIndistinguishableNotFound("EsE0YK25-No-Category")

          if (user.isEmpty)
            throwIndistinguishableNotFound("EsE5PK4Z-No-User")

          val pageMembers = transaction.loadMessageMembers(pageMeta.pageId)
          if (!pageMembers.contains(user.getOrDie("EsE2WY50F3").id))
            throwIndistinguishableNotFound("EsE5GYK0V-Not-Message-Member")
      }
    }
  }


  private def throwIfMayNotSeeCategory(categoryId: CategoryId, user: Option[User])(
        transaction: SiteTransaction) {
    if (user.exists(_.isStaff))
      return

    val categories = transaction.loadCategoryPathRootLast(categoryId)
    if (categories.exists(_.staffOnly))
      throwIndistinguishableNotFound("EsE7YKG25")
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


