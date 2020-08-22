/**
 * Copyright (c) 2014-2020 Kaj Magnus Lindberg
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
import com.debiki.core.PageParts.MaxTitleLength
import com.debiki.core.PageParts.FirstReplyNr
import com.debiki.core.Participant.SystemUserId
import debiki._
import debiki.EdHttp._
import ed.server.auth.Authz
import ed.server.spam.SpamChecker
import java.{util => ju}
import scala.collection.immutable
import talkyard.server.dao._
import math.max
import org.owasp.encoder.Encode


case class CreatePageResult(
  path: PagePathWithId,
  bodyPost: Post,
  anyReviewTask: Option[ReviewTask],
  anyCategoryId: Option[CategoryId]) {

  def id: PageId = path.pageId
}


/** Creates and deletes pages, changes their states, e.g. Closed or Solved etc.
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  *
  * SECURITY SHOULD either continue creating review tasks for new users, until they've been
  * reviewed and we know the user is safe. Or block the user from posting more comments,
  * until his/her first ones have been reviewed.
  */
trait PagesDao {
  self: SiteDao =>


  def loadPagesByUser(userId: UserId, isStaffOrSelf: Boolean, limit: Int): Seq[PagePathAndMeta] = {
    readOnlyTransaction(_.loadPagesByUser(userId, isStaffOrSelf = isStaffOrSelf, limit))
  }


  REMOVE; CLEAN_UP // use createPage2 instead, and rename it to createPage().
  def createPage(pageRole: PageType, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        anyFolder: Option[String], anySlug: Option[String], title: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, deleteDraftNr: Option[DraftNr], byWho: Who,
        spamRelReqStuff: SpamRelReqStuff,
        discussionIds: Set[AltPageId] = Set.empty, embeddingUrl: Option[String] = None,
        extId: Option[ExtId] = None): PagePathWithId = {

    createPage2(pageRole, pageStatus = pageStatus, anyCategoryId = anyCategoryId,
          anyFolder = anyFolder, anySlug = anySlug, title = title,
          bodyTextAndHtml = bodyTextAndHtml, showId = showId,
          deleteDraftNr = deleteDraftNr, byWho = byWho,
          spamRelReqStuff = spamRelReqStuff,
          discussionIds = discussionIds, embeddingUrl = embeddingUrl,
          extId = extId).path
  }


  def createPage2(pageRole: PageType, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        anyFolder: Option[String], anySlug: Option[String], title: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, deleteDraftNr: Option[DraftNr], byWho: Who,
        spamRelReqStuff: SpamRelReqStuff,
        discussionIds: Set[AltPageId] = Set.empty, embeddingUrl: Option[String] = None,
        extId: Option[ExtId] = None): CreatePageResult = {

    if (pageRole.isSection) {
      // Should use e.g. ForumController.createForum() instead.
      throwBadRequest("DwE4FKW8", s"Bad page role: $pageRole")
    }

    if (pageRole.isPrivateGroupTalk) {
      throwForbidden("EsE5FKE0I2", "Use MessagesDao instead")
      // Perhaps OpenChat pages should be created via MessagesDao too? [5KTE02Z]
    }

    if (pageRole.isGroupTalk && byWho.isGuest) {
      throwForbidden("EdE7KFWY64", "Guests may not create group talk pages")
    }

    if (bodyTextAndHtml.safeHtml.trim.isEmpty)
      throwForbidden("DwE3KFE29", "Page body should not be empty")

    if (title.source.length > MaxTitleLength)
      throwBadReq("DwE4HEFW8", s"Title too long, max length is $MaxTitleLength")

    if (title.safeHtml.trim.isEmpty)
      throwForbidden("DwE5KPEF21", "Page title should not be empty")

    dieIf(discussionIds.exists(_.startsWith("diid:")), "TyE0KRTDT53J")

    quickCheckIfSpamThenThrow(byWho, bodyTextAndHtml, spamRelReqStuff)

    val result = writeTx { (tx, staleStuff) =>
      val (pagePath, bodyPost, anyReviewTask) =
            createPageImpl(
                pageRole, pageStatus, anyCategoryId,
                anyFolder = anyFolder, anySlug = anySlug, showId = showId,
                title = title, body = bodyTextAndHtml,
                pinOrder = None,
                pinWhere = None,
                byWho,
                Some(spamRelReqStuff),
                discussionIds = discussionIds,
                embeddingUrl = embeddingUrl,
                extId = extId)(tx, staleStuff)

      deleteDraftNr.foreach(nr => tx.deleteDraft(byWho.id, nr))

      CreatePageResult(
            pagePath, bodyPost, anyReviewTask, anyCategoryId = anyCategoryId)
    }

    memCache.firePageCreated(siteId, result.path)
    result
    // Don't start rendering any html. See comment below [5KWC58]
  }


  /** Returns (PagePath, body-post, any-review-task)
    */
  def createPageImpl(pageRole: PageType,
      pageStatus: PageStatus,
      anyCategoryId: Option[CategoryId],
      anyFolder: Option[String],
      anySlug: Option[String],
      showId: Boolean,
      title: TitleSourceAndHtml,
      body: TextAndHtml,
      pinOrder: Option[Int] = None,
      pinWhere: Option[PinPageWhere] = None,
      byWho: Who,
      spamRelReqStuff: Option[SpamRelReqStuff],
      hidePageBody: Boolean = false,
      layout: Option[PageLayout] = None,
      bodyPostType: PostType = PostType.Normal,
      discussionIds: Set[AltPageId] = Set.empty,
      embeddingUrl: Option[String] = None,
      extId: Option[String] = None,
      skipNotfsAndAuditLog: Boolean = false,
      createAsDeleted: Boolean = false,
      )(
      tx: SiteTx,
      staleStuff: StaleStuff,
      ):
        (PagePathWithId, Post, Option[ReviewTask]) = {

    val now = globals.now()
    val authorId = byWho.id
    val authorAndLevels = loadUserAndLevels(byWho, tx)
    val author = authorAndLevels.user
    val categoryPath = tx.loadCategoryPathRootLast(anyCategoryId)
    val groupIds = tx.loadGroupIdsMemberIdFirst(author)
    val permissions = tx.loadPermsOnPages()
    //val authzCtx = ForumAuthzContext(Some(author), groupIds, permissions)  ?  [5FLK02]
    val settings = loadWholeSiteSettings(tx)

    dieOrThrowNoUnless(Authz.mayCreatePage(  // REFACTOR COULD pass a pageAuthzCtx instead [5FLK02]
      authorAndLevels, groupIds,
      pageRole, bodyPostType, pinWhere, anySlug = anySlug, anyFolder = anyFolder,
      inCategoriesRootLast = categoryPath,
      permissions), "EdE5JGK2W4")

    require(!anyFolder.exists(_.isEmpty), "EsE6JGKE3")
    // (Empty slug ok though, e.g. homepage.)
    require(!title.source.isEmpty && !title.safeHtml.isEmpty, "EsE7MGK24")
    require(!body.source.isEmpty && !body.safeHtml.isEmpty, "EsE1WKUQ5")
    require(pinOrder.isDefined == pinWhere.isDefined, "Ese5MJK2")
    require(embeddingUrl.trimNoneIfBlank == embeddingUrl, "Cannot have blank emb urls [TyE75SPJBJ]")

    val pageSlug = anySlug.getOrElse({
        context.nashorn.slugifyTitle(title.source)
    }).take(PagePath.MaxSlugLength).dropRightWhile(_ == '-').dropWhile(_ == '-')

    COULD // try to move this authz + review-reason check to ed.server.auth.Authz?
    val (
      reviewReasons: Seq[ReviewReason],
      shallApprove: Boolean) =
        throwOrFindReviewNewPageReasons(authorAndLevels, pageRole, tx)

    val approvedById =
      if (author.isStaff) {
        dieIf(!shallApprove, "EsE2UPU70")
        Some(author.id)
      }
      else if (shallApprove) Some(SystemUserId)
      else None

    if (pageRole.isSection) {
      // A forum page is created before its root category — verify that the root category
      // does not yet exist (if so, the category id is probably wrong).
      val categoryId = anyCategoryId getOrElse {
        throwForbidden("DwE4KFE0", s"Pages type $pageRole needs a root category id")
      }
      if (tx.loadCategory(categoryId).isDefined) {
        throwForbidden("DwE5KPW2", s"Category already exists, id: $categoryId")
      }
    }
    else {
      anyCategoryId foreach { categoryId =>
        val category = tx.loadCategory(categoryId) getOrElse throwNotFound(
          "DwE4KGP8", s"Category not found, id: $categoryId")
        def whichCategory = s"The '${category.name}' category"
        if (category.isRoot)
          throwForbidden("DwE5GJU0", o"""The root category cannot have any child pages;
            use the Uncategorized category instead""")
        if (category.isLocked)
          throwForbidden("DwE4KFW2", s"$whichCategory is locked")
        if (category.isFrozen)
          throwForbidden("DwE1QXF2", s"$whichCategory is frozen")
        if (category.isDeleted)
          throwForbidden("DwE6GPY2", s"$whichCategory is deleted")
      }
    }

    val folder = anyFolder getOrElse "/"
    SECURITY // Maybe page id shouldn't be public? [rand-page-id] To prevent people from
    // discovering all pages. E.g. iterating through all discussions, in a public blog.
    val pageId = tx.nextPageId()
    val siteId = tx.siteId // [5GKEPMW2] remove this row later
    val pagePath = PagePathWithId(folder = folder, pageId = pageId,
      showId = showId, pageSlug = pageSlug, canonical = true)

    val titleUniqueId = tx.nextPostId()
    val bodyUniqueId = titleUniqueId + 1

    val titlePost = Post.createTitle(
      uniqueId = titleUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorId,
      source = title.source,
      htmlSanitized = title.safeHtml,
      approvedById = approvedById)

    val bodyPost = Post.createBody(
      uniqueId = bodyUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorId,
      source = body.source,
      htmlSanitized = body.safeHtml,
      postType = bodyPostType,
      approvedById = approvedById)
      .copy(
        bodyHiddenAt = ifThenSome(hidePageBody, now.toJavaDate),
        bodyHiddenById = ifThenSome(hidePageBody, authorId),
        bodyHiddenReason = None) // add `hiddenReason` function parameter?

    val uploadRefs = body.uploadRefs
    if (Globals.isDevOrTest) {
      val uplRefs2 = findUploadRefsInPost(bodyPost)
      dieIf(uploadRefs != uplRefs2, "TyE7RTEGP04", s"uploadRefs: $uploadRefs, 2: $uplRefs2")
    }

    val pageMeta = PageMeta.forNewPage(pageId, pageRole, authorId,
      extId = extId,
      creationDati = now.toJavaDate,
      deletedAt = if (createAsDeleted) Some(now) else None,
      numPostsTotal = 2, // title & body
      layout = layout,
      pinOrder = pinOrder, pinWhere = pinWhere,
      categoryId = anyCategoryId,
      // BUG the emb url changes, if the blog moves to another domain, so this db field
      // can get out of date. Remove it? and instead use the url in use, when a comment
      // gets posted and generating notf emails?  But what about summary emails?
      // Maybe remember each blog's last visited domain, and among the domains in the allowed
      // domains list, use the most recently last visited one? But what if a Ty site is used
      // for different blogs? Remember last-visited-domain, per individual blog post?
      // Or maybe different blogs, should place their comments in different categories,
      // and each category can have a primary / canonical embedding domain? [COMCATS]
      embeddingUrl = embeddingUrl,
      publishDirectly = true,
      hidden = approvedById.isEmpty) // [7AWU2R0]

    val anyReviewTask =
      if (reviewReasons.isEmpty) None
      else Some(ReviewTask(
        id = tx.nextReviewTaskId(),
        reasons = reviewReasons.to[immutable.Seq],
        createdById = SystemUserId,
        createdAt = now.toJavaDate,
        createdAtRevNr = Some(bodyPost.currentRevisionNr),
        maybeBadUserId = authorId,
        pageId = Some(pageId),
        postId = Some(bodyPost.id),
        postNr = Some(bodyPost.nr)))

    val anySpamCheckTask =
      if (spamRelReqStuff.isEmpty || !globals.spamChecker.spamChecksEnabled) None
      else if (!SpamChecker.shallCheckSpamFor(authorAndLevels)) None
      else {
        // The uri is now sth like /-/create-page. Change to the path to the page
        // we're creating.
        val spamStuffPageUri = spamRelReqStuff.getOrDie("TyE2045MEQf").copy(uri = pagePath.value)
        Some(
          SpamCheckTask(
            createdAt = globals.now(),
            siteId = siteId,
            postToSpamCheck = Some(PostToSpamCheck(
              postId = bodyPost.id,
              postNr = bodyPost.nr,
              postRevNr = bodyPost.currentRevisionNr,
              pageId = pageMeta.pageId,
              pageType = pageMeta.pageType,
              pageAvailableAt = When.fromDate(pageMeta.publishedAt getOrElse pageMeta.createdAt),
              htmlToSpamCheck = body.safeHtml,
              language = settings.languageCode)),
            who = byWho,
            requestStuff = spamStuffPageUri))
      }

    val stats = UserStats(
      authorId,
      lastSeenAt = now,
      lastPostedAt = Some(now),
      firstNewTopicAt = Some(now),
      numDiscourseTopicsCreated = pageRole.isChat ? 0 | 1,
      numChatTopicsCreated = pageRole.isChat ? 1 | 0)

    addUserStats(stats)(tx)
    tx.insertPageMetaMarkSectionPageStale(pageMeta)
    tx.insertPagePath(pagePath)
    tx.insertPost(titlePost)
    tx.insertPost(bodyPost)

    // By default, one follows all activity on a page one has created — unless this is some page
    // that gets auto created by System. [EXCLSYS]
    if (author.id >= Participant.LowestNormalMemberId) {
      tx.upsertPageNotfPref(
          PageNotfPref(authorId, NotfLevel.WatchingAll, pageId = Some(pageId)))
    }

    if (approvedById.isDefined) {
      updatePagePopularity(
        PreLoadedPageParts(pageMeta, Vector(titlePost, bodyPost)), tx)

      // Add links, and uncache linked pages — need to rerender them, with
      // a backlink to this new page.
      // Need not: staleStuff.addPageId(new-page-id) — page didn't exist before.
      saveDeleteLinks(bodyPost, body, authorId, tx, staleStuff, skipBugWarn = true)
    }

    uploadRefs foreach { hashPathSuffix =>
      tx.insertUploadedFileReference(bodyPost.id, hashPathSuffix, authorId)
    }

    discussionIds.foreach(id => tx.insertAltPageId("diid:" + id, realPageId = pageId))

    embeddingUrl foreach { embUrl =>
      if (!discussionIds.contains(embUrl)) {
        // If the url already points to another embedded discussion, keep it pointing to the old one.
        // Then, seems like lower risk for some hijack-a-discussion-by-forging-the-url security issue.
        tx.insertAltPageIdIfFree(embUrl, realPageId = pageId)
      }
      // To make it simple to test things from localhost, and moving to
      // a new address, store the discussion id by url path too, without origin. [06KWDNF2]
      // Maybe some time later, could add a conf val to disable this.
      val embeddingPath = extractUrlPath(embUrl)
      if (!discussionIds.contains(embeddingPath)) {
        tx.insertAltPageIdIfFree(embeddingPath, realPageId = pageId)
      }
    }

    // COULD generate notifications from here — currently done in the callers though.

    anyReviewTask.foreach(tx.upsertReviewTask)
    anySpamCheckTask.foreach(tx.insertSpamCheckTask)

    if (!skipNotfsAndAuditLog) {
      val notifications = notfGenerator(tx).generateForNewPost(
            newPageDao(pagePath.pageId, tx), bodyPost,
            Some(body), anyNewModTask = anyReviewTask)

      tx.saveDeleteNotifications(notifications)

      insertAuditLogEntry(AuditLogEntry(
            siteId = siteId,
            id = AuditLogEntry.UnassignedId,
            didWhat = AuditLogEntryType.NewPage,
            doerId = authorId,
            doneAt = now.toJavaDate,
            browserIdData = byWho.browserIdData,
            pageId = Some(pageId),
            pageType = Some(pageRole),
            uniquePostId = Some(bodyPost.id),
            postNr = Some(bodyPost.nr)), tx)
    }

    tx.indexPostsSoon(titlePost, bodyPost)

    // Don't start rendering html for this page in the background. [5KWC58]
    // (Instead, when the user requests the page, we'll render it directly in
    // the request thread. Otherwise either 1) the request thread would have to wait
    // for the background thread (which is too complicated) or 2) we'd generate
    // the page twice, both in the request thread and in a background thread.)

    (pagePath, bodyPost, anyReviewTask)
  }


  REFACTOR; MOVE // to ReviewsDao (and rename it to ModerationDao)
  private def throwOrFindReviewNewPageReasons(author: UserAndLevels, pageRole: PageType,
        tx: SiteTx): (Seq[ReviewReason], Boolean) = {
    throwOrFindNewPostReviewReasonsImpl(author, pageMeta = None, newPageRole = Some(pageRole), tx)
  }


  def unpinPage(pageId: PageId, requester: Participant): Unit = {
    pinOrUnpin(pageId, pinWhere = None, pinOrder = None, requester)
  }


  def pinPage(pageId: PageId, pinWhere: PinPageWhere, pinOrder: Int, requester: Participant): Unit = {
    pinOrUnpin(pageId, Some(pinWhere), Some(pinOrder), requester)
  }


  private def pinOrUnpin(pageId: PageId, pinWhere: Option[PinPageWhere], pinOrder: Option[Int],
        requester: Participant): Unit = {
    require(pinWhere.isDefined == pinOrder.isDefined, "EdE2WRT5")
    val didWhat = pinWhere match {
      case None => "unpinned this topic"
      case Some(_) => "pinned this topic"
    }

    val (oldMeta, newMeta) = readWriteTransaction { tx =>
      val oldMeta = tx.loadThePageMeta(pageId)
      val newMeta = oldMeta.copy(pinWhere = pinWhere, pinOrder = pinOrder,
        version = oldMeta.version + 1, numPostsTotal = oldMeta.numPostsTotal + 1)

      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      addMetaMessage(requester, didWhat, pageId, tx)

      (oldMeta, newMeta)
    }

    if (newMeta.isChatPinnedGlobally != oldMeta.isChatPinnedGlobally) {
      // When a chat gets un/pinned globally, need rerender watchbar, affects all pages. [0GPHSR4]
      emptyCache()
    }
    else {
      refreshPageInMemCache(pageId)
    }
  }


  def ifAuthAcceptAnswer(pageId: PageId, postUniqueId: PostId, userId: UserId,
        browserIdData: BrowserIdData): Option[ju.Date] = {
    val answeredAt = readWriteTransaction { tx =>
      val user = tx.loadTheParticipant(userId)
      val oldMeta = tx.loadThePageMeta(pageId)
      if (oldMeta.pageType != PageType.Question)
        throwBadReq("DwE4KGP2", "This page is not a question so no answer can be selected")

      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE8JGY3", "Only staff and the topic author can accept an answer")

      val post = tx.loadThePost(postUniqueId)
      throwBadRequestIf(post.isDeleted, "TyE4BQR20", "That post has been deleted, cannot mark as answer")
      throwBadRequestIf(post.pageId != pageId,
          "DwE5G2Y2", "That post is placed on another page, page id: " + post.pageId)

      // Pages are probably closed for good reasons, e.g. off-topic, and then it gives
      // the wrong impression if the author can still select an answer. It would seem as
      // if that kind of questions were allowed / on-topic.
      if (oldMeta.closedAt.isDefined)
        throwBadReq("DwE0PG26", "This question is closed, therefore no answer can be accepted")

      val answeredAt = Some(tx.now.toJavaDate)
      val newMeta = oldMeta.copy(
        answeredAt = answeredAt,
        answerPostId = Some(postUniqueId),
        closedAt = answeredAt,
        version = oldMeta.version + 1)
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      // (COULD wait 5 minutes (in case the answer gets un-accepted) then send email
      // to the author of the answer)
      answeredAt
    }
    refreshPageInMemCache(pageId)
    answeredAt
  }


  def ifAuthUnacceptAnswer(pageId: PageId, userId: UserId, browserIdData: BrowserIdData): Unit = {
    readWriteTransaction { tx =>
      val user = tx.loadTheParticipant(userId)
      val oldMeta = tx.loadThePageMeta(pageId)
      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE2GKU4", "Only staff and the topic author can unaccept the answer")

      // Dupl line. [4UKP58B]
      val newMeta = oldMeta.copy(answeredAt = None, answerPostId = None, closedAt = None,
        version = oldMeta.version + 1)

      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
    }
    refreshPageInMemCache(pageId)
  }


  def ifAuthTogglePageClosed(pageId: PageId, userId: UserId, browserIdData: BrowserIdData)
        : Option[ju.Date] = {
    val now = globals.now()
    val newClosedAt = readWriteTransaction { tx =>
      val user = tx.loadTheParticipant(userId)
      val oldMeta = tx.loadThePageMeta(pageId)
      throwIfMayNotSeePage(oldMeta, Some(user))(tx)

      throwBadRequestIf(oldMeta.isDeleted,
          "TyE0CLSPGDLD", s"Cannot close or reopen deleted pages")

      throwBadRequestIf(!oldMeta.pageType.canClose,
          "DwE4PKF7", s"Cannot close pages of type ${oldMeta.pageType}")

      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE5JPK7", "Only staff and the topic author can toggle it closed")

      val (newClosedAt: Option[ju.Date], didWhat: String) = oldMeta.closedAt match {
        case None => (Some(now.toJavaDate), "closed")
        case Some(_) => (None, "reopened")
      }
      val newMeta = oldMeta.copy(
        closedAt = newClosedAt,
        version = oldMeta.version + 1,
        numPostsTotal = oldMeta.numPostsTotal + 1)

      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // Update audit log
      addMetaMessage(user, s" $didWhat this topic", pageId, tx)

      newClosedAt
    }
    refreshPageInMemCache(pageId)
    newClosedAt
  }


  def deletePagesIfAuth(pageIds: Seq[PageId], deleterId: UserId, browserIdData: BrowserIdData,
        undelete: Boolean): Unit = {
    writeTx { (tx, staleStuff) =>
      // SHOULD LATER: [4GWRQA28] If is sub community (= forum page), delete the root category too,
      // so all topics in the sub community will get deleted.
      // And remove the sub community from the watchbar's Communities section.
      // (And if undeleting the sub community, undelete the root category too.)
      deletePagesImpl(pageIds, deleterId, browserIdData, undelete = undelete
            )(tx, staleStuff)
    }
    refreshPagesInAnyCache(pageIds.toSet)
  }


  def deletePagesImpl(pageIds: Seq[PageId], deleterId: UserId, browserIdData: BrowserIdData,
        undelete: Boolean = false)(
        tx: SiteTx, staleStuff: StaleStuff): Unit = {

    BUG; SHOULD // delete notfs or mark deleted?  [notfs_bug]  [nice_notfs]
    // But don't delete any review tasks — good if staff reviews, if a new
    // member posts something trollish, people react, then hen deletes hens page.
    // Later, if undeleting, then restore the notfs? [undel_posts]

    val deleter = tx.loadTheParticipant(deleterId)
    if (!deleter.isStaff)
      throwForbidden("EsE7YKP424_", "Only staff may (un)delete pages")

    for {
      pageId <- pageIds
      pageMeta <- tx.loadPageMeta(pageId)
      // Hmm but trying to delete a deleted *post*, throws an error. [5WKQRH2]
      if pageMeta.isDeleted == undelete
    } {
      if ((pageMeta.pageType.isSection || pageMeta.pageType == PageType.CustomHtmlPage) &&
          !deleter.isAdmin)
        throwForbidden("EsE5GKF23_", "Only admin may (un)delete sections and HTML pages")

      val baseAuditEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.DeletePage,
        doerId = deleterId,
        doneAt = tx.now.toJavaDate,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        pageType = Some(pageMeta.pageType))

      var (newMeta, auditLogEntry) =
        if (undelete) {
          (pageMeta.copy(deletedAt = None, version = pageMeta.version + 1),
            baseAuditEntry.copy(didWhat = AuditLogEntryType.UndeletePage))
        }
        else {
          (pageMeta.copy(deletedAt = Some(tx.now.toJavaDate),
            version = pageMeta.version + 1), baseAuditEntry)
        }
      newMeta = newMeta.copy(numPostsTotal = newMeta.numPostsTotal + 1)

      // Invalidate, or re-activate, review tasks whose posts now get deleted / undeleted.
      // Also done here: [deld_post_mod_tasks] when deleting posts.
      // Actually, maybe better to *not* invalidate review tasks now when the page gets
      // deleted? Can be good to be able to review flagged posts and misbehavior.
      // Example: Mallory creates a topic and says things that make people angry. Then,
      // when some people have replied, he deletes the page? Or maybe a staff or core memeber
      // does, because the whole page is off-topic with angry comments. Now, it'd be silly
      // if all review tasks for the flags casted on Mallory's comments, disappeared.
      /* So don't:
      if (!undelete) {
        invalidateReviewTasksForPageId(pageId, doingReviewTask,tx)
      }
      else {
        reactivateReviewTasksForPageId(pageId, doingReviewTask, tx)
      } */

      // If this page is getting deleted because it's spam, then, update any [UPDSPTSK]
      // pending spam check task, so a training sample gets sent to any spam check services.
      tx.loadOrigPost(pageMeta.pageId) foreach { origPost =>
        TESTS_MISSING
        val postAuthor = tx.loadTheParticipant(origPost.createdById)
        updateSpamCheckTaskBecausePostDeleted(origPost, postAuthor, deleter = deleter, tx)
      }

      tx.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)
      tx.insertAuditLogEntry(auditLogEntry)
      tx.indexAllPostsOnPage(pageId)
      // (Keep in top-topics table, so staff can list popular-but-deleted topics.)

      // Refresh backlinks — this page now deleted.
      // (However, we don't delete from links_t, when deleting pages or categories
      // — that would sometime cause lots of writes to the database. Instead,
      // backlinks to deleted and access restricted pages and categories are
      // filtered out, when reading from the db.)
      val linkedPageIds = tx.loadPageIdsLinkedFromPage(pageId)
      staleStuff.addPageIds(linkedPageIds, pageModified = false, backlinksStale = true)
      // Page version bumped above.
      staleStuff.addPageId(pageId, memCacheOnly = true)

      val un = undelete ? "un" | ""
      addMetaMessage(deleter, s" ${un}deleted this topic", pageId, tx)
    }
  }


  REFACTOR // Move to PostsDao? This fn creates a post, not a whole page operation.
  def addMetaMessage(doer: Participant, message: String, pageId: PageId, tx: SiteTransaction): Unit = {
    // Some dupl code [3GTKYA02]
    val page = newPageDao(pageId, tx)
    val postId = tx.nextPostId()
    val postNr = page.parts.highestReplyNr.map(_ + 1).map(max(FirstReplyNr, _)) getOrElse FirstReplyNr

    val metaMessage = Post.create(
      uniqueId = postId,
      pageId = pageId,
      postNr = postNr,
      parent = Some(page.parts.theBody),
      multireplyPostNrs = Set.empty,
      postType = PostType.MetaMessage,
      createdAt = tx.now.toJavaDate,
      createdById = doer.id,
      source = message,
      htmlSanitized = Encode.forHtmlContent(message),
      approvedById = Some(SystemUserId))

    // Don't mark the section page as stale — total posts count not shown (only total replies).
    // Don't index — meta messages shouldn't be found, when searching.

    // The caller must have remembered to update numPostsTotal.
    val pageMeta = tx.loadThePageMeta(pageId)
    dieIf(pageMeta.numPostsTotal != postNr + 1, "EdE3PFK2W0", o"""pageMeta.numPostsTotal
        is ${pageMeta.numPostsTotal} but should be = postNr + 1 = ${postNr + 1}""")

    tx.insertPost(metaMessage)

    SHOULD // send back json so the satus message gets shown, without reloading the page. [2PKRRSZ0]
  }


  def refreshPageMetaBumpVersion(pageId: PageId, markSectionPageStale: Boolean,
        tx: SiteTransaction): Unit = {
    val page = newPageDao(pageId, tx)
    var newMeta = page.meta.copyWithUpdatedStats(page)
    tx.updatePageMeta(newMeta, oldMeta = page.meta,
      markSectionPageStale = markSectionPageStale)
  }
}

