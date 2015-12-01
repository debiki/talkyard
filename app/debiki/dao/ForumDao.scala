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
        hideInForum = false,
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
        hideInForum = false,
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

  private val ForumBodySanitized = i"""
    |<p>[Replace this text with an introduction to this forum, so people know what it is about.
    |You can include a link to your main website, if any.
    |<p>Edit this text, by clicking the pencil above, and then click <b>Edit intro text</b>.
    |People can hide this intro text once they have read it,
    |by clicking <b>Hide intro</b> below.]
    """

}

