/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.User.SystemUserId
import debiki._
import debiki.EdHttp._
import ed.server.auth.{Authz, ForumAuthzContext}
import ed.server.notf.NotificationGenerator
import java.{util => ju}
import scala.collection.immutable
import math.max
import org.owasp.encoder.Encode


/** Loads and saves pages and page parts (e.g. posts and patches).
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

  import context.globals

  def loadPagesByUser(userId: UserId, isStaffOrSelf: Boolean, limit: Int): Seq[PagePathAndMeta] = {
    readOnlyTransaction(_.loadPagesByUser(userId, isStaffOrSelf = isStaffOrSelf, limit))
  }


  def createPage(pageRole: PageRole, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        anyFolder: Option[String], anySlug: Option[String], titleTextAndHtml: TextAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, byWho: Who,
        spamRelReqStuff: SpamRelReqStuff,
        altPageId: Option[AltPageId] = None, embeddingUrl: Option[String] = None): PagePath = {

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

    if (titleTextAndHtml.text.length > MaxTitleLength)
      throwBadReq("DwE4HEFW8", s"Title too long, max length is $MaxTitleLength")

    if (titleTextAndHtml.safeHtml.trim.isEmpty)
      throwForbidden("DwE5KPEF21", "Page title should not be empty")

    quickCheckIfSpamThenThrow(byWho, bodyTextAndHtml, spamRelReqStuff)

    val pagePath = readWriteTransaction { transaction =>
      val (pagePath, bodyPost) = createPageImpl(pageRole, pageStatus, anyCategoryId,
        anyFolder = anyFolder, anySlug = anySlug, showId = showId,
        titleSource = titleTextAndHtml.text, titleHtmlSanitized = titleTextAndHtml.safeHtml,
        bodySource = bodyTextAndHtml.text, bodyHtmlSanitized = bodyTextAndHtml.safeHtml,
        pinOrder = None, pinWhere = None, byWho, Some(spamRelReqStuff),
        transaction, altPageId = altPageId, embeddingUrl = embeddingUrl)

      val notifications = NotificationGenerator(transaction)
        .generateForNewPost(PageDao(pagePath.pageId getOrDie "DwE5KWI2", transaction), bodyPost)
      transaction.saveDeleteNotifications(notifications)
      pagePath
    }

    memCache.firePageCreated(pagePath)
    pagePath
    // Don't start rendering any html. See comment below [5KWC58]
  }


  /** Returns (PagePath, body-post)
    */
  def createPageImpl2(pageRole: PageRole,
        title: TextAndHtml, body: TextAndHtml,
        pageStatus: PageStatus = PageStatus.Published,
        anyCategoryId: Option[CategoryId] = None,
        anyFolder: Option[String] = None, anySlug: Option[String] = None, showId: Boolean = true,
        pinOrder: Option[Int] = None, pinWhere: Option[PinPageWhere] = None,
        byWho: Who, spamRelReqStuff: Option[SpamRelReqStuff],
        transaction: SiteTransaction): (PagePath, Post) =
    createPageImpl(pageRole, pageStatus, anyCategoryId = anyCategoryId,
      anyFolder = anyFolder, anySlug = anySlug, showId = showId,
      titleSource = title.text, titleHtmlSanitized = title.safeHtml,
      bodySource = body.text, bodyHtmlSanitized = body.safeHtml,
      pinOrder = pinOrder, pinWhere = pinWhere,
      byWho, spamRelReqStuff, transaction = transaction, layout = None)


  def createPageImpl(pageRole: PageRole, pageStatus: PageStatus,
      anyCategoryId: Option[CategoryId],
      anyFolder: Option[String], anySlug: Option[String], showId: Boolean,
      titleSource: String, titleHtmlSanitized: String,
      bodySource: String, bodyHtmlSanitized: String,
      pinOrder: Option[Int], pinWhere: Option[PinPageWhere],
      byWho: Who, spamRelReqStuff: Option[SpamRelReqStuff],
      transaction: SiteTransaction, hidePageBody: Boolean = false,
      layout: Option[TopicListLayout] = None,
      bodyPostType: PostType = PostType.Normal,
      altPageId: Option[AltPageId] = None, embeddingUrl: Option[String] = None): (PagePath, Post) = {

    val now = globals.now()
    val authorId = byWho.id
    val authorAndLevels = loadUserAndLevels(byWho, transaction)
    val author = authorAndLevels.user
    val categoryPath = transaction.loadCategoryPathRootLast(anyCategoryId)
    val groupIds = transaction.loadGroupIds(author)
    val permissions = transaction.loadPermsOnPages()
    val authzCtx = ForumAuthzContext(Some(author), groupIds, permissions)

    dieOrThrowNoUnless(Authz.mayCreatePage(  // REFACTOR COULD pass a pageAuthzCtx instead [5FLK02]
      authorAndLevels, groupIds,
      pageRole, bodyPostType, pinWhere, anySlug = anySlug, anyFolder = anyFolder,
      inCategoriesRootLast = categoryPath,
      permissions), "EdE5JGK2W4")

    require(!anyFolder.exists(_.isEmpty), "EsE6JGKE3")
    // (Empty slug ok though, e.g. homepage.)
    require(!titleSource.isEmpty && !titleHtmlSanitized.isEmpty, "EsE7MGK24")
    require(!bodySource.isEmpty && !bodyHtmlSanitized.isEmpty, "EsE1WKUQ5")
    require(pinOrder.isDefined == pinWhere.isDefined, "Ese5MJK2")

    val pageSlug = anySlug.getOrElse({
        context.nashorn.slugifyTitle(titleSource)
    }).take(PagePath.MaxSlugLength).dropRightWhile(_ == '-').dropWhile(_ == '-')

    COULD // try to move this authz + review-reason check to ed.server.auth.Authz?
    val (reviewReasons: Seq[ReviewReason], shallApprove) =
      throwOrFindReviewNewPageReasons(authorAndLevels, pageRole, transaction)

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
      if (transaction.loadCategory(categoryId).isDefined) {
        throwForbidden("DwE5KPW2", s"Category already exists, id: $categoryId")
      }
    }
    else {
      anyCategoryId foreach { categoryId =>
          val category = transaction.loadCategory(categoryId) getOrElse throwNotFound(
            "DwE4KGP8", s"Category not found, id: $categoryId")
          if (category.isRoot)
            throwForbidden("DwE5GJU0", o"""The root category cannot have any child pages;
              use the Uncategorized category instead""")
          if (category.isLocked)
            throwForbidden("DwE4KFW2", "Category locked")
          if (category.isFrozen)
            throwForbidden("DwE1QXF2", "Category frozen")
          if (category.isDeleted)
            throwForbidden("DwE6GPY2", "Category deleted")
      }
    }

    val folder = anyFolder getOrElse "/"
    SECURITY // Maybe page id shouldn't be public? [rand-page-id] To prevent people from
    // discovering all pages. E.g. iterating through all discussions, in a public blog.
    val pageId = transaction.nextPageId()
    val siteId = transaction.siteId // [5GKEPMW2] remove this row later
    val pagePath = PagePath(siteId, folder = folder, pageId = Some(pageId),
      showId = showId, pageSlug = pageSlug)

    val titleUniqueId = transaction.nextPostId()
    val bodyUniqueId = titleUniqueId + 1

    val titlePost = Post.createTitle(
      uniqueId = titleUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorId,
      source = titleSource,
      htmlSanitized = titleHtmlSanitized,
      approvedById = approvedById)

    val bodyPost = Post.createBody(
      uniqueId = bodyUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorId,
      source = bodySource,
      htmlSanitized = bodyHtmlSanitized,
      postType = bodyPostType,
      approvedById = approvedById)
      .copy(
        bodyHiddenAt = ifThenSome(hidePageBody, now.toJavaDate),
        bodyHiddenById = ifThenSome(hidePageBody, authorId),
        bodyHiddenReason = None) // add `hiddenReason` function parameter?

    val uploadPaths = findUploadRefsInPost(bodyPost)

    val pageMeta = PageMeta.forNewPage(pageId, pageRole, authorId, now.toJavaDate,
      numPostsTotal = 2, // title & body
      layout = layout,
      pinOrder = pinOrder, pinWhere = pinWhere,
      categoryId = anyCategoryId, embeddingUrl = None, publishDirectly = true,
      hidden = approvedById.isEmpty) // [7AWU2R0]

    val reviewTask = if (reviewReasons.isEmpty) None
    else Some(ReviewTask(
      id = transaction.nextReviewTaskId(),
      reasons = reviewReasons.to[immutable.Seq],
      createdById = SystemUserId,
      createdAt = now.toJavaDate,
      createdAtRevNr = Some(bodyPost.currentRevisionNr),
      maybeBadUserId = authorId,
      pageId = Some(pageId),
      postId = Some(bodyPost.id),
      postNr = Some(bodyPost.nr)))

    val auditLogEntry = AuditLogEntry(
      siteId = siteId,
      id = AuditLogEntry.UnassignedId,
      didWhat = AuditLogEntryType.NewPage,
      doerId = authorId,
      doneAt = now.toJavaDate,
      browserIdData = byWho.browserIdData,
      pageId = Some(pageId),
      pageRole = Some(pageRole),
      uniquePostId = Some(bodyPost.id),
      postNr = Some(bodyPost.nr))

    val stats = UserStats(
      authorId,
      lastSeenAt = now,
      lastPostedAt = Some(now),
      firstNewTopicAt = Some(now),
      numDiscourseTopicsCreated = pageRole.isChat ? 0 | 1,
      numChatTopicsCreated = pageRole.isChat ? 1 | 0)

    addUserStats(stats)(transaction)
    transaction.insertPageMetaMarkSectionPageStale(pageMeta)
    transaction.insertPagePath(pagePath)
    transaction.insertPost(titlePost)
    transaction.insertPost(bodyPost)
    // By default, one follows all activity on a page one has created — unless this is some page
    // that gets auto created by System. [EXCLSYS]
    if (author.id != SystemUserId) {
      transaction.saveUserPageSettings(
        authorId, pageId = pageId, UserPageSettings(NotfLevel.WatchingAll))
    }
    if (approvedById.isDefined) {
      updatePagePopularity(PreLoadedPageParts(pageId, Vector(titlePost, bodyPost)), transaction)
    }
    uploadPaths foreach { hashPathSuffix =>
      transaction.insertUploadedFileReference(bodyPost.id, hashPathSuffix, authorId)
    }

    altPageId.foreach(transaction.insertAltPageId(_, realPageId = pageId))
    if (altPageId != embeddingUrl) {
      // If the url already points to another embedded discussion, keep it pointing to the old one.
      // Then, seems like lower risk for some hijack-a-discussion-by-forging-the-url security issue.
      embeddingUrl.foreach(transaction.insertAltPageIdIfFree(_, realPageId = pageId))
    }

    reviewTask.foreach(transaction.upsertReviewTask)
    insertAuditLogEntry(auditLogEntry, transaction)

    transaction.indexPostsSoon(titlePost, bodyPost)
    spamRelReqStuff.foreach(transaction.spamCheckPostsSoon(byWho, _, titlePost, bodyPost))

    // Don't start rendering html for this page in the background. [5KWC58]
    // (Instead, when the user requests the page, we'll render it directly in
    // the request thread. Otherwise either 1) the request thread would have to wait
    // for the background thread (which is too complicated) or 2) we'd generate
    // the page twice, both in the request thread and in a background thread.)

    (pagePath, bodyPost)
  }


  def throwOrFindReviewNewPageReasons(author: UserAndLevels, pageRole: PageRole,
        transaction: SiteTransaction): (Seq[ReviewReason], Boolean) = {
    throwOrFindReviewReasonsImpl(author, pageMeta = None, newPageRole = Some(pageRole), transaction)
  }


  def unpinPage(pageId: PageId, requester: User) {
    pinOrUnpin(pageId, pinWhere = None, pinOrder = None, requester)
  }


  def pinPage(pageId: PageId, pinWhere: PinPageWhere, pinOrder: Int, requester: User): Unit = {
    pinOrUnpin(pageId, Some(pinWhere), Some(pinOrder), requester)
  }


  private def pinOrUnpin(pageId: PageId, pinWhere: Option[PinPageWhere], pinOrder: Option[Int],
        requester: User) {
    require(pinWhere.isDefined == pinOrder.isDefined, "EdE2WRT5")
    val didWhat = pinWhere match {
      case None => "unpinned this topic"
      case Some(_) => "pinned this topic"
    }
    val (oldMeta, newMeta) = readWriteTransaction { transaction =>
      val oldMeta = transaction.loadThePageMeta(pageId)
      val newMeta = oldMeta.copy(pinWhere = pinWhere, pinOrder = pinOrder,
        version = oldMeta.version + 1, numPostsTotal = oldMeta.numPostsTotal + 1)

      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      addMetaMessage(requester, didWhat, pageId, transaction)

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
    val answeredAt = readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      if (oldMeta.pageRole != PageRole.Question)
        throwBadReq("DwE4KGP2", "This page is not a question so no answer can be selected")

      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE8JGY3", "Only staff and the topic author can accept an answer")

      val post = transaction.loadThePost(postUniqueId)
      if (post.pageId != pageId)
        throwBadReq("DwE5G2Y2", "That post is placed on another page, page id: " + post.pageId)

      // Pages are probably closed for good reasons, e.g. off-topic, and then it gives
      // the wrong impression if the author can still select an answer. It would seem as
      // if that kind of questions were allowed / on-topic.
      if (oldMeta.closedAt.isDefined)
        throwBadReq("DwE0PG26", "This question is closed, therefore no answer can be accepted")

      val answeredAt = Some(transaction.now.toJavaDate)
      val newMeta = oldMeta.copy(
        answeredAt = answeredAt,
        answerPostUniqueId = Some(postUniqueId),
        closedAt = answeredAt,
        version = oldMeta.version + 1)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      // (COULD wait 5 minutes (in case the answer gets un-accepted) then send email
      // to the author of the answer)
      answeredAt
    }
    refreshPageInMemCache(pageId)
    answeredAt
  }


  def ifAuthUnacceptAnswer(pageId: PageId, userId: UserId, browserIdData: BrowserIdData) {
    readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE2GKU4", "Only staff and the topic author can unaccept the answer")

      // Dupl line. [4UKP58B]
      val newMeta = oldMeta.copy(answeredAt = None, answerPostUniqueId = None, closedAt = None,
        version = oldMeta.version + 1)

      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
    }
    refreshPageInMemCache(pageId)
  }


  /** Changes status from New to Planned to Done, and back to New again.
    */
  def cyclePageDoneIfAuth(pageId: PageId, userId: UserId, browserIdData: BrowserIdData)
        : PageMeta = {
    val now = globals.now()
    val newMeta = readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("EsE4YK0W2", "Only the page author and staff may change the page status")

      val pageRole = oldMeta.pageRole
      if (pageRole != PageRole.Problem && pageRole != PageRole.Idea &&
          pageRole != PageRole.UsabilityTesting)
        throwBadReq("DwE6KEW2", "This page cannot be marked as planned or done")

      var newPlannedAt: Option[ju.Date] = None
      var newStartedAt: Option[ju.Date] = None
      var newDoneAt: Option[ju.Date] = None
      var newClosedAt: Option[ju.Date] = None
      var newStatus = ""

      if (oldMeta.doneAt.isDefined) {
        // Change from status Done —> to New.
        newStatus = "New"
      }
      else if (oldMeta.startedAt.isDefined) {
        // Started —> Done
        newPlannedAt = oldMeta.plannedAt
        newStartedAt = oldMeta.startedAt
        newDoneAt = Some(now.toJavaDate)
        newClosedAt = Some(now.toJavaDate)
        newStatus = "Done"
      }
      else if (oldMeta.plannedAt.isDefined) {
        // Planned —> Started.
        newPlannedAt = oldMeta.plannedAt
        newStartedAt = Some(now.toJavaDate)
        newStatus = "Started"
      }
      else if (pageRole == PageRole.UsabilityTesting) {  // [plugin]
        // These get Done after just one status change, there's no Planned or Started. So bump to Done.
        newDoneAt = Some(now.toJavaDate)
        newClosedAt = Some(now.toJavaDate)
        newStatus = "Done"
      }
      else {
        // Waiting —> Planned
        newPlannedAt = Some(now.toJavaDate)
        newStatus = "Planned"
      }

      val newMeta = oldMeta.copy(
        plannedAt = newPlannedAt,
        startedAt = newStartedAt,
        doneAt = newDoneAt,
        closedAt = newClosedAt,
        numPostsTotal = oldMeta.numPostsTotal + 1,
        version = oldMeta.version + 1)

      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // Update audit log
      addMetaMessage(user, s" marked this topic as $newStatus", pageId, transaction)

      newMeta
    }
    refreshPageInMemCache(pageId)
    newMeta
  }


  def ifAuthTogglePageClosed(pageId: PageId, userId: UserId, browserIdData: BrowserIdData)
        : Option[ju.Date] = {
    val now = globals.now()
    val newClosedAt = readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      throwIfMayNotSeePage(oldMeta, Some(user))(transaction)

      if (!oldMeta.pageRole.canClose)
        throwBadRequest("DwE4PKF7", s"Cannot close pages of type ${oldMeta.pageRole}")

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

      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // Update audit log
      addMetaMessage(user, s" $didWhat this topic", pageId, transaction)

      newClosedAt
    }
    refreshPageInMemCache(pageId)
    newClosedAt
  }


  def deletePagesIfAuth(pageIds: Seq[PageId], deleterId: UserId, browserIdData: BrowserIdData,
        undelete: Boolean) {
    readWriteTransaction { transaction =>
      // SHOULD LATER: [4GWRQA28] If is sub community (= forum page), delete the root category too,
      // so all topics in the sub community will get deleted.
      // And remove the sub community from the watchbar's Communities section.
      // (And if undeleting the sub community, undelete the root category too.)
      deletePagesImpl(pageIds, deleterId, browserIdData, undelete = undelete)(transaction)
    }
  }


  def deletePagesImpl(pageIds: Seq[PageId], deleterId: UserId, browserIdData: BrowserIdData,
        undelete: Boolean = false)(transaction: SiteTransaction) {

      val deleter = transaction.loadTheUser(deleterId)
      if (!deleter.isStaff)
        throwForbidden("EsE7YKP424_", "Only staff may (un)delete pages")

      for (pageId <- pageIds ; pageMeta <- transaction.loadPageMeta(pageId)) {
        if ((pageMeta.pageRole.isSection || pageMeta.pageRole == PageRole.CustomHtmlPage) &&
            !deleter.isAdmin)
          throwForbidden("EsE5GKF23_", "Only admin may (un)delete sections and HTML pages")

        val baseAuditEntry = AuditLogEntry(
          siteId = siteId,
          id = AuditLogEntry.UnassignedId,
          didWhat = AuditLogEntryType.DeletePage,
          doerId = deleterId,
          doneAt = transaction.now.toJavaDate,
          browserIdData = browserIdData,
          pageId = Some(pageId),
          pageRole = Some(pageMeta.pageRole))

        var (newMeta, auditLogEntry) =
          if (undelete) {
            (pageMeta.copy(deletedAt = None, version = pageMeta.version + 1),
              baseAuditEntry.copy(didWhat = AuditLogEntryType.UndeletePage))
          }
          else {
            (pageMeta.copy(deletedAt = Some(transaction.now.toJavaDate),
              version = pageMeta.version + 1), baseAuditEntry)
          }
        newMeta = newMeta.copy(numPostsTotal = newMeta.numPostsTotal + 1)

        transaction.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)
        transaction.insertAuditLogEntry(auditLogEntry)
        transaction.indexAllPostsOnPage(pageId)
        // (Keep in top-topics table, so staff can list popular-but-deleted topics.)

        val un = undelete ? "un" | ""
        addMetaMessage(deleter, s" ${un}deleted this topic", pageId, transaction)
      }

    pageIds foreach refreshPageInMemCache
  }


  def addMetaMessage(doer: User, message: String, pageId: PageId, tx: SiteTransaction) {
    // Some dupl code [3GTKYA02]
    val page = PageDao(pageId, tx)
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
        transaction: SiteTransaction) {
    val page = PageDao(pageId, transaction)
    val newMeta = page.meta.copy(
      lastReplyAt = page.parts.lastVisibleReply.map(_.createdAt),
      lastReplyById = page.parts.lastVisibleReply.map(_.createdById),
      frequentPosterIds = page.parts.frequentPosterIds,
      numLikes = page.parts.numLikes,
      numWrongs = page.parts.numWrongs,
      numBurys = page.parts.numBurys,
      numUnwanteds = page.parts.numUnwanteds,
      numRepliesVisible = page.parts.numRepliesVisible,
      numRepliesTotal = page.parts.numRepliesTotal,
      numPostsTotal = page.parts.numPostsTotal,
      numOrigPostLikeVotes = page.parts.theBody.numLikeVotes,
      numOrigPostWrongVotes = page.parts.theBody.numWrongVotes,
      numOrigPostBuryVotes = page.parts.theBody.numBuryVotes,
      numOrigPostUnwantedVotes = page.parts.theBody.numUnwantedVotes,
      numOrigPostRepliesVisible = page.parts.numOrigPostRepliesVisible,
      answeredAt = page.anyAnswerPost.map(_.createdAt),
      answerPostUniqueId = page.anyAnswerPost.map(_.id),
      version = page.version + 1)
    transaction.updatePageMeta(newMeta, oldMeta = page.meta,
      markSectionPageStale = markSectionPageStale)
  }
}

