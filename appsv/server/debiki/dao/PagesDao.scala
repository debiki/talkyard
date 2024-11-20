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
import talkyard.server.authz.{Authz, ReqrAndTgt, ReqrStranger, AnyReqrAndTgt}
import talkyard.server.spam.SpamChecker
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
  *
  * REFACTOR: Split into  CreatePageDao  and  AlterPageDao.  [pg_ctrl_dao]
  * Merge  PageTitleSettingsController into AlterPageDao,  except for HTTP req
  * handling which could be merged into PageController?
  */
trait PagesDao {
  self: SiteDao =>

  import context.security.throwNoUnless

  def loadPagesByUser(userId: PatId, isStaffOrSelf: Bo, inclAnonPosts: Bo = false, limit: i32)
          : Seq[PagePathAndMeta] = {
    unimplIf(inclAnonPosts, "inclAnonPosts [TyEANONUNIMPL01]");  ANON_UNIMPL
    readTx(_.loadPagesByUser(userId, isStaffOrSelf = isStaffOrSelf, limit))
  }

  MOVE // loadMaySeePagesInCategory and listMaySeeTopicsInclPinned to here?  [move_list_pages]

  REMOVE; CLEAN_UP
  @deprecated("use createPageIfAuZ instead?")
  def createPage(pageRole: PageType, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        anyFolder: Option[String], anySlug: Option[String], title: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, deleteDraftNr: Option[DraftNr], byWho: Who,
        spamRelReqStuff: SpamRelReqStuff,
        discussionIds: Set[AltPageId] = Set.empty, embeddingUrl: Option[String] = None,
        extId: Option[ExtId] = None,
        ): PagePathWithId = {
    dieIf(!globals.isOrWasTest, "TyE306MGJCW2") // see deprecation note above
    val withTags = Nil
    createPageSkipAuZ(pageRole, pageStatus = pageStatus, anyCategoryId = anyCategoryId, withTags,
          anyFolder = anyFolder, anySlug = anySlug, title = title,
          bodyTextAndHtml = bodyTextAndHtml, showId = showId,
          deleteDraftNr = deleteDraftNr, byWho = byWho,
          spamRelReqStuff = spamRelReqStuff,
          asAlias = None,
          discussionIds = discussionIds, embeddingUrl = embeddingUrl,
          extId = extId,
          ).path
  }



  // Break out a  CreatePageParams class?  But deleteDraftNr  shouldn't be part of it,
  // maybe  reqrTgt  also shouldn't?
  // There's also:  talkyard.server.api.CreatePageParams
  // but it's different, in that it has still unresolved "refid:..."s instead
  // of e.g. category id.
  // Maybe they could be named  CreatePageRefParams and  CreatePageIdParams? [ref_and_id_params]
  //                       Or:  CreatePageApiParams and  CreatePageInt(ernal)Params?
  //                       Or:                           CreatePageExpImpParams? (export import)
  def createPageIfAuZ(
        pageType: PageType, pageStatus: PageStatus, inCatId: Opt[CategoryId],
        withTags: ImmSeq[TagTypeValue],
        anyFolder: Opt[St], anySlug: Opt[St], title: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Bo, deleteDraftNr: Opt[DraftNr],
        reqrAndCreator: AnyReqrAndTgt,
        spamRelReqStuff: SpamRelReqStuff,
        asAlias: Opt[WhichAliasPat],
        discussionIds: Set[AltPageId] = Set.empty,
        embeddingUrl: Opt[St] = None,
        refId: Opt[RefId] = None,
        ): CreatePageResult = {

    // [dupl_load_lvls]
    val reqrAndLevels: AnyUserAndLevels = reqrAndCreator match {
      case rt: ReqrAndTgt =>
        readTx(loadUserAndLevels(rt.reqrToWho, _))
      case _: ReqrStranger =>
        val threatLevel = this.readTx(this.loadThreatLevelNoUser(
              reqrAndCreator.browserIdData, _))
        StrangerAndThreatLevel(threatLevel)
    }

    val catsRootLast = getAncestorCategoriesSelfFirst(inCatId)
    val tooManyPermissions = getPermsOnPages(categories = catsRootLast)

    // A bot might be creating the page on behalf of another user, via the API. Then,
    // the requester is the bot (it sends the HTTP request), and the creator is the human.
    // Both the requester and the creator need the mayCreatePage() permission. [2_perm_chks]
    // See docs in docs/ty-security.adoc [api_do_as].

    TESTS_MISSING
    // Dupl permission check, below? [dupl_prem_chk]
    throwNoUnless(Authz.mayCreatePage(
          reqrAndLevels,
          asAlias =
              if (reqrAndCreator.areNotTheSame) {
                // Then the alias is for the user who will be the page author, [4_doer_not_reqr]
                // not for the HTTP request requester.
                None
              }
              else {
                // The requester is the creator, so any alias is also the requester's.
                asAlias
              },
          getOnesGroupIds(reqrAndLevels.anyUser getOrElse UnknownParticipant),
          pageType, PostType.Normal, pinWhere = None,
          anySlug = anySlug, anyFolder = anyFolder,
          inCategoriesRootLast = catsRootLast,
          tooManyPermissions),
          "TyE_CRPG_REQR_PERMS")

    val createdByWho: Who = reqrAndCreator match {
      case theReqrAndCreator: ReqrAndTgt =>
        val creatorWho = theReqrAndCreator.targetToWho
        if (theReqrAndCreator.areNotTheSame) {
          TESTS_MISSING; COULD_OPTIMIZE // don't load user again [2WKG06SU]
          val creatorAndLevels: UserAndLevels = readTx(loadUserAndLevels(creatorWho, _))
          throwNoUnless(Authz.mayCreatePage(
                creatorAndLevels, asAlias, getOnesGroupIds(creatorAndLevels.user),
                pageType, PostType.Normal, pinWhere = None,
                anySlug = anySlug, anyFolder = anyFolder,
                inCategoriesRootLast = catsRootLast,
                // (This includes permissions for both the requester and target users, and
                // everyone else, but mayCreatePage() uses only those of the creator.)
                tooManyPermissions),
                "TyE_CRPG_TGT_PERMS")
        }
        creatorWho
      case _ =>
        Who(TrueId(UnknownUserId), reqrAndCreator.browserIdData, isAnon = false)
    }

    createPageSkipAuZ(
          pageType, pageStatus, anyCategoryId = inCatId, withTags,
          anyFolder = anyFolder, anySlug = anySlug, title,
          bodyTextAndHtml = bodyTextAndHtml, showId = showId, deleteDraftNr = deleteDraftNr,
          byWho = createdByWho,
          spamRelReqStuff,
          asAlias,
          discussionIds = discussionIds,
          embeddingUrl = embeddingUrl,
          extId = refId)
  }


  def createPageSkipAuZ(pageRole: PageType, pageStatus: PageStatus, anyCategoryId: Option[CategoryId],
        withTags: ImmSeq[TagTypeValue],
        anyFolder: Option[String], anySlug: Option[String], title: TitleSourceAndHtml,
        bodyTextAndHtml: TextAndHtml, showId: Boolean, deleteDraftNr: Option[DraftNr], byWho: Who,
        spamRelReqStuff: SpamRelReqStuff,
        asAlias: Opt[WhichAliasPat],
        discussionIds: Set[AltPageId] = Set.empty, embeddingUrl: Option[String] = None,
        extId: Option[ExtId] = None,
        ): CreatePageResult = {

    if (pageRole.isSection) {
      // Should use e.g. ForumController.createForum() instead.
      throwBadRequest("DwE4FKW8", s"Bad page role: $pageRole")
    }

    if (pageRole.isPrivateGroupTalk) {
      throwForbidden("EsE5FKE0I2", "Use MessagesDao instead")
      // Perhaps JoinlessChat/OpenChat pages should be created via MessagesDao too? [5KTE02Z]
    }

    if (pageRole.isChat && byWho.isGuest) {
      throwForbidden("TyE7KFWY63", "Guests may not create chats")
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
                pageRole, pageStatus, anyCategoryId, withTags,
                anyFolder = anyFolder, anySlug = anySlug, showId = showId,
                title = title, body = bodyTextAndHtml,
                pinOrder = None,
                pinWhere = None,
                byWho,
                Some(spamRelReqStuff),
                asAlias,
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
    *
    * @param asAlias — must be a new anonym, since anons are per page, and this page is new.
    */
  def createPageImpl(pageRole: PageType,
      pageStatus: PageStatus,
      anyCategoryId: Option[CategoryId],
      withTags: ImmSeq[TagTypeValue],
      anyFolder: Option[String],
      anySlug: Option[String],
      showId: Boolean,
      title: TitleSourceAndHtml,
      body: TextAndHtml,
      pinOrder: Option[Int] = None,
      pinWhere: Option[PinPageWhere] = None,
      byWho: Who,
      spamRelReqStuff: Option[SpamRelReqStuff],
      asAlias: Opt[WhichAliasPat] = None,
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
    val realAuthorId = byWho.id
    val realAuthorAndLevels = loadUserAndLevels(byWho, tx)
    // Currently is the real auhtor. But with [pseudonyms_later], then maybe not.
    val realAuthor = realAuthorAndLevels.user

    val site = tx.loadSite() getOrDie "TyE8MWNP247"
    val categoryPath = tx.loadCategoryPathRootLast(anyCategoryId, inclSelfFirst = true)
    val groupIds = tx.loadGroupIdsMemberIdFirst(realAuthor)
    val permissions = tx.loadPermsOnPages()
    //val authzCtx = ForumAuthzContext(Some(author), groupIds, permissions)  ?  [5FLK02]
    val settings = loadWholeSiteSettings(tx)

    // Dupl permission check [dupl_prem_chk] when called via createPageIfAuZ()?
    dieOrThrowNoUnless(Authz.mayCreatePage(  // REFACTOR COULD pass a pageAuthzCtx instead [5FLK02]
      realAuthorAndLevels, asAlias, groupIds,
      pageRole, bodyPostType, pinWhere, anySlug = anySlug, anyFolder = anyFolder,
      inCategoriesRootLast = categoryPath,
      permissions), "EdE5JGK2W4")

    require(!anyFolder.exists(_.isEmpty), "EsE6JGKE3")
    // (Empty slug ok though, e.g. homepage.)
    require(!title.source.isEmpty && !title.safeHtml.isEmpty, "EsE7MGK24")
    require(!body.source.isEmpty && !body.safeHtml.isEmpty, "EsE1WKUQ5")
    require(pinOrder.isDefined == pinWhere.isDefined, "Ese5MJK2")
    require(embeddingUrl.trimNoneIfBlank == embeddingUrl, "Cannot have blank emb urls [TyE75SPJBJ]")

    SECURITY // Maybe page id shouldn't be public? [rand-page-id] To prevent people from
    // discovering all pages. E.g. iterating through all discussions, in a public blog.
    val pageId = tx.nextPageId()

    val personaAndLevels: UserAndLevels = SiteDao.getPersonaAndLevels(
          realAuthorAndLevels, pageId = pageId, asAlias, mayReuseAnon = false,
          isCreatingPage = true)(tx, IfBadAbortReq)

    val authorMaybeAnon: Pat = personaAndLevels.user

    val pageSlug = anySlug.getOrElse({
        context.nashorn.slugifyTitle(title.source)
    }).take(PagePath.MaxSlugLength).dropRightWhile(_ == '-').dropWhile(_ == '-')

    COULD // try to move this authz + review-reason check to talkyard.server.authz.Authz?
    val (
      reviewReasons: Seq[ReviewReason],
      shallApprove: Bo) =
          throwOrFindReviewNewPageReasons(personaAndLevels, pageRole, tx)  // [mod_deanon_risk]

    // Similar to: [find_approver_id].  [mod_deanon_risk]
    val approvedById =
          if (!shallApprove) None
          else if (realAuthor.isStaff && asAlias.isEmpty) Some(realAuthor.id)
          else Some(SystemUserId)

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
    val siteId = tx.siteId // [5GKEPMW2] remove this row later
    val pagePath = PagePathWithId(folder = folder, pageId = pageId,
      showId = showId, pageSlug = pageSlug, canonical = true)

    val titleUniqueId = tx.nextPostId()
    val bodyUniqueId = titleUniqueId + 1

    val titlePost = Post.createTitle(
      uniqueId = titleUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorMaybeAnon.id,
      source = title.source,
      htmlSanitized = title.safeHtml,
      approvedById = approvedById)

    val bodyPost = Post.createBody(
      uniqueId = bodyUniqueId,
      pageId = pageId,
      createdAt = now.toJavaDate,
      createdById = authorMaybeAnon.id,
      source = body.source,
      htmlSanitized = body.safeHtml,
      postType = bodyPostType,
      approvedById = approvedById)
      .copy(
        bodyHiddenAt = ifThenSome(hidePageBody, now.toJavaDate),
        bodyHiddenById = ifThenSome(hidePageBody, authorMaybeAnon.id),
        bodyHiddenReason = None) // add `hiddenReason` function parameter?

    var nextTagId: TagId =
          if (withTags.nonEmpty) tx.nextTagId()
          else -1
    val newTags: ImmSeq[Tag] = withTags map { typeAndVal: TagTypeValue =>
      val tag: Tag = typeAndVal.withIdAndPostId(nextTagId, postId = bodyPost.id, IfBadAbortReq)
      nextTagId += 1
      tag
    }

    val uploadRefs = body.uploadRefs
    if (Globals.isDevOrTest) {
      val uplRefs2 = findUploadRefsInPost(bodyPost, site = Some(site))
      dieIf(uploadRefs != uplRefs2, "TyE7RTEGP04", s"uploadRefs: $uploadRefs, 2: $uplRefs2")
    }

    val pageMeta = PageMeta.forNewPage(
      pageId = pageId,
      pageRole,
      authorId = authorMaybeAnon.id,
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
        reasons = reviewReasons.to(immutable.Seq),
        createdById = SystemUserId,
        createdAt = now.toJavaDate,
        createdAtRevNr = Some(bodyPost.currentRevisionNr),
        maybeBadUserId = authorMaybeAnon.id,
        pageId = Some(pageId),
        postId = Some(bodyPost.id),
        postNr = Some(bodyPost.nr)))

    // [dupl_spam_check_code]
    val anySpamCheckTask =
      if (spamRelReqStuff.isEmpty || !globals.spamChecker.spamChecksEnabled) None
      else if (settings.userMustBeAuthenticated) None
      else if (!canStrangersSeePagesInCat_useTxMostly(anyCategoryId, tx)) None
      else if (!SpamChecker.shallCheckSpamFor(realAuthorAndLevels)) None  // [mod_deanon_risk]
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
            reqrId = authorMaybeAnon.id,
            requestStuff = spamStuffPageUri))
      }

    val stats = UserStats(
      // If is a pseudo/anonym, add stats to the pseudo/anon account only,
      // not to the true user — otherwise others might be able to guess who hen is.
      authorMaybeAnon.id,
      lastSeenAt = now,
      lastPostedAt = Some(now),
      firstNewTopicAt = Some(now),
      numDiscourseTopicsCreated = pageRole.isChat ? 0 | 1,
      numChatTopicsCreated = pageRole.isChat ? 1 | 0)

    addUserStats(stats)(tx)
    tx.insertPageMetaMarkSectionPageStale(pageMeta)(IfBadDie)
    tx.insertPagePath(pagePath)
    tx.insertPost(titlePost)
    tx.insertPost(bodyPost)
    newTags foreach tx.insertTag

    // By default, one follows all activity on a page one has created — unless this is some page
    // that gets auto created by System. [EXCLSYS]
    // Notfs need to get sent to the real author (not the anonym — it's just an
    // "indirectin" account).
    if (realAuthor.id >= Participant.LowestNormalMemberId) {
      tx.upsertPageNotfPref(
          PageNotfPref(realAuthorId, NotfLevel.WatchingAll, pageId = Some(pageId)))
    }

    if (approvedById.isDefined) {
      updatePagePopularity(
        PreLoadedPageParts(pageMeta, Vector(titlePost, bodyPost)), tx)

      // Add links, and uncache linked pages — need to rerender them, with
      // a backlink to this new page.
      // Need not: staleStuff.addPageId(new-page-id) — page didn't exist before.
      saveDeleteLinks(bodyPost, body, authorMaybeAnon.trueId2, tx, staleStuff, skipBugWarn = true)
    }

    uploadRefs foreach { hashPathSuffix =>
      tx.insertUploadedFileReference(bodyPost.id, hashPathSuffix, authorMaybeAnon.id)
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
      val notifications = notfGenerator(tx).generateForNewPost(  // dao incls new page body
            newPageDao(pagePath.pageId, tx), bodyPost,
            Some(body), anyNewModTask = anyReviewTask,
            postAuthor = Some(authorMaybeAnon), trueAuthor = Some(realAuthor))

      tx.saveDeleteNotifications(notifications)

      insertAuditLogEntry(AuditLogEntry(
            siteId = siteId,
            id = AuditLogEntry.UnassignedId,
            didWhat = AuditLogEntryType.NewPage,
            doerTrueId = authorMaybeAnon.trueId2,
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
      clearDatabaseCacheAndMemCache()
    }
    else {
      refreshPageInMemCache(pageId)
    }
  }


  def ifAuthAcceptAnswer(pageId: PageId, postUniqueId: PostId, reqrAndDoer: ReqrAndTgt,
        browserIdData: BrowserIdData, asAlias: Opt[WhichAliasPat]): Opt[ju.Date] = {
    unimplIf(reqrAndDoer.areNotTheSame, "Accepting answer on behalf of sbd else")

    val answeredAt = writeTx { (tx, staleStuff) =>

      val user = tx.loadTheParticipant(reqrAndDoer.reqrId) // reqr & doer are the same, see above
      val oldMeta = tx.loadThePageMeta(pageId)

      COULD_OPTIMIZE // Check see-post & alter-page at the same time, 1 fn call.
      throwIfMayNotSeePost2(ThePost.WithId(postUniqueId), reqrAndDoer)(tx)
      throwIfMayNotAlterPage(user, asAlias, oldMeta, changesOnlyTypeOrStatus = true, tx)

      if (!oldMeta.pageType.canBeSolved)
        throwBadReq("DwE4KGP2", "This page is not a question so no answer can be selected")

      val doingAs: Pat = SiteDao.getAliasOrTruePat(
            user, pageId = pageId, asAlias, mayCreateAnon = false)(tx, IfBadAbortReq)

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
      addMetaMessage(doingAs, s" accepted an answer", pageId, tx)  // I18N
      staleStuff.addPageId(pageId, memCacheOnly = true)

      val auditLogEntry = AuditLogEntry(
            siteId = siteId,
            id = AuditLogEntry.UnassignedId,
            didWhat = AuditLogEntryType.PageAnswered,
            doerTrueId = doingAs.trueId2,
            doneAt = tx.now.toJavaDate,
            browserIdData = browserIdData,
            pageId = Some(pageId),
            uniquePostId = Some(post.id),
            // Skip — the post might just have been moved to another page (a race condition).
            // [no_ans_post_nr]
            postNr = None)

      insertAuditLogEntry(auditLogEntry, tx)

      UX; COULD // wait 5 minutes (in case the answer gets un-accepted) then send email
      // to the author of the answer)

      // If a trusted member thinks the answer is ok, then, maybe resolving
      // any review mod tasks for the answer — and the question too.
      // Test:  modn-from-disc-page-review-after.2browsers  TyTE2E603RKG4.TyTE2E50ARMS
      if (doingAs.isStaffOrTrustedNotThreat) {
        maybeReviewAcceptPostByInteracting(post, moderator = doingAs,
              ReviewDecision.InteractAcceptAnswer)(tx, staleStuff)

        tx.loadOrigPost(pageId).getOrBugWarn("TyE205WKT734") { origPost =>
          maybeReviewAcceptPostByInteracting(origPost, moderator = doingAs,
                ReviewDecision.InteractAcceptAnswer)(tx, staleStuff)
        }
      }

      answeredAt
    }

    answeredAt
  }


  def ifAuthUnacceptAnswer(pageId: PageId, reqrAndDoer: ReqrAndTgt,
          browserIdData: BrowserIdData, asAlias: Opt[WhichAliasPat]): U = {

    unimplIf(reqrAndDoer.areNotTheSame, "Unaccepting answer on behalf of sbd else")

    readWriteTransaction { tx =>
      val user = tx.loadTheParticipant(reqrAndDoer.reqrId)
      val oldMeta = tx.loadThePageMeta(pageId)

      throwIfMayNotAlterPage(user, asAlias, oldMeta, changesOnlyTypeOrStatus = true, tx)
      // (Don't require user to be able to see the current answer —  maybe it's been deleted.)

      val doingAs: Pat = SiteDao.getAliasOrTruePat(user, pageId = pageId, asAlias,
            mayCreateAnon = false)(tx, IfBadAbortReq)

      // Dupl line. [4UKP58B]
      val newMeta = oldMeta.copy(answeredAt = None, answerPostId = None, closedAt = None,
        version = oldMeta.version + 1)

      val auditLogEntry = AuditLogEntry(
            siteId = siteId,
            id = AuditLogEntry.UnassignedId,
            didWhat = AuditLogEntryType.PageUnanswered,
            doerTrueId = doingAs.trueId2,
            doneAt = tx.now.toJavaDate,
            browserIdData = browserIdData,
            pageId = Some(pageId),
            uniquePostId = oldMeta.answerPostId,
            // Skip — might have been moved to a different page; then, the postNr
            // combined with pageId would be the wrong post.  [no_ans_post_nr]
            postNr = None)

      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      addMetaMessage(doingAs, s" unaccepted an answer", pageId, tx)  // I18N
      tx.insertAuditLogEntry(auditLogEntry)
    }
    refreshPageInMemCache(pageId)
  }


  def ifAuthTogglePageClosed(pageId: PageId, reqr: ReqrId, asAlias: Opt[WhichAliasPat])
          : Opt[ju.Date] = {
    val now = globals.now()
    val newClosedAt = readWriteTransaction { tx =>
      val user = tx.loadTheParticipant(reqr.id)
      val oldMeta = tx.loadThePageMeta(pageId)

      TESTS_MISSING

      throwIfMayNotAlterPage(user, asAlias, oldMeta, changesOnlyTypeOrStatus = true, tx)

      val doingAs: Pat = SiteDao.getAliasOrTruePat(user, pageId = pageId, asAlias,
            mayCreateAnon = false)(tx, IfBadAbortReq)

      throwBadRequestIf(oldMeta.isDeleted,
          "TyE0CLSPGDLD", s"Cannot close or reopen deleted pages")

      throwBadRequestIf(!oldMeta.pageType.canClose,
          "DwE4PKF7", s"Cannot close pages of type ${oldMeta.pageType}")

      val (newClosedAt: Option[ju.Date], didWhat: String) = oldMeta.closedAt match {
        case None => (Some(now.toJavaDate), "closed")
        case Some(_) => (None, "reopened")
      }

      val newMeta = oldMeta.copy(
        closedAt = newClosedAt,
        version = oldMeta.version + 1,
        numPostsTotal = oldMeta.numPostsTotal + 1)

      val auditLogEntry = AuditLogEntry(
            siteId = siteId,
            id = AuditLogEntry.UnassignedId,
            didWhat =
                  if (newMeta.isClosed) AuditLogEntryType.PageClosed
                  else AuditLogEntryType.PageReopened,
            doerTrueId = doingAs.trueId2,
            doneAt = tx.now.toJavaDate,
            browserIdData = reqr.browserIdData,
            pageId = Some(pageId))

      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
      addMetaMessage(doingAs, s" $didWhat this topic", pageId, tx)
      tx.insertAuditLogEntry(auditLogEntry)

      newClosedAt
    }
    refreshPageInMemCache(pageId)
    newClosedAt
  }


  def deletePagesIfAuth(pageIds: Seq[PageId], reqr: ReqrId, asAlias: Opt[WhichAliasPat],
          undelete: Bo): U = {
    // Anonyms are per page, so we can't delete many pages at a time, if asAlias is an anonym.
    throwForbiddenIf(asAlias.isDefined && pageIds.size != 1,
          "TyEALIMANYPAGES", s"Can delete only one page at a time, when using an alias. I got ${
              pageIds.size} pages")

    writeTx { (tx, staleStuff) =>
      // Later: [4GWRQA28] If is a sub community (= forum page), delete the root category too,
      // so all topics in the sub community will get deleted. [subcomms]
      // And remove the sub community from the watchbar's Communities section.
      // (And if undeleting the sub community, undelete the root category too.)
      deletePagesImpl(pageIds, reqr, asAlias, undelete = undelete)(tx, staleStuff)
    }
    refreshPagesInMemCache(pageIds.toSet)
  }


  def deletePagesImpl(pageIds: Seq[PageId], reqr: ReqrId, asAlias: Opt[WhichAliasPat],
          undelete: Bo = false)(tx: SiteTx, staleStuff: StaleStuff): U = {

    BUG; SHOULD // delete notfs or mark deleted?  [notfs_bug]  [nice_notfs]
    // But don't delete any review tasks — good if staff reviews, if a new
    // member posts something trollish, people react, then hen deletes hens page.
    // Later, if undeleting, then restore the notfs? [undel_posts]

    val trueDeleter = tx.loadTheParticipant(reqr.id) // [alias_4_principal]

    dieIf(asAlias.isDefined && pageIds.size != 1,
          "TyEALIMANYPGS2", s"Alias deleting ${pageIds.size} != 1 pages")

    val deleterPersona: Pat = SiteDao.getAliasOrTruePat(
          truePat = trueDeleter, pageId = pageIds(0), asAlias,
          mayCreateAnon = false)(tx, IfBadAbortReq)

    for {
      pageId <- pageIds
      pageMeta <- tx.loadPageMeta(pageId)
      // Hmm but trying to delete a deleted *post*, throws an error. [5WKQRH2]
      if pageMeta.isDeleted == undelete
    } {
      SHOULD // use Authz and  mayDeletePage  instead? [authz_may_del] [granular_perms]

      // Mods may not delete pages they cannot see — maybe admins have
      // their own internal discussions.
      throwIfMayNotSeePage(pageMeta, Some(trueDeleter))(tx)

      // Ordinary members may only delete their own pages, before others have replied.
      // Sync with client side. [who_del_pge]
      if (!deleterPersona.isStaff) {
        // (This message is misleading if trying to delete one's own post, using the wrong
        // alias. But let's fix by using  Authz & mayDeletePage  instead? [authz_may_del])
        throwForbiddenIf(pageMeta.authorId != deleterPersona.id,
                "TyEDELOTRSPG_", "May not delete other people's pages")

        // Shouldn't have been allowed to see sbd else's deleted page.
        val deletedOwn = pageMeta.deletedById.is(deleterPersona.id) &&
                pageMeta.authorId == deleterPersona.id
        dieIf(undelete && !deletedOwn, "TyEUNDELOTRS", s"s$siteId: User ${
              deleterPersona.nameParaId} may not undelete sbd else's page $pageId")

        // When there are replies, the UX should send a request to delete the
        // orig post only — but not the whole page. (Unless is staff, then can delete
        // the whole page.)
        // Later: Allow people to delete their own pages, if no one but themselves
        // have replied.  [del_own_pg]
        throwForbiddenIf(pageMeta.numRepliesVisible >= 1,
                "TyEDELPGWRES", "May not delete pages with replies")
      }

      if ((pageMeta.pageType.isSection || pageMeta.pageType == PageType.CustomHtmlPage) &&
          !deleterPersona.isAdmin)
        throwForbidden("EsE5GKF23_", "Only admin may (un)delete sections and HTML pages")

      val baseAuditEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.DeletePage,
        doerTrueId = deleterPersona.trueId2,
        doneAt = tx.now.toJavaDate,
        browserIdData = reqr.browserIdData,
        pageId = Some(pageId),
        pageType = Some(pageMeta.pageType))

      var (newMeta, auditLogEntry) =
        if (undelete) {
          (pageMeta.copy(
                deletedAt = None,
                deletedById = None,
                version = pageMeta.version + 1),
            baseAuditEntry.copy(didWhat = AuditLogEntryType.UndeletePage))
        }
        else {
          (pageMeta.copy(
                deletedAt = Some(tx.now.toJavaDate),
                deletedById = Some(deleterPersona.id),
                version = pageMeta.version + 1),
            baseAuditEntry)
        }

      // We're adding a meta post below.
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
        updateSpamCheckTaskBecausePostDeleted(origPost, postAuthor, deleter = deleterPersona, tx)
      }

      tx.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)
      tx.insertAuditLogEntry(auditLogEntry)

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
      addMetaMessage(deleterPersona, s" ${un}deleted this topic", pageId, tx)
    }
  }


  REFACTOR // Move to PostsDao? This fn creates a post, not a whole page operation.
  def addMetaMessage(doer: Participant, message: String, pageId: PageId,
                     tx: SiteTransaction, notifyMentioned: Bo = false): Post = {
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

    // The caller must have remembered to update numPostsTotal. There might,
    // however, be fewer than postNr + 1 posts, in case an old post was moved to
    // another page. But never more.
    val pageMeta = tx.loadThePageMeta(pageId)
    dieIf(pageMeta.numPostsTotal > postNr + 1, "EdE3PFK2W0", o"""pageMeta.numPostsTotal
        is ${pageMeta.numPostsTotal} but should be <= postNr + 1 = ${postNr + 1}""")

    // (Later: How handle [private_pats]?)
    tx.insertPost(metaMessage)

    SHOULD // send back json so the satus message gets shown, without reloading the page. [2PKRRSZ0]

    if (notifyMentioned) {
      // For now. Later, somehow use  NotfType.AssigneesChanged (if assignees changed).
      notfGenerator(tx).generateForNewPost(  // page dao excls new meta post
            page, metaMessage, sourceAndHtml = None,
            // or Some(doer) — but `doer` might be from another tx?
            postAuthor = None, trueAuthor = None,
            anyNewModTask = None)
    }

    metaMessage
  }


  def refreshPageMetaBumpVersion(pageId: PageId, markSectionPageStale: Bo,
          newBumpedAt: Opt[When] = None)(tx: SiteTx): U = {
    // Also elsewhere, bit dupl.  [dupl_upd_pg_stats]
    val page = newPageDao(pageId, tx)
    val newMeta = page.meta.copyWithUpdatedStats(page, newBumpedAt)
    tx.updatePageMeta(newMeta, oldMeta = page.meta,
      markSectionPageStale = markSectionPageStale)
  }
}

