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


  val AdminQuickStartGuideTitle = "READ FIRST: Admin Quick Start Guide"

  lazy val adminQuickStartGuide = renderCommonMark(i"""
    |As an admin, you can edit forum settings, define what this community is about, and invite people.
    |
    |Edit settings
    |------------------
    |
    |Go to the admin area by clicking <span class="icon-menu"></span> to the upper right, then click **Admin**. (The admin area is a bit unfinished right now.)
    |
    |Have a look at the settings, in case there's something you'd like to change. For example:
    |
    |#### Copyright
    |
    |By default, people may copy material from the forum, and they must then give credit to the authors, and indicate if they have modified it. They must also in turn allow others to copy and edit their modified material. This is [Creative Commons' CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/). — All this is a bit configurable, in the **Legal** settings section.
    |
    |#### Private or public?
    |
    |You can make the forum private, by enabling these: _Login required_ and _Approve users_, in the **Login** settings section.
    |
    |#### Customize colors and logo
    |
    |In the **Customize** section, you can customize colors, add a logo and a top navigation bar. **However**, your customizations might break in the future, because this functionality is a bit experimental right now. Also, right now you need to know some CSS and HTML, unfortunately.
    |
    |Clarify what this community is about
    |------------------
    |
    |Edit the community intro text (just below the forum title). And edit the _Welcome to this community_ topic. And [the about page](/about).
    |
    |Create categories
    |------------------
    |
    |On [the forum main page](/), click **Categories**, then **Create Category**. Edit the about-this-category topic that you'll find in each category you create. Don't create too many categories (if you do, they might look rather empty).
    |
    |Build your community
    |------------------
    |
    |Building a community is hard. Before launching:
    |
    | - Make sure people will understand what this community is about — see the _Clarify what the site is about_ section above.
    | - Create some interesting topics, so people won't find an empty forum.
    | - Commit to visiting your forum regularly and participating in the discussions.
    | - Tell a few people to have a look at this new community. Ask them if they understand its purpose. Edit and improve the welcome topic or intro text, until everything is clear.
    |
    |Then start promoting your community: link to it "everywhere" and tell people about it. You can invite people via email: click your name in the upper right, then click **View Profile**, then **Invite**.
    |
    |Need help?
    |------------------
    |
    |For help, go to EffectiveDiscussion's [support forum](http://www.effectivediscussions.org/forum/latest/support). Over there, there's an _Ideas_ category too, and you're welcome to make suggestions.
    |""")


  def renderCommonMark(source: String) = ReactRenderer.renderSanitizeCommonMarkReturnSource(
    source, allowClassIdDataAttrs = true, followLinks = true)

}
