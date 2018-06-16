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
import talkyard.server.CommonMarkSourceAndHtml


case class CreateForumOptions(
  isForEmbeddedComments: Boolean,
  title: String,
  folder: String,
  useCategories: Boolean,
  createSupportCategory: Boolean,
  createIdeasCategory: Boolean,
  createSampleTopics: Boolean,
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
      createSampleTopics = !isForEmbCmts,
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
        includeInSummaries = IncludeInSummaries.Default),
      immutable.Seq[PermsOnPages](
        makeStaffCategoryPerms(staffCategoryId)),
      bySystem)(transaction)

    if (options.isForEmbeddedComments)
      createEmbeddedCommentsCategory(forumPageId, rootCategoryId, defaultCategoryId,
        staffCategoryId, options, bySystem, transaction)
    else
      createForumCategories(forumPageId, rootCategoryId, defaultCategoryId,
        staffCategoryId, options, bySystem, transaction)
  }


  private def createEmbeddedCommentsCategory(
    forumPageId: PageId, rootCategoryId: CategoryId, defaultCategoryId: CategoryId,
    staffCategoryId: CategoryId, options: CreateForumOptions,
    bySystem: Who, tx: SiteTransaction): CreateForumResult = {

    dieIf(!options.isForEmbeddedComments, "TyE7HQT42")

    createCategoryImpl(
      CategoryToSave(
        anyId = Some(defaultCategoryId),
        sectionPageId = forumPageId,
        parentId = rootCategoryId,
        shallBeDefaultCategory = true,
        name = EmbCommentsCategoryName,
        slug = EmbCommentsCategorySlug,
        position = DefaultCategoryPosition,
        description = "Embedded comments for your blog or articles.",
        newTopicTypes = immutable.Seq(PageRole.Discussion),
        // Strangers may not list all topics, maybe blog owner wants to keep some of them private?
        // SECURITY [rand-page-id]
        unlisted = true,
        includeInSummaries = IncludeInSummaries.NoExclude),
      immutable.Seq[PermsOnPages](
        makeEveryonesDefaultCategoryPerms(defaultCategoryId),
        makeStaffCategoryPerms(defaultCategoryId)),
      bySystem)(tx)

    CreateForumResult(null, defaultCategoryId = defaultCategoryId,
      staffCategoryId = staffCategoryId)
  }


  private def createForumCategories(
    forumPageId: PageId, rootCategoryId: CategoryId, defaultCategoryId: CategoryId,
    staffCategoryId: CategoryId, options: CreateForumOptions,
    bySystem: Who, transaction: SiteTransaction): CreateForumResult = {

    dieIf(options.isForEmbeddedComments, "TyE2PKQ9")

    var nextCategoryId = defaultCategoryId
    def getAndBumpCategoryId() = {
      nextCategoryId += 1
      nextCategoryId - 1
    }

    var anySupportCategoryId: Option[CategoryId] = None
    var anyIdeasCategoryId: Option[CategoryId] = None
    var uncategorizedCategoryId: CategoryId = -1

    if (options.createSupportCategory) {
      val categoryId = getAndBumpCategoryId()
      anySupportCategoryId = Some(categoryId)
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
          includeInSummaries = IncludeInSummaries.Default),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(transaction)
    }

    if (options.createIdeasCategory) {
      val categoryId = getAndBumpCategoryId()
      anyIdeasCategoryId = Some(categoryId)
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
          includeInSummaries = IncludeInSummaries.Default),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(transaction)
    }

    // Create the Uncategorized category.
    uncategorizedCategoryId = getAndBumpCategoryId()
    createCategoryImpl(
        CategoryToSave(
          anyId = Some(uncategorizedCategoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = uncategorizedCategoryId == defaultCategoryId,
          name = UncategorizedCategoryName,
          slug = UncategorizedCategorySlug,
          position = DefaultCategoryPosition,
          description = "For topics that don't fit in other categories.",
          newTopicTypes = immutable.Seq(PageRole.Discussion),
          unlisted = false,
          includeInSummaries = IncludeInSummaries.Default),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(uncategorizedCategoryId),
          makeStaffCategoryPerms(uncategorizedCategoryId)),
        bySystem)(transaction)

    // Create forum welcome topic.
    createPageImpl(
      PageRole.Discussion, PageStatus.Published,
      anyCategoryId = Some(uncategorizedCategoryId),
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

    // Create staff chat
    createPageImpl(
      PageRole.OpenChat, PageStatus.Published,
      anyCategoryId = Some(staffCategoryId),
      anyFolder = None, anySlug = Some("staff-chat"), showId = true,
      titleSource = StaffChatTopicTitle,
      titleHtmlSanitized = StaffChatTopicTitle,
      bodySource = StaffChatTopicText,
      bodyHtmlSanitized = s"<p>$StaffChatTopicText</p>",
      pinOrder = None,
      pinWhere = None,
      bySystem,
      spamRelReqStuff = None,
      transaction)

    // Create example threaded discussion.
    if (options.createSampleTopics) createPageImpl(
      PageRole.Discussion, PageStatus.Published,
      anyCategoryId = Some(uncategorizedCategoryId),
      anyFolder = None, anySlug = Some("example-discussion"), showId = true,
      titleSource = SampleThreadedDiscussionTitle,
      titleHtmlSanitized = SampleThreadedDiscussionTitle,
      bodySource = SampleThreadedDiscussionText,
      bodyHtmlSanitized = s"<p>$SampleThreadedDiscussionText</p>",
      pinOrder = None,
      pinWhere = None,
      bySystem,
      spamRelReqStuff = None,
      transaction)

    // Create example problem.
    if (options.createSampleTopics) createPageImpl(
      PageRole.Problem, PageStatus.Published,
      anyCategoryId = anySupportCategoryId orElse Some(uncategorizedCategoryId),
      anyFolder = None, anySlug = Some("example-problem"), showId = true,
      titleSource = SampleProblemTitle,
      titleHtmlSanitized = SampleProblemTitle,
      bodySource = SampleProblemText.source,
      bodyHtmlSanitized = SampleProblemText.html,
      pinOrder = None,
      pinWhere = None,
      bySystem,
      spamRelReqStuff = None,
      transaction)

    // Create example question.
    if (options.createSampleTopics) {
      val questionPagePath = createPageImpl(
        PageRole.Question, PageStatus.Published,
        anyCategoryId = anySupportCategoryId orElse Some(uncategorizedCategoryId),
        anyFolder = None, anySlug = Some("example-question"), showId = true,
        titleSource = SampleQuestionTitle,
        titleHtmlSanitized = SampleQuestionTitle,
        bodySource = SampleQuestionText.source,
        bodyHtmlSanitized = SampleQuestionText.html,
        pinOrder = None,
        pinWhere = None,
        bySystem,
        spamRelReqStuff = None,
        transaction)._1
      insertReplyImpl(textAndHtmlMaker.wrapInParagraph(SampleAnswerText, isTitle = false),
        questionPagePath.thePageId, replyToPostNrs = Set(PageParts.BodyNr), PostType.Normal,
        bySystem, SystemSpamStuff, globals.now(), SystemUserId, transaction, skipNotifications = true)
    }

    // Create example idea.
    if (options.createSampleTopics) createPageImpl(
      PageRole.Idea, PageStatus.Published,
      anyCategoryId = anyIdeasCategoryId orElse anySupportCategoryId orElse Some(
        uncategorizedCategoryId),
      anyFolder = None, anySlug = Some("example-idea"), showId = true,
      titleSource = SampleIdeaTitle,
      titleHtmlSanitized = SampleIdeaTitle,
      bodySource = SampleIdeaText.source,
      bodyHtmlSanitized = SampleIdeaText.html,
      pinOrder = None,
      pinWhere = None,
      bySystem,
      spamRelReqStuff = None,
      transaction)

    CreateForumResult(null, defaultCategoryId = defaultCategoryId,
      staffCategoryId = staffCategoryId)
  }

}


object ForumDao {

  private val WelcomeToForumTopicPinOrder = 5
  val AboutCategoryTopicPinOrder = 10

  private val RootCategoryName = "(Root Category)"  // In Typescript test code too [7UKPX5]
  private val RootCategorySlug = "(root-category)"  //

  private val UncategorizedCategoryName = "Uncategorized"
  private val UncategorizedCategorySlug = "uncategorized"

  private val EmbCommentsCategoryName = "Blog Comments"
  private val EmbCommentsCategorySlug = "blog-comments"

  private val DefaultCategoryPosition = 1000


  private val ForumIntroText: CommonMarkSourceAndHtml = {
    val source = o"""Edit this to tell people what this community is about.
        You can link back to your main website, if any."""
    CommonMarkSourceAndHtml(source, html = s"<p>$source</p>")
  }


  private val EmbeddedCommentsIntroText: CommonMarkSourceAndHtml = {
    val source = o"""Here are comments posted at your website.
         One topic here, for each page over at your website."""
    CommonMarkSourceAndHtml(source, html = s"<p>$source</p>")
  }


  private val WelcomeTopicTitle = "Welcome to this community"

  private val welcomeTopic: CommonMarkSourceAndHtml = {
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

  private val ToDeleteText =
    "(To delete this example topic, click Tools at the top, and then click Delete.)"

  private val StaffChatTopicTitle = "Staff chat"
  private val StaffChatTopicText = "This is a private chat for staff."

  private val SampleThreadedDiscussionTitle = "Sample discussion"
  private val SampleThreadedDiscussionText =
    o"""This is an open ended discussion. Good comments rise to the top, and people can click
       Disagree to show that they disagree about something."""

  private val SampleProblemTitle = "Sample problem"
  private val SampleProblemText = {
    val para1 = o"""If you get a report about something being broken, and you need to fix it,
      you can change the topic type to Problem (like this topic) — click the pencil to the
      right of the title."""
    val para2 =
      o"""Then, when you decide to fix the problem,
      click <span class="icon-attention-circled"></span> to the left of the title,
      to change the status to We-plan-to-fix-this.
      Click again to change status to Fixing-now, and Fixed."""
    val para3 = o"""In the topic list, people see if a problem is new, or if it's been solved:
      the <span class="icon-attention-circled"></span> and
      <span class="icon-check"></span> icons."""
    CommonMarkSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$para3
        |
        |$ToDeleteText
        |""",
      html = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |<p>$para3</p>
        |<p>$ToDeleteText</p>
        """)
  }

  private val SampleIdeaTitle = "Sample idea"
  private val SampleIdeaText = {
    val para1 = o"""This is an example idea. Click the idea icon to the left of the title
      (i.e. <span class="icon-idea"></span>)
      to change status from New Idea, to Planned-to-do, to Doing-now, to Done."""
    val para2 = o"""In the topic list, everyone sees the status of the idea at a glance
      — the status icon is shown to the left (e.g.
      <span class="icon-idea"></span> or <span class="icon-check"></span>).</div>"""
    CommonMarkSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$ToDeleteText
        |""",
      html = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |<p>$ToDeleteText</p>
        """)
  }

  private val SampleQuestionTitle = "Sample question"
  private val SampleQuestionText = {
    val para1 = o"""This is an example question. Click "Solution" below to accept an answer.
      In the topic list, everyone sees that this is a question, and if it's new
      (the <span class="icon-help-circled"></span> icon), or if it's been answered (
      the <span class="icon-ok-circled-empty"></span> icon)."""
    val para2 = o"""In the topic list: To see all unanswered questions, click "All topic"
      and then choose "Only waiting", look:"""
    val para3 = """<img class="no-lightbox" src="/-/img/tips/how-click-show-waiting-680px.jpg">"""
    CommonMarkSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$para3
        |
        |$ToDeleteText
        |""",
      html = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |$para3
        |<p>$ToDeleteText</p>
        """)
  }

  private val SampleAnswerText = o"""Sample answer. The one who posted the question,
    and the staff (you?), can click Solution below, to accept this answer and mark
    the question as solved."""

  // SHOULD separate layout: chat/flat/threaded/2d, from
  // topic type: idea/question/discussion/wiki/etc ?
  //
  //val SampleFlatDiscussionTopicTitle = "Sample discussion, flat"
  //val SampleFlatDiscussionTopicText =
  // "If you prefer flat (not threaded) discussions, instead of threaded discussions,
  // you can edit the category and change the default topic type from Discussion to Chat."

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
