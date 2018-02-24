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
import scala.collection.immutable
import ForumDao._


case class CreateForumOptions(
  isForEmbeddedComments: Boolean,
  title: String,
  folder: String,
  useCategories: Boolean,
  createSupportCategory: Boolean,
  createIdeasCategory: Boolean,
  createOtherCategory: Boolean,
  topicListStyle: TopicListLayout)


case class CreateForumResult(
  pagePath: PagePath,
  staffCategoryId: CategoryId,
  defaultCategoryId: CategoryId)


/** Creates forums.
  */
trait ForumDao {
  self: SiteDao =>


  def createForum(title: String, folder: String, isForEmbCmts: Boolean, byWho: Who): CreateForumResult = {
    createForum(CreateForumOptions(
      isForEmbeddedComments = isForEmbCmts,
      title = title,
      folder = folder,
      useCategories = !isForEmbCmts,
      createSupportCategory = false,
      createIdeasCategory = false,
      createOtherCategory = isForEmbCmts,
      topicListStyle = TopicListLayout.TitleExcerptSameLine), byWho)
  }


  def createForum(options: CreateForumOptions, byWho: Who): CreateForumResult = {
    val titleHtmlSanitized = context.nashorn.sanitizeHtml(options.title, followLinks = false)
    val isForEmbCmts = options.isForEmbeddedComments

    val result = readWriteTransaction { transaction =>

      // The forum page points to the root category, which points back.
      transaction.deferConstraints()
      val creator = transaction.loadTheMember(byWho.id)

      AuditDao.insertAuditLogEntry(AuditLogEntry(
        siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.CreateForum,
        doerId = byWho.id,
        doneAt = transaction.now.toJavaDate,
        // Incl email, so will remember forever the created-by-email, even if the user
        // changes hens email later.
        emailAddress = creator.email.trimNoneIfEmpty,
        browserIdData = byWho.browserIdData,
        browserLocation = None), transaction)

      val rootCategoryId = transaction.nextCategoryId()

      // Create forum page.
      val introText = isForEmbCmts ? EmbeddedCommentsIntroText | ForumIntroText
      val (forumPagePath, _) = createPageImpl(
        PageRole.Forum, PageStatus.Published, anyCategoryId = Some(rootCategoryId),
        anyFolder = Some(options.folder), anySlug = Some(""), showId = false,
        titleSource = options.title, titleHtmlSanitized = titleHtmlSanitized,
        bodySource = introText.source, bodyHtmlSanitized = introText.html,
        pinOrder = None, pinWhere = None,
        byWho, spamRelReqStuff = None, transaction, layout = Some(options.topicListStyle))

      val forumPageId = forumPagePath.pageId getOrDie "DwE5KPFW2"

      val partialResult: CreateForumResult = createDefaultCategoriesAndTopics(
        forumPageId, rootCategoryId, isForEmbCmts = isForEmbCmts, options, byWho, transaction)

      val settings =
        if (isForEmbCmts) {
          Some(SettingsToSave(
            showCategories = Some(Some(false)),
            showTopicFilterButton = Some(Some(false)),
            showTopicTypes = Some(Some(false)),
            selectTopicType = Some(Some(false))))
        }
        else if (!options.useCategories) {
          Some(SettingsToSave(
            showCategories = Some(Some(false))))
        }
        else None

      settings.foreach(transaction.upsertSiteSettings)

      partialResult.copy(pagePath = forumPagePath)
    }

    // So settings get refreshed (might have been changed above.)
    emptyCache()

    result
  }


  private def createDefaultCategoriesAndTopics(forumPageId: PageId, rootCategoryId: CategoryId,
        isForEmbCmts: Boolean, options: CreateForumOptions, byWho: Who, transaction: SiteTransaction)
        : CreateForumResult = {

    val staffCategoryId = rootCategoryId + 1
    val defaultCategoryId = rootCategoryId + 2
    val bySystem = Who(SystemUserId, byWho.browserIdData)

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
      includeInSummaries = IncludeInSummaries.Default,
      createdAt = transaction.now.toJavaDate,
      updatedAt = transaction.now.toJavaDate))

    // Create the Staff category.
    createCategoryImpl(
      CategoryToSave(
        anyId = Some(staffCategoryId),
        sectionPageId = forumPageId,
        parentId = rootCategoryId,
        shallBeDefaultCategory = false,
        name = "Staff",
        slug = "staff",
        position = DefaultCategoryPosition + 10,
        description = "Private category for staff discussions.",
        newTopicTypes = immutable.Seq(PageRole.Discussion),
        unlisted = false,
        includeInSummaries = IncludeInSummaries.Default,
        isCreatingNewForum = true),
      immutable.Seq[PermsOnPages](
        makeStaffCategoryPerms(staffCategoryId)),
      bySystem)(transaction)

    var nextCategoryId = defaultCategoryId
    def getAndBumpCategoryId() = {
      nextCategoryId += 1
      nextCategoryId - 1
    }

    if (options.createSupportCategory) {
      val categoryId = getAndBumpCategoryId()
      createCategoryImpl(
        CategoryToSave(
          anyId = Some(categoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = categoryId == defaultCategoryId,
          name = "Support",
          slug = "support",
          position = DefaultCategoryPosition - 2,
          description = "Here you can ask questions and report problems.",
          newTopicTypes = immutable.Seq(PageRole.Question),
          unlisted = false,
          includeInSummaries = IncludeInSummaries.Default,
          isCreatingNewForum = true),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(transaction)
    }

    if (options.createIdeasCategory) {
      val categoryId = getAndBumpCategoryId()
      createCategoryImpl(
        CategoryToSave(
          anyId = Some(categoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = categoryId == defaultCategoryId,
          name = "Ideas",
          slug = "ideas",
          position = DefaultCategoryPosition - 1,
          description = "Here you can suggest new ideas.",
          newTopicTypes = immutable.Seq(PageRole.Idea),
          unlisted = false,
          includeInSummaries = IncludeInSummaries.Default,
          isCreatingNewForum = true),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(transaction)
    }

    // If we didn't create a Support or Ideas category, we'll need to create the General
    // category in any case, so that there'll be a default category.
    val createGeneralCategory =
      options.createOtherCategory || (!options.createSupportCategory && !options.createIdeasCategory)

    var generalCategoryId: Option[CategoryId] = None

    if (createGeneralCategory) {
      val categoryId = getAndBumpCategoryId()
      generalCategoryId = Some(categoryId)
      createCategoryImpl(
        CategoryToSave(
          anyId = Some(categoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = categoryId == defaultCategoryId,
          name = DefaultCategoryName,
          slug = DefaultCategorySlug,
          position = DefaultCategoryPosition,
          description = "For topics that don't fit in any other category.",
          newTopicTypes = immutable.Seq(PageRole.Discussion),
          unlisted = false,
          includeInSummaries = IncludeInSummaries.Default,
          isCreatingNewForum = true),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(transaction)
    }

    // Create forum welcome topic.
    if (!isForEmbCmts) createPageImpl(
      PageRole.Discussion, PageStatus.Published,
      anyCategoryId = generalCategoryId orElse Some(defaultCategoryId),
      anyFolder = None, anySlug = Some("welcome"), showId = true,
      titleSource = WelcomeTopicTitle,
      titleHtmlSanitized = WelcomeTopicTitle,
      bodySource = welcomeTopic.source,
      bodyHtmlSanitized = welcomeTopic.html,
      pinOrder = Some(WelcomeToForumTopicPinOrder),
      pinWhere = Some(PinPageWhere.Globally),
      bySystem,
      spamRelReqStuff = None,
      transaction)

    CreateForumResult(null, defaultCategoryId = defaultCategoryId,
      staffCategoryId = staffCategoryId)
  }


  private val RootCategoryName = "(Root Category)"  // In Typescript test code too [7UKPX5]
  private val RootCategorySlug = "(root-category)"  //

  private val DefaultCategoryName = "General"
  private val DefaultCategorySlug = "general"
  private val DefaultCategoryPosition = 1000

}


object ForumDao {

  val WelcomeToForumTopicPinOrder = 5
  val AboutCategoryTopicPinOrder = 10


  val ForumIntroText: CommonMarkSourceAndHtml = {
    val source = o"""Edit this to tell people what this community is about.
        You can link back to your main website, if any."""
    CommonMarkSourceAndHtml(source, html = s"<p>$source</p>")
  }


  val EmbeddedCommentsIntroText: CommonMarkSourceAndHtml = {
    val source = o"""Here are comments posted at your website.
         One topic here, for each page over at your website."""
    CommonMarkSourceAndHtml(source, html = s"<p>$source</p>")
  }


  val WelcomeTopicTitle = "Welcome to this community"

  val welcomeTopic: CommonMarkSourceAndHtml = {
    val para1Line1 = "Edit this to clarify what this community is about. This first paragraph"
    val para1Line2 = "is shown to everyone, on the forum homepage."
    val para2Line1 = "Here, below the first paragraph, add details like:"
    val listItem1 = "Who is this community for?"
    val listItem2 = "What can they do or find here?"
    val listItem3 = "Link to additional info, for example, any FAQ, or main website of yours."
    val toEditText = """To edit this, click the <b class="icon-edit"></b> icon below."""
    CommonMarkSourceAndHtml(
      source = i"""
        |$para1Line1
        |$para1Line2
        |
        |$para2Line1
        |- $listItem1
        |- $listItem2
        |- $listItem3
        |
        |$toEditText
        |""",
      html = i"""
        |<p>$para1Line1 $para1Line2</p>
        |<p>$para2Line1</p>
        |<ol><li>$listItem1</li><li>$listItem2</li><li>$listItem3</li></ol>
        |<p>$toEditText</p>
        """)
  }


  // Sync with dupl code in Typescript. [7KFWY025]
  def makeEveryonesDefaultCategoryPerms(categoryId: CategoryId) = PermsOnPages(
    id = NoPermissionId,
    forPeopleId = Group.EveryoneId,
    onCategoryId = Some(categoryId),
    mayEditOwn = Some(true),
    mayCreatePage = Some(true),
    mayPostComment = Some(true),
    maySee = Some(true),
    maySeeOwn = Some(true))


  // Sync with dupl code in Typescript. [7KFWY025]
  def makeStaffCategoryPerms(categoryId: CategoryId) = PermsOnPages(
    id = NoPermissionId,
    forPeopleId = Group.StaffId,
    onCategoryId = Some(categoryId),
    mayEditPage = Some(true),
    mayEditComment = Some(true),
    mayEditWiki = Some(true),
    mayEditOwn = Some(true),
    mayDeletePage = Some(true),
    mayDeleteComment = Some(true),
    mayCreatePage = Some(true),
    mayPostComment = Some(true),
    maySee = Some(true),
    maySeeOwn = Some(true))

}
