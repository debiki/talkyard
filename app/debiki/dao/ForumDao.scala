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
    val titleHtmlSanitized = siteDbDao.commonMarkRenderer.sanitizeHtml(title)
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
      position = 60, // 50 is the default? Break out constant?
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

    // Create admin quick start guide.
    createPageImpl(
      PageRole.Discussion, PageStatus.Published, anyCategoryId = Some(staffCategoryId),
      anyFolder = None, anySlug = Some("admin-quick-start-guide"), showId = true,
      titleSource = AdminQuickStartGuideTitle,
      titleHtmlSanitized = AdminQuickStartGuideTitle,
      bodySource = adminQuickStartGuide.source,
      bodyHtmlSanitized = adminQuickStartGuide.html,
      pinOrder = None,
      pinWhere = None,
      authorId = SystemUserId,
      browserIdData,
      transaction)
  }


  private val RootCategoryName = "(Root Category)"
  private val RootCategorySlug = "(root-category)"

  private val UncategorizedName = "Uncategorized"
  private val UncategorizedSlug = "uncategorized"
  private val UncategorizedPosition = 1000

}


object ForumDao {

  val WelcomeToForumTopicPinOrder = 5
  val AboutCategoryTopicPinOrder = 10


  lazy val introText = renderCommonMark(i"""
    |Replace this text with an introduction to this forum, so people will know what it is about. You can link back to your main website, if any.
    """)


  val WelcomeTopicTitle = "Welcome to this forum"

  lazy val welcomeTopic = renderCommonMark(i"""
    |This first paragraph is shown to everyone, on the forum homepage. Edit it to briefly clarify what this community is about.
    |
    |Here, below the first paragraph, add details like:
    |- Who is this community for?
    |- What can they do or find here?
    |- Add links to additional info, e.g. [the about page](/about), any FAQ or any main website of yours.
    |
    |""")


  val AdminQuickStartGuideTitle = "READ ME FIRST: Admin Quick Start Guide"

  lazy val adminQuickStartGuide = renderCommonMark(i"""
    |As an admin, you can configure this forum and website. Go to the admin area by clicking <span class="icon-menu"></span> to the upper right, then click **Admin**.
    |
    |Required settings
    |------------------
    |
    |In the admin area, fill in settings: the website title and description, and the `company_...` settings.
    |
    |Private or public?
    |------------------
    |
    |In the admin area, you can make the forum private, by changing these settings:
    |
    |- Login required
    |- Approve users
    |
    |Customize colors and logo
    |------------------
    |
    |See the admin area, the **Customize** section. However, your customizations might break in the future, because this functionality is a bit experimental right now. Also, you need to know some CSS and/or a bit HTML, right now, unfortunately.
    |
    |Clarify what this forum is about
    |------------------
    |
    |Edit the forum intro text (just below the forum title). And the _Welcome to this forum_ topic.
    |
    |Edit [the about page](/about): tell people what this forum and website is about. Link to your main website, if any.
    |
    |Create categories
    |------------------
    |
    |On the forum homepage, click **Categories**, then **Create Category**. Edit the about-this-category topic that you'll find in each category you create.
    |
    |Build your community
    |------------------
    |
    |Building a community is hard. Before launching:
    |
    | - Make sure people will understand what this forum is about — see the _Clarify what the site is about_ sections above.
    | - Create some interesting topics, so people won't find an empty forum.
    | - Commit to visiting your forum regularly and participating in the discussions.
    |
    |Then you can start promoting your forum. Start by telling a few people about it, and ask them if they understand the purpose of the forum. Rewrite the welcome topic or intro text, if needed.
    |
    |Later, when those you ask do seem to understand, link to your forum "everywhere" and tell people about it. You can invite people via email: click your name in the upper right, then click **Invite**.
    |
    |Need help?
    |------------------
    |
    |For help, go to EffectiveDiscussion's [support forum](http://www.effectivediscussions.org/forum/#/latest/support).
    |""")


  def renderCommonMark(source: String) = ReactRenderer.renderSanitizeCommonMarkReturnSource(
    source, allowClassIdDataAttrs = true, followLinks = true)

}
