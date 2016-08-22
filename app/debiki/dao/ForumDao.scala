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
import io.efdi.server.Who
import scala.collection.{immutable, mutable}
import ForumDao._


case class CreateForumResult(
  pagePath: PagePath,
  uncategorizedCategoryId: CategoryId)


/** Creates forums.
  */
trait ForumDao {
  self: SiteDao =>


  def createForum(title: String, folder: String, byWho: Who): CreateForumResult = {
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
        byWho, transaction)

      val forumPageId = forumPagePath.pageId getOrDie "DwE5KPFW2"

      val partialResult = createDefaultCategoriesAndTopics(
        forumPageId, rootCategoryId, byWho.browserIdData, transaction)

      // COULD create audit log entries.

      partialResult.copy(pagePath = forumPagePath)
    }
  }


  private def createDefaultCategoriesAndTopics(forumPageId: PageId, rootCategoryId: CategoryId,
        browserIdData: BrowserIdData, transaction: SiteTransaction): CreateForumResult = {

    val defaultCategoryId = rootCategoryId + 1
    val staffCategoryId = rootCategoryId + 2

    // Create forum root category.
    transaction.insertCategoryMarkSectionPageStale(Category(
      id = rootCategoryId,
      sectionPageId = forumPageId,
      parentId = None,
      defaultCategoryId = Some(defaultCategoryId),
      name = RootCategoryName,
      slug = RootCategorySlug,
      position = 1,
      description = None,
      newTopicTypes = Nil,
      unlisted = false,
      staffOnly = false,
      onlyStaffMayCreateTopics = false,
      createdAt = transaction.currentTime,
      updatedAt = transaction.currentTime))

    // Create the default category.
    transaction.insertCategoryMarkSectionPageStale(Category(
      id = defaultCategoryId,
      sectionPageId = forumPageId,
      parentId = Some(rootCategoryId),
      defaultCategoryId = None,
      name = DefaultCategoryName,
      slug = DefaultCategorySlug,
      position = DefaultCategoryPosition,
      description = Some("New topics get placed here, unless another category is selected."),
      newTopicTypes = immutable.Seq(PageRole.Discussion),
      unlisted = false,
      staffOnly = false,
      onlyStaffMayCreateTopics = false,
      createdAt = transaction.currentTime,
      updatedAt = transaction.currentTime))

    // Create the Staff category.
    transaction.insertCategoryMarkSectionPageStale(Category(
      id = staffCategoryId,
      sectionPageId = forumPageId,
      parentId = Some(rootCategoryId),
      defaultCategoryId = None,
      name = "Staff",
      slug = "staff",
      position = Category.DefaultPosition + 10,
      description = Some("Private category for staff discussions"),
      newTopicTypes = immutable.Seq(PageRole.Discussion),
      unlisted = false,
      staffOnly = true,
      onlyStaffMayCreateTopics = false,
      createdAt = transaction.currentTime,
      updatedAt = transaction.currentTime))

    // Create forum welcome topic.
    createPageImpl(
      PageRole.Discussion, PageStatus.Published, anyCategoryId = Some(defaultCategoryId),
      anyFolder = None, anySlug = Some("welcome"), showId = true,
      titleSource = WelcomeTopicTitle,
      titleHtmlSanitized = WelcomeTopicTitle,
      bodySource = welcomeTopic.source,
      bodyHtmlSanitized = welcomeTopic.html,
      pinOrder = Some(WelcomeToForumTopicPinOrder),
      pinWhere = Some(PinPageWhere.Globally),
      Who(SystemUserId, browserIdData),
      transaction)

    CreateForumResult(null, defaultCategoryId)
  }


  private val RootCategoryName = "(Root Category)"  // In Typescript test code too [7UKPX5]
  private val RootCategorySlug = "(root-category)"  //

  private val DefaultCategoryName = "Uncategorized"
  private val DefaultCategorySlug = "uncategorized"
  private val DefaultCategoryPosition = 1000

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
    |- Link to additional info, for example, any FAQ, or main website of yours.
    |
    |To edit this, click <span class="icon-menu"></span> just below and then <b class="icon-edit">Edit</b>.
    |""")


  def renderCommonMark(source: String) = ReactRenderer.renderSanitizeCommonMarkReturnSource(
    source, allowClassIdDataAttrs = true, followLinks = true)

}
