/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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
import java.{util => ju}
import debiki.ReactRenderer
import scala.collection.{immutable, mutable}
import ForumDao._


/** Creates forums.
  */
trait ForumDao {
  self: SiteDao =>


  def createForum(title: String, folder: String, creatorId: UserId,
        browserIdData: BrowserIdData): PagePath = {
    val titleHtmlSanitized = commonmarkRenderer.sanitizeHtml(title)
    readWriteTransaction { transaction =>

      // The forum page points to the root category, which points back.
      transaction.deferConstraints()

      val rootCategoryId = transaction.nextCategoryId()

      // Create forum page.
      val (forumPagePath, _) = createPageImpl(
        PageRole.Forum, PageStatus.Published, anyCategoryId = Some(rootCategoryId),
        anyFolder = Some(folder), anySlug = Some(""), showId = false,
        titleSource = title, titleHtmlSanitized = titleHtmlSanitized,
        bodySource = introText.source, bodyHtmlSanitized = introText.html,
        pinOrder = None, pinWhere = None,
        authorId = creatorId, browserIdData, transaction)

      val forumPageId = forumPagePath.pageId getOrDie "DwE5KPFW2"

      createDefaultCategoriesAndTopics(forumPageId, rootCategoryId, browserIdData, transaction)

      // COULD create audit log entries.
      forumPagePath
    }
  }


  private def createDefaultCategoriesAndTopics(forumPageId: PageId, rootCategoryId: CategoryId,
        browserIdData: BrowserIdData, transaction: SiteTransaction) {

    val uncategorizedCategoryId = rootCategoryId + 1
    val staffCategoryId = rootCategoryId + 2

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

    // Create the Uncategorized category.
    transaction.insertCategoryMarkSectionPageStale(Category(
      id = uncategorizedCategoryId,
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

    // Create the Staff category.
    transaction.insertCategoryMarkSectionPageStale(Category(
      id = staffCategoryId,
      sectionPageId = forumPageId,
      parentId = Some(rootCategoryId),
      name = "Staff",
      slug = "staff",
      position = Category.DefaultPosition + 10,
      description = Some("Private category for staff discussions"),
      newTopicTypes = immutable.Seq(PageRole.Discussion),
      hideInForum = false,
      createdAt = transaction.currentTime,
      updatedAt = transaction.currentTime))

    // Create forum welcome topic.
    createPageImpl(
      PageRole.Discussion, PageStatus.Published, anyCategoryId = Some(uncategorizedCategoryId),
      anyFolder = None, anySlug = Some("welcome"), showId = true,
      titleSource = WelcomeTopicTitle,
      titleHtmlSanitized = WelcomeTopicTitle,
      bodySource = welcomeTopic.source,
      bodyHtmlSanitized = welcomeTopic.html,
      pinOrder = Some(WelcomeToForumTopicPinOrder),
      pinWhere = Some(PinPageWhere.Globally),
      authorId = SystemUserId,
      browserIdData,
      transaction)
  }


  private val RootCategoryName = "(Root Category)"  // In Typescript test code too [7UKPX5]
  private val RootCategorySlug = "(root-category)"  //

  private val UncategorizedName = "Uncategorized"
  private val UncategorizedSlug = "uncategorized"
  private val UncategorizedPosition = 1000

}


object ForumDao {

  val WelcomeToForumTopicPinOrder = 5
  val AboutCategoryTopicPinOrder = 10


  lazy val introText = renderCommonMark(i"""
    |Edit this to tell people what this community is about. Consider linking back to your main website, if any.
    """)


  val WelcomeTopicTitle = "Welcome to this community"

  lazy val welcomeTopic = renderCommonMark(i"""
    |This first paragraph is shown to everyone, on the forum homepage. Edit it to briefly clarify what this community is about. You can edit the topic title too.
    |
    |Here, below the first paragraph, add details like:
    |- Who is this community for?
    |- What can they do or find here?
    |- Link to additional info, for example:  [the about page](/about); any FAQ; any main website of yours.
    |
    |To edit this, click <span class="icon-menu"></span> just below and then <b class="icon-edit">Edit</b>.
    |""")


  def renderCommonMark(source: String) = ReactRenderer.renderSanitizeCommonMarkReturnSource(
    source, allowClassIdDataAttrs = true, followLinks = true)

}
