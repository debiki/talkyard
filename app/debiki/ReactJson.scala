/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.ForumController
import debiki.dao.{ReviewStuff, PageStuff, SiteDao, PageDao}
import debiki.DebikiHttp.throwNotFound
import io.efdi.server.http._
import java.{util => ju}
import play.api.libs.json._
import scala.collection.{mutable, immutable}
import scala.collection.mutable.ArrayBuffer
import scala.math.BigDecimal.decimal


object ReactJson {

  /** If there are more than this many visible replies, we'll summarize the page, otherwise
    * it'll take a bit long to render in the browser, especially on mobiles.
    */
  val SummarizeNumRepliesVisibleLimit = 80

  /** If we're summarizing a page, we'll show the first replies to each comment non-summarized.
    * But the rest will be summarized.
    */
  val SummarizeSiblingIndexLimit = 5

  val SummarizeAllDepthLimit = 5

  /** If we're summarizing a page, we'll squash the last replies to a comment into one
    * single "Click to show more comments..." html elem.
    */
  val SquashSiblingIndexLimit = 8

  /** Like a tweet :-)  */
  val PostSummaryLength = 140

  /** Posts shorter than this won't be summarized if they're one single paragraph only,
    * because the "Click to show..." text would then make the summarized post as large
    * as the non-summarized version.
    */
  val SummarizePostLengthLimit =
    PostSummaryLength + 80 // one line is roughly 80 chars



  def pageToJson(
        pageId: PageId,
        dao: SiteDao,
        anyPageRoot: Option[PostNr] = None,
        anyPageQuery: Option[PageQuery] = None): (String, CachedPageVersion) = {
    dao.readOnlyTransaction(
      pageToJsonImpl(pageId, dao, _, anyPageRoot, anyPageQuery))
  }


  /** When a site has just been created, and has no contents.
    */
  def emptySiteJson(pageReq: PageRequest[_]): JsObject = {
    require(!pageReq.pageExists, "DwE7KEG2")
    require(pageReq.pagePath.value == HomepageUrlPath, "DwE8UPY4")
    val site = pageReq.dao.theSite()
    val siteSettings = pageReq.dao.loadWholeSiteSettings()
    val isFirstSiteAdminEmailMissing = site.status == SiteStatus.NoAdmin &&
      site.id == FirstSiteId && Globals.becomeFirstSiteOwnerEmail.isEmpty

    Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "now" -> JsNumber((new ju.Date).getTime),
      "siteId" -> JsString(pageReq.siteId),
      "siteStatus" -> pageReq.dao.theSite().status.toInt,
      "isFirstSiteAdminEmailMissing" -> isFirstSiteAdminEmailMissing,
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> Json.obj(
        "allowGuestLogin" -> JsBoolean(siteSettings.isGuestLoginAllowed),
        "showComplicatedStuff" -> JsBoolean(siteSettings.showComplicatedStuff)),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsNumber(pageReq.thePageRole.toInt),
      "pagePath" -> JsPagePath(pageReq.pagePath),
      "numPosts" -> JsNumber(0),
      "numPostsRepliesSection" -> JsNumber(0),
      "numPostsChatSection" -> JsNumber(0),
      "numPostsExclTitle" -> JsNumber(0),
      "isInEmbeddedCommentsIframe" -> JsBoolean(false),
      "categories" -> JsArray(),
      "topics" -> JsArray(),
      "me" -> NoUserSpecificData,
      "rootPostId" -> JsNumber(PageParts.BodyNr),
      "usersByIdBrief" -> JsObject(Nil),
      "allPosts" -> JsObject(Nil),
      "topLevelCommentIdsSorted" -> JsArray(),
      "siteSections" -> JsArray(),
      "horizontalLayout" -> JsBoolean(false),
      "socialLinksHtml" -> JsNull)
  }


  private def pageToJsonImpl(
        pageId: PageId,
        dao: SiteDao,
        transaction: SiteTransaction,
        anyPageRoot: Option[PostNr],
        anyPageQuery: Option[PageQuery]): (String, CachedPageVersion) = {

    val socialLinksHtml = dao.loadWholeSiteSettings().socialLinksHtml
    val page = PageDao(pageId, transaction)
    val pageParts = page.parts
    val posts =
      if (page.role.isChat) {
        // Load the latest chat messages only. We'll load earlier posts from the browser, on demand.
        transaction.loadOrigPostAndLatestPosts(page.id, limit = 100)
      }
      else if (page.role == PageRole.Form) {
        // Don't load any comments on form pages. [5GDK02]
        transaction.loadOrigPost(page.id)
      }
      else {
        pageParts.loadAllPosts()
        pageParts.allPosts
      }

    var numPosts = 0
    var numPostsRepliesSection = 0
    var numPostsChatSection = 0

    val interestingPosts = posts filter { post =>
      // In case a page contains both form replies and "normal" comments, don't load any
      // form replies, because they might contain private stuff. (Page type might have
      // been changed to/from Form.) [5GDK02]
      post.tyype != PostType.CompletedForm &&
      post.tyype != PostType.Flat && ( // flat comments disabled [8KB42]
      !post.deletedStatus.isDeleted || (
        post.deletedStatus.onlyThisDeleted && pageParts.hasNonDeletedSuccessor(post.nr)))
    }

    val tagsByPostId = transaction.loadTagsByPostId(interestingPosts.map(_.uniqueId))

    var allPostsJson = interestingPosts map { post: Post =>
      numPosts += 1
      if (post.tyype == PostType.Flat)
        numPostsChatSection += 1
      else if (!post.isOrigPost && !post.isTitle)
        numPostsRepliesSection += 1
      val tags = tagsByPostId(post.uniqueId)
      post.nr.toString -> postToJsonImpl(post, page, tags)
    }

    // Topic members (e.g. chat channel members) join/leave infrequently, so better cache them
    // than to lookup them each request.
    val pageMemberIds = transaction.loadMessageMembers(pageId)

    val userIdsToLoad = mutable.Set[UserId]()
    userIdsToLoad ++= pageMemberIds

    val numPostsExclTitle = numPosts - (if (pageParts.titlePost.isDefined) 1 else 0)

    if (page.role == PageRole.EmbeddedComments) {
      allPostsJson +:=
        PageParts.BodyNr.toString ->
          embeddedCommentsDummyRootPost(pageParts.topLevelComments)
    }

    val topLevelComments = pageParts.topLevelComments
    val topLevelCommentIdsSorted =
      Post.sortPostsBestFirst(topLevelComments).map(reply => JsNumber(reply.nr))

    val (anyForumId: Option[PageId], ancestorsJsonRootFirst: Seq[JsObject]) =
      makeForumIdAndAncestorsJson(page.meta, dao)

    val categories = makeCategoriesJson(isStaff = false, restrictedOnly = false, dao)

    val anyLatestTopics: Seq[JsObject] =
      if (page.role == PageRole.Forum) {
        val rootCategoryId = page.meta.categoryId.getOrDie(
          "DwE7KYP2", s"Forum page '${page.id}', site '${transaction.siteId}', has no category id")
        val orderOffset = anyPageQuery.getOrElse(
          PageQuery(PageOrderOffset.ByBumpTime(None), PageFilter.ShowAll))
        val topics = ForumController.listTopicsInclPinned(rootCategoryId, orderOffset, dao,
          includeDescendantCategories = true,
          isStaff = false, restrictedOnly = false,
          limit = ForumController.NumTopicsToList)
        val pageStuffById = dao.loadPageStuff(topics.map(_.pageId))
        topics.foreach(_.meta.addUserIdsTo(userIdsToLoad))
        topics.map(controllers.ForumController.topicToJson(_, pageStuffById))
      }
      else {
        Nil
      }

    val usersById = transaction.loadUsersAsMap(userIdsToLoad)
    val usersByIdJson = JsObject(usersById map { idAndUser =>
      idAndUser._1.toString -> JsUser(idAndUser._2)
    })

    val siteSettings = dao.loadWholeSiteSettings()
    //val pageSettings = dao.loadSinglePageSettings(pageId)
    val horizontalLayout = page.role == PageRole.MindMap // || pageSettings.horizontalComments
    val is2dTreeDefault = false // pageSettings.horizontalComments
    val showForumCategories =
      if (page.role == PageRole.Forum) Some(siteSettings.showForumCategories)
      else None

    val jsonObj = Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "pageVersion" -> page.meta.version,
      "siteId" -> JsString(dao.siteId),
      "siteStatus" -> dao.theSite().status.toInt,
      // Later: move these two userMustBe... to settings {} too.
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> Json.obj(
        "allowGuestLogin" -> JsBoolean(siteSettings.isGuestLoginAllowed),
        "showComplicatedStuff" -> JsBoolean(siteSettings.showComplicatedStuff)),
      "pageId" -> pageId,
      "pageMemberIds" -> pageMemberIds,
      "categoryId" -> JsNumberOrNull(page.meta.categoryId),
      "forumId" -> JsStringOrNull(anyForumId),
      "showForumCategories" -> JsBooleanOrNull(showForumCategories),
      "ancestorsRootFirst" -> ancestorsJsonRootFirst,
      "pageRole" -> JsNumber(page.role.toInt),
      "pagePath" -> JsPagePath(page.thePath),
      "pageHtmlTagCssClasses" -> JsString(page.meta.htmlTagCssClasses),
      "pageHtmlHeadTitle" -> JsString(page.meta.htmlHeadTitle),
      "pageHtmlHeadDescription" -> JsString(page.meta.htmlHeadDescription),
      "pinOrder" -> JsNumberOrNull(page.meta.pinOrder),
      "pinWhere" -> JsNumberOrNull(page.meta.pinWhere.map(_.toInt)),
      "pageAnsweredAtMs" -> dateOrNull(page.meta.answeredAt),
      "pageAnswerPostUniqueId" -> JsNumberOrNull(page.meta.answerPostUniqueId),
      "pagePlannedAtMs" -> dateOrNull(page.meta.plannedAt),
      "pageDoneAtMs" -> dateOrNull(page.meta.doneAt),
      "pageClosedAtMs" -> dateOrNull(page.meta.closedAt),
      "pageLockedAtMs" -> dateOrNull(page.meta.lockedAt),
      "pageFrozenAtMs" -> dateOrNull(page.meta.frozenAt),
      "pageDeletedAtMs" -> dateOrNull(page.meta.deletedAt),
      "numPosts" -> numPosts,
      "numPostsRepliesSection" -> numPostsRepliesSection,
      "numPostsChatSection" -> numPostsChatSection,
      "numPostsExclTitle" -> numPostsExclTitle,
      "maxUploadSizeBytes" -> Globals.maxUploadSizeBytes,
      "isInEmbeddedCommentsIframe" -> JsBoolean(page.role == PageRole.EmbeddedComments),
      "categories" -> categories,
      "topics" -> JsArray(anyLatestTopics),
      "me" -> NoUserSpecificData,
      "rootPostId" -> JsNumber(BigDecimal(anyPageRoot getOrElse PageParts.BodyNr)),
      "usersByIdBrief" -> usersByIdJson,
      "allPosts" -> JsObject(allPostsJson), // COULD rename — doesn't contain all posts, if is chat
      "topLevelCommentIdsSorted" -> JsArray(topLevelCommentIdsSorted),
      "siteSections" -> makeSiteSectionsJson(dao),
      "horizontalLayout" -> JsBoolean(horizontalLayout),
      "is2dTreeDefault" -> JsBoolean(is2dTreeDefault),
      "socialLinksHtml" -> JsString(socialLinksHtml))

    val jsonString = jsonObj.toString()
    val version = CachedPageVersion(
      siteVersion = transaction.loadSiteVersion(),
      pageVersion = page.version,
      appVersion = Globals.applicationVersion,
      dataHash = hashSha1Base64UrlSafe(jsonString))

    (jsonString, version)
  }


  def adminAreaOrUserProfileJson(request: DebikiRequest[_]): JsObject = {
    val dao = request.dao
    val siteSettings = dao.loadWholeSiteSettings()
    Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "siteId" -> JsString(dao.siteId),
      "siteStatus" -> request.dao.theSite().status.toInt,
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> Json.obj(
        "allowGuestLogin" -> JsBoolean(siteSettings.isGuestLoginAllowed),
        "showComplicatedStuff" -> JsBoolean(siteSettings.showComplicatedStuff)),
      // (WOULD move 'me' to the volatile json; suddenly having it here in the main json is
      // a bit surprising.)
      "me" -> userNoPageToJson(request),
      "maxUploadSizeBytes" -> Globals.maxUploadSizeBytes,
      "siteSections" -> makeSiteSectionsJson(dao))
  }


  /** Returns (any-forum-id, json-for-ancestor-forum-and-categories-forum-first).
    */
  def makeForumIdAndAncestorsJson(pageMeta: PageMeta, dao: SiteDao)
        : (Option[PageId], Seq[JsObject]) = {
    val categoryId = pageMeta.categoryId getOrElse {
      return (None, Nil)
    }
    val categoriesRootFirst = dao.loadCategoriesRootLast(categoryId).reverse
    if (categoriesRootFirst.isEmpty) {
      return (None, Nil)
    }
    val forumPageId = categoriesRootFirst.head.sectionPageId
    dao.lookupPagePath(forumPageId) match {
      case None => (None, Nil)
      case Some(forumPath) =>
        val jsonRootFirst = categoriesRootFirst.map(makeForumOrCategoryJson(forumPath, _))
        (Some(forumPageId), jsonRootFirst)
    }
  }


  def makeSiteSectionsJson(dao: SiteDao): JsValue = {
    val sectionPageIds = dao.loadSectionPageIdsAsSeq()
    val jsonObjs = for {
      pageId <- sectionPageIds
      // (We're not in a transaction, the page might be gone [transaction])
      metaAndPath <- dao.loadPageMetaAndPath(pageId)
    } yield {
      Json.obj(
        "pageId" -> metaAndPath.pageId,
        "path" -> metaAndPath.path.value,
        "pageRole" -> metaAndPath.pageRole.toInt,
        "name" -> "(?? [EsU2UWY0]")
    }
    JsArray(jsonObjs)
  }


  /** Returns the URL path, category id and title for a forum or category.
    */
  private def makeForumOrCategoryJson(forumPath: PagePath, category: Category): JsObject = {
    val forumPathSlash = forumPath.value.endsWith("/") ? forumPath.value | forumPath.value + "/"
    val (name, path) =
      if (category.isRoot)
        ("Home", s"${forumPathSlash}latest")   // [i18n]
      else
        (category.name, s"${forumPathSlash}latest/${category.slug}")
    Json.obj(
      "categoryId" -> category.id,
      "title" -> name,
      "path" -> path,
      "unlisted" -> category.unlisted,
      "staffOnly" -> category.staffOnly,
      "onlyStaffMayCreateTopics" -> category.onlyStaffMayCreateTopics)
  }


  def postToJson2(postNr: PostNr, pageId: PageId, dao: SiteDao, includeUnapproved: Boolean = false)
      : JsObject =
    postToJson(postNr, pageId, dao, includeUnapproved)._1


  def postToJson(postNr: PostNr, pageId: PageId, dao: SiteDao, includeUnapproved: Boolean = false)
        : (JsObject, PageVersion) = {
    dao.readOnlyTransaction { transaction =>
      // COULD optimize: don't load the whole page, load only postNr and the author and last editor.
      val page = PageDao(pageId, transaction)
      val post = page.parts.thePost(postNr)
      val tags = transaction.loadTagsForPost(post.uniqueId)
      val json = postToJsonImpl(post, page, tags,
        includeUnapproved = includeUnapproved)
      (json, page.version)
    }
  }


  /** Private, so it cannot be called outside a transaction.
    */
  private def postToJsonImpl(post: Post, page: Page, tags: Set[TagLabel],
        includeUnapproved: Boolean = false): JsObject = {
    val people = page.parts

    val (anySanitizedHtml: Option[String], isApproved: Boolean) =
      if (includeUnapproved)
        (Some(post.currentHtmlSanitized(ReactRenderer, page.role)),
          post.isCurrentVersionApproved)
      else
        (post.approvedHtmlSanitized, post.approvedAt.isDefined)

    val depth = page.parts.depthOf(post.nr)

    // Find out if we should summarize post, or squash it and its subsequent siblings.
    // This is simple but a bit too stupid? COULD come up with a better algorithm (better
    // in the sense that it better avoids summarizing or squashing interesting stuff).
    // (Note: We'll probably have to do this server side in order to do it well, because
    // only server side all information is available, e.g. how trustworthy certain users
    // are or if they are trolls. Cannot include that in JSON sent to the browser, privacy issue.)
    val (summarize, jsSummary, squash) =
      if (page.parts.numRepliesVisible < SummarizeNumRepliesVisibleLimit) {
        (false, JsNull, false)
      }
      else {
        val (siblingIndex, hasNonDeletedSuccessorSiblingTrees) = page.parts.siblingIndexOf(post)
        val squashTime = siblingIndex > SquashSiblingIndexLimit / math.max(depth, 1)
        // Don't squash a single comment with no replies – summarize it instead.
        val squash = squashTime && (hasNonDeletedSuccessorSiblingTrees ||
          page.parts.hasNonDeletedSuccessor(post.nr))
        var summarize = !squash && (squashTime || siblingIndex > SummarizeSiblingIndexLimit ||
          depth >= SummarizeAllDepthLimit)
        val summary: JsValue =
          if (summarize) post.approvedHtmlSanitized match {
            case None =>
              JsString("(Not approved [DwE4FGEU7])")
            case Some(html) =>
              // Include only the first paragraph or header.
              val ToTextResult(text, isSingleParagraph) =
                htmlToTextWithNewlines(html, firstLineOnly = true)
              if (isSingleParagraph && text.length <= SummarizePostLengthLimit) {
                // There's just one short paragraph. Don't summarize.
                summarize = false
                JsNull
              }
              else {
                JsString(text.take(PostSummaryLength))
              }
          }
          else JsNull
        (summarize, summary, squash)
      }

    val childrenSorted = page.parts.childrenBestFirstOf(post.nr)
    val postType: Option[Int] = if (post.tyype == PostType.Normal) None else Some(post.tyype.toInt)

    // For now, ignore ninja edits of the very first revision, because otherwise if
    // clicking to view the edit history, it'll be empty.
    val lastApprovedEditAtNoNinja =
      if (post.approvedRevisionNr.contains(FirstRevisionNr)) None
      else post.lastApprovedEditAt

    var fields = Vector(
      "uniqueId" -> JsNumber(post.uniqueId),
      "postId" -> JsNumber(post.nr),
      "parentId" -> post.parentNr.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostIds" -> JsArray(post.multireplyPostNrs.toSeq.map(JsNumber(_))),
      "postType" -> JsNumberOrNull(postType),
      "authorId" -> JsString(post.createdById.toString),  // COULD remove, but be careful when converting to int client side
      "authorIdInt" -> JsNumber(post.createdById),  // Rename to authorId when it's been converted to int (the line above)
      "createdAtMs" -> JsDateMs(post.createdAt),
      "lastApprovedEditAtMs" -> JsDateMsOrNull(lastApprovedEditAtNoNinja),
      "numEditors" -> JsNumber(post.numDistinctEditors),
      "numLikeVotes" -> JsNumber(post.numLikeVotes),
      "numWrongVotes" -> JsNumber(post.numWrongVotes),
      "numBuryVotes" -> JsNumber(post.numBuryVotes),
      "numUnwantedVotes" -> JsNumber(post.numUnwantedVotes),
      "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions),
      "summarize" -> JsBoolean(summarize),
      "summary" -> jsSummary,
      "squash" -> JsBoolean(squash),
      "isTreeDeleted" -> JsBoolean(post.deletedStatus.isTreeDeleted),
      "isPostDeleted" -> JsBoolean(post.deletedStatus.isPostDeleted),
      "isTreeCollapsed" -> (
        if (summarize) JsString("Truncated")
        else JsBoolean(!squash && post.collapsedStatus.isTreeCollapsed)),
      "isPostCollapsed" -> JsBoolean(!summarize && !squash && post.collapsedStatus.isPostCollapsed),
      "isTreeClosed" -> JsBoolean(post.closedStatus.isTreeClosed),
      "isApproved" -> JsBoolean(isApproved),
      "pinnedPosition" -> JsNumberOrNull(post.pinnedPosition),
      "branchSideways" -> JsNumberOrNull(post.branchSideways.map(_.toInt)),
      "likeScore" -> JsNumber(decimal(post.likeScore)),
      "childIdsSorted" -> JsArray(childrenSorted.map(reply => JsNumber(reply.nr))),
      "sanitizedHtml" -> JsStringOrNull(anySanitizedHtml),
      "tags" -> JsArray(tags.toSeq.map(JsString)))

    if (post.isHidden) fields :+= "isPostHidden" -> JsTrue

    JsObject(fields)
  }


  def postRevisionToJson(revision: PostRevision, usersById: Map[UserId, User],
        maySeeHidden: Boolean): JsValue = {
    val source =
      if (revision.isHidden && !maySeeHidden) JsNull
      else JsString(revision.fullSource.getOrDie("DwE7GUY2"))
    val composer = usersById.get(revision.composedById)
    val approver = revision.approvedById.flatMap(usersById.get)
    val hider = revision.hiddenById.flatMap(usersById.get)
    Json.obj(
      "revisionNr" -> revision.revisionNr,
      "previousNr" -> JsNumberOrNull(revision.previousNr),
      "fullSource" -> source,
      "composedAtMs" -> revision.composedAt,
      "composedBy" -> JsUserOrNull(composer),
      "approvedAtMs" -> JsDateMsOrNull(revision.approvedAt),
      "approvedBy" -> JsUserOrNull(approver),
      "hiddenAtMs" -> JsDateMsOrNull(revision.hiddenAt),
      "hiddenBy" -> JsUserOrNull(hider))
  }


  /** Creates a dummy root post, needed when rendering React elements. */
  def embeddedCommentsDummyRootPost(topLevelComments: immutable.Seq[Post]) = Json.obj(
    "postId" -> JsNumber(PageParts.BodyNr),
    "childIdsSorted" ->
      JsArray(Post.sortPostsBestFirst(topLevelComments).map(reply => JsNumber(reply.nr))))


  val NoUserSpecificData = Json.obj(
    "rolePageSettings" -> JsObject(Nil),
    "notifications" -> JsArray(),
    "watchbar" -> EmptyWatchbar,
    "votes" -> JsObject(Nil),
    "unapprovedPosts" -> JsObject(Nil),
    "postIdsAutoReadLongAgo" -> JsArray(Nil),
    "postIdsAutoReadNow" -> JsArray(Nil),
    "marksByPostId" -> JsObject(Nil),
    "closedHelpMessages" -> JsObject(Nil))


  // Ought to rename this function (i.e. userDataJson) because it really should come as a
  // surprise that it updates the watchbar! But to what? Or reanme the class too? Or break out?
  def userDataJson(pageRequest: PageRequest[_]): Option[JsObject] = {
    val user = pageRequest.user getOrElse {
      return None
    }

    var watchbar: BareWatchbar = pageRequest.dao.loadWatchbar(user.id)
    if (pageRequest.pageExists) {
      // (See comment above about ought-to-rename this whole function / stuff.)
      BUG // Fairly harmless race condition: If the user opens two pages roughly at once.
      watchbar = watchbar.addRecentTopicMarkSeen(pageRequest.thePageId)
      pageRequest.dao.saveWatchbar(user.id, watchbar)
      // Another race condition.
      pageRequest.dao.pubSub.userWatchesPages(pageRequest.siteId, user.id, watchbar.watchedPageIds)
    }
    val watchbarWithTitles = pageRequest.dao.fillInWatchbarTitlesEtc(watchbar)
    val (restrictedCategories, restrictedTopics) = listRestrictedCategoriesAndTopics(pageRequest)
    pageRequest.dao.readOnlyTransaction { transaction =>
      Some(userDataJsonImpl(user, pageRequest.pageId, watchbarWithTitles, restrictedCategories,
        restrictedTopics, transaction))
    }
  }


  def userNoPageToJson(request: DebikiRequest[_]): JsValue = {
    val user = request.user getOrElse {
      return JsNull
    }
    val watchbar = request.dao.loadWatchbar(user.id)
    val watchbarWithTitles = request.dao.fillInWatchbarTitlesEtc(watchbar)
    request.dao.readOnlyTransaction(userDataJsonImpl(user, anyPageId = None, watchbarWithTitles,
      restrictedCategories = JsArray(), restrictedTopics = Nil, _))
  }


  private def userDataJsonImpl(user: User, anyPageId: Option[PageId],
        watchbar: WatchbarWithTitles, restrictedCategories: JsArray,
        restrictedTopics: Seq[JsValue], transaction: SiteTransaction): JsObject = {

    val reviewTasksAndCounts =
      if (user.isStaff) transaction.loadReviewTaskCounts(user.isAdmin)
      else ReviewTaskCounts(0, 0)

    val notfsAndCounts = loadNotifications(user.id, transaction, unseenFirst = true, limit = 30)

    val (rolePageSettings, anyVotes, anyUnapprovedPosts) =
      anyPageId map { pageId =>
        val rolePageSettings = user.anyRoleId.map({ roleId =>
          val anySettings = transaction.loadRolePageSettings(roleId = roleId, pageId = pageId)
          rolePageSettingsToJson(anySettings getOrElse RolePageSettings.Default)
        }) getOrElse JsNull
        (rolePageSettings,
          votesJson(user.id, pageId, transaction),
          unapprovedPostsJson(user, pageId, transaction))
      } getOrElse (JsNull, JsNull, JsNull)

    val threatLevel = user match {
      case member: Member => member.threatLevel
      case guest: Guest =>
        COULD // load or get-from-cache IP bans ("blocks") for this guest and derive the
        // correct threat level. However, for now, since this is for the brower only, this'll do:
        ThreatLevel.HopefullySafe
    }

    Json.obj(
      "id" -> JsNumber(user.id),
      "userId" -> JsNumber(user.id), // try to remove, use 'id' instead
      "username" -> JsStringOrNull(user.anyUsername),
      "fullName" -> JsStringOrNull(user.anyName),
      "isLoggedIn" -> JsBoolean(true),
      "isAdmin" -> JsBoolean(user.isAdmin),
      "isModerator" -> JsBoolean(user.isModerator),
      "avatarUrl" -> JsUploadUrlOrNull(user.smallAvatar),
      "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
      "isAuthenticated" -> JsBoolean(user.isAuthenticated),
      "rolePageSettings" -> rolePageSettings,
      "trustLevel" -> JsNumber(user.effectiveTrustLevel.toInt),
      "threatLevel" -> JsNumber(threatLevel.toInt),

      "numUrgentReviewTasks" -> reviewTasksAndCounts.numUrgent,
      "numOtherReviewTasks" -> reviewTasksAndCounts.numOther,

      "numTalkToMeNotfs" -> notfsAndCounts.numTalkToMe,
      "numTalkToOthersNotfs" -> notfsAndCounts.numTalkToOthers,
      "numOtherNotfs" -> notfsAndCounts.numOther,
      "thereAreMoreUnseenNotfs" -> notfsAndCounts.thereAreMoreUnseen,
      "notifications" -> notfsAndCounts.notfsJson,

      "watchbar" -> watchbar.toJsonWithTitles,

      "restrictedTopics" -> restrictedTopics,
      "restrictedCategories" -> restrictedCategories,
      "votes" -> anyVotes,
      "unapprovedPosts" -> anyUnapprovedPosts,
      "postIdsAutoReadLongAgo" -> JsArray(Nil),
      "postIdsAutoReadNow" -> JsArray(Nil),
      "marksByPostId" -> JsObject(Nil),

      "closedHelpMessages" -> JsObject(Nil))
  }


  private def rolePageSettingsToJson(settings: RolePageSettings): JsObject = {
    Json.obj(
      "notfLevel" -> JsNumber(settings.notfLevel.toInt))
  }


  def listRestrictedCategoriesAndTopics(request: PageRequest[_]): (JsArray, Seq[JsValue]) = {
    // Currently there're only 2 types of "personal" topics: unlisted, & staff-only.
    if (!request.isStaff)
      return (JsArray(), Nil)

    // SHOULD avoid starting a new transaction, so can remove workaround [7YKG25P].
    // (request.dao might start a new transaction)
    val (categories, defaultCategoryId) =
      request.dao.listAllCategories(isStaff = true, restrictedOnly = true)

    // A tiny bit dupl code [5YK03W5]
    val categoriesJson = JsArray(categories.filterNot(_.isRoot) map { category =>
      makeCategoryJson(category, defaultCategoryId.contains(category.id))
    })

    val categoryId = request.thePageMeta.categoryId getOrElse {
      // Not a forum topic. Could instead show an option to add the page to the / a forum?
      return (categoriesJson, Nil)
    }

    val (topics, pageStuffById) =
      if (request.thePageRole != PageRole.Forum) {
        // Then won't list topics; no need to load any.
        (Nil, Map[PageId, PageStuff]())
      }
      else {
        val orderOffset = PageQuery(PageOrderOffset.ByBumpTime(None), PageFilter.ShowAll)
        // SHOULD avoid starting a new transaction, so can remove workaround [7YKG25P].
        // (We're passing request.dao to ForumController below.)
        val topics = ForumController.listTopicsInclPinned(
          categoryId, orderOffset, request.dao,
          includeDescendantCategories = true,
          isStaff = true,
          restrictedOnly = true,
          limit = ForumController.NumTopicsToList)
        val pageStuffById = request.dao.loadPageStuff(topics.map(_.pageId))
        (topics, pageStuffById)
      }

    (categoriesJson, topics.map(ForumController.topicToJson(_, pageStuffById)))
  }


  case class NotfsAndCounts(
    numTalkToMe: Int,
    numTalkToOthers: Int,
    numOther: Int,
    thereAreMoreUnseen: Boolean,
    notfsJson: JsArray)


  def loadNotifications(userId: UserId, transaction: SiteTransaction, unseenFirst: Boolean,
        limit: Int, upToWhen: Option[ju.Date] = None): NotfsAndCounts = {
    val notfs = transaction.loadNotificationsForRole(userId, limit, unseenFirst, upToWhen)
    notificationsToJson(notfs, transaction)
  }


  def notificationsToJson(notfs: Seq[Notification], transaction: SiteTransaction)
        : NotfsAndCounts = {
    val userIds = ArrayBuffer[UserId]()
    var numTalkToMe = 0
    var numTalkToOthers = 0
    var numOther = 0

    val postIds: Seq[UniquePostId] = notfs flatMap {
      case notf: Notification.NewPost => Some(notf.uniquePostId)
      case _ => None
    }
    val postsById = transaction.loadPostsByUniqueId(postIds)

    val pageIds = postsById.values.map(_.pageId)
    val pageTitlesById = transaction.loadTitlesPreferApproved(pageIds)

    notfs.foreach {
      case notf: Notification.NewPost =>
        userIds.append(notf.byUserId)
        import NotificationType._
        if (notf.seenAt.isEmpty) notf.tyype match {
          case DirectReply | Mention | Message =>
            numTalkToMe += 1
          case NewPost =>
            numTalkToOthers += 1
          case PostTagged =>
            numOther += 1
        }
      case _ => ()
    }

    // Unseen notfs are sorted first, so if the last one is unseen, there might be more unseen.
    val thereAreMoreUnseen = notfs.lastOption.exists(_.seenAt.isEmpty)

    val usersById = transaction.loadUsersAsMap(userIds)

    NotfsAndCounts(
      numTalkToMe = numTalkToMe,
      numTalkToOthers = numTalkToOthers,
      numOther = numOther,
      thereAreMoreUnseen = thereAreMoreUnseen,
      notfsJson = JsArray(notfs.flatMap(
        makeNotificationsJson(_, pageTitlesById, postsById, usersById))))
  }


  private def makeNotificationsJson(notf: Notification, pageTitlesById: Map[PageId, String],
        postsById: Map[UniquePostId, Post], usersById: Map[UserId, User]): Option[JsObject] = {
    Some(notf match {
      case notf: Notification.NewPost =>
        val post = postsById.getOrElse(notf.uniquePostId, {
          return None
        })
        val title = pageTitlesById.get(post.pageId)
        // COULD include number recipients for this notf, so the user will know if this is
        // for him/her only, or for other people too. [4Y2KF8S]
        Json.obj(
          "id" -> notf.id,
          "type" -> notf.tyype.toInt,
          "createdAtMs" -> notf.createdAt.getTime,
          "pageId" -> post.pageId,
          "pageTitle" -> JsStringOrNull(title),
          "postNr" -> post.nr,
          "byUser" -> JsUserOrNull(usersById.get(notf.byUserId)),
          "seen" -> notf.seenAt.nonEmpty)
    })
  }


  private def votesJson(userId: UserId, pageId: PageId, transaction: SiteTransaction): JsObject = {
    val actions = transaction.loadActionsByUserOnPage(userId, pageId)
    val votes = actions.filter(_.isInstanceOf[PostVote]).asInstanceOf[immutable.Seq[PostVote]]
    val userVotesMap = UserPostVotes.makeMap(votes)
    val votesByPostId = userVotesMap map { case (postNr, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedBury) voteStrs = voteStrs :+ "VoteBury"
      if (votes.votedUnwanted) voteStrs = voteStrs :+ "VoteUnwanted"
      postNr.toString -> Json.toJson(voteStrs)
    }
    JsObject(votesByPostId.toSeq)
  }


  private def unapprovedPostsJson(user: User, pageId: PageId, transaction: SiteTransaction)
        : JsObject = {

    REFACTOR // Load form replies. For now: (a bit hacky)   (& could rename this fn + more stuff)
    COULD_OPTIMIZE // don't load the whole page when is-not Form
    COULD_OPTIMIZE // only load unapproved posts and form replies. [3PF4GK]
    if (user.isAdmin) {
      val page = PageDao(pageId, transaction)
      if (page.exists && (
            page.meta.pageRole == PageRole.Form ||
            page.meta.pageRole == PageRole.WebPage)) {  // hack. Try to remove + fix [3PF4GK] above
        val posts = page.parts.allPosts
        val tagsByPostId = transaction.loadTagsByPostId(posts.map(_.uniqueId))
        val postIdsAndJson: Seq[(String, JsValue)] = posts.toSeq.map { post =>
          val tags = tagsByPostId(post.uniqueId)
          post.nr.toString -> postToJsonImpl(post, page, tags, includeUnapproved = true)
        }
        return JsObject(postIdsAndJson)
      }
    }

    JsObject(Nil) // for now
    /*
    // TOO slow! does a db req each http req. Fix by caching user ids with unappr posts, per page?
    val page = PageDao(pageId, transaction)
    val posts = page.parts.allPosts filter { post =>
      (user.isAdmin || post.createdById == user.id) && !post.isCurrentVersionApproved
    }
    /* doesn't work currently, because (unfortunately) the whole page is needed:
    val byId = user.isStaff ? Option(user.id) | None
    val posts = transaction.loadPosts(authorId = byId, includeTitles = true,
      includeChatMessages = false, onPageId = Some(pageId), onlyUnapproved = true,
      orderBy = OrderBy.OldestFirst, limit = 99)
      */

    val postIdsAndJson: Seq[(String, JsValue)] = posts.toSeq.map { post =>
      post.nr.toString -> postToJsonImpl(post, page, includeUnapproved = true)
    }
    JsObject(postIdsAndJson)
    */
  }


  def makeCategoriesJson(isStaff: Boolean, restrictedOnly: Boolean, dao: SiteDao)
        : JsArray = {
    val (categories, defaultCategoryId) = dao.listAllCategories(isStaff = isStaff,
      restrictedOnly = restrictedOnly)
    // A tiny bit dupl code [5YK03W5]
    val categoriesJson = JsArray(categories.filterNot(_.isRoot) map { category =>
      makeCategoryJson(category, defaultCategoryId.contains(category.id))
    })
    categoriesJson
  }


  def makeCategoryJson(category: Category, isDefaultCategory: Boolean,
        recentTopicsJson: Seq[JsObject] = null) = {
    var json = Json.obj(
      "id" -> category.id,
      "name" -> category.name,
      "slug" -> category.slug,
      // [refactor] [5YKW294] There should be only one default type.
      "defaultTopicType" -> JsNumber(
          category.newTopicTypes.headOption.getOrElse(PageRole.Discussion).toInt),
      // [refactor] [5YKW294] delete this later:
      "newTopicTypes" -> JsArray(category.newTopicTypes.map(t => JsNumber(t.toInt))),
      "unlisted" -> JsBoolean(category.unlisted),
      "staffOnly" -> JsBoolean(category.staffOnly),
      "onlyStaffMayCreateTopics" -> JsBoolean(category.onlyStaffMayCreateTopics),
      "position" -> category.position,
      "description" -> JsStringOrNull(category.description))
    if (recentTopicsJson ne null) {
      json += "recentTopics" -> JsArray(recentTopicsJson)
    }
    if (isDefaultCategory) {
      json += "isDefaultCategory" -> JsBoolean(true)
    }
    json
  }


  def reviewStufToJson(stuff: ReviewStuff, usersById: Map[UserId, User]): JsValue = {
    // Also see nowadays no-longer-in-use ModerationController.makeJsonSinglePost.
    val anyPost = stuff.post match {
      case None => JsNull
      case Some(post) =>
        Json.obj(
          "pageId" -> post.pageId,
          "nr" -> post.nr,
          "uniqueId" -> post.uniqueId,
          "createdBy" -> JsUserOrNull(usersById.get(post.createdById)),
          "currentSource" -> post.currentSource,
          "currRevNr" -> post.currentRevisionNr,
          "currRevComposedBy" -> JsUserOrNull(usersById.get(post.currentRevisionById)),
          "approvedSource" -> JsStringOrNull(post.approvedSource),
          "approvedHtmlSanitized" -> JsStringOrNull(post.approvedHtmlSanitized),
          "approvedRevNr" -> JsNumberOrNull(post.approvedRevisionNr),
          "approvedRevComposedById" -> JsNull, // post.lastApprovedEditById ? ... hmm, see below
          "approvedRevApprovedById" -> JsNull) // -> post.aprvdRevAprvdById?? ... hmm no,
                                                // better: post.lastApporvedRevision.approvedById
    }
    Json.obj(
      "id" -> stuff.id,
      "reasonsLong" -> ReviewReason.toLong(stuff.reasons),
      "createdAtMs" -> stuff.createdAt.getTime,
      "moreReasonsAtMs" -> JsDateMsOrNull(stuff.moreReasonsAt),
      "completedAtMs" -> JsDateMsOrNull(stuff.completedAt),
      "completedBy" -> JsUserOrNull(stuff.completedBy),
      "invalidatedAt" -> JsDateMsOrNull(stuff.invalidatedAt),
      "resolution" -> JsNumberOrNull(stuff.resolution.map(_.toInt)),
      "user" -> JsUserOrNull(stuff.user),
      "pageId" -> JsStringOrNull(stuff.pageId),
      "pageTitle" -> JsStringOrNull(stuff.pageTitle),
      "post" -> anyPost)
  }


  case class ToTextResult(text: String, isSingleParagraph: Boolean)


  def htmlToTextWithNewlines(htmlText: String, firstLineOnly: Boolean = false): ToTextResult = {
    // This includes no newlines: Jsoup.parse(htmlText).body.text
    // Instead we'll have to traverse all nodes. There are some alternative approaches
    // at StackOverflow but I think this is the only way to do it properly.
    // This implementation is based on how above `.text` works)
    import org.jsoup.Jsoup
    import org.jsoup.nodes.{Element, TextNode, Node}
    import org.jsoup.select.{NodeTraversor, NodeVisitor}
    import scala.util.control.ControlThrowable

    val result = new StringBuilder
    var numParagraphBlocks = 0
    var numOtherBlocks = 0
    def isInFirstParagraph = numParagraphBlocks == 0 && numOtherBlocks == 0
    def canStillBeSingleParagraph = numOtherBlocks == 0 && numParagraphBlocks <= 1

    val nodeTraversor = new NodeTraversor(new NodeVisitor() {
      override def head(node: Node, depth: Int) {
        node match {
          case textNode: TextNode =>
            if (!firstLineOnly || isInFirstParagraph) {
              result.append(textNode.getWholeText.trim)
            }
          case _ => ()
        }
      }
      override def tail(node: Node, depth: Int) {
        node match {
          case element: Element if result.nonEmpty =>
            val tagName = element.tag.getName
            if (tagName == "body")
              return
            if (element.isBlock) {
              // Consider a <br>, not just </p>, the end of a paragraph.
              if (tagName == "p" || tagName == "br")
                numParagraphBlocks += 1
              else
                numOtherBlocks += 1
            }
            if (element.isBlock || tagName == "br") {
              if (firstLineOnly) {
                // Don't break traversal before we know if there's at most one paragraph.
                if (!canStillBeSingleParagraph)
                  throw new ControlThrowable {}
              }
              else {
                result.append("\n")
              }
            }
          case _ => ()
        }
      }
    })

    try { nodeTraversor.traverse(Jsoup.parse(htmlText).body) }
    catch {
      case _: ControlThrowable => ()
    }
    ToTextResult(text = result.toString().trim, isSingleParagraph = canStillBeSingleParagraph)
  }


  def htmlToExcerpt(htmlText: String, length: Int): String = {
    val ToTextResult(text, _) = htmlToTextWithNewlines(htmlText, firstLineOnly = true)
    var excerpt =
      if (text.length <= length + 3) text
      else text.take(length) + "..."
    var lastChar = 'x'
    excerpt = excerpt takeWhile { ch =>
      val newParagraph = ch == '\n' && lastChar == '\n'
      lastChar = ch
      !newParagraph
    }
    excerpt
  }


  def EmptyWatchbar = Json.obj(
    WatchbarSection.RecentTopics.toInt.toString -> JsArray(Nil),
    WatchbarSection.Notifications.toInt.toString -> JsArray(Nil),
    WatchbarSection.ChatChannels.toInt.toString -> JsArray(Nil),
    WatchbarSection.DirectMessages.toInt.toString -> JsArray(Nil))


  def makeStorePatch(post: Post, author: User, dao: SiteDao): JsValue = {
    // Warning: some similar code below [89fKF2]
    require(post.createdById == author.id, "EsE5PKY2")
    val (postJson, pageVersion) = ReactJson.postToJson(
      post.nr, pageId = post.pageId, dao, includeUnapproved = true)
    makeStorePatch(PageIdVersion(post.pageId, pageVersion),
      posts = Seq(postJson), users = Seq(JsUser(author)))
  }


  def makeStorePatch2(postId: UniquePostId, pageId: PageId, transaction: SiteTransaction)
        : JsValue = {
    // Warning: some similar code above [89fKF2]
    // Load the page so we'll get a version that includes postId, in case it was just added.
    val page = PageDao(pageId, transaction)
    val post = page.parts.postById(postId) getOrDie "EsE8YKPW2"
    val tags = transaction.loadTagsForPost(post.uniqueId)
    val author = transaction.loadTheUser(post.createdById)
    require(post.createdById == author.id, "EsE4JHKX1")
    val postJson = postToJsonImpl(post, page, tags, includeUnapproved = true)
    makeStorePatch(PageIdVersion(post.pageId, page.version),
      posts = Seq(postJson), users = Seq(JsUser(author)))
  }


  def makeStorePatch(pageIdVersion: PageIdVersion, posts: Seq[JsObject] = Nil,
        users: Seq[JsObject] = Nil): JsValue = {
    require(posts.isEmpty || users.nonEmpty, "Posts but no authors [EsE4YK7W2]")
    Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "pageVersionsByPageId" -> Json.obj(pageIdVersion.pageId -> pageIdVersion.version),
      "usersBrief" -> users,
      "postsByPageId" -> Json.obj(pageIdVersion.pageId -> posts))
  }


  def makeTagsStuffPatch(json: JsObject): JsValue = {
    makeStorePatch(Json.obj("tagsStuff" -> json))
  }


  def makeStorePatch(json: JsObject): JsValue = {
    json + ("appVersion" -> JsString(Globals.applicationVersion))
  }


  def JsUserOrNull(user: Option[User]): JsValue =
    user.map(JsUser).getOrElse(JsNull)

  def JsUser(user: User): JsObject = {
    var json = Json.obj(
      "id" -> JsNumber(user.id),
      "username" -> JsStringOrNull(user.anyUsername),
      "fullName" -> JsStringOrNull(user.anyName))
    user.tinyAvatar foreach { uploadRef =>
      json += "avatarUrl" -> JsString(uploadRef.url)
    }
    if (user.isGuest) {
      json += "isGuest" -> JsTrue
    }
    else {
      require(user.isAuthenticated, "EdE8GPY4")
      json += "isAuthenticated" -> JsTrue  // COULD remove this, client side, use !isGuest instead
    }
    if (user.email.isEmpty) {
      json += "isEmailUnknown" -> JsTrue
    }
    if (user.isAdmin) {
      json += "isAdmin" -> JsTrue
    }
    if (user.isModerator) {
      json += "isModerator" -> JsTrue
    }
    json
  }

  def JsPagePath(pagePath: PagePath): JsValue =
    Json.obj(
      "value" -> pagePath.value,
      "folder" -> pagePath.folder,
      "showId" -> pagePath.showId,
      "slug" -> pagePath.pageSlug)

  def JsUploadUrlOrNull(uploadRef: Option[UploadRef]): JsValue =
    uploadRef.map(ref => JsString(ref.url)) getOrElse JsNull

  def JsStringOrNull(value: Option[String]) =
    value.map(JsString).getOrElse(JsNull)

  def JsBooleanOrNull(value: Option[Boolean]) =
    value.map(JsBoolean).getOrElse(JsNull)

  def JsNumberOrNull(value: Option[Int]) =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsLongOrNull(value: Option[Long]) =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsDateMs(value: ju.Date) =
    JsNumber(value.getTime)

  def JsDateMsOrNull(value: Option[ju.Date]) =
    value.map(JsDateMs).getOrElse(JsNull)

  def DateEpochOrNull(value: Option[ju.Date]) =
    value.map(date => JsNumber(date.getTime)).getOrElse(JsNull)

  def date(value: ju.Date) =
    JsString(toIso8601NoSecondsNoT(value))

  def dateOrNull(value: Option[ju.Date]) = value match {
    case Some(v) => date(v)
    case None => JsNull
  }

}

