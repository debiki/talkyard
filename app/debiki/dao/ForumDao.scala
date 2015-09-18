/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.throwNotFound
import java.{util => ju}
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer


/** Creates forums.
  */
trait ForumDao {
  self: SiteDao =>


  def createForum(title: String, folder: String, creatorId: UserId,
        browserIdData: BrowserIdData): PagePath = {
    val titleHtmlSanitized = siteDbDao.commonMarkRenderer.sanitizeHtml(title)
    readWriteTransaction { transaction =>

      // The forum page points to the root category, which points back.
      transaction.deferConstraints()

      val rootCategoryId = transaction.nextCategoryId()

      // Create forum page.
      val (forumPagePath, _) = createPageImpl(
        PageRole.Forum, PageStatus.Published, anyCategoryId = Some(rootCategoryId),
        anyFolder = Some(folder), anySlug = Some(""),
        titleSource = title, titleHtmlSanitized = titleHtmlSanitized,
        bodySource = ForumBodySanitized, bodyHtmlSanitized = ForumBodySanitized,
        showId = false, authorId = creatorId, browserIdData, transaction)

      val forumPageId = forumPagePath.pageId getOrDie "DwE5KPFW2"

      // Create forum root category.
      transaction.insertCategoryMarkSectionPageStale(Category(
        id = rootCategoryId,
        sectionPageId = forumPageId,
        parentId = None,
        name = RootCategoryName,
        slug = RootCategorySlug,
        position = 1,
        description = None,
        newTopicTypes = Nil,
        createdAt = transaction.currentTime,
        updatedAt = transaction.currentTime))

      // Create an Uncategorized category.
      transaction.insertCategoryMarkSectionPageStale(Category(
        id = rootCategoryId + 1,
        sectionPageId = forumPageId,
        parentId = Some(rootCategoryId),
        name = UncategorizedName,
        slug = UncategorizedSlug,
        position = UncategorizedPosition,
        description = Some(Category.UncategorizedDescription),
        newTopicTypes = immutable.Seq(PageRole.Discussion),
        createdAt = transaction.currentTime,
        updatedAt = transaction.currentTime))

      // COULD create audit log entries.
      forumPagePath
    }
  }


  private val RootCategoryName = "(Root Category)"
  private val RootCategorySlug = "(root-category)"

  private val UncategorizedName = "Uncategorized"
  private val UncategorizedSlug = "uncategorized"
  private val UncategorizedPosition = 1000

  private val ForumBodySanitized = "(Forum body not used [DwM4KZP2])"

}

