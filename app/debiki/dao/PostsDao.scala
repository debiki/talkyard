/**
 * Copyright (c) 2014-2015 Kaj Magnus Lindberg
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
import com.debiki.core.EditedSettings.MaxNumFirstPosts
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.FirstReplyNr
import controllers.EditController
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.notf.NotificationGenerator
import io.efdi.server.pubsub.StorePatchMessage
import play.api.libs.json.JsValue
import play.{api => p}
import scala.collection.{mutable, immutable}
import scala.collection.mutable.ArrayBuffer
import PostsDao._


case class InsertPostResult(storePatchJson: JsValue, post: Post)


/** Loads and saves pages and page parts (e.g. posts and patches).
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  *
  * SHOULD make the full text search indexer work again
  */
trait PostsDao {
  self: SiteDao =>

  // 3 minutes
  val LastChatMessageRecentMs = 3 * 60 * 1000


  def insertReply(textAndHtml: TextAndHtml, pageId: PageId, replyToPostNrs: Set[PostNr],
        postType: PostType, authorId: UserId, browserIdData: BrowserIdData): InsertPostResult = {

    // Note: Fairly similar to createNewChatMessage() just below. [4UYKF21]

    if (textAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE6KEF2", "Empty reply")

    // Later: create 1 post of type multireply, with no text, per replied-to post,
    // and one post for the actual text and resulting location of this post.
    // Disabling for now, so I won't have to parse dw2_posts.multireply and convert
    // to many rows.
    if (replyToPostNrs.size > 1)
      throwNotImplemented("EsE7GKX2", o"""Please reply to one single person only.
        Multireplies temporarily disabled, sorry""")

    val (newPost, author, notifications) = readWriteTransaction { transaction =>
      val author = transaction.loadUser(authorId) getOrElse throwNotFound("DwE404UF3", "Bad user")
      val page = PageDao(pageId, transaction)
      throwIfMayNotPostTo(page, author)(transaction)

      if (page.role.isChat)
        throwForbidden("EsE50WG4", s"Page '${page.id}' is a chat page; cannot post normal replies")

      val uniqueId = transaction.nextPostId()
      val postNr = page.parts.highestReplyNr.map(_ + 1) getOrElse PageParts.FirstReplyNr
      val commonAncestorId = page.parts.findCommonAncestorNr(replyToPostNrs.toSeq)
      val anyParent =
        if (commonAncestorId == PageParts.NoNr) {
          // Flat chat comments might not reply to anyone in particular.
          // On embedded comments pages, there's no Original Post, so top level comments
          // have no parent post.
          if (postType != PostType.Flat && page.role != PageRole.EmbeddedComments)
            throwBadReq("DwE2CGW7", "Non-flat non-embedded comment with no parent post id")
          else
            None
        }
        else {
          val anyParent = page.parts.post(commonAncestorId)
          if (anyParent.isEmpty) {
            throwBadReq("DwEe8HD36", o"""Cannot reply to common ancestor post '$commonAncestorId';
                it does not exist""")
          }
          anyParent
        }
      if (anyParent.exists(_.deletedStatus.isDeleted))
        throwForbidden(
          "The parent post has been deleted; cannot reply to a deleted post", "DwE5KDE7")

      val (reviewReasons: Seq[ReviewReason], shallApprove) =
        throwOrFindReviewPostReasons(page, author, transaction)

      val approverId =
        if (author.isStaff) {
          dieIf(!shallApprove, "EsE5903")
          Some(author.id)
        }
        else if (shallApprove) Some(SystemUserId)
        else None

      val newPost = Post.create(
        uniqueId = uniqueId,
        pageId = pageId,
        postNr = postNr,
        parent = anyParent,
        multireplyPostNrs = (replyToPostNrs.size > 1) ? replyToPostNrs | Set.empty,
        postType = postType,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = textAndHtml.text,
        htmlSanitized = textAndHtml.safeHtml,
        approvedById = approverId)

      val numNewOrigPostReplies = (shallApprove && newPost.isOrigPostReply) ? 1 | 0
      val newFrequentPosterIds: Seq[UserId] =
        if (shallApprove)
          PageParts.findFrequentPosters(newPost +: page.parts.allPosts,
            ignoreIds = Set(page.meta.authorId, authorId))
        else
          page.meta.frequentPosterIds

      val oldMeta = page.meta
      val newMeta = oldMeta.copy(
        bumpedAt = page.isClosed ? oldMeta.bumpedAt | Some(transaction.currentTime),
        lastReplyAt = shallApprove ? Option(transaction.currentTime) | oldMeta.lastReplyAt,
        lastReplyById = shallApprove ? Option(authorId) | oldMeta.lastReplyById,
        frequentPosterIds = newFrequentPosterIds,
        numRepliesVisible = page.parts.numRepliesVisible + (shallApprove ? 1 | 0),
        numRepliesTotal = page.parts.numRepliesTotal + 1,
        numOrigPostRepliesVisible = page.parts.numOrigPostRepliesVisible + numNewOrigPostReplies,
        version = oldMeta.version + 1)

      val uploadRefs = UploadsDao.findUploadRefsInPost(newPost)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.NewPost,
        doerId = authorId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(newPost.uniqueId),
        postNr = Some(newPost.nr),
        targetPageId = anyParent.map(_.pageId),
        targetUniquePostId = anyParent.map(_.uniqueId),
        targetPostNr = anyParent.map(_.nr),
        targetUserId = anyParent.map(_.createdById))

      val anyReviewTask = if (reviewReasons.isEmpty) None
      else Some(ReviewTask(
        id = transaction.nextReviewTaskId(),
        reasons = reviewReasons.to[immutable.Seq],
        causedById = author.id,
        createdAt = transaction.currentTime,
        createdAtRevNr = Some(newPost.currentRevisionNr),
        postId = Some(newPost.uniqueId),
        postNr = Some(newPost.nr)))

      transaction.insertPost(newPost)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = shallApprove)
      uploadRefs foreach { uploadRef =>
        transaction.insertUploadedFileReference(newPost.uniqueId, uploadRef, authorId)
      }
      insertAuditLogEntry(auditLogEntry, transaction)
      anyReviewTask.foreach(transaction.upsertReviewTask)

      val notifications = NotificationGenerator(transaction).generateForNewPost(page, newPost)
      transaction.saveDeleteNotifications(notifications)

      (newPost, author, notifications)
    }

    refreshPageInAnyCache(pageId)

    val storePatchJson = ReactJson.makeStorePatch(newPost, author, this)
    pubSub.publish(StorePatchMessage(siteId, pageId, storePatchJson, notifications),
      byId = author.id)

    InsertPostResult(storePatchJson, newPost)
  }


  def throwOrFindReviewPostReasons(page: PageDao, author: User, transaction: SiteTransaction)
        : (Seq[ReviewReason], Boolean) = {
    throwOrFindReviewReasonsImpl(author, Some(page), transaction)
  }


  def throwOrFindReviewReasonsImpl(author: User, page: Option[PageDao],
        transaction: SiteTransaction): (Seq[ReviewReason], Boolean) = {
    if (author.isStaff)
      return (Nil, true)

    // SECURITY COULD analyze the author's trust level and past actions, and
    // based on that, approve, reject or review later.

    val settings = loadWholeSiteSettings(transaction)
    val numFirstToAllow = math.min(MaxNumFirstPosts, settings.numFirstPostsToAllow)
    val numFirstToApprove = math.min(MaxNumFirstPosts, settings.numFirstPostsToApprove)
    val numFirstToNotify = math.min(MaxNumFirstPosts, settings.numFirstPostsToReview)

    val reviewReasons = mutable.ArrayBuffer[ReviewReason]()
    var autoApprove = true

    if ((numFirstToAllow > 0 && numFirstToApprove > 0) || numFirstToNotify > 0) {
      val firstPosts = transaction.loadPostsBy(author.id, includeTitles = false,
        includeChatMessages = false, limit = MaxNumFirstPosts, OrderBy.OldestFirst)

      val numApproved = firstPosts.count(_.isSomeVersionApproved)
      val numFirst = firstPosts.length
      if (numApproved < numFirstToApprove) {
        // This user is still under evaluation (is s/he a spammer or not?).
        autoApprove = false
        if (numFirst >= numFirstToAllow)
          throwForbidden("_EsE6YKF2_", o"""You cannot post more posts until a moderator has
              approved your first posts""")
      }

      if (numFirst < math.min(MaxNumFirstPosts, numFirstToApprove + numFirstToNotify)) {
        reviewReasons.append(ReviewReason.IsByNewUser, ReviewReason.NewPost)
      }
    }

    if (page.exists(_.isClosed)) {
      // The topic won't be bumped, so no one might see this post, so staff should review it.
      // Could skip this if the user is trusted.
      reviewReasons.append(ReviewReason.NoBumpPost)
    }

    (reviewReasons, autoApprove)
  }


  /** If the chat message author just posted another chat message, just above, no other
    * messages in between — then we'll append this new message to the old one, instead
    * of creating a new different chat message.
    */
  def insertChatMessage(textAndHtml: TextAndHtml, pageId: PageId,
        authorId: UserId, browserIdData: BrowserIdData): InsertPostResult = {

    if (textAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE2U3K8", "Empty chat message")

    val (post, author, notifications) = readWriteTransaction { transaction =>
      val author = transaction.loadUser(authorId) getOrElse
        throwNotFound("DwE8YK32", "Author not found")
      val page = PageDao(pageId, transaction)
      throwIfMayNotPostTo(page, author)(transaction)

      val pageMemberIds = transaction.loadMessageMembers(pageId)
      if (!pageMemberIds.contains(authorId))
        throwForbidden("EsE4UGY7", "You are not a member of this chat channel")

      // Try to append to the last message, instead of creating a new one. That looks
      // better in the browser (fewer avatars & sent-by info), + we'll save disk and
      // render a little bit faster.
      val anyLastMessage = page.parts.lastPostButNotOrigPost
      val anyLastMessageSameUserRecently = anyLastMessage filter { post =>
        post.createdById == authorId &&
          transaction.currentTime.getTime - post.createdAt.getTime < LastChatMessageRecentMs
      }
      val (postNr, notfs) = anyLastMessageSameUserRecently match {
        case Some(lastMessage) =>
          appendToLastChatMessage(lastMessage, textAndHtml, authorId, browserIdData, transaction)
        case None =>
          createNewChatMessage(page, textAndHtml, authorId, browserIdData, transaction)
      }
      (postNr, author, notfs)
    }

    refreshPageInAnyCache(pageId)

    val storePatchJson = ReactJson.makeStorePatch(post, author, this)
    pubSub.publish(StorePatchMessage(siteId, pageId, storePatchJson, notifications),
      byId = author.id)

    InsertPostResult(storePatchJson, post)
  }


  private def createNewChatMessage(page: PageDao, textAndHtml: TextAndHtml, authorId: UserId,
        browserIdData: BrowserIdData, transaction: SiteTransaction)
        : (Post, Notifications) = {

    // Note: Farily similar to insertReply() a bit above. [4UYKF21]

    val uniqueId = transaction.nextPostId()
    val postNr = page.parts.highestReplyNr.map(_ + 1) getOrElse PageParts.FirstReplyNr
    if (!page.role.isChat)
      throwForbidden("EsE6JU04", s"Page '${page.id}' is not a chat page")

    // This is better than some database foreign key error.
    transaction.loadUser(authorId) getOrElse throwNotFound("EsE2YG8", "Bad user")

    val newPost = Post.create(
      uniqueId = uniqueId,
      pageId = page.id,
      postNr = postNr,
      parent = None,
      multireplyPostNrs = Set.empty,
      postType = PostType.ChatMessage,
      createdAt = transaction.currentTime,
      createdById = authorId,
      source = textAndHtml.text,
      htmlSanitized = textAndHtml.safeHtml,
      approvedById = Some(SystemUserId))

    // COULD find the most recent posters in the last 100 messages only, because is chat.
    val newFrequentPosterIds: Seq[UserId] =
      PageParts.findFrequentPosters(newPost +: page.parts.allPosts,
        ignoreIds = Set(page.meta.authorId, authorId))

    val oldMeta = page.meta
    val newMeta = oldMeta.copy(
      bumpedAt = page.isClosed ? oldMeta.bumpedAt | Some(transaction.currentTime),
      lastReplyAt = Some(transaction.currentTime),
      lastReplyById = Some(authorId),
      frequentPosterIds = newFrequentPosterIds,
      version = oldMeta.version + 1)

    val uploadRefs = UploadsDao.findUploadRefsInPost(newPost)

    SECURITY // COULD: if is new chat user, create review task to look at his/her first
    // chat messages, but only the first few.

    val auditLogEntry = AuditLogEntry(
      siteId = siteId,
      id = AuditLogEntry.UnassignedId,
      didWhat = AuditLogEntryType.NewChatMessage,
      doerId = authorId,
      doneAt = transaction.currentTime,
      browserIdData = browserIdData,
      pageId = Some(page.id),
      uniquePostId = Some(newPost.uniqueId),
      postNr = Some(newPost.nr),
      targetUniquePostId = None,
      targetPostNr = None,
      targetUserId = None)

    transaction.insertPost(newPost)
    transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
    uploadRefs foreach { uploadRef =>
      transaction.insertUploadedFileReference(newPost.uniqueId, uploadRef, authorId)
    }
    insertAuditLogEntry(auditLogEntry, transaction)

    // generate json? load all page members?
    // send the post + json back to the caller?
    // & publish [pubsub]

    val notfs = NotificationGenerator(transaction).generateForNewPost(page, newPost)
    transaction.saveDeleteNotifications(notfs)

    (newPost, notfs)
  }


  private def appendToLastChatMessage(lastPost: Post, textAndHtml: TextAndHtml, authorId: UserId,
    browserIdData: BrowserIdData, transaction: SiteTransaction): (Post, Notifications) = {

    // Note: Farily similar to editPostIfAuth() just below. [2GLK572]

    if (lastPost.tyype != PostType.ChatMessage)
      throwForbidden("EsE6YUW2", o"""Cannot append more chat text; post id ${lastPost.uniqueId}
          is not a chat message""")

    require(lastPost.currentRevisionById == authorId, "EsE5JKU0")
    require(lastPost.currentSourcePatch.isEmpty, "EsE7YGKU2")
    require(lastPost.currentRevisionNr == FirstRevisionNr, "EsE2FWY2")
    require(lastPost.lastApprovedEditAt.isEmpty, "EsE2ZXF5")
    require(lastPost.approvedById.contains(SystemUserId), "EsE4GBF3")
    require(lastPost.approvedRevisionNr.contains(FirstRevisionNr), "EsE4PKW1")
    require(lastPost.deletedAt.isEmpty, "EsE2GKY8")

    val newText = lastPost.approvedSource.getOrDie("EsE5GYKF2") + "\n\n\n" + textAndHtml.text
    val newHtml = lastPost.approvedHtmlSanitized.getOrDie("EsE2PU8") + "\n\n" + textAndHtml.safeHtml

    val editedPost = lastPost.copy(
      approvedSource = Some(newText),
      approvedHtmlSanitized = Some(newHtml))

    transaction.updatePost(editedPost)
    saveDeleteUploadRefs(lastPost, editedPost = editedPost, authorId, transaction)

    val oldMeta = transaction.loadThePageMeta(lastPost.pageId)
    val newMeta = oldMeta.copy(version = oldMeta.version + 1)
    transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)

    // COULD create audit log entry that shows that this ip appended to the chat message.

    val notfs = NotificationGenerator(transaction).generateForEdits(lastPost, editedPost)
    transaction.saveDeleteNotifications(notfs)

    (editedPost, notfs)
  }


  /** Edits the post, if authorized to edit it.
    */
  def editPostIfAuth(pageId: PageId, postNr: PostNr, editorId: UserId, browserIdData: BrowserIdData,
        newTextAndHtml: TextAndHtml) {

    // Note: Farily similar to appendChatMessageToLastMessage() just above. [2GLK572]

    if (newTextAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE4KEL7", EditController.EmptyPostErrorMessage)

    readWriteTransaction { transaction =>
      val editor = transaction.loadUser(editorId).getOrElse(
        throwNotFound("DwE30HY21", s"User not found, id: '$editorId'"))
      val page = PageDao(pageId, transaction)
      throwIfMayNotSeePage(page, Some(editor))(transaction)

      val postToEdit = page.parts.post(postNr) getOrElse {
        page.meta // this throws page-not-fount if the page doesn't exist
        throwNotFound("DwE404GKF2", s"Post not found, id: '$postNr'")
      }

      if (postToEdit.isDeleted)
        throwForbidden("DwE6PK2", "The post has been deleted")

      if (postToEdit.currentSource == newTextAndHtml.text)
        return

      // For now: (add back edit suggestions later. And should perhaps use PermsOnPage.)
      if (!userMayEdit(editor, postToEdit))
        throwForbidden("DwE8KF32", "You may not edit that post")

      val approverId = if (editor.isStaff) editor.id else SystemUserId

      // COULD don't allow sbd else to edit until 3 mins after last edit by sbd else?
      // so won't create too many revs quickly because 2 edits.
      BUG // COULD compare version number: kills the lost update bug.

      val isInNinjaEditWindow = {
        val ninjaWindowMs = ninjaEditWindowMsFor(page.role)
        val ninjaEditEndMs = postToEdit.currentRevStaredAt.getTime + ninjaWindowMs
        transaction.currentTime.getTime < ninjaEditEndMs
      }

      // If we've saved an old revision already, and 1) there hasn't been any more discussion
      // in this sub thread since the current revision was started, and 2) the current revision
      // hasn't been flagged, — then don't save a new revision. It's rather uninteresting
      // to track changes, when no discussion is happening.
      // (We avoid saving unneeded revisions, to save disk.)
      val anyLastRevision = loadLastRevisionWithSource(postToEdit.uniqueId, transaction)
      def oldRevisionSavedAndNothingHappened = anyLastRevision match {
        case None => false
        case Some(_) =>
          // COULD: instead of comparing timestamps, flags and replies could explicitly clarify
          // which revision of postToEdit they concern.
          val currentRevStartMs = postToEdit.currentRevStaredAt.getTime
          val flags = transaction.loadFlagsFor(immutable.Seq(PagePostNr(pageId, postNr)))
          val anyNewFlag = flags.exists(_.flaggedAt.getTime > currentRevStartMs)
          val successors = page.parts.descendantsOf(postNr)
          val anyNewComment = successors.exists(_.createdAt.getTime > currentRevStartMs)
        !anyNewComment && !anyNewFlag
      }

      val isNinjaEdit = {
        val sameAuthor = postToEdit.currentRevisionById == editorId
        val ninjaHardEndMs = postToEdit.currentRevStaredAt.getTime + HardMaxNinjaEditWindowMs
        val isInHardWindow = transaction.currentTime.getTime < ninjaHardEndMs
        sameAuthor && isInHardWindow && (isInNinjaEditWindow || oldRevisionSavedAndNothingHappened)
      }

      val (newRevision: Option[PostRevision], newStartedAt, newRevisionNr, newPrevRevNr) =
        if (isNinjaEdit) {
          (None, postToEdit.currentRevStaredAt, postToEdit.currentRevisionNr,
            postToEdit.previousRevisionNr)
        }
        else {
          val revision = PostRevision.createFor(postToEdit, previousRevision = anyLastRevision)
          (Some(revision), transaction.currentTime, postToEdit.currentRevisionNr + 1,
            Some(postToEdit.currentRevisionNr))
        }

      // COULD send current version from browser to server, reject edits if != oldPost.currentVersion
      // to stop the lost update problem.

      // Later, if post not approved directly: currentSourcePatch = makePatch(from, to)

      var editedPost = postToEdit.copy(
        currentRevStaredAt = newStartedAt,
        currentRevLastEditedAt = Some(transaction.currentTime),
        currentRevisionById = editorId,
        currentSourcePatch = None,
        currentRevisionNr = newRevisionNr,
        previousRevisionNr = newPrevRevNr,
        lastApprovedEditAt = Some(transaction.currentTime),
        lastApprovedEditById = Some(editorId),
        approvedSource = Some(newTextAndHtml.text),
        approvedHtmlSanitized = Some(newTextAndHtml.safeHtml),
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId),
        approvedRevisionNr = Some(newRevisionNr))

      if (editorId != editedPost.createdById) {
        editedPost = editedPost.copy(numDistinctEditors = 2)  // for now
      }

      val anyEditedCategory =
        if (page.role != PageRole.AboutCategory || !editedPost.isOrigPost) {
          // Later: Go here also if new text not yet approved.
          None
        }
        else {
          if (newTextAndHtml.text == Category.UncategorizedDescription) {
            // We recognize Uncategorized categories via the magic text tested for above.
            throwForbidden("DwE4KEP8", "Forbidden magic text")
          }
          // COULD reuse the same transaction, when loading the category. Barely matters.
          val category = loadTheCategory(page.meta.categoryId getOrDie "DwE2PKF0")
          val newDescription = ReactJson.htmlToExcerpt(
            newTextAndHtml.safeHtml, Category.DescriptionExcerptLength)
          Some(category.copy(description = Some(newDescription)))
        }

      val postRecentlyCreated = transaction.currentTime.getTime - postToEdit.createdAt.getTime <=
          AllSettings.PostRecentlyCreatedLimitMs

      val reviewTask: Option[ReviewTask] =
        if (postRecentlyCreated || editor.isStaff) {
          // Need not review a recently created post: it's new and the edits likely
          // happened before other people read it, so they'll notice any weird things
          // later when they read it, and can flag it. This is not totally safe,
          // but better than forcing the staff to review all edits? (They'd just
          // get bored and stop reviewing.)
          // The way to do this in a really safe manner: Create a invisible inactive post-edited
          // review task, which gets activated & shown after x hours if too few people have read
          // the post. But if many has seen the post, the review task instead gets deleted.
          None
        }
        else {
          Some(makeReviewTask(editorId, editedPost, immutable.Seq(ReviewReason.LateEdit),
            transaction))
        }

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.EditPost,
        doerId = editorId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postToEdit.uniqueId),
        postNr = Some(postNr),
        targetUserId = Some(postToEdit.createdById))

      transaction.updatePost(editedPost)
      newRevision.foreach(transaction.insertPostRevision)
      saveDeleteUploadRefs(postToEdit, editedPost = editedPost, editorId, transaction)

      insertAuditLogEntry(auditLogEntry, transaction)
      anyEditedCategory.foreach(transaction.updateCategoryMarkSectionPageStale)
      reviewTask.foreach(transaction.upsertReviewTask)

      if (!postToEdit.isSomeVersionApproved && editedPost.isSomeVersionApproved) {
        unimplemented("Updating visible post counts when post approved via an edit", "DwE5WE28")
      }

      if (editedPost.isCurrentVersionApproved) {
        val notfs = NotificationGenerator(transaction).generateForEdits(postToEdit, editedPost)
        transaction.saveDeleteNotifications(notfs)
      }

      val oldMeta = page.meta
      var newMeta = oldMeta.copy(version = oldMeta.version + 1)
      var makesSectionPageHtmlStale = false
      // Bump the page, if the article / original post was edited.
      // (This is how Discourse works and people seems to like it. However,
      // COULD add a don't-bump option for minor edits.)
      if (postNr == PageParts.BodyNr && editedPost.isCurrentVersionApproved && !page.isClosed) {
        newMeta = newMeta.copy(bumpedAt = Some(transaction.currentTime))
        makesSectionPageHtmlStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, makesSectionPageHtmlStale)
    }

    refreshPageInAnyCache(pageId)
  }


  private def saveDeleteUploadRefs(postToEdit: Post, editedPost: Post, editorId: UserId,
        transaction: SiteTransaction) {
    // Use findUploadRefsInPost (not ...InText) so we'll find refs both in the hereafter
    // 1) approved version of the post, and 2) the current possibly unapproved version.
    // Because if any of the approved or the current version links to an uploaded file,
    // we should keep the file.
    val currentUploadRefs = UploadsDao.findUploadRefsInPost(editedPost)
    val oldUploadRefs = transaction.loadUploadedFileReferences(postToEdit.uniqueId)
    val uploadRefsAdded = currentUploadRefs -- oldUploadRefs
    val uploadRefsRemoved = oldUploadRefs -- currentUploadRefs

    uploadRefsAdded foreach { hashPathSuffix =>
      transaction.insertUploadedFileReference(postToEdit.uniqueId, hashPathSuffix, editorId)
    }

    uploadRefsRemoved foreach { hashPathSuffix =>
      val gone = transaction.deleteUploadedFileReference(postToEdit.uniqueId, hashPathSuffix)
      if (!gone) {
        p.Logger.warn(o"""Didn't delete this uploaded file ref: $hashPathSuffix, post id:
            ${postToEdit.uniqueId} [DwE7UMF2]""")
      }
    }
  }


  def loadSomeRevisionsRecentFirst(postId: UniquePostId, revisionNr: Int, atLeast: Int,
        userId: Option[UserId]): (Seq[PostRevision], Map[UserId, User]) = {
    val revisionsRecentFirst = mutable.ArrayStack[PostRevision]()
    var usersById: Map[UserId, User] = null
    readOnlyTransaction { transaction =>
      val post = transaction.loadThePost(postId)
      val page = PageDao(post.pageId, transaction)
      val user = userId.flatMap(transaction.loadUser)
      throwIfMayNotSeePage(page, user)(transaction)

      loadSomeRevisionsWithSourceImpl(postId, revisionNr, revisionsRecentFirst,
        atLeast, transaction)
      if (revisionNr == PostRevision.LastRevisionMagicNr) {
        val postNow = transaction.loadThePost(postId)
        val currentRevision = PostRevision.createFor(postNow, revisionsRecentFirst.headOption)
          .copy(fullSource = Some(postNow.currentSource))
        revisionsRecentFirst.push(currentRevision)
      }
      val userIds = mutable.HashSet[UserId]()
      revisionsRecentFirst foreach { revision =>
        userIds add revision.composedById
        revision.approvedById foreach userIds.add
        revision.hiddenById foreach userIds.add
      }
      usersById = transaction.loadUsersAsMap(userIds)
    }
    (revisionsRecentFirst.toSeq, usersById)
  }


  private def loadLastRevisionWithSource(postId: UniquePostId, transaction: SiteTransaction)
        : Option[PostRevision] = {
    val revisionsRecentFirst = mutable.ArrayStack[PostRevision]()
    loadSomeRevisionsWithSourceImpl(postId, PostRevision.LastRevisionMagicNr,
      revisionsRecentFirst, atLeast = 1, transaction)
    revisionsRecentFirst.headOption
  }


  private def loadSomeRevisionsWithSourceImpl(postId: UniquePostId, revisionNr: Int,
        revisionsRecentFirst: mutable.ArrayStack[PostRevision], atLeast: Int,
        transaction: SiteTransaction) {
    transaction.loadPostRevision(postId, revisionNr) foreach { revision =>
      loadRevisionsFillInSource(revision, revisionsRecentFirst, atLeast, transaction)
    }
  }


  private def loadRevisionsFillInSource(revision: PostRevision,
        revisionsRecentFirstWithSource: mutable.ArrayStack[PostRevision],
        atLeast: Int, transaction: SiteTransaction) {
    if (revision.fullSource.isDefined && (atLeast <= 1 || revision.previousNr.isEmpty)) {
      revisionsRecentFirstWithSource.push(revision)
      return
    }

    val previousRevisionNr = revision.previousNr.getOrDie(
      "DwE08SKF3", o"""In site $siteId, post ${revision.postId} revision ${revision.revisionNr}
          has neither full source nor any previous revision nr""")

    val previousRevision =
      transaction.loadPostRevision(revision.postId, previousRevisionNr).getOrDie(
        "DwE5GLK2", o"""In site $siteId, post ${revision.postId} revision $previousRevisionNr
            is missing""")

    loadRevisionsFillInSource(previousRevision, revisionsRecentFirstWithSource,
      atLeast - 1, transaction)

    val prevRevWithSource = revisionsRecentFirstWithSource.headOption getOrDie "DwE85UF2"
    val revisionWithSource =
      if (revision.fullSource.isDefined) revision
      else revision.copyAndPatchSourceFrom(prevRevWithSource)
    revisionsRecentFirstWithSource.push(revisionWithSource)
  }


  def changePostType(pageId: PageId, postNr: PostNr, newType: PostType,
        changerId: UserId, browserIdData: BrowserIdData) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val postBefore = page.parts.thePost(postNr)
      val Seq(author, changer) = transaction.loadTheUsers(postBefore.createdById, changerId)
      throwIfMayNotSeePage(page, Some(changer))(transaction)

      val postAfter = postBefore.copy(tyype = newType)

      // Test if the changer is allowed to change the post type in this way.
      if (changer.isStaff) {
        (postBefore.tyype, postAfter.tyype) match {
          case (before, after)
            if before == PostType.Normal && after.isWiki => // Fine, staff wikifies post.
          case (before, after)
            if before.isWiki && after == PostType.Normal => // Fine, staff removes wiki status.
          case (before, after) =>
            throwForbidden("DwE7KFE2", s"Cannot change post type from $before to $after")
        }
      }
      else {
        // All normal users may do is to remove wiki status of their own posts.
        if (postBefore.isWiki && postAfter.tyype == PostType.Normal) {
          if (changer.id != author.id)
            throwForbidden("DwE5KGPF2", o"""You are not the author and not staff,
                so you cannot remove the Wiki status of this post""")
        }
        else {
            throwForbidden("DwE4KXB2", s"""Cannot change post type from
                ${postBefore.tyype} to ${postAfter.tyype}""")
        }
      }

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.ChangePostType,
        doerId = changerId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postBefore.uniqueId),
        postNr = Some(postNr),
        targetUserId = Some(postBefore.createdById))

      val oldMeta = page.meta
      val newMeta = oldMeta.copy(version = oldMeta.version + 1)

      transaction.updatePost(postAfter)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = false)
      insertAuditLogEntry(auditLogEntry, transaction)
      // COULD generate some notification? E.g. "Your post was made wiki-editable."
    }

    refreshPageInAnyCache(pageId)
  }


  def changePostStatus(postNr: PostNr, pageId: PageId, action: PostStatusAction, userId: UserId) {
    readWriteTransaction(changePostStatusImpl(postNr, pageId = pageId, action, userId = userId, _))
  }


  def changePostStatusImpl(postNr: PostNr, pageId: PageId, action: PostStatusAction,
        userId: UserId, transaction: SiteTransaction) {
    import com.debiki.core.{PostStatusAction => PSA}

      val page = PageDao(pageId, transaction)
      val user = transaction.loadUser(userId) getOrElse throwForbidden("DwE3KFW2", "Bad user id")
      throwIfMayNotSeePage(page, Some(user))(transaction)

      val postBefore = page.parts.thePost(postNr)

      // Authorization.
      if (!user.isStaff) {
        if (postBefore.createdById != userId)
          throwForbidden("DwE0PK24", "You may not modify that post, it's not yours")

        if (!action.isInstanceOf[PSA.DeletePost] && action != PSA.CollapsePost)
          throwForbidden("DwE5JKF7", "You may not modify the whole tree")
      }

      val isChangingDeletePostToDeleteTree =
        postBefore.deletedStatus.onlyThisDeleted && action == PSA.DeleteTree
      if (postBefore.isDeleted && !isChangingDeletePostToDeleteTree)
        throwForbidden("DwE5GUK5", "This post has already been deleted")

      var numVisibleRepliesGone = 0
      var numOrigPostVisibleRepliesGone = 0

      // Update the directly affected post.
      val postAfter = action match {
        case PSA.HidePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postHidden = true)
        case PSA.UnhidePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postUnhidden = true)
        case PSA.CloseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeClosed = true)
        case PSA.CollapsePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postCollapsed = true)
        case PSA.CollapseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeCollapsed = true)
        case PSA.DeletePost(clearFlags) =>
          if (postBefore.isVisible && postBefore.isReply) {
            numVisibleRepliesGone += 1
            if (postBefore.isOrigPostReply) {
              numOrigPostVisibleRepliesGone += 1
            }
          }
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postDeleted = true)
        case PSA.DeleteTree =>
          if (postBefore.isVisible && postBefore.isReply) {
            numVisibleRepliesGone += 1
            if (postBefore.isOrigPostReply) {
              numOrigPostVisibleRepliesGone += 1
            }
          }
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeDeleted = true)
      }

      SHOULD // delete any review tasks.

      transaction.updatePost(postAfter)

      // Update any indirectly affected posts, e.g. subsequent comments in the same
      // thread that are being deleted recursively.
      for (successor <- page.parts.descendantsOf(postNr)) {
        val anyUpdatedSuccessor: Option[Post] = action match {
          case PSA.CloseTree =>
            if (successor.closedStatus.areAncestorsClosed) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsClosed = true))
          case PSA.CollapsePost =>
            None
          case PSA.CollapseTree =>
            if (successor.collapsedStatus.areAncestorsCollapsed) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsCollapsed = true))
          case PSA.DeletePost(clearFlags) =>
            None
          case PSA.DeleteTree =>
            if (successor.isVisible && successor.isReply) {
              numVisibleRepliesGone += 1
              if (successor.isOrigPostReply) {
                // Was the orig post + all replies deleted recursively? Weird.
                numOrigPostVisibleRepliesGone += 1
              }
            }
            if (successor.deletedStatus.areAncestorsDeleted) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsDeleted = true))
          case x =>
            die("DwE8FMU3", "PostAction not implemented: " + x)
        }

        anyUpdatedSuccessor foreach { updatedSuccessor =>
          transaction.updatePost(updatedSuccessor)
        }
      }

      val oldMeta = page.meta
      var newMeta = oldMeta.copy(version = oldMeta.version + 1)
      var markSectionPageStale = false
      if (numVisibleRepliesGone > 0) {
        newMeta = newMeta.copy(
          numRepliesVisible = oldMeta.numRepliesVisible - numVisibleRepliesGone,
          numOrigPostRepliesVisible =
            // For now: use max() because the db field was just added so some counts are off.
            math.max(oldMeta.numOrigPostRepliesVisible - numOrigPostVisibleRepliesGone, 0))
        markSectionPageStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale)

      // In the future: if is a forum topic, and we're restoring the OP, then bump the topic.


    refreshPageInAnyCache(pageId)
  }


  def approvePost(pageId: PageId, postNr: PostNr, approverId: UserId) {
    readWriteTransaction(approvePostImpl(pageId, postNr, approverId = approverId, _))
  }


  def approvePostImpl(pageId: PageId, postNr: PostNr, approverId: UserId,
        transaction: SiteTransaction) {
    var pageIdsToRefresh = Set[PageId](pageId)

      val page = PageDao(pageId, transaction)
      val pageMeta = page.meta
      val postBefore = page.parts.thePost(postNr)
      if (postBefore.isCurrentVersionApproved)
        throwForbidden("DwE4GYUR2", "Post already approved")

      val approver = transaction.loadTheUser(approverId)

      // For now. Later, let core members approve posts too.
      if (!approver.isStaff)
        throwForbidden("EsE5GYK02", "You're not staff so you cannot approve posts")

      // ------ The post

      // Later: update lastApprovedEditAt, lastApprovedEditById and numDistinctEditors too,
      // or remove them.
      val postAfter = postBefore.copy(
        safeRevisionNr =
          approver.isHuman ? Option(postBefore.currentRevisionNr) | postBefore.safeRevisionNr,
        approvedRevisionNr = Some(postBefore.currentRevisionNr),
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId),
        approvedSource = Some(postBefore.currentSource),
        approvedHtmlSanitized = Some(postBefore.currentHtmlSanitized(
          commonmarkRenderer, pageMeta.pageRole)),
        currentSourcePatch = None)
      transaction.updatePost(postAfter)

      SHOULD // delete any review tasks.

      // ------ The page

      val isApprovingPageBody = postNr == PageParts.BodyNr
      val isApprovingNewPost = postBefore.approvedRevisionNr.isEmpty

      var newMeta = pageMeta.copy(version = pageMeta.version + 1)
      // Bump page and update reply counts if a new post was approved and became visible,
      // or if the original post was edited.
      var makesSectionPageHtmlStale = false
      if (isApprovingNewPost || isApprovingPageBody) {
        val (numNewReplies, numNewOrigPostReplies, newLastReplyAt, newLastReplyById) =
          if (isApprovingNewPost && postAfter.isReply)
            (1, postAfter.isOrigPostReply ? 1 | 0,
                                Some(transaction.currentTime), Some(postAfter.createdById))
          else
            (0, 0, pageMeta.lastReplyAt, pageMeta.lastReplyById)

        newMeta = newMeta.copy(
          numRepliesVisible = pageMeta.numRepliesVisible + numNewReplies,
          numOrigPostRepliesVisible = pageMeta.numOrigPostRepliesVisible + numNewOrigPostReplies,
          lastReplyAt = newLastReplyAt,
          lastReplyById = newLastReplyById,
          bumpedAt = pageMeta.isClosed ? pageMeta.bumpedAt | Some(transaction.currentTime))
        makesSectionPageHtmlStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = pageMeta, makesSectionPageHtmlStale)

      // ------ Notifications

      val notifications =
        if (isApprovingNewPost) {
          NotificationGenerator(transaction).generateForNewPost(page, postAfter)
        }
        else {
          NotificationGenerator(transaction).generateForEdits(postBefore, postAfter)
        }
      transaction.saveDeleteNotifications(notifications)

      // ------ Cascade approval?

      // If we will now have approved all the required first posts (numFirstToApprove below),
      // then auto-approve all remaining first posts, because now we trust the post author
      // that much.
      val settings = loadWholeSiteSettings(transaction)
      val numFirstToAllow = math.min(MaxNumFirstPosts, settings.numFirstPostsToAllow)
      val numFirstToApprove = math.min(MaxNumFirstPosts, settings.numFirstPostsToApprove)
      if (numFirstToAllow > 0 && numFirstToApprove > 0) {
        val firstPosts = transaction.loadPostsBy(postBefore.createdById, includeTitles = false,
          includeChatMessages = false, limit = MaxNumFirstPosts, OrderBy.OldestFirst)
        // BUG approvedById will be changed to not-a-human after an edit (that gets auto-approved).
        val numApprovedByHuman = firstPosts.count(_.approvedById.exists(User.isHumanMember))
        val shallApproveRemainingFirstPosts = numApprovedByHuman >= numFirstToApprove
        if (shallApproveRemainingFirstPosts) {
          val unapprovedFirstPosts = firstPosts.filter(!_.isSomeVersionApproved)
          pageIdsToRefresh ++= unapprovedFirstPosts.map(
            autoApprovePendingEarlyPost(_, transaction))
        }
      }


    refreshPagesInAnyCache(pageIdsToRefresh)
  }


  def autoApprovePendingEarlyPost(post: Post, transaction: SiteTransaction): PageId = {
    dieIf(post.isSomeVersionApproved, "EsE6YKP2")

    val page = PageDao(post.pageId, transaction)
    val pageMeta = page.meta

    // ----- The post

    // Don't need to update lastApprovedEditAt, because this post has been invisible until now.
    // Don't set safeRevisionNr, because this approval hasn't been reviewed by a human.
    val postAfter = post.copy(
      approvedRevisionNr = Some(post.currentRevisionNr),
      approvedAt = Some(transaction.currentTime),
      approvedById = Some(SystemUserId),
      approvedSource = Some(post.currentSource),
      approvedHtmlSanitized = Some(post.currentHtmlSanitized(
        commonmarkRenderer, pageMeta.pageRole)),
      currentSourcePatch = None)
    transaction.updatePost(postAfter)

    // ----- Review tasks

    // Don't think there're any review tasks to delete . They should have been
    // generated only for the num-first-posts-to-approve posts, and they should have been
    // handled already. We want to keep any review tasks created for num-first-posts-to-notify.

    // ----- The page

    // We're making an unapproved post visible, so the page will change.
    val numNewOpReplies = postAfter.isOrigPostReply ? 1 | 0
    val newMeta = pageMeta.copy(
      numRepliesVisible = pageMeta.numRepliesVisible + 1,
      numOrigPostRepliesVisible = pageMeta.numOrigPostRepliesVisible + numNewOpReplies,
      lastReplyAt = Some(transaction.currentTime),
      bumpedAt = pageMeta.isClosed ? pageMeta.bumpedAt | Some(transaction.currentTime),
      version = pageMeta.version + 1)

    transaction.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)

    val notfs = NotificationGenerator(transaction).generateForNewPost(page, postAfter)
    transaction.saveDeleteNotifications(notfs)

    page.id
  }


  def deletePost(pageId: PageId, postNr: PostNr, deletedById: UserId,
        browserIdData: BrowserIdData) {
    readWriteTransaction(deletePostImpl(
      pageId, postNr = postNr, deletedById = deletedById, browserIdData, _))
  }


  def deletePostImpl(pageId: PageId, postNr: PostNr, deletedById: UserId,
        browserIdData: BrowserIdData, transaction: SiteTransaction) {
    changePostStatusImpl(pageId = pageId, postNr = postNr,
      action = PostStatusAction.DeletePost(clearFlags = false), userId = deletedById,
      transaction = transaction)
  }


  def deleteVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId) {
    readWriteTransaction { transaction =>
      throwIfMayNotSeePost(transaction.loadThePost(pageId, postNr),
        Some(transaction.loadTheUser(voterId)))(transaction)

      transaction.deleteVote(pageId, postNr, voteType, voterId = voterId)
      updateVoteCounts(pageId, postNr = postNr, transaction)
      /* FRAUD SHOULD delete by cookie too, like I did before:
      var numRowsDeleted = 0
      if ((userIdData.anyGuestId.isDefined && userIdData.userId != UnknownUser.Id) ||
        userIdData.anyRoleId.isDefined) {
        numRowsDeleted = deleteVoteByUserId()
      }
      if (numRowsDeleted == 0 && userIdData.browserIdCookie.isDefined) {
        numRowsDeleted = deleteVoteByCookie()
      }
      if (numRowsDeleted > 1) {
        assErr("DwE8GCH0", o"""Too many votes deleted, page `$pageId' post `$postId',
          user: $userIdData, vote type: $voteType""")
      }
      */
    }
    refreshPageInAnyCache(pageId)
  }


  def ifAuthAddVote(pageId: PageId, postNr: PostNr, voteType: PostVoteType,
        voterId: UserId, voterIp: String, postNrsRead: Set[PostNr]) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val voter = transaction.loadTheUser(voterId)
      throwIfMayNotSeePage(page, Some(voter))(transaction)

      val post = page.parts.thePost(postNr)

      if (voteType == PostVoteType.Bury && !voter.isStaff)
        throwForbidden("DwE2WU74", "Only staff and regular members may Bury-vote")

      if (voteType == PostVoteType.Unwanted && !voter.isStaff && page.meta.authorId != voterId)
        throwForbidden("DwE5JUK0", "Only staff and the page author may Unwanted-vote")

      if (voteType == PostVoteType.Like) {
        if (post.createdById == voterId)
          throwForbidden("DwE84QM0", "Cannot like own post")
      }

      try {
        transaction.insertVote(post.uniqueId, pageId, postNr, voteType, voterId = voterId)
      }
      catch {
        case DbDao.DuplicateVoteException =>
          throwForbidden("Dw403BKW2", "You have already voted")
      }

      // Update post read stats.
      val postsToMarkAsRead =
        if (voteType == PostVoteType.Like) {
          // Upvoting a post shouldn't affect its ancestors, because they're on the
          // path to the interesting post so they are a bit useful/interesting. However
          // do mark all earlier siblings as read since they weren't upvoted (this time).
          val ancestorIds = page.parts.ancestorsOf(postNr).map(_.nr)
          postNrsRead -- ancestorIds.toSet
        }
        else {
          // The post got a non-like vote: wrong, bury or unwanted.
          // This should result in only the downvoted post
          // being marked as read, because a post *not* being downvoted shouldn't
          // give that post worse rating. (Remember that the rating of a post is
          // roughly the number of Like votes / num-times-it's-been-read.)
          Set(postNr)
        }

      transaction.updatePostsReadStats(pageId, postsToMarkAsRead, readById = voterId,
        readFromIp = voterIp)

      updateVoteCounts(post, transaction)
    }
    refreshPageInAnyCache(pageId)
  }


  def movePostIfAuth(whichPost: PagePostId, newParent: PagePostNr, moverId: UserId,
        browserIdData: BrowserIdData): (Post, JsValue) = {

    if (newParent.postNr == PageParts.TitleNr)
      throwForbidden("EsE4YKJ8_", "Cannot place a post below the title")

    val (postAfter, storePatch) = readWriteTransaction { transaction =>
      val mover = transaction.loadTheMember(moverId)
      if (!mover.isStaff)
        throwForbidden("EsE6YKG2_", "Only staff may move posts")

      val postToMove = transaction.loadThePost(whichPost.postId)
      if (postToMove.nr == PageParts.TitleNr || postToMove.nr == PageParts.BodyNr)
        throwForbidden("EsE7YKG25_", "Cannot move page title or body")

      val newParentPost = transaction.loadPost(newParent) getOrElse throwForbidden(
        "EsE7YKG42_", "New parent post not found")

      dieIf(postToMove.collapsedStatus.isCollapsed, "EsE5KGV4", "Unimpl")
      dieIf(postToMove.closedStatus.isClosed, "EsE9GKY03", "Unimpl")
      dieIf(postToMove.deletedStatus.isDeleted, "EsE4PKW12", "Unimpl")
      dieIf(newParentPost.collapsedStatus.isCollapsed, "EsE7YKG32", "Unimpl")
      dieIf(newParentPost.closedStatus.isClosed, "EsE2GLK83", "Unimpl")
      dieIf(newParentPost.deletedStatus.isDeleted, "EsE8KFG1", "Unimpl")

      val fromPage = PageDao(postToMove.pageId, transaction)
      val toPage = PageDao(newParent.pageId, transaction)

      // Don't create cycles.
      if (newParentPost.pageId == postToMove.pageId) {
        val ancestorsOfNewParent = fromPage.parts.ancestorsOf(newParentPost.nr)
        if (ancestorsOfNewParent.exists(_.uniqueId == postToMove.uniqueId))
          throwForbidden("EsE7KCCL_", o"""Cannot move a post to after one of its descendants
              — doing that, would create a cycle""")
      }

      val moveTreeAuditEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.MovePost,
        doerId = moverId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(postToMove.pageId),
        uniquePostId = Some(postToMove.uniqueId),
        postNr = Some(postToMove.nr),
        targetPageId = Some(newParentPost.pageId),
        targetUniquePostId = Some(newParentPost.uniqueId),
        targetPostNr = Some(newParentPost.nr))

      val postAfter =
        if (postToMove.pageId == newParentPost.pageId) {
          val postAfter = postToMove.copy(parentNr = Some(newParentPost.nr))
          transaction.updatePost(postAfter)
          transaction.insertAuditLogEntry(moveTreeAuditEntry)
          postAfter
        }
        else {
          transaction.deferConstraints()
          transaction.startAuditLogBatch()

          val descendants = fromPage.parts.descendantsOf(postToMove.nr)
          val newNrsMap = mutable.HashMap[PostNr, PostNr]()
          val firstFreePostNr = toPage.parts.highestReplyNr.map(_ + 1) getOrElse FirstReplyNr
          var nextPostNr = firstFreePostNr
          newNrsMap.put(postToMove.nr, nextPostNr)
          for (descendant <- descendants) {
            nextPostNr += 1
            newNrsMap.put(descendant.nr, nextPostNr)
          }

          val postAfter = postToMove.copy(
            pageId = newParentPost.pageId,
            nr = firstFreePostNr,
            parentNr = Some(newParentPost.nr))

          var postsAfter = ArrayBuffer[Post](postAfter)
          var auditEntries = ArrayBuffer[AuditLogEntry](moveTreeAuditEntry)

          descendants foreach { descendant =>
            val descendantAfter = descendant.copy(
              pageId = toPage.id,
              nr = newNrsMap.get(descendant.nr) getOrDie "EsE7YKL32",
              parentNr = Some(newNrsMap.get(
                descendant.parentNr getOrDie "EsE8YKHF2") getOrDie "EsE2PU79"))
            postsAfter += descendantAfter
            auditEntries += AuditLogEntry(
              siteId = siteId,
              id = AuditLogEntry.UnassignedId,
              didWhat = AuditLogEntryType.MovePost,
              doerId = moverId,
              doneAt = transaction.currentTime,
              browserIdData = browserIdData,
              pageId = Some(descendant.pageId),
              uniquePostId = Some(descendant.uniqueId),
              postNr = Some(descendant.nr),
              targetPageId = Some(descendantAfter.pageId))
              // (leave target post blank — we didn't place decendantAfter at any
              // particular post on the target page)
          }

          postsAfter foreach transaction.updatePost
          auditEntries foreach transaction.insertAuditLogEntry
          transaction.movePostsReadStats(fromPage.id, toPage.id, Map(newNrsMap.toSeq: _*))
          // Mark both fromPage and toPage sections as stale, in case they're different forums.
          refreshPageMetaBumpVersion(fromPage.id, markSectionPageStale = true, transaction)
          refreshPageMetaBumpVersion(toPage.id, markSectionPageStale = true, transaction)

          postAfter
        }

      val notfs = NotificationGenerator(transaction).generateForNewPost(
        toPage, postAfter, skipMentions = true)
      SHOULD // transaction.saveDeleteNotifications(notfs) — but would cause unique key errors

      val patch = ReactJson.makeStorePatch2(postAfter.uniqueId, toPage.id, transaction)
      (postAfter, patch)
    }

    refreshPageInAnyCache(newParent.pageId)
    (postAfter, storePatch)
  }


  def loadThingsToReview(): ThingsToReview = {
    readOnlyTransaction { transaction =>
      val posts = transaction.loadPostsToReview()
      val pageMetas = transaction.loadPageMetas(posts.map(_.pageId))
      val flags = transaction.loadFlagsFor(posts.map(_.pagePostNr))
      val userIds = mutable.HashSet[UserId]()
      userIds ++= posts.map(_.createdById)
      userIds ++= posts.map(_.currentRevisionById)
      userIds ++= flags.map(_.flaggerId)
      val users = transaction.loadUsers(userIds.toSeq)
      ThingsToReview(posts, pageMetas, users, flags)
    }
  }


  def flagPost(pageId: PageId, postNr: PostNr, flagType: PostFlagType, flaggerId: UserId) {
    readWriteTransaction { transaction =>
      val postBefore = transaction.loadThePost(pageId, postNr)
      val flagger = transaction.loadTheUser(flaggerId)
      throwIfMayNotSeePost(postBefore, Some(flagger))(transaction)

      // SHOULD if >= 2 pending flags, then hide post until reviewed? And unhide, if flags cleared.
      val postAfter = postBefore.copy(numPendingFlags = postBefore.numPendingFlags + 1)
      val reviewTask = makeReviewTask(flaggerId, postAfter,
        immutable.Seq(ReviewReason.PostFlagged), transaction)
      transaction.insertFlag(postBefore.uniqueId, pageId, postNr, flagType, flaggerId)
      transaction.updatePost(postAfter)
      transaction.upsertReviewTask(reviewTask)
      // Need not update page version: flags aren't shown (except perhaps for staff users).
    }
    refreshPageInAnyCache(pageId)
  }


  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId): Unit = {
    readWriteTransaction { transaction =>
      val clearer = transaction.loadTheUser(clearedById)
      if (!clearer.isStaff)
        throwForbidden("EsE7YKG59", "Only staff may clear flags")

      val postBefore = transaction.loadThePost(pageId, postNr)
      val postAfter = postBefore.copy(
        numPendingFlags = 0,
        numHandledFlags = postBefore.numHandledFlags + postBefore.numPendingFlags)
      transaction.updatePost(postAfter)
      transaction.clearFlags(pageId, postNr, clearedById = clearedById)
      // Need not update page version: flags aren't shown (except perhaps for staff users).
    }
    // In case the post gets unhidden now when flags gone:
    refreshPageInAnyCache(pageId)
  }


  def loadPostsReadStats(pageId: PageId): PostsReadStats =
    readOnlyTransaction(_.loadPostsReadStats(pageId))


  def loadPost(pageId: PageId, postNr: PostNr): Option[Post] =
    readOnlyTransaction(_.loadPost(pageId, postNr))


  def makeReviewTask(causedById: UserId, post: Post, reasons: immutable.Seq[ReviewReason],
        transaction: SiteTransaction): ReviewTask = {
    val oldReviewTask = transaction.loadPendingPostReviewTask(post.uniqueId,
      causedById = causedById)
    val newTask = ReviewTask(
      id = oldReviewTask.map(_.id).getOrElse(transaction.nextReviewTaskId()),
      reasons = reasons,
      causedById = causedById,
      createdAt = transaction.currentTime,
      createdAtRevNr = Some(post.currentRevisionNr),
      postId = Some(post.uniqueId),
      postNr = Some(post.nr))
    newTask.mergeWithAny(oldReviewTask)
  }


  private def updateVoteCounts(pageId: PageId, postNr: PostNr, transaction: SiteTransaction) {
    val post = transaction.loadThePost(pageId, postNr = postNr)
    updateVoteCounts(post, transaction)
  }


  private def updateVoteCounts(post: Post, transaction: SiteTransaction) {
    val actions = transaction.loadActionsDoneToPost(post.pageId, postNr = post.nr)
    val readStats = transaction.loadPostsReadStats(post.pageId, Some(post.nr))
    val postAfter = post.copyWithUpdatedVoteAndReadCounts(actions, readStats)

    val numNewLikes = postAfter.numLikeVotes - post.numLikeVotes
    val numNewWrongs = postAfter.numWrongVotes - post.numWrongVotes
    val numNewBurys = postAfter.numBuryVotes - post.numBuryVotes
    val numNewUnwanteds = postAfter.numUnwantedVotes - post.numUnwantedVotes

    val (numNewOpLikes, numNewOpWrongs, numNewOpBurys, numNewOpUnwanteds) =
      if (post.isOrigPost)
        (numNewLikes, numNewWrongs, numNewBurys, numNewUnwanteds)
      else
        (0, 0, 0, 0)

    val pageMetaBefore = transaction.loadThePageMeta(post.pageId)
    val pageMetaAfter = pageMetaBefore.copy(
      numLikes = pageMetaBefore.numLikes + numNewLikes,
      numWrongs = pageMetaBefore.numWrongs + numNewWrongs,
      numBurys = pageMetaBefore.numBurys + numNewBurys,
      numUnwanteds = pageMetaBefore.numUnwanteds + numNewUnwanteds,
      // For now: use max() because the db fields were just added so some counts are off.
      // (but not for Unwanted, that vote was added after the vote count fields)
      numOrigPostLikeVotes = math.max(0, pageMetaBefore.numOrigPostLikeVotes + numNewOpLikes),
      numOrigPostWrongVotes = math.max(0, pageMetaBefore.numOrigPostWrongVotes + numNewOpWrongs),
      numOrigPostBuryVotes = math.max(0, pageMetaBefore.numOrigPostBuryVotes + numNewOpBurys),
      numOrigPostUnwantedVotes = pageMetaBefore.numOrigPostUnwantedVotes + numNewOpUnwanteds,
      version = pageMetaBefore.version + 1)

    transaction.updatePost(postAfter)
    transaction.updatePageMeta(pageMetaAfter, oldMeta = pageMetaBefore,
      markSectionPageStale = true)

    // COULD split e.g. num_like_votes into ..._total and ..._unique? And update here.
  }

}



object PostsDao {

  private val SixMinutesMs = 6 * 60 * 1000
  private val OneHourMs = SixMinutesMs * 10
  private val OneDayMs = OneHourMs * 24

  val HardMaxNinjaEditWindowMs = OneDayMs

  /** For non-discussion pages, uses a long ninja edit window.
    */
  def ninjaEditWindowMsFor(pageRole: PageRole): Int = pageRole match {
    case PageRole.CustomHtmlPage => OneHourMs
    case PageRole.WebPage => OneHourMs
    case PageRole.Code => OneHourMs
    case PageRole.SpecialContent => OneHourMs
    case PageRole.Blog => OneHourMs
    case PageRole.Forum => OneHourMs
    case _ => SixMinutesMs
  }

  def userMayEdit(user: User, post: Post): Boolean = {
    val editsOwnPost = user.id == post.createdById
    val mayEditWiki = user.isAuthenticated && post.tyype == PostType.CommunityWiki
    editsOwnPost || user.isStaff || mayEditWiki
  }
}



trait CachingPostsDao extends PagesDao {
  self: CachingSiteDao =>

  // We cache all html already, that might be enough actually. For now, don't cache posts too.
  // So I've removed all cache-posts code from here.

}

