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
import debiki.dao.{PageDao, PageStuff, ReviewStuff, SiteDao}
import io.efdi.server.http._
import java.{util => ju}
import org.jsoup.Jsoup
import play.api.libs.json._
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import scala.math.BigDecimal.decimal


case class PostExcerpt(text: String, firstImageUrls: immutable.Seq[String])


class HowRenderPostInPage(
  val summarize: Boolean,
  val jsSummary: JsValue,
  val squash: Boolean,
  val childrenSorted: immutable.Seq[Post])



// CLEAN_UP COULD rename it to JsonMaker? JsonBuilder? Jsonifier?
// REFACTOR COULD split into one class JsonDao, which accesses the database and is a Dao trait?
// + a class JsonMaker or EdJson that doesn't do any db calls or anything like that.
//
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


  /** Returns (json, page-version, page-title).
    */
  def pageToJson(
        pageId: PageId,
        dao: SiteDao,
        anyPageRoot: Option[PostNr] = None,
        anyPageQuery: Option[PageQuery] = None): (String, CachedPageVersion, Option[String]) = {
    dao.readOnlyTransaction(
      pageToJsonImpl(pageId, dao, _, anyPageRoot, anyPageQuery))
  }


  def makeSettingsVisibleClientSideJson(settings: EffectiveSettings): JsObject = {
    // Only include settings that differ from the default. Default settings: [8L4KWU02]
    var json = Json.obj()
    if (settings.inviteOnly) json += "inviteOnly" -> JsTrue
    if (!settings.allowSignup) json += "allowSignup" -> JsFalse
    if (!settings.allowLocalSignup) json += "allowLocalSignup" -> JsFalse
    if (settings.isGuestLoginAllowed) json += "allowGuestLogin" -> JsTrue
    if (settings.showExperimental) json += "showExperimental" -> JsTrue
    if (!settings.showCategories) json += "showCategories" -> JsFalse
    if (!settings.showTopicFilterButton) json += "showTopicFilterButton" -> JsFalse
    if (!settings.showTopicTypes) json += "showTopicTypes" -> JsFalse
    if (!settings.selectTopicType) json += "selectTopicType" -> JsFalse
    json
  }


  /** When a site has just been created, and has no contents.
    */
  def emptySiteJson(pageReq: PageRequest[_]): JsObject = {
    require(!pageReq.pageExists, "DwE7KEG2")
    require(pageReq.pagePath.value == HomepageUrlPath, "DwE8UPY4")
    val site = pageReq.dao.theSite()
    val siteSettings = pageReq.dao.getWholeSiteSettings()
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
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings),
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
      "postsByNr" -> JsObject(Nil),
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
        anyPageQuery: Option[PageQuery]): (String, CachedPageVersion, Option[String]) = {

    // The json constructed here will be cached & sent to "everyone", so in this function
    // we always specify !isStaff and !restrictedOnly.

    val socialLinksHtml = dao.getWholeSiteSettings().socialLinksHtml
    val page = PageDao(pageId, transaction)
    val pageParts = page.parts
    val posts =
      if (page.role.isChat) {
        // Load the latest chat messages only. We'll load earlier posts from the browser, on demand.
        transaction.loadOrigPostAndLatestPosts(page.id, limit = 100)
      }
      else if (page.role == PageRole.Form) {
        // Don't load any comments on form pages. [5GDK02]
        transaction.loadTitleAndOrigPost(page.id)
      }
      else {
        pageParts.loadAllPosts()
        pageParts.allPosts
      }

    val pageTitle = posts.find(_.isTitle).flatMap(_.approvedHtmlSanitized)

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

    val tagsByPostId = transaction.loadTagsByPostId(interestingPosts.map(_.id))

    var allPostsJson = interestingPosts map { post: Post =>
      numPosts += 1
      if (post.tyype == PostType.Flat)
        numPostsChatSection += 1
      else if (!post.isOrigPost && !post.isTitle)
        numPostsRepliesSection += 1
      val tags = tagsByPostId(post.id)
      post.nr.toString -> postToJsonImpl(post, page, tags)
    }

    // Topic members (e.g. chat channel members) join/leave infrequently, so better cache them
    // than to lookup them each request.
    val pageMemberIds = transaction.loadMessageMembers(pageId)

    val userIdsToLoad = mutable.Set[UserId]()
    userIdsToLoad ++= pageMemberIds
    userIdsToLoad ++= interestingPosts.map(_.createdById)

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
        val pageStuffById = dao.getPageStuffById(topics.map(_.pageId))
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

    val siteSettings = dao.getWholeSiteSettings()
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
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings),
      "pageId" -> pageId,
      "pageMemberIds" -> pageMemberIds,
      "categoryId" -> JsNumberOrNull(page.meta.categoryId),
      "forumId" -> JsStringOrNull(anyForumId),
      "showForumCategories" -> JsBooleanOrNull(showForumCategories),
      "ancestorsRootFirst" -> ancestorsJsonRootFirst,
      "pageRole" -> JsNumber(page.role.toInt),
      "pagePath" -> JsPagePath(page.thePath),
      "pageLayout" -> JsNumber(page.meta.layout.bitmask),
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
      "pageHiddenAtMs" -> JsWhenMsOrNull(page.meta.hiddenAt),
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
      "postsByNr" -> JsObject(allPostsJson),
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

    (jsonString, version, pageTitle)
  }


  def makeSpecialPageJson(request: DebikiRequest[_], inclCategoriesJson: Boolean): JsObject = {
    val dao = request.dao
    val siteSettings = dao.getWholeSiteSettings()
    var result = Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "siteId" -> JsString(dao.siteId),
      "siteStatus" -> request.dao.theSite().status.toInt,
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings),
      // (WOULD move 'me' to the volatile json; suddenly having it here in the main json is
      // a bit surprising.) CLEAN_UP
      "me" -> userNoPageToJson(request),
      "maxUploadSizeBytes" -> Globals.maxUploadSizeBytes,
      "siteSections" -> makeSiteSectionsJson(dao))

    if (inclCategoriesJson) {
      result += "categories" -> makeCategoriesJson(
          isStaff = request.isStaff, restrictedOnly = false, dao)
    }

    result
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
    dao.getPagePath(forumPageId) match {
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
      metaAndPath <- dao.getPagePathAndMeta(pageId)
    } yield {
      Json.obj(
        "pageId" -> metaAndPath.pageId,
        "path" -> metaAndPath.path.value,
        "pageRole" -> metaAndPath.pageRole.toInt,
        "name" -> "(?? [EsU2UWY0]")
    }
    JsArray(jsonObjs)
  }


  /** Returns the URL path, category id and title for a forum or category.  [6FK02QFV]
    */
  private def makeForumOrCategoryJson(forumPath: PagePath, category: Category): JsObject = {
    val forumPathSlash = forumPath.value.endsWith("/") ? forumPath.value | forumPath.value + "/"
    val (name, path) =
      if (category.isRoot)
        ("Home", s"${forumPathSlash}latest")   // [i18n]
      else
        (category.name, s"${forumPathSlash}latest/${category.slug}")
    var result = Json.obj(
      "categoryId" -> category.id,
      "title" -> name,
      "path" -> path,
      "unlisted" -> category.unlisted,
      "staffOnly" -> category.staffOnly,
      "onlyStaffMayCreateTopics" -> category.onlyStaffMayCreateTopics)
    if (category.isDeleted) {
      result += "isDeleted" -> JsTrue
    }
    result
  }


  def postToJson2(postNr: PostNr, pageId: PageId, dao: SiteDao, includeUnapproved: Boolean = false,
        showHidden: Boolean = false): JsObject =
    postToJson(postNr, pageId, dao, includeUnapproved = includeUnapproved,
      showHidden = showHidden)._1


  def postToJson(postNr: PostNr, pageId: PageId, dao: SiteDao, includeUnapproved: Boolean = false,
        showHidden: Boolean = false): (JsObject, PageVersion) = {
    dao.readOnlyTransaction { transaction =>
      // COULD optimize: don't load the whole page, load only postNr and the author and last editor.
      val page = PageDao(pageId, transaction)
      val post = page.parts.thePostByNr(postNr)
      val tags = transaction.loadTagsForPost(post.id)
      val json = postToJsonImpl(post, page, tags,
        includeUnapproved = includeUnapproved, showHidden = showHidden)
      (json, page.version)
    }
  }


  ANNOYING ; COULD ; REFACTOR // postToJsonImpl's dependency on Page & a transaction is annoying.
  // Could create a StuffNeededToRenderPost class instead? and make some things, like
  // depth & siblings, optional, and then just exlude them from the resulting json, and
  // merge-update the post client side instead.

  /** Private, so it cannot be called outside a transaction.
    */
  private def postToJsonImpl(post: Post, page: Page, tags: Set[TagLabel],
        includeUnapproved: Boolean = false, showHidden: Boolean = false): JsObject = {

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

    val howRender = new HowRenderPostInPage(summarize = summarize, jsSummary = jsSummary,
        squash = squash, childrenSorted = childrenSorted)

    postToJsonNoDbAccess(post, showHidden = showHidden, includeUnapproved = includeUnapproved,
      pageRole = page.role, tags = tags, howRender)
  }


  def postToJsonOutsidePage(post: Post, pageRole: PageRole, showHidden: Boolean, includeUnapproved: Boolean,
        tags: Set[TagLabel]): JsObject = {
    postToJsonNoDbAccess(post, showHidden = showHidden, includeUnapproved = includeUnapproved,
      pageRole, tags = tags, new HowRenderPostInPage(false, JsNull, false, Nil))
  }


  private def postToJsonNoDbAccess(post: Post, showHidden: Boolean, includeUnapproved: Boolean,
        pageRole: PageRole, tags: Set[TagLabel], inPageInfo: HowRenderPostInPage): JsObject = {

    import inPageInfo._
    val postType: Option[Int] = if (post.tyype == PostType.Normal) None else Some(post.tyype.toInt)

    val (anySanitizedHtml: Option[String], isApproved: Boolean) =
      if (post.isBodyHidden && !showHidden)
        (None, post.approvedAt.isDefined)
      else if (includeUnapproved)
        (Some(post.currentHtmlSanitized(ReactRenderer, pageRole)),
          post.isCurrentVersionApproved)
      else
        (post.approvedHtmlSanitized, post.approvedAt.isDefined)

    // For now, ignore ninja edits of the very first revision, because otherwise if
    // clicking to view the edit history, it'll be empty.
    val lastApprovedEditAtNoNinja =
      if (post.approvedRevisionNr.contains(FirstRevisionNr)) None
      else post.lastApprovedEditAt

    var fields = Vector(
      "uniqueId" -> JsNumber(post.id),
      "nr" -> JsNumber(post.nr),
      "parentNr" -> post.parentNr.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostNrs" -> JsArray(post.multireplyPostNrs.toSeq.map(JsNumber(_))),
      "postType" -> JsNumberOrNull(postType),
      "authorId" -> JsNumber(post.createdById),
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

    if (post.isBodyHidden) fields :+= "isBodyHidden" -> JsTrue

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
    "nr" -> JsNumber(PageParts.BodyNr),
    "childIdsSorted" ->
      JsArray(Post.sortPostsBestFirst(topLevelComments).map(reply => JsNumber(reply.nr))))


  val NoUserSpecificData = Json.obj(
    "rolePageSettings" -> JsObject(Nil),
    "notifications" -> JsArray(),
    "watchbar" -> EmptyWatchbar,
    "votes" -> JsObject(Nil),
    "unapprovedPosts" -> JsObject(Nil),
    "unapprovedPostAuthors" -> JsArray(),
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

    val dao = pageRequest.dao
    var watchbar: BareWatchbar = dao.getOrCreateWatchbar(user.id)
    if (pageRequest.pageExists) {
      // (See comment above about ought-to-rename this whole function / stuff.)
      RACE // if the user opens a page, and someone adds her to a chat at the same time.
      watchbar.tryAddRecentTopicMarkSeen(pageRequest.thePageMeta) match {
        case None => // watchbar wasn't modified
        case Some(modifiedWatchbar) =>
          watchbar = modifiedWatchbar
          dao.saveWatchbar(user.id, watchbar)
          dao.pubSub.userWatchesPages(pageRequest.siteId, user.id, watchbar.watchedPageIds) ;RACE
      }
    }
    val watchbarWithTitles = dao.fillInWatchbarTitlesEtc(watchbar)
    val (restrictedCategories, restrictedTopics) = listRestrictedCategoriesAndTopics(pageRequest)
    dao.readOnlyTransaction { transaction =>
      Some(userDataJsonImpl(user, pageRequest.pageId, watchbarWithTitles, restrictedCategories,
        restrictedTopics, transaction))
    }
  }


  def userNoPageToJson(request: DebikiRequest[_]): JsValue = {
    val user = request.user getOrElse {
      return JsNull
    }
    val watchbar = request.dao.getOrCreateWatchbar(user.id)
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

    val (rolePageSettings, anyVotes, anyUnapprovedPosts, anyUnapprovedAuthors) =
      anyPageId map { pageId =>
        val rolePageSettings = user.anyRoleId.map({ roleId =>
          val anySettings = transaction.loadRolePageSettings(roleId = roleId, pageId = pageId)
          rolePageSettingsToJson(anySettings getOrElse RolePageSettings.Default)
        }) getOrElse JsNull
        val votes = votesJson(user.id, pageId, transaction)
        // + flags, interesting for staff, & so people won't attempt to flag twice [7KW20WY1]
        val (postsJson, postAuthorsJson) = unapprovedPostsAndAuthorsJson(user, pageId, transaction)
        (rolePageSettings, votes, postsJson, postAuthorsJson)
      } getOrElse (JsNull, JsNull, JsNull, JsNull)

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
      // later: "flags" -> JsArray(...) [7KW20WY1]
      "unapprovedPosts" -> anyUnapprovedPosts,
      "unapprovedPostAuthors" -> anyUnapprovedAuthors,
      "postIdsAutoReadLongAgo" -> JsArray(Nil),
      "postIdsAutoReadNow" -> JsArray(Nil),
      "marksByPostId" -> JsObject(Nil),

      "closedHelpMessages" -> JsObject(Nil))
  }


  private def rolePageSettingsToJson(settings: RolePageSettings): JsObject = {
    Json.obj(
      "notfLevel" -> JsNumber(settings.notfLevel.toInt))
  }


  COULD ; REFACTOR // move to CategoriesDao? and change from param PageRequest to
  // user + pageMeta?
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
        val pageStuffById = request.dao.getPageStuffById(topics.map(_.pageId))
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

    val postIds: Seq[PostId] = notfs flatMap {
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
        postsById: Map[PostId, Post], usersById: Map[UserId, User]): Option[JsObject] = {
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
    // COULD load flags too, at least if user is staff [7KW20WY1]
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


  private def unapprovedPostsAndAuthorsJson(user: User, pageId: PageId,
        transaction: SiteTransaction): (
          JsObject /* why object? try to change to JsArray instead */, JsArray) = {

    REFACTOR // Load form replies. For now: (a bit hacky)   (& could rename this fn + more stuff)
    SHOULD;OPTIMIZE // don't load the whole page when is-not Form
    COULD_OPTIMIZE // only load unapproved posts and form replies. [3PF4GK]
    if (user.isAdmin) {
      val page = PageDao(pageId, transaction)
      if (page.exists && (
            page.meta.pageRole == PageRole.Form ||
            page.meta.pageRole == PageRole.WebPage)) {  // hack. Try to remove + fix [3PF4GK] above
        val posts = page.parts.allPosts
        val tagsByPostId = transaction.loadTagsByPostId(posts.map(_.id))
        val postIdsAndJson: Seq[(String, JsValue)] = posts.toSeq.map { post =>
          val tags = tagsByPostId(post.id)
          post.nr.toString -> postToJsonImpl(post, page, tags, includeUnapproved = true)
        }
        val authors = transaction.loadUsers(posts.map(_.createdById).toSet)
        val authorsJson = JsArray(authors map JsUser)
        return (JsObject(postIdsAndJson), authorsJson)
      }
    }

    (JsObject(Nil), JsArray()) // for now
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


  def makeCategoriesStorePatch(isStaff: Boolean, restrictedOnly: Boolean, dao: SiteDao): JsValue = {
    val categoriesJson = makeCategoriesJson(isStaff = isStaff, restrictedOnly = restrictedOnly, dao)
    Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "categories" -> categoriesJson)
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
      json += "isDefaultCategory" -> JsTrue
    }
    if (category.isDeleted) {
      json += "isDeleted" -> JsTrue
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
          "uniqueId" -> post.id,
          "createdBy" -> JsUserOrNull(usersById.get(post.createdById)),
          "currentSource" -> post.currentSource,
          "currRevNr" -> post.currentRevisionNr,
          "currRevComposedBy" -> JsUserOrNull(usersById.get(post.currentRevisionById)),
          "approvedSource" -> JsStringOrNull(post.approvedSource),
          "approvedHtmlSanitized" -> JsStringOrNull(post.approvedHtmlSanitized),
          "approvedRevNr" -> JsNumberOrNull(post.approvedRevisionNr),
          "approvedRevComposedById" -> JsNull, // post.lastApprovedEditById ? ... hmm, see below
          "approvedRevApprovedById" -> JsNull, // -> post.aprvdRevAprvdById?? ... hmm no,
                                                // better: post.lastApporvedRevision.approvedById
          "bodyHiddenAtMs" -> JsDateMsOrNull(post.bodyHiddenAt),
          "bodyHiddenById" -> JsNumberOrNull(post.bodyHiddenById),
          "bodyHiddenReason" -> JsStringOrNull(post.bodyHiddenReason))
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
      "user" -> JsUser(stuff.maybeBadUser),
      "pageId" -> JsStringOrNull(stuff.pageId),
      "pageTitle" -> JsStringOrNull(stuff.pageTitle),
      "post" -> anyPost)
  }


  case class ToTextResult(text: String, isSingleParagraph: Boolean)

  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def htmlToTextWithNewlines(htmlText: String, firstLineOnly: Boolean = false): ToTextResult = {
    htmlToTextWithNewlinesImpl(htmlText, firstLineOnly)._1
  }


  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def htmlToTextWithNewlinesImpl(htmlText: String, firstLineOnly: Boolean = false)
        : (ToTextResult, org.jsoup.nodes.Document) = {
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

    val jsoupDoc = Jsoup.parse(htmlText)
    try nodeTraversor.traverse(jsoupDoc.body)
    catch {
      case _: ControlThrowable => ()
    }

    (ToTextResult(text = result.toString().trim, isSingleParagraph = canStillBeSingleParagraph),
      jsoupDoc)
  }


  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def htmlToExcerpt(htmlText: String, length: Int, firstParagraphOnly: Boolean): PostExcerpt = {
    val (text, jsoupDoc) =
      if (!firstParagraphOnly) {
        val doc = Jsoup.parse(htmlText)
        (doc.body.text, // includes no newlines
         doc)
      }
      else {
        val (toTextResult, doc) = htmlToTextWithNewlinesImpl(htmlText, firstLineOnly = true)
        (toTextResult.text, doc)
      }

    var excerpt =
      if (text.length <= length + 3) text
      else text.take(length) + "..."

    var lastChar = 'x'
    if (firstParagraphOnly) {
      excerpt = excerpt takeWhile { ch =>
        val newParagraph = ch == '\n' && lastChar == '\n'
        lastChar = ch
        !newParagraph
      }
    }

    val imageUrls = findImageUrlsImpl(jsoupDoc)

    PostExcerpt(text = excerpt, firstImageUrls = imageUrls.take(5))
  }

  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def findImageUrls(htmlText: String): immutable.Seq[String] = {
    findImageUrlsImpl(Jsoup.parse(htmlText))
  }


  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def findImageUrlsImpl(jsoupDoc: org.jsoup.nodes.Document): immutable.Seq[String] = {
    // Later: COULD use https://github.com/bytedeco/javacv to extract frame samples from videos.
    // Sample code: http://stackoverflow.com/a/22107132/694469
    /*
    FFmpegFrameGrabber g = new FFmpegFrameGrabber("video.mp4");
    g.start();
    for (int i = 0 ; i < numFrames ; i++) {
        ImageIO.write(g.grab().getBufferedImage(), "png", new File(s"video-frame-$i.png"));
    }
    g.stop(); */

    val imageElems: org.jsoup.select.Elements = jsoupDoc.select("img[src]")
    var imageUrls = Vector[String]()
    import collection.JavaConversions._
    for (elem <- imageElems) {
      imageUrls :+= elem.attr("src")
    }
    imageUrls
  }


  def EmptyWatchbar = Json.obj(
    WatchbarSection.RecentTopics.toInt.toString -> JsArray(Nil),
    WatchbarSection.Notifications.toInt.toString -> JsArray(Nil),
    WatchbarSection.ChatChannels.toInt.toString -> JsArray(Nil),
    WatchbarSection.DirectMessages.toInt.toString -> JsArray(Nil))


  def makeStorePatchForPostNr(pageId: PageId, postNr: PostNr, dao: SiteDao, showHidden: Boolean)
        : Option[JsValue] = {
    val post = dao.loadPost(pageId, postNr) getOrElse {
      return None
    }
    val author = dao.getUser(post.createdById) getOrElse {
      // User was just deleted? Race condition.
      UnknownUser
    }
    Some(makeStorePatch(post, author, dao, showHidden = showHidden))
  }


  def makeStorePatchForPosts(postIds: Set[PostId], showHidden: Boolean, dao: SiteDao)
        : JsValue = {
    dao.readOnlyTransaction { transaction =>
      makeStorePatchForPosts(postIds, showHidden, transaction)
    }
  }


  def makeStorePatchForPosts(postIds: Set[PostId], showHidden: Boolean,
        transaction: SiteTransaction): JsValue = {
    val posts = transaction.loadPostsByUniqueId(postIds).values
    val tagsByPostId = transaction.loadTagsByPostId(postIds)
    val pageIds = posts.map(_.pageId).toSet
    val pageIdVersions = transaction.loadPageMetas(pageIds).map(_.idVersion)
    val authorIds = posts.map(_.createdById).toSet
    val authors = transaction.loadUsers(authorIds)
    makeStorePatch3(pageIdVersions, posts, tagsByPostId, authors)(transaction)
  }


  def makeStorePatch(post: Post, author: User, dao: SiteDao, showHidden: Boolean): JsValue = {
    // Warning: some similar code below [89fKF2]
    require(post.createdById == author.id, "EsE5PKY2")
    val (postJson, pageVersion) = ReactJson.postToJson(
      post.nr, pageId = post.pageId, dao, includeUnapproved = true, showHidden = showHidden)
    makeStorePatch(PageIdVersion(post.pageId, pageVersion),
      posts = Seq(postJson), users = Seq(JsUser(author)))
  }


  @deprecated("now", "use makeStorePatchForPosts instead")
  def makeStorePatch2(postId: PostId, pageId: PageId, transaction: SiteTransaction)
        : JsValue = {
    // Warning: some similar code above [89fKF2]
    // Load the page so we'll get a version that includes postId, in case it was just added.
    val page = PageDao(pageId, transaction)
    val post = page.parts.postById(postId) getOrDie "EsE8YKPW2"
    dieIf(post.pageId != pageId, "EdE4FK0Q2W", o"""Wrong page id: $pageId, was post $postId
        just moved to page ${post.pageId} instead? Site: ${transaction.siteId}""")
    val tags = transaction.loadTagsForPost(post.id)
    val author = transaction.loadTheUser(post.createdById)
    require(post.createdById == author.id, "EsE4JHKX1")
    val postJson = postToJsonImpl(post, page, tags, includeUnapproved = true, showHidden = true)
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


  ANNOYING // needs a transaction, because postToJsonImpl needs one. Try to remove
  private def makeStorePatch3(pageIdVersions: Iterable[PageIdVersion], posts: Iterable[Post],
        tagsByPostId: Map[PostId, Set[String]], users: Iterable[User])(
        transaction: SiteTransaction): JsValue = {
    require(posts.isEmpty || users.nonEmpty, "Posts but no authors [EsE4YK7W2]")
    val pageVersionsByPageIdJson =
      JsObject(pageIdVersions.toSeq.map(p => p.pageId -> JsNumber(p.version)))
    val postsByPageId: Map[PageId, Iterable[Post]] = posts.groupBy(_.pageId)
    val postsByPageIdJson = JsObject(
      postsByPageId.toSeq.map(pageIdPosts => {
        val pageId = pageIdPosts._1
        val posts = pageIdPosts._2
        val page = new PageDao(pageId, transaction)
        val postsJson = posts map { p =>
          postToJsonImpl(p, page, tagsByPostId.getOrElse(p.id, Set.empty),
            includeUnapproved = false, showHidden = false)
        }
        pageId -> JsArray(postsJson.toSeq)
      }))
    Json.obj(
      "appVersion" -> Globals.applicationVersion,
      "pageVersionsByPageId" -> pageVersionsByPageIdJson,
      "usersBrief" -> users.map(JsUser),
      "postsByPageId" -> postsByPageIdJson)
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

  def JsFloatOrNull(value: Option[Float]) =
    value.map(v => JsNumber(BigDecimal(v))).getOrElse(JsNull)

  def JsWhenMs(when: When) =
    JsNumber(when.unixMillis)

  def JsDateMs(value: ju.Date) =
    JsNumber(value.getTime)

  def JsWhenMsOrNull(value: Option[When]) =
    value.map(when => JsNumber(when.unixMillis)).getOrElse(JsNull)

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

