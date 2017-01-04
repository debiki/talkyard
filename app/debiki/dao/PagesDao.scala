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
import com.debiki.core.User.SystemUserId
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.http.throwIndistinguishableNotFound
import io.efdi.server.notf.NotificationGenerator
import java.{util => ju}

import scala.collection.{immutable, mutable}


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


  def createPage(pageRole: PageRole, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        anyFolder: Option[String], anySlug: Option[String], titleTextAndHtml: TextAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, byWho: Who,
        spamRelReqStuff: SpamRelReqStuff): PagePath = {

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
        pinOrder = None, pinWhere = None, byWho, Some(spamRelReqStuff), transaction)

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
      byWho, spamRelReqStuff, transaction = transaction)


  def createPageImpl(pageRole: PageRole, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
      anyFolder: Option[String], anySlug: Option[String], showId: Boolean,
      titleSource: String, titleHtmlSanitized: String,
      bodySource: String, bodyHtmlSanitized: String,
      pinOrder: Option[Int], pinWhere: Option[PinPageWhere],
      byWho: Who, spamRelReqStuff: Option[SpamRelReqStuff],
      transaction: SiteTransaction, hidePageBody: Boolean = false,
      bodyPostType: PostType = PostType.Normal): (PagePath, Post) = {

    val authorId = byWho.id
    val authorAndLevels = loadUserAndLevels(byWho, transaction)
    val author = transaction.loadUser(authorId) getOrElse throwForbidden(
      "DwE9GK32", s"User not found, id: $authorId")
    anyCategoryId match {
      case None =>
        if (pageRole != PageRole.FormalMessage && !author.isStaff)
          throwForbidden("EsE8GY32", "Only staff may create pages outside any category")
      case Some(categoryId) =>
        throwIfMayNotCreatePageIn(categoryId, Some(author))(transaction)
    }

    require(!anyFolder.exists(_.isEmpty), "EsE6JGKE3")
    // (Empty slug ok though, e.g. homepage.)
    require(!titleSource.isEmpty && !titleHtmlSanitized.isEmpty, "EsE7MGK24")
    require(!bodySource.isEmpty && !bodyHtmlSanitized.isEmpty, "EsE1WKUQ5")
    require(pinOrder.isDefined == pinWhere.isDefined, "Ese5MJK2")

    // Don't allow more than ... 10 topics with no critique? For now only.
    // For now, don't restrict PageRole.UsabilityTesting — I'll "just" sort by oldest-first instead?
    if (pageRole == PageRole.Critique) { // [plugin] [85SKW32]
      anyCategoryId foreach { categoryId =>
        val pages = loadPagesInCategory(categoryId, includeDescendants = true,
          isStaff = false, restrictedOnly = false,
          PageQuery(PageOrderOffset.Any, PageFilter.ShowWaiting), limit = 20)
        // Client side, the limit is 10. Let's allow a few more topics in case people start
        // writing before the limit is reached but submit afterwards.
        if (pages.length >= 10 + 5)  // for now only
          throwForbidden("DwE8GUM2", o"""Too many topics waiting for critique,
            you cannot submit more topics at this time, sorry. Check back later.""")
      }
    }

    val pageSlug = (anySlug match {
      case Some(slug) =>
        if (!author.isStaff && slug.nonEmpty)
          throwForbidden("DwE4KFW87", "Only staff may specify page slug")
        slug
      case None =>
        commonmarkRenderer.slugifyTitle(titleSource)
    }).take(PagePath.MaxSlugLength).dropRightWhile(_ == '-').dropWhile(_ == '-')

    val (reviewReasons: Seq[ReviewReason], shallApprove) =
      throwOrFindReviewNewPageReasons(authorAndLevels, pageRole, transaction)

    val approvedById =
      if (author.isStaff) {
        dieIf(!shallApprove, "EsE2UPU70")
        Some(author.id)
      }
      else if (shallApprove) Some(SystemUserId)
      else None

    if (!author.isStaff && pageRole.staffOnly)
      throwForbidden("DwE5KEPY2", s"Forbidden page type: $pageRole")

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
    val pageId = transaction.nextPageId()
    val siteId = transaction.siteId // [5GKEPMW2] remove this row later
    val pagePath = PagePath(siteId, folder = folder, pageId = Some(pageId),
      showId = showId, pageSlug = pageSlug)

    val titleUniqueId = transaction.nextPostId()
    val bodyUniqueId = titleUniqueId + 1

    val titlePost = Post.createTitle(
      uniqueId = titleUniqueId,
      pageId = pageId,
      createdAt = transaction.currentTime,
      createdById = authorId,
      source = titleSource,
      htmlSanitized = titleHtmlSanitized,
      approvedById = approvedById)

    val bodyPost = Post.createBody(
      uniqueId = bodyUniqueId,
      pageId = pageId,
      createdAt = transaction.currentTime,
      createdById = authorId,
      source = bodySource,
      htmlSanitized = bodyHtmlSanitized,
      postType = bodyPostType,
      approvedById = approvedById)
      .copy(
        bodyHiddenAt = ifThenSome(hidePageBody, transaction.currentTime),
        bodyHiddenById = ifThenSome(hidePageBody, authorId),
        bodyHiddenReason = None) // add `hiddenReason` function parameter?

    val uploadPaths = UploadsDao.findUploadRefsInPost(bodyPost)

    val pageMeta = PageMeta.forNewPage(pageId, pageRole, authorId, transaction.currentTime,
      pinOrder = pinOrder, pinWhere = pinWhere,
      categoryId = anyCategoryId, url = None, publishDirectly = true,
      hidden = approvedById.isEmpty) // [7AWU2R0]

    val reviewTask = if (reviewReasons.isEmpty) None
    else Some(ReviewTask(
      id = transaction.nextReviewTaskId(),
      reasons = reviewReasons.to[immutable.Seq],
      createdById = SystemUserId,
      createdAt = transaction.currentTime,
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
      doneAt = transaction.currentTime,
      browserIdData = byWho.browserIdData,
      pageId = Some(pageId),
      pageRole = Some(pageRole),
      uniquePostId = Some(bodyPost.id),
      postNr = Some(bodyPost.nr))

    transaction.insertPageMetaMarkSectionPageStale(pageMeta)
    transaction.insertPagePath(pagePath)
    transaction.insertPost(titlePost)
    transaction.insertPost(bodyPost)
    uploadPaths foreach { hashPathSuffix =>
      transaction.insertUploadedFileReference(bodyPost.id, hashPathSuffix, authorId)
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
    throwOrFindReviewReasonsImpl(author, page = None, newPageRole = Some(pageRole), transaction)
  }


  def unpinPage(pageId: PageId) {
    readWriteTransaction { transaction =>
      val oldMeta = transaction.loadThePageMeta(pageId)
      val newMeta = oldMeta.copy(pinWhere = None, pinOrder = None, version = oldMeta.version + 1)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
    }
    refreshPageInMemCache(pageId)
  }


  def pinPage(pageId: PageId, pinWhere: PinPageWhere, pinOrder: Int) {
    readWriteTransaction { transaction =>
      val oldMeta = transaction.loadThePageMeta(pageId)
      val newMeta = oldMeta.copy(pinWhere = Some(pinWhere), pinOrder = Some(pinOrder),
        version = oldMeta.version + 1)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
    }
    refreshPageInMemCache(pageId)
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

      val answeredAt = Some(transaction.currentTime)
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
    val newMeta = readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("EsE4YK0W2", "Only the page author and staff may change the page status")

      val pageRole = oldMeta.pageRole
      if (pageRole != PageRole.Problem && pageRole != PageRole.Idea && pageRole != PageRole.ToDo)
        throwBadReq("DwE6KEW2", "This page cannot be marked as planned or done")

      var newPlannedAt: Option[ju.Date] = None
      var newDoneAt: Option[ju.Date] = None
      var newClosedAt: Option[ju.Date] = None

      if (oldMeta.doneAt.isDefined) {
        // Keep all None, except for todos because they cannot be not-planned.
        if (pageRole == PageRole.ToDo) {
          newPlannedAt = oldMeta.plannedAt
        }
      }
      else if (oldMeta.plannedAt.isDefined) {
        newPlannedAt = oldMeta.plannedAt
        newDoneAt = Some(transaction.currentTime)
        newClosedAt = Some(transaction.currentTime)
      }
      else {
        newPlannedAt = Some(transaction.currentTime)
      }

      val newMeta = oldMeta.copy(
        plannedAt = newPlannedAt,
        doneAt = newDoneAt,
        closedAt = newClosedAt,
        version = oldMeta.version + 1)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      newMeta
    }
    refreshPageInMemCache(pageId)
    newMeta
  }


  def ifAuthTogglePageClosed(pageId: PageId, userId: UserId, browserIdData: BrowserIdData)
        : Option[ju.Date] = {
    val newClosedAt = readWriteTransaction { transaction =>
      val user = transaction.loadTheUser(userId)
      val oldMeta = transaction.loadThePageMeta(pageId)
      throwIfMayNotSeePage(oldMeta, Some(user))(transaction)

      if (!oldMeta.pageRole.canClose)
        throwBadRequest("DwE4PKF7", s"Cannot close pages of type ${oldMeta.pageRole}")

      if (!user.isStaff && user.id != oldMeta.authorId)
        throwForbidden("DwE5JPK7", "Only staff and the topic author can toggle it closed")

      val newClosedAt: Option[ju.Date] = oldMeta.closedAt match {
        case None => Some(transaction.currentTime)
        case Some(_) => None
      }
      val newMeta = oldMeta.copy(closedAt = newClosedAt, version = oldMeta.version + 1)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      // (COULD update audit log)
      newClosedAt
    }
    refreshPageInMemCache(pageId)
    newClosedAt
  }


  def deletePagesIfAuth(pageIds: Seq[PageId], deleterId: UserId, browserIdData: BrowserIdData,
        undelete: Boolean) {
    readWriteTransaction { transaction =>
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
          doneAt = transaction.currentTime,
          browserIdData = browserIdData,
          pageId = Some(pageId),
          pageRole = Some(pageMeta.pageRole))

        val (newMeta, auditLogEntry) =
          if (undelete) {
            (pageMeta.copy(deletedAt = None, version = pageMeta.version + 1),
              baseAuditEntry.copy(didWhat = AuditLogEntryType.UndeletePage))
          }
          else {
            (pageMeta.copy(deletedAt = Some(transaction.currentTime),
              version = pageMeta.version + 1), baseAuditEntry)
          }

        transaction.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)
        transaction.insertAuditLogEntry(auditLogEntry)
        transaction.indexAllPostsOnPage(pageId)
      }

    pageIds foreach refreshPageInMemCache
  }


  def joinOrLeavePageIfAuth(pageId: PageId, join: Boolean, who: Who): Option[BareWatchbar] = {
    if (User.isGuestId(who.id))
      throwForbidden("EsE3GBS5", "Guest users cannot join/leave pages")

    val watchbarsByUserId = addRemoveUsersToPageImpl(Set(who.id), pageId, add = join, who)
    val anyNewWatchbar = watchbarsByUserId.get(who.id)
    anyNewWatchbar
  }


  def addUsersToPage(userIds: Set[UserId], pageId: PageId, byWho: Who) {
    addRemoveUsersToPageImpl(userIds, pageId, add = true, byWho)
  }


  def removeUsersFromPage(userIds: Set[UserId], pageId: PageId, byWho: Who) {
    addRemoveUsersToPageImpl(userIds, pageId, add = false, byWho)
  }


  private def addRemoveUsersToPageImpl(userIds: Set[UserId], pageId: PageId, add: Boolean,
        byWho: Who): Map[UserId, BareWatchbar] = {
    if (byWho.isGuest)
      throwForbidden("EsE2GK7S", "Guests cannot add/remove people to pages")

    if (userIds.size > 50)
      throwForbidden("EsE5DKTW02", "Cannot add/remove more than 50 people at a time")

    if (userIds.exists(User.isGuestId) && add)
      throwForbidden("EsE5PKW1", "Cannot add guests to a page")

    var couldntAdd: Set[UserId] = Set.empty

    val pageMeta = readWriteTransaction { transaction =>
      val pageMeta = transaction.loadPageMeta(pageId) getOrElse
        throwIndistinguishableNotFound("42PKD0")

      val usersById = transaction.loadMembersAsMap(userIds + byWho.id)
      val me = usersById.getOrElse(byWho.id, throwForbidden(
        "EsE6KFE0X", s"Your user cannot be found, id: ${byWho.id}"))

      lazy val numMembersAlready = transaction.loadMessageMembers(pageId).size
      if (add && numMembersAlready + userIds.size > 200) {
        // I guess something, not sure what?, would break if too many people join
        // the same page.
        throwForbidden("EsE4FK0Y2", o"""Sorry but currently more than 200 page members
            isn't allowed. There are $numMembersAlready page members already""")
      }

      throwIfMayNotSeePage(pageMeta, Some(me))(transaction)

      val addingRemovingMyselfOnly = userIds.size == 1 && userIds.head == me.id

      if (!me.isStaff && me.id != pageMeta.authorId && !addingRemovingMyselfOnly)
        throwForbidden(
          "EsE28PDW9", "Only staff and the page author may add/remove people to/from the page")

      if (add) {
        if (!pageMeta.pageRole.isGroupTalk)
          throwForbidden("EsE8TBP0", s"Cannot add people to pages of type ${pageMeta.pageRole}")

        userIds.find(!usersById.contains(_)) foreach { missingUserId =>
          throwForbidden("EsE5PKS40", s"User not found, id: $missingUserId, cannot add to page")
        }

        userIds foreach { id =>
          COULD_OPTIMIZE // batch insert all users at once
          val wasAdded = transaction.insertMessageMember(pageId, userId = id, addedById = me.id)
          if (!wasAdded) {
            // Someone else has added that user already. Could happen e.g. if someone adds you
            // to a chat channel, and you attempt to join it yourself at the same time.
            couldntAdd += id
          }
        }
      }
      else {
        userIds foreach { id =>
          transaction.removePageMember(pageId, userId = id)
        }
      }

      // Bump the page version, so the cached page json will be regenerated, now including
      // this new page member.
      // COULD add a numMembers field, and show # members, instead of # comments,
      // for chat topics, in the forum topic list? (because # comments in a chat channel is
      // rather pointless, instead, # new comments per time unit matters more, but then it's
      // simpler to instead show # users?)
      transaction.updatePageMeta(pageMeta, oldMeta = pageMeta, markSectionPageStale = false)
      pageMeta
    }

    SHOULD // push new member notf to browsers, so that this gets updated: [5FKE0WY2]
    // - new members' watchbars
    // - everyone's context bar (the users list)
    // - the Join Chat button (disappears/appears)

    // The page JSON includes a list of all page members, so:
    refreshPageInMemCache(pageId)

    var watchbarsByUserId = Map[UserId, BareWatchbar]()
    userIds foreach { userId =>
      if (couldntAdd.contains(userId)) {
        // Need not update the watchbar.
      }
      else {
        addRemovePageToWatchbar(pageMeta, userId, add) foreach { newWatchbar =>
          watchbarsByUserId += userId -> newWatchbar
        }
      }
    }
    watchbarsByUserId
  }


  private def addRemovePageToWatchbar(pageMeta: PageMeta, userId: UserId, add: Boolean)
        : Option[BareWatchbar] = {
    BUG; RACE // when loading & saving the watchbar. E.g. if a user joins a page herself, and
    // another member adds her to the page, or another page, at the same time.

    val oldWatchbar = getOrCreateWatchbar(userId)
    val newWatchbar = {
      if (add) oldWatchbar.addPage(pageMeta, hasSeenIt = true)
      else oldWatchbar.removePageTryKeepInRecent(pageMeta)
    }

    if (oldWatchbar == newWatchbar) {
      // This happens if we're adding a user whose in-memory watchbar got created in
      // `loadWatchbar` above — then the watchbar will likely be up-to-date already, here.
      return None
    }

    saveWatchbar(userId, newWatchbar)

    // If pages were added to the watchbar, we should start watching them. If we left
    // a private page, it'll disappear from the watchbar — then we should stop watching it.
    if (oldWatchbar.watchedPageIds != newWatchbar.watchedPageIds) {
      pubSub.userWatchesPages(siteId, userId, newWatchbar.watchedPageIds)
    }

    Some(newWatchbar)
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

