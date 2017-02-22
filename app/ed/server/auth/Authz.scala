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


sealed abstract class MayMaybe
object MayMaybe {
  case object Yes extends MayMaybe
  case class NoMayNot(code: String, reason: String) extends MayMaybe
  case class NoNotFound(debugCode: String) extends MayMaybe
}


/** Checks if a member is not allowed to e.g. create pages, post a reply, wikify, ... and so on.
  * And tells you why: all functions returns a why-may-not reason.
  */
object Authz {

  def mayCreatePage(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    pageRole: PageRole,
    bodyPostType: PostType,
    pinWhere: Option[PinPageWhere],
    anySlug: Option[String],
    anyFolder: Option[String],
    inCategoriesRootLast: immutable.Seq[Category],
    relevantPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user

    if (user.isStaff) {
      if (inCategoriesRootLast.exists(_.isDeleted))
        return NoMayNot("EsE0YLE85", "Category deleted")
    }
    else {
      if (inCategoriesRootLast.isEmpty && pageRole != PageRole.FormalMessage)
        return NoMayNot("EsE8GY32", "Only staff may create pages outside any category")

      // Non-staff may not know that the category and page has existed, so use not-found,
      // if staff-only, or deleted:  (112899)

      if (inCategoriesRootLast.exists(_.staffOnly))
        return NoNotFound("EsE5PWX29")

      if (inCategoriesRootLast.exists(_.isDeleted))
        return NoNotFound("EsE2WXT63") // see comment above (112899)

      if (inCategoriesRootLast.exists(_.onlyStaffMayCreateTopics))
        return NoMayNot("EsE8YK3W2", "You may not start new topics in this category")

      if (anySlug.exists(_.nonEmpty))
        return NoMayNot("DwE4KFW87", "Only staff may specify page slug")

      if (pageRole.staffOnly)
        return NoMayNot("DwE5KEPY2", s"Forbidden page type: $pageRole")
    }

    Yes
  }


  def maySeePage(pageMeta: PageMeta, user: Option[User],
        categoriesRootLast: Seq[Category], pageMembers: Set[UserId],
        maySeeUnlisted: Boolean = true): (Boolean, String) = {

    if (user.exists(_.isAdmin))
      return (true, "")

    categoriesRootLast.headOption foreach { parentCategory =>
      dieIf(!pageMeta.categoryId.contains(parentCategory.id), "EdE5PBSW2")
    }

    if (!user.exists(_.isStaff)) {
      if (categoriesRootLast.exists(_.staffOnly))
        return (false, "EsE8YGK25-Staff-Only-Cat")

      if (categoriesRootLast.exists(_.isDeleted))
        return (false, "EdE5PK2WS-Cat-Deleted")

      if (!maySeeUnlisted && categoriesRootLast.exists(_.unlisted))
        return (false, "EdE6WKQ0-Unlisted")

      if (categoriesRootLast.isEmpty) {
        // Fine — as of now, let people see pages placed in no category.
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

      if (!pageMembers.contains(theUser.id))
        return (false, "EsE5K8W27-Not-Page-Member")
    }
    else {
      // Later:
      // return (false, "EdE0YK25-No-Category")? Merge with `categoriesRootLast` checks above.
    }

    (true, "")
  }


  def mayPostReply(
    userAndLevels: UserAndLevels,
    groupIds: immutable.Seq[GroupId],
    postType: PostType,
    pageMeta: PageMeta,
    privateGroupTalkMemberIds: Set[UserId],
    inCategoriesRootLast: immutable.Seq[Category],
    relevantPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user
    val (maySee, debugCode) = maySeePage(pageMeta, Some(user), inCategoriesRootLast,
      privateGroupTalkMemberIds)
    if (!maySee)
      return NoNotFound(s"EdE5ISR8-$debugCode")

    // Mind maps can easily get messed up by people posting comments. So, for now, only
    // allow the page author + staff to add stuff to a mind map. [7KUE20]
    if (pageMeta.pageRole == PageRole.MindMap) {
      if (user.id != pageMeta.authorId && !user.isStaff)
        return NoMayNot("EsE6JK4I0", "Only the page author and staff may edit this mind map")
    }

    if (!pageMeta.pageRole.canHaveReplies)
      return NoMayNot("EsE8YGK42", s"Cannot post to page type ${pageMeta.pageRole}")

    Yes
  }


  def maySubmitCustomForm(
    userAndLevels: AnyUserAndThreatLevel,
    groupIds: immutable.Seq[GroupId],
    pageMeta: PageMeta,
    inCategoriesRootLast: immutable.Seq[Category],
    relevantPermissions: immutable.Seq[PermsOnPages]): MayMaybe = {

    val user = userAndLevels.user
    val (maySee, debugCode) = maySeePage(pageMeta, user, inCategoriesRootLast,
      pageMembers = Set.empty)
    if (!maySee)
      return NoNotFound(s"EdE9NY0M6-$debugCode")

    if (pageMeta.pageRole != PageRole.WebPage && pageMeta.pageRole != PageRole.Form) {
      return NoMayNot("EsE4PBRN2F", s"Cannot submit custom forms to page type ${pageMeta.pageRole}")
    }

    dieUnless(pageMeta.pageRole.canHaveReplies, "EdE5PJWK20")

    Yes
  }

}
