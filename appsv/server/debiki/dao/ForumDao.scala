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
import debiki.{Globals, SafeStaticSourceAndHtml, TextAndHtml, TitleSourceAndHtml}
import talkyard.server.dao._


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
  pagePath: PagePathWithId,
  rootCategoryId: CategoryId,
  staffCategoryId: CategoryId,
  defaultCategoryId: CategoryId)


/** Creates forums.
  */
trait ForumDao {
  self: SiteDao =>


  def createForum(title: St, folder: String, isForEmbCmts: Bo, byWho: Who,
          anyTx: Opt[(SiteTx, StaleStuff)] = None): Opt[CreateForumResult] = {
    createForum2(CreateForumOptions(
      isForEmbeddedComments = isForEmbCmts,
      title = title,
      folder = folder,
      useCategories = !isForEmbCmts,
      createSupportCategory = !isForEmbCmts,
      createIdeasCategory = !isForEmbCmts,
      createSampleTopics = !isForEmbCmts,
      topicListStyle = TopicListLayout.TitleExcerptSameLine), byWho, anyTx)
  }


  def createForum2(options: CreateForumOptions, byWho: Who,
          anyTx: Opt[(SiteTx, StaleStuff)] = None): Opt[CreateForumResult] = {
    val titleSourceAndHtml = TitleSourceAndHtml(options.title)
    val isForEmbCmts = options.isForEmbeddedComments

    val result = writeTxTryReuse(anyTx) { (tx, staleStuff) =>
      val oldForumPagePath = tx.checkPagePath(PagePath(
        siteId = siteId, folder = options.folder, pageId = None, showId = false, pageSlug = ""))
      if (oldForumPagePath.isDefined) {
        // There's already a page here; this is probably a create-forum double submit.
        // Can happen if  non-existing-page.more.ts  is open in two browser tabs
        // at the same time — maybe because the user pasted an email verification link
        // in a new 2nd tab. Do nothing.
        return None
      }

      // The forum page points to the root category, which points back.
      tx.deferConstraints()
      val creator = tx.loadTheUser(byWho.id)

      AuditDao.insertAuditLogEntry(AuditLogEntry(
        siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.CreateForum,
        doerId = byWho.id,
        doneAt = tx.now.toJavaDate,
        // Incl email, so will remember forever the created-by-email, even if the user
        // changes hens email later.
        emailAddress = creator.email.trimNoneIfEmpty,
        browserIdData = byWho.browserIdData,
        browserLocation = None), tx)

      val rootCategoryId = tx.nextCategoryId()

      // If is the first forum for this site, we're also creating the first category, id = 1. [8UWKQXN45]
      val isFirstForumForThisSite = rootCategoryId == 1

      // Create forum page.
      val introText: TextAndHtml = isForEmbCmts ? EmbeddedCommentsIntroText | ForumIntroText
      val forumPagePath = createPageImpl(
            PageType.Forum, PageStatus.Published, anyCategoryId = Some(rootCategoryId),
            anyFolder = Some(options.folder), anySlug = Some(""), showId = false,
            title = titleSourceAndHtml, body = introText,
            byWho = byWho, spamRelReqStuff = None,
            layout = Some(options.topicListStyle),
            // We generate a notf below about this whole new sub forum instead.
            skipNotfsAndAuditLog = true)(tx, staleStuff)._1

      val forumPageId = forumPagePath.pageId

      val partialResult: CreateForumResult = createDefaultCategoriesAndTopics(
        forumPageId, rootCategoryId, options, byWho, tx, staleStuff)

      // Forum section page path missing.
      DO_AFTER // 2021-01-01 remove !isDevOrTest, instead require() always.
      require((partialResult.pagePath eq null) || !Globals.isDevOrTest, "TyE205MKT4")

      val completeResult = partialResult.copy(pagePath = forumPagePath)

      // Delaying configuration of these settings until here, instead of here: [493MRP1],
      // lets us let people choose to create embedded comments sites, also
      // for the first site when doing a self hosted installation. Only partly impl, see [602KMRR52].
      val settings =
        if (!isFirstForumForThisSite) {
          // Don't overwrite site settings — this is a 2nd forum for the same site,
          // and the current settings have been choosen to suite the 1st forum for this site.
          // (Each forum is its own sub community. So, this is a multi sub community site.)
          // Could, however, add forum specific settings (the ones below) scoped to the new forum?
          None
        }
        else if (isForEmbCmts) {
          // (This is the first "forum" we create, for this site. We're free to
          // update site settings as we want.)
          // Features intended for forums just make people confused, in a blog comments site.
          // So disable:
          Some(SettingsToSave(
            enableForum = Some(Some(false)),
            showCategories = Some(Some(false)),
            enableChat = Some(Some(false)),
            enableDirectMessages = Some(Some(false)),
            enableSimilarTopics = Some(Some(false)),
            showTopicFilterButton = Some(Some(false)),
            showTopicTypes = Some(Some(false)),
            selectTopicType = Some(Some(false))))
        }
        else if (!options.useCategories) {
          Some(SettingsToSave(
            showCategories = Some(Some(false))))
        }
        else None

      settings.foreach(tx.upsertSiteSettings)

      // [subcomms] generate notfs to other staff / admins, when
      // sub sites / sub forums created?
      // if (!skipNotfsAndAuditLog) {
        AUDIT_LOG
        COULD // notify other staff? admins? who wants to know about new cats?
        //val notfs = notfGenerator(tx).generateForNew Forum ( ...)   [nice_notfs]
      // }

      completeResult
    }

    // So settings get refreshed (might have been changed above.)
    clearDatabaseCacheAndMemCache(anyTx)

    Some(result)
  }


  private def createDefaultCategoriesAndTopics(forumPageId: PageId, rootCategoryId: CategoryId,
        options: CreateForumOptions, byWho: Who, tx: SiteTransaction, staleStuff: StaleStuff)
        : CreateForumResult = {

    val staffCategoryId = rootCategoryId + 1
    val defaultCategoryId = rootCategoryId + 2
    val bySystem = Who(SystemUserId, byWho.browserIdData)

    // Create forum root category.
    tx.insertCategoryMarkSectionPageStale(Category(
      id = rootCategoryId,
      sectionPageId = forumPageId,
      parentId = None,
      defaultSubCatId = Some(defaultCategoryId),
      name = RootCategoryName,
      slug = RootCategorySlugPrefix + rootCategoryId,
      position = 1,
      description = None,
      newTopicTypes = Nil,
      defaultSortOrder = None,
      doVoteStyle = None,
      doVoteInTopicList = None,
      unlistCategory = false,
      unlistTopics = false,
      includeInSummaries = IncludeInSummaries.Default,
      createdAt = tx.now.toJavaDate,
      updatedAt = tx.now.toJavaDate), IfBadDie)

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
        newTopicTypes = immutable.Seq(PageType.Discussion),
        defaultSortOrder = None,
        doVoteStyle = None,
        doVoteInTopicList = None,
        unlistCategory = false,
        unlistTopics = false,
        includeInSummaries = IncludeInSummaries.Default),
      immutable.Seq[PermsOnPages](
        makeStaffCategoryPerms(staffCategoryId)),
      bySystem)(tx, staleStuff)

    if (options.isForEmbeddedComments)
      createEmbeddedCommentsCategory(forumPageId, rootCategoryId, defaultCategoryId,
            staffCategoryId, options, bySystem, tx, staleStuff)
    else
      createForumCategories(forumPageId, rootCategoryId, defaultCategoryId,
            staffCategoryId, options, bySystem, tx, staleStuff)
  }


  private def createEmbeddedCommentsCategory(
    forumPageId: PageId, rootCategoryId: CategoryId, defaultCategoryId: CategoryId,
    staffCategoryId: CategoryId, options: CreateForumOptions,
    bySystem: Who, tx: SiteTransaction, staleStuff: StaleStuff): CreateForumResult = {

    dieIf(!options.isForEmbeddedComments, "TyE7HQT42")

    createCategoryImpl(
      CategoryToSave(
        anyId = Some(defaultCategoryId),
        extId = Some(EmbeddedCommentsExtId),
        sectionPageId = forumPageId,
        parentId = rootCategoryId,
        shallBeDefaultCategory = true,
        name = EmbCommentsCategoryName,
        slug = EmbCommentsCategorySlug,
        position = DefaultCategoryPosition,
        description = "Embedded comments for your blog or articles.",
        newTopicTypes = immutable.Seq(PageType.Discussion),
        defaultSortOrder = None,
        doVoteStyle = None,
        doVoteInTopicList = None,
        // Strangers may not list all topics, maybe blog owner wants to keep some of them private?
        // SECURITY [rand-page-id]
        unlistCategory = true,
        unlistTopics = false,
        // The category About page is not needed, because the same info is in the forum
        // intro post anyway and there's only one single category. So create the About topic
        // in a deleted state, so it won't be shown. Can be undeleted later if one wants
        // a "real" forum with many categories.
        createDeletedAboutTopic = true,
        includeInSummaries = IncludeInSummaries.NoExclude),
      immutable.Seq[PermsOnPages](
        makeEveryonesDefaultCategoryPerms(defaultCategoryId),
        makeFullMembersDefaultCategoryPerms(defaultCategoryId),
        makeStaffCategoryPerms(defaultCategoryId)),
      bySystem)(tx, staleStuff)

    CreateForumResult(null, rootCategoryId = rootCategoryId,
          defaultCategoryId = defaultCategoryId, staffCategoryId = staffCategoryId)
  }


  private def createForumCategories(
    forumPageId: PageId, rootCategoryId: CategoryId, defaultCategoryId: CategoryId,
    staffCategoryId: CategoryId, options: CreateForumOptions,
    bySystem: Who, tx: SiteTransaction, staleStuff: StaleStuff): CreateForumResult = {

    dieIf(options.isForEmbeddedComments, "TyE2PKQ9")

    var nextCategoryId = defaultCategoryId
    def getAndBumpCategoryId() = {
      nextCategoryId += 1
      nextCategoryId - 1
    }

    var anyQuestionsCategoryId: Option[CategoryId] = None
    var anyIdeasCategoryId: Option[CategoryId] = None
    var generalCategoryId: CategoryId = -1
    var anySampleTopicsCategoryId: Option[CategoryId] = None

    // Create a default General category.
    generalCategoryId = getAndBumpCategoryId()
    createCategoryImpl(
      CategoryToSave(
        anyId = Some(generalCategoryId),
        sectionPageId = forumPageId,
        parentId = rootCategoryId,
        shallBeDefaultCategory = true, //uncategorizedCategoryId == defaultCategoryId,
        name = UncategorizedCategoryName,
        slug = UncategorizedCategorySlug,
        position = DefaultCategoryPosition,
        description = "For topics that don't fit in other categories.",
        newTopicTypes = immutable.Seq(PageType.Discussion),
        defaultSortOrder = None,
        doVoteStyle = None,
        doVoteInTopicList = None,
        unlistCategory = false,
        unlistTopics = false,
        includeInSummaries = IncludeInSummaries.Default),
      immutable.Seq[PermsOnPages](
        makeEveryonesDefaultCategoryPerms(generalCategoryId),
        makeFullMembersDefaultCategoryPerms(generalCategoryId),
        makeStaffCategoryPerms(generalCategoryId)),
      bySystem)(tx, staleStuff)

    // Talkyard is advertised as Question-Answers and crowdsource ideas forum software,
    // so makes sense to create Questions and Ideas categories?

    // Create a Questions category.
    if (options.createSupportCategory) {
      val categoryId = getAndBumpCategoryId()
      anyQuestionsCategoryId = Some(categoryId)
      createCategoryImpl(
        CategoryToSave(
          anyId = Some(categoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = categoryId == defaultCategoryId,
          name = "Questions",
          slug = "questions",
          position = DefaultCategoryPosition - 2,
          description = "Here you can ask questions.",
          newTopicTypes = immutable.Seq(PageType.Question),
          defaultSortOrder = None,
          doVoteStyle = None,
          doVoteInTopicList = None,
          unlistCategory = false,
          unlistTopics = false,
          includeInSummaries = IncludeInSummaries.Default),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeFullMembersDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(tx, staleStuff)
    }

    // Create an Ideas category.
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
          description = "Here you can suggest and discuss ideas.",
          newTopicTypes = immutable.Seq(PageType.Idea),
          defaultSortOrder = Some(PageOrderOffset.ByScoreAndBumpTime(
              offset = None, period = TopTopicsPeriod.Year)),
          doVoteStyle = Some(DoVoteStyle.Likes),
          doVoteInTopicList = Some(true),
          unlistCategory = false,
          unlistTopics = false,
          includeInSummaries = IncludeInSummaries.Default),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeFullMembersDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(tx, staleStuff)
    }

    /*
    if (options.createSampleTopics) {
      val categoryId = getAndBumpCategoryId()
      anySampleTopicsCategoryId = Some(categoryId)
      createCategoryImpl(
        CategoryToSave(
          anyId = Some(categoryId),
          sectionPageId = forumPageId,
          parentId = rootCategoryId,
          shallBeDefaultCategory = false,
          name = "Sample Topics",
          slug = "sample-topics",
          position = DefaultCategoryPosition + 100,
          description =
            o"""Sample topics of different types, okay to delete.""",
            // yes now they are [4AKBR02]: They aren't listed in the main
              //topic list — you'll see them only if you open this sample topics category.""",
          newTopicTypes = immutable.Seq(PageType.Discussion),
          defaultSortOrder = None,
          doVoteStyle = None,
          doVoteInTopicList = None,
          unlistCategory = false,
          unlistTopics = false,  // so won't appear in the main topic list
                                 // edit: Now I just hid all category-descr topics. [4AKBR02]
                                 // Let's try again, with showing the sample topics by default.
          includeInSummaries = IncludeInSummaries.NoExclude),
        immutable.Seq[PermsOnPages](
          makeEveryonesDefaultCategoryPerms(categoryId),
          makeFullMembersDefaultCategoryPerms(categoryId),
          makeStaffCategoryPerms(categoryId)),
        bySystem)(tx, staleStuff)
    } */

    def makeTitle(safeText: String) =
      TitleSourceAndHtml.alreadySanitized(safeText, safeHtml = safeText)

    // Create forum welcome topic.
    createPageImpl(
      PageType.Discussion, PageStatus.Published,
      anyCategoryId = Some(generalCategoryId),
      anyFolder = None, anySlug = Some("welcome"), showId = true,
      title = makeTitle(WelcomeTopicTitle),
      body = welcomeTopic,
      pinOrder = Some(WelcomeToForumTopicPinOrder),
      pinWhere = Some(PinPageWhere.Globally),
      bySystem,
      spamRelReqStuff = None,
      skipNotfsAndAuditLog = true)(tx, staleStuff)

    if (options.createSampleTopics) {
      def wrap(text: String) =
        SafeStaticSourceAndHtml(source = text, safeHtml = s"<p>$text</p>")

      // Create a sample open-ended discussion.
      val discussionPagePath = createPageImpl(
        PageType.Discussion, PageStatus.Published,
        anyCategoryId = Some(generalCategoryId), //anySampleTopicsCategoryId,
        anyFolder = None, anySlug = Some("sample-discussion"), showId = true,
        title = makeTitle(SampleThreadedDiscussionTitle),
        body = SafeStaticSourceAndHtml(SampleThreadedDiscussionText,
                s"<p>$SampleThreadedDiscussionText</p>"),
        pinOrder = None,
        pinWhere = None,
        bySystem,
        spamRelReqStuff = None,
        skipNotfsAndAuditLog = true)(tx, staleStuff)._1
      // ... with a brief discussion.
      insertReplyImpl(wrap(SampleDiscussionReplyOne),
            discussionPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleDiscussionReplyTwo),
            discussionPagePath.pageId, replyToPostNrs = Set(PageParts.FirstReplyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleDiscussionReplyThree),
            discussionPagePath.pageId, replyToPostNrs = Set(PageParts.FirstReplyNr + 1),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)

      /*
      // Create sample problem. — maybe it's enough, with a sample Idea.
      createPageImpl(
        PageType.Problem, PageStatus.Published,
        anyCategoryId = anySampleTopicsCategoryId,
        anyFolder = None, anySlug = Some("sample-problem"), showId = true,
        title = makeTitle(SampleProblemTitle),
        body = SampleProblemText,
        pinOrder = None,
        pinWhere = None,
        bySystem,
        spamRelReqStuff = None,
        tx, staleStuff) */

      // Create sample idea.
      val ideaPagePath = createPageImpl(
        PageType.Idea, PageStatus.Published,
        anyCategoryId = anyIdeasCategoryId.orElse(Some(generalCategoryId)), //anySampleTopicsCategoryId,
        anyFolder = None, anySlug = Some("sample-idea"), showId = true,
        title = makeTitle(SampleIdeaTitle),
        body = SampleIdeaText,
        pinOrder = None,
        pinWhere = None,
        bySystem,
        spamRelReqStuff = None,
        skipNotfsAndAuditLog = true)(tx, staleStuff)._1
      // ... with some sample Discussion and Progress replies.
      insertReplyImpl(wrap(SampleIdeaDiscussionReplyOne),
            ideaPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleIdeaDiscussionReplyTwo),
            ideaPagePath.pageId, replyToPostNrs = Set(PageParts.FirstReplyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleIdeaDiscussionReplyThree),
            ideaPagePath.pageId, replyToPostNrs = Set(PageParts.FirstReplyNr + 1),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleIdeaProgressReplyOne),
            ideaPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.BottomComment, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleIdeaProgressReplyTwo),
            ideaPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.BottomComment, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)

      // Create sample question.
      val questionPagePath = createPageImpl(
        PageType.Question, PageStatus.Published,
        anyCategoryId = anyQuestionsCategoryId.orElse(Some(generalCategoryId)), //anySampleTopicsCategoryId,
        anyFolder = None, anySlug = Some("sample-question"), showId = true,
        title = makeTitle(SampleQuestionTitle),
        body = SampleQuestionText,
        pinOrder = None,
        pinWhere = None,
        bySystem,
        spamRelReqStuff = None,
        skipNotfsAndAuditLog = true)(tx, staleStuff)._1
      // ... with two answers and a comment:
      insertReplyImpl(wrap(SampleAnswerText),
            questionPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleAnswerCommentText),
            questionPagePath.pageId, replyToPostNrs = Set(PageParts.FirstReplyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
      insertReplyImpl(wrap(SampleAnswerText2),
            questionPagePath.pageId, replyToPostNrs = Set(PageParts.BodyNr),
            PostType.Normal, bySystem, SystemSpamStuff, globals.now(), SystemUserId,
            tx, staleStuff, skipNotfsAndAuditLog = true)
    }

    // Create staff chat.
    // (Create after the sample topics above, so will appear above them in the
    // topic list, because is newer.)
    createPageImpl(
      PageType.OpenChat, PageStatus.Published,
      anyCategoryId = Some(staffCategoryId),
      anyFolder = None, anySlug = Some("staff-chat"), showId = true,
      title = makeTitle(StaffChatTopicTitle),
      body = SafeStaticSourceAndHtml(StaffChatTopicText, s"<p>$StaffChatTopicText</p>"),
      pinOrder = None,
      pinWhere = None,
      bySystem,
      spamRelReqStuff = None,
      skipNotfsAndAuditLog = true)(tx, staleStuff)

    CreateForumResult(null, rootCategoryId = rootCategoryId,
          defaultCategoryId = defaultCategoryId, staffCategoryId = staffCategoryId)
  }

}


object ForumDao {

  private val WelcomeToForumTopicPinOrder = 5

  private val RootCategoryName = "(Root Category)"    // In Typescript test code too [7UKPX5]
  private val RootCategorySlugPrefix = "__root_cat_"  //

  private val UncategorizedCategoryName = "General" // I18N everywhere here
  private val UncategorizedCategorySlug = "general"

  val EmbeddedCommentsExtId = "embedded_comments"
  private val EmbCommentsCategoryName = "Blog Comments"
  private val EmbCommentsCategorySlug = "blog-comments"

  private val DefaultCategoryPosition = 1000


  private val ForumIntroText: SafeStaticSourceAndHtml = {
    val source = o"""[ Edit this to tell people what they can do here. ]"""
    SafeStaticSourceAndHtml(source, safeHtml = s"<p>$source</p>")
  }


  private val EmbeddedCommentsIntroText: SafeStaticSourceAndHtml = {
    val source = o"""Here are comments posted at your website. One topic here,
         for each blog post that got any comments, over at your website."""
    SafeStaticSourceAndHtml(source, safeHtml = s"<p>$source</p>")
  }


  private val WelcomeTopicTitle = "Welcome to this community"

  private val welcomeTopic: SafeStaticSourceAndHtml = {
    val para1Line1 = "[ Edit this to clarify what this community is about. This first paragraph"
    val para1Line2 = "is shown to everyone, on the forum homepage. ]"
    val para2Line1 = "Here, below the first paragraph, add details like:"
    val listItem1 = "Who is this community for?"
    val listItem2 = "What can they do or find here?"
    val listItem3 = "Link to additional info, for example, any FAQ, or main website of yours."
    val toEditText = """To edit this, click the <b class="icon-edit"></b> icon below."""
    SafeStaticSourceAndHtml(
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
      safeHtml = i"""
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

  private val SampleDiscussionReplyOne = o"""Lorem ipsum dolor sit amet, consectetur adipiscing elit,
      sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
      quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."""
  private val SampleDiscussionReplyTwo = SampleDiscussionReplyOne.takeWhile(_ != '.')
  private val SampleDiscussionReplyThree = SampleDiscussionReplyTwo


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
    SafeStaticSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$para3
        |
        |$ToDeleteText
        |""",
      safeHtml = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |<p>$para3</p>
        |<p>$ToDeleteText</p>
        """)
  }


  private val SampleIdeaTitle = "Sample idea"
  private val SampleIdeaText = {
    val para1 = o"""This is a sample idea. Click the idea icon to the left of the title
      (i.e. <span class="icon-idea"></span>)
      to change status from New Idea, to Planned, to Started, to Done."""
    val para2 = o"""In the topic list, everyone sees the status of the idea at a glance
      — the status icon is shown to the left (e.g.
      <span class="icon-idea"></span> or <span class="icon-check"></span>).</div>"""
    SafeStaticSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$ToDeleteText
        |""",
      safeHtml = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |<p>$ToDeleteText</p>
        """)
  }

  private val SampleIdeaDiscussionReplyOne = o"""Sample reply, discussing if the idea
     is a good idea."""

  private val SampleIdeaDiscussionReplyTwo = o"""
     More thoughts about the idea."""

  private val SampleIdeaDiscussionReplyThree = o"""
     These Discussion section replies are always threaded.
     Whilst the Progress section replies below, are flat."""

  private val SampleIdeaProgressReplyOne = o"""
     Here, in the Progress section,
     you can step by step update others,
     about how you're making progress with implementing the idea."""

  private val SampleIdeaProgressReplyTwo = o"""Now we have: ...,
     and next we will: ..."""


  private val SampleQuestionTitle = "Sample question"
  private val SampleQuestionText = {
    val para1 = o"""This is an sample question. Click "Solution" below to accept an answer.
      In the topic list, everyone sees that this is a question, and if it's new
      (the <span class="icon-help-circled"></span> icon), or if it's been answered (
      the <span class="icon-ok-circled-empty"></span> icon)."""
    val para2 = o"""In the topic list: To see all unanswered questions, click "All topic"
      and then choose "Only waiting", look:"""
    // (You'll find /-/media/ in the Nginx config [NGXMEDIA] and submodule ty-media.)
    val para3 = """<img class="no-lightbox" src="/-/media/tips/how-click-show-waiting-680px.jpg">"""
    SafeStaticSourceAndHtml(
      source = i"""
        |$para1
        |
        |$para2
        |
        |$para3
        |
        |$ToDeleteText
        |""",
      safeHtml = i"""
        |<p>$para1</p>
        |<p>$para2</p>
        |$para3
        |<p>$ToDeleteText</p>
        """)
  }

  private val SampleAnswerText = o"""Sample answer. The one who posted the question,
    and the staff (you?), can click Solution below, to accept this answer and mark
    the question as solved."""

  private val SampleAnswerCommentText = o"""Here, someone has posted a comment, to start
    discussing the sample answers just above."""

  private val SampleAnswerText2 = "Another sample answer."

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


  /** New and basic members may not edit Wiki pages — that'd be too risky?
    * (Of course admins can change this, for their own site.)  [DEFMAYEDWIKI]
    * Sync with dupl code in Typescript. [7KFWY025]
    */
  def makeFullMembersDefaultCategoryPerms(categoryId: CategoryId): PermsOnPages =
    makeEveryonesDefaultCategoryPerms(categoryId).copy(
          forPeopleId = Group.FullMembersId,
          mayEditWiki = Some(true))


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
