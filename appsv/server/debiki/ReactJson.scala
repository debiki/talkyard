/**
 * Copyright (c) 2012-2018 Kaj Magnus Lindberg
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
import debiki.dao._
import talkyard.server.authz.{Authz, ForumAuthzContext, AuthzCtxOnAllWithReqer}
import talkyard.server.http._
import talkyard.server.security.{SidStatus, SidOk}
import java.{lang => jl, util => ju}
import org.jsoup.Jsoup
import org.jsoup.nodes.{Element => jsoup_Element}
import org.jsoup.nodes.{Attribute => jsoup_Attribute}
import play.api.libs.json._
import scala.collection.{immutable => imm, mutable => mut}
import scala.collection.mutable.ArrayBuffer
import scala.math.BigDecimal.decimal
import talkyard.server.{IfCached, PostRenderer, PostRendererSettings}
import JsonMaker._
import talkyard.server.JsX
import talkyard.server.JsX._


case class PostExcerpt(text: String, firstImageUrls: imm.Seq[String])


private case class RendererWithSettings(
  renderer: PostRenderer, settings: PostRendererSettings, site: SiteIdHostnames,
  inclPageId: Bo = false) {

  def renderAndSanitize(post: Post, ifCached: IfCached): String = {
    renderer.renderAndSanitize(post, settings, ifCached, site)
  }
}


case class MeAndStuff(me: Me, stuffForMe: StuffForMe)


case class Me(
  // For now. Later, separate fields, so can load only what's needed.
  meJsOb: JsObject)


case class StuffForMe(  // ts: StuffForMe
  tagTypeIdsNeeded: Set[TagTypeId],
) {

  def isEmpty: Bo = tagTypeIdsNeeded.isEmpty

  /// Prefers the mem caches, avoids db access.
  def toJson(dao: SiteDao): JsObject = {
    val tagTypes = dao.getTagTypes(tagTypeIdsNeeded)
    Json.obj(
        "tagTypes" -> tagTypes.map(JsTagType))
  }
}


object StuffForMe {
  val empty: StuffForMe = StuffForMe(Set.empty)
}


private case class RestrTopicsCatsLinks(
  categoriesJson: JsArray,
  topicsJson: Seq[JsValue],
  topicParticipantsJson: Seq[JsObject],
  internalBacklinksJson: Seq[JsValue],
  tagTypeIdsNeeded: Set[TagTypeId])


case class CatsWithTopics(
  catsAndTopicsJson: JsArray,
  pageStuffById: Map[PageId, PageStuff])


private case class UnapprovedPostsAndAuthors(
  posts: JsObject, // why object? try to change to JsArray instead
  authors: JsArray,
  tagTypeIdsNeeded: Set[TagTypeId])


class HowRenderPostInPage(
  val summarize: Boolean,
  val jsSummary: JsValue,
  val squash: Boolean,
  val childrenSorted: imm.Seq[Post])


case class PageToJsonResult(
  reactStoreJsonString: String,
  version: CachedPageVersion,
  pageTitleUnsafe: Option[String],
  customHeadTags: FindHeadTagsResult,

  //------
  unapprovedPostAuthorIds: Set[UserId],
  // Later:  [remember_if_bookmarks_or_priv_comts]
  // hasBookmarksPatIds: Set[UserId], — or, could be part of unapprovedPostAuthorIds
  //      and maybe rename  patIdsWithUnapprovedPostsInclBoookmarks  hmm
  //      Maybe better to switch to "node" vs "post" terminology, then just:  [its_a_node]
  //       [patIdsWithOwnNodes],
  //          and an "own node" includes:  bookmarks,  drafts,  unapproved posts.
  // thereArePrivateComments: Bo,
  // BUT there's no need to cache this in the *database*. Aren't rendered server side
  // since not visible to everyone, only to a few specific peolpe, e.g. the bookmarker
  // or private thread members.
  // Maybe remember in  PageStuff?  It's in the mem cache already.
  //------

  anonsByRealId: Map[PatId, Seq[Anonym]])

case class FindHeadTagsResult(
  includesTitleTag: Boolean,
  includesDescription: Boolean,
  allTags: String,
  adminOnlyTags: String)

object FindHeadTagsResult {
  val None: FindHeadTagsResult = FindHeadTagsResult(false, false, "", "")
}


// REFACTOR COULD split into one class JsonDao, which accesses the database and is a Dao trait?
// + a class that doesn't do any db calls or anything like that.
//
class JsonMaker(dao: SiteDao) {


  /** Returns (json, page-version, page-title, ids-of-authors-of-not-yet-approved-posts)
    * only with contents everyone may see.
    */
  def pageToJson(pageId: PageId, pageRenderParams: PageRenderParams): PageToJsonResult = {
    dao.readTx(
      pageThatExistsToJsonImpl(pageId, pageRenderParams, _))
  }


  /** When a site has just been created, and has no contents.
    */
  def emptySiteJson(pageReq: PageRequest[_]): JsObject = {
    require(pageReq.dao == dao, "TyE4GKWQ10")
    require(!pageReq.pageExists, "DwE7KEG2")
    require(pageReq.pagePath.value == HomepageUrlPath, "DwE8UPY4")
    val globals = pageReq.context.globals
    val site = dao.theSite()
    val siteSettings = dao.getWholeSiteSettings()
    val idps = dao.getSiteCustomIdentityProviders(onlyEnabled = true)
    val isFirstSiteAdminEmailMissing = site.status == SiteStatus.NoAdmin &&
      site.id == FirstSiteId && globals.becomeFirstSiteOwnerEmail.isEmpty
    val everyoneGroup = dao.getTheGroup(Group.EveryoneId)
    val everyonesPerms = dao.getPermsForEveryone()
    val pageId = pageReq.thePageId

    val pageJsonObj = Json.obj(
      "pageId" -> pageId,
      "pageRole" -> JsNumber(pageReq.thePageRole.toInt),
      "pagePath" -> JsPagePath(pageReq.pagePath),
      "numPosts" -> JsNumber(0),
      "numRepliesVisible" -> JsNumber(0),
      "numPostsRepliesSection" -> JsNumber(0),  // CHANGE to numPostsVisible (incl status change meta posts)
      "numPostsChatSection" -> JsNumber(0),  // CLEAN_UP REMOVE
      "numPostsExclTitle" -> JsNumber(0),
      "postsByNr" -> JsObject(Nil),
      "topLevelCommentIdsSorted" -> JsArray(),
      "horizontalLayout" -> JsBoolean(false))

    Json.obj(
      "dbgSrc" -> "EmptySiteJ",
      "widthLayout" -> (if (pageReq.isMobile) WidthLayout.Tiny else WidthLayout.Medium).toInt,
      "isEmbedded" -> false,
      "embeddedOriginOrEmpty" -> "",
      "anyCdnOrigin" -> JsStringOrNull(globals.anyCdnOrigin),
      // anyUgcOrigin — not yet needed; the site is empty.
      "appVersion" -> globals.applicationVersion,
      "pubSiteId" -> JsString(site.pubId),
      "siteId" -> JsNumber(site.id),  // LATER remove in Prod mode [5UKFBQW2]
      "siteCreatedAtMs" -> JsNumber(site.createdAt.millis),
      "siteStatus" -> site.status.toInt,
      "siteFeatureFlags" -> JsString(site.featureFlags),
      "serverFeatureFlags" -> JsString(globals.config.featureFlags),
      "siteOwnerTermsUrl" -> JsStringOrNull(globals.siteOwnerTermsUrl),
      "siteOwnerPrivacyUrl" -> JsStringOrNull(globals.siteOwnerPrivacyUrl),
      "isFirstSiteAdminEmailMissing" -> isFirstSiteAdminEmailMissing,
      "makeEmbeddedCommentsSite" -> siteSettings.allowEmbeddingFrom.nonEmpty,
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings, idps, globals),
      "publicCategories" -> JsArray(),
      "topics" -> JsNull,
      "me" -> noUserSpecificData(everyonesPerms, everyoneGroup).meJsOb,
      "rootPostId" -> JsNumber(PageParts.BodyNr),
      "usersByIdBrief" -> JsObject(Nil),
      "pageMetaBriefById" -> JsObject(Nil),
      "siteSections" -> JsArray(),
      "socialLinksHtml" -> JsNull,
      "currentPageId" -> pageId,
      "pagesById" -> Json.obj(pageId -> pageJsonObj))
  }


  private def pageThatExistsToJsonImpl(pageId: PageId, pageRenderParams: PageRenderParams,
        tx: SiteTx): PageToJsonResult = {
    val page = dao.newPageDao(pageId, tx, useMemCache = true)
    pageToJsonImpl(page, pageRenderParams, dao, tx)
  }


  /** Used when rendering embedded comments, and no comment has been posted yet, so the
    * embedded comments page has not yet been created.
    *
    * Later?: Or if constructing a wiki, and navigating via a wiki link `[[Page Title]]``
    * to a wiki page that has not yet been created.
    */
  def notYetCreatedPageToJson(dummyPage: NotYetCreatedEmbeddedPage,
          renderParams: PageRenderParams): PageToJsonResult = {
    require(dummyPage.id == EmptyPageId, "TyE5UKBQ2")
    dao.readOnlyTransaction { tx =>
      pageToJsonImpl(dummyPage, renderParams, dao, tx)
    }
  }


  private def pageToJsonImpl(page: Page, renderParams: PageRenderParams,
        dao: SiteDao, transaction: SiteTx): PageToJsonResult = {

    // Also see: [posts_2_json]

    // The json constructed here will be cached & sent to "everyone", so in this function
    // we always specify !isStaff and the requester must be a stranger (user = None):
    val pubAuthzCtx = dao.getForumPublicAuthzContext()
    val everyoneGroup = dao.getTheGroup(Group.EveryoneId)
    def globals = dao.globals

    val socialLinksHtml = dao.getWholeSiteSettings().socialLinksHtml
    val pageParts = page.parts
    val posts =
      if (page.pageType.isChat) {
        renderParams.comtOffset match {
          case None =>
            // Load the latest chat messages only. We'll load earlier posts from the browser,
            // on demand.
            transaction.loadOrigPostAndLatestPosts(page.id, limit = 40)
          case Some(ofs) =>
            die("TyEDEADMAYBE04", "Is this dead code?")
            // Orig pots & title should have been loaded already? But then would
            // one really need *page*PoJsonImpl? Shouldn't we return only json
            // for the post range, not any html?   [careful_cache_range]
            transaction.loadPostsOnPage(page.id, WhichPostsOnPage.TopLevelRange(
                  offset = ofs,
                  // Either include range dir in the render params, or decide on
                  // fixed offsets and limits? E.g. first 25, 26-50, 51-75, ...
                  direction = RangeDir.Older,
                  activeOnly = true))
        }
      }
      else if (page.pageType == PageType.Form) {
        // Don't load any comments on form pages. [5GDK02]
        transaction.loadTitleAndOrigPost(page.id)
      }
      else {
        pageParts.allPosts // loads all posts, if needed
      }

    val pageTitleUnsafe = posts.find(_.isTitle).flatMap(_.approvedSource)

    // Meta tags allowed for custom HTML pages only, right now. Usually the homepage.
    // Only staff can edit custom html pages, currently, so reasonably safe, [2GKW0M]
    // + we remove weird attrs, below.
    val headTags: FindHeadTagsResult =
      if (page.pageType != PageType.CustomHtmlPage) FindHeadTagsResult.None
      else posts.find(_.isOrigPost) match {
        case None => FindHeadTagsResult.None
        case Some(origPost) =>
          findHeadTags(origPost.approvedSource getOrElse "")
      }

    SECURITY; SHOULD // allow only admins to change this (not moderators). Not urgent though. [2GKW0M]
    // Fix that, by hiding/collapsing <head>, if the editor isn't an admin?
    // And, when saving a page, compare head tags before, with after, and if changed, throw Forbidden.
    // And when creating, throw forbidden, unless is admin.

    var numPosts = 0
    var numPostsRepliesSection = 0
    var numPostsChatSection = 0
    var numRepliesVisible = 0

    val relevantPosts = posts filter { post =>
      // In case a page contains both form replies and "normal" comments, don't load any
      // form replies, because they might contain private stuff. (Page type might have
      // been changed to/from Form.) [5GDK02]
      // Note that we do include unapproved posts. Client side, they're shown
      // as empty posts with a date but no author, and "not yet approved"
      // text. [show_empty_unapr]
      COULD_OPTIMIZE // don't load the actual text. [iz01]
      post.tyype != PostType.CompletedForm &&
      post.tyype != PostType.Flat && ( // flat comments disabled [8KB42]
      !post.deletedStatus.isDeleted || post.isOrigPost || post.isTitle || (
        post.deletedStatus.onlyThisDeleted && pageParts.hasNonDeletedSuccessor(post.nr)))
    }

    val relevantApprovedPosts = relevantPosts.filter(_.isSomeVersionApproved)

    // (Tags and author badges not shown for unapproved posts.)
    val tagsAndBadges = transaction.loadPostTagsAndAuthorBadges(relevantApprovedPosts.map(_.id))

    // Json by post nr as string.
    var allPostsJson: Seq[(St, JsObject)] = relevantPosts map { post: Post =>
      numPosts += 1
      if (post.isReply && post.isVisible) {
        numRepliesVisible += 1
      }
      if (post.tyype == PostType.Flat)
        numPostsChatSection += 1
      else if (!post.isOrigPost && !post.isTitle)
        numPostsRepliesSection += 1

      post.nr.toString ->
          postToJsonImpl(post, page, tagsAndBadges,
                includeUnapproved = false, showHidden = false,
                // We're rendering a whole page at once, not a single comment. Then,
                // we'll summarize and squash comments as needed so as not to show too
                // many on page load.
                maySquash = true, dao.getSite())
    }

    if (Globals.isDevOrTest) {
      BUG // sometimes tot num replies not updated properly, e.g. run:
      // s/wdio --only api-upsert-posts.2browsers --cd --da
      // and set a breakpoint in the if-mismatch.
      val mismatch = numRepliesVisible != page.meta.numRepliesVisible
      if (mismatch) {
        System.err.println(o"""$numRepliesVisible != ${page.meta.numRepliesVisible}
              [TyE2R0MSE3R2]""")
      }
      // No, breaks tests, and this mismatch is a pretty minor problem anyway:
      //dieIf(mismatch, "TyE2R0MSE3R2",
      //    s"$numRepliesVisible != ${page.meta.numRepliesVisible}")
    }

    // Topic members (e.g. chat channel members) join/leave infrequently, so better cache them
    // than to lookup them each request.
    // However, if a chat was changed from OpenChat to JoinlessChat, in the database,
    // there might already be page members (from when it was OpenChat). Then, don't
    // load those members — JoinlessChat:s don't have any members. (But keep in the db,
    // in case the page type gets changed back.)
    val pageMemberIds: Set[UserId] =
          if (!page.pageType.isGroupTalk) Set.empty
          else transaction.loadMessageMembers(page.id)

    val userIdsToLoad = mut.Set[UserId]()
    userIdsToLoad ++= pageMemberIds
    for (post <- relevantPosts) {  // or relevantApprovedPosts? [iz01]
      // Later: Don't incl any private members. [private_pats]
      post.addVisiblePatIdsTo(userIdsToLoad)
    }


    val numPostsExclTitle = numPosts - (if (pageParts.titlePost.isDefined) 1 else 0)

    val parentlessReplyNrsSorted =
          pageParts.parentlessRepliesSorted.map(reply => JsNumber(reply.nr))

    if (page.pageType == PageType.EmbeddedComments) {
      allPostsJson +:=
        PageParts.BodyNr.toString ->
          embeddedCommentsDummyRootPost(parentlessReplyNrsSorted)
    }

    val progressPostNrsSorted =  // [timeline_comts]
          pageParts.progressPostsSorted.map(reply => JsNumber(reply.nr))

    val (anyForumId: Option[PageId], ancestorsJsonRootFirst: Seq[JsObject]) =
      makeForumIdAndAncestorsJson(page.meta)

    val anyCurCatId = page.meta.categoryId
    val anyCatsCanSee: Opt[CatsCanSee] = anyCurCatId.flatMap(
          dao.listMaySeeCategoriesInSameSectionAs(_, pubAuthzCtx, inclDeleted = false))

    val pubCatsJson: JsArray = anyCatsCanSee.map({ catsCanSee =>
        // Forum pages need per-category recently active topics, to show on
        // the categories list page, next to each category title.  [per_cat_topics]
        if (page.meta.pageType != PageType.Forum) {
          makeCategoriesJsonNoDbAccess(catsCanSee, recentTopicsJson = None)
        }
        else {
          // Should this be configurable, maybe want popular-first instead of active-first?
          // [cats_topics_order]
          val pageQuery = activePagesPerCatQuery
          COULD_OPTIMIZE // Remember cats, so can skip lookup below?  [2_many_cat_queries]
          val catsWithTopics = makeForumPageCatsAndTopicsJson(catsCanSee, pageQuery)
          // Topic assignees not needed here? How it works elsewhere: [incl_assignees]
          catsWithTopics.catsAndTopicsJson
        }
    }) getOrElse JsArray()

    val siteSettings = dao.getWholeSiteSettings()

    val internalBacklinksJson = makeInternalBacklinksJson(page.id, pubAuthzCtx, dao)

    val tagTypeIdsToLoad = mut.Set[TagTypeId]()
    tagsAndBadges.tagTypeIds foreach tagTypeIdsToLoad.add

    val anyLatestTopicsJsVal: JsValue =
      if (page.pageType == PageType.Forum) {
        val catsCanSee = anyCatsCanSee.getOrDie(
          // Constraint `dw1_pages__c_has_category` ensures there's a category id.
          "DwE7KYP2", s"Forum page '${page.id}', site '${transaction.siteId}', has no category id")
        val orderOffset = renderParams.anyPageQuery getOrElse defaultPageQuery(siteSettings)
        // Reuse results from above?  [2_many_cat_queries]
        val topicsCanSee: PagesCanSee =
              dao.listPagesCanSeeInCatsCanSee(
                  catsCanSee, orderOffset, inclPinned = true,
                  limit = ForumController.NumTopicsToList)
        RACE // got an 1 version old page stuff. So, now looking up by id *and version*,
        // instead.
        val topics: ImmSeq[PagePathAndMeta] = topicsCanSee.pages
        val pageStuffById = dao.getPageStuffsByIdVersion(topics.map(_.idAndVersion))

        pageStuffById.values.foreach(_.addVisiblePatIdsTo(userIdsToLoad))

        for (stuff <- pageStuffById.values; tag <- stuff.pageTags) {
          tagTypeIdsToLoad.add(tag.tagTypeId)
        }
        JsArray(topics.map(controllers.ForumController.topicToJson(_, pageStuffById)).toArray)
      }
      else {
        JsNull
      }

    val anyAnswerPostNr = page.meta.answerPostId flatMap { postId =>
      posts.find(_.id == postId).map(_.nr)
    }

    // Bit dupl code. [pats_by_id_json]
    val usersById = transaction.loadParticipantsAsMap(userIdsToLoad)
    val usersByIdJson = JsObject(usersById map { idAndUser =>
      idAndUser._1.toString -> JsPat(idAndUser._2, tagsAndBadges,
            // Let anonyms stay anonymous; don't show their true ids on public pages:
            // (So specify no user here, meaning, a stranger, no permissions.)
            toShowForPatId = None)
    })

    val anons: Seq[Anonym] = usersById.values.collect({ case a: Anonym => a }).toSeq
    RENAME // to ...ByTrueId?
    val anonsByRealId = anons.groupBy(_.anonForPatId)

    // These don't change often, can use the cache.
    val tagTypes = dao.getTagTypes(tagTypeIdsToLoad.toSet)

    //val pageSettings = dao.loadSinglePageSettings(pageId)
    val horizontalLayout = page.pageType == PageType.MindMap // || pageSettings.horizontalComments
    val is2dTreeDefault = false // pageSettings.horizontalComments

    val pagePath =
      page.path getOrElse PagePathWithId.fromIdOnly(page.id, canonical = true)

    SAVE_BANDWIDTH // Skip null and default-value fields
    val pageJsonObj = Json.obj(  // ts: Page
      "pageId" -> page.id,
      "pageVersion" -> page.meta.version,
      "pageMemberIds" -> pageMemberIds,
      "forumId" -> JsStringOrNull(anyForumId),
      "ancestorsRootFirst" -> ancestorsJsonRootFirst,
      "categoryId" -> JsNumberOrNull(page.meta.categoryId),
      "internalBacklinks" -> internalBacklinksJson,
      "externalBacklinks" -> JsArray(Nil),
      "pageRole" -> JsNumber(page.pageType.toInt),
      "pagePath" -> JsPagePathWithId(pagePath),
      // --- These and some more, could be in separate objs instead [DBLINHERIT]
      "pageLayout" -> JsNumber(page.meta.layout.toInt),
      "comtOrder" -> JsNum32OrNull(page.meta.comtOrder.map(_.toInt)),
      //"comtNesting" -> later
      "comtsStartHidden" -> JsNum32OrNull(page.meta.comtsStartHidden.map(_.toInt)),
      "comtsStartAnon" -> JsNum32OrNull(page.meta.comtsStartAnon.map(_.toInt)),
      "newAnonStatus" -> JsNum32OrNull(page.meta.newAnonStatus.map(_.toInt)),
      "forumSearchBox" -> JsNum32OrNull(page.meta.forumSearchBox),
      "forumMainView" -> JsNum32OrNull(page.meta.forumMainView),
      "forumCatsTopics" -> JsNum32OrNull(page.meta.forumCatsTopics),
      "progressLayout" -> JsNumber(siteSettings.progressLayout.toInt),
      "origPostVotes" -> JsNumber(page.parts.origPostVotes.toInt),
      "enableDisagreeVote" -> JsBoolean(page.parts.enableDisagreeVote),
      "origPostReplyBtnTitle" -> JsStringOrNull(page.parts.origPostReplyBtnTitle),
      // -------------------------------------------------
      "pageHtmlTagCssClasses" -> JsString(page.meta.htmlTagCssClasses),
      "pageHtmlHeadTitle" -> JsString(page.meta.htmlHeadTitle),
      "pageHtmlHeadDescription" -> JsString(page.meta.htmlHeadDescription),
      "pinOrder" -> JsNumberOrNull(page.meta.pinOrder),
      "pinWhere" -> JsNumberOrNull(page.meta.pinWhere.map(_.toInt)),
      "pageAnsweredAtMs" -> dateOrNull(page.meta.answeredAt),
      "pageAnswerPostUniqueId" -> JsNumberOrNull(page.meta.answerPostId),
      "pageAnswerPostNr" -> JsNumberOrNull(anyAnswerPostNr),
      "doingStatus" -> page.meta.doingStatus.toInt,
      "pagePlannedAtMs" -> dateOrNull(page.meta.plannedAt),
      "pageStartedAtMs" -> dateOrNull(page.meta.startedAt),
      "pageDoneAtMs" -> dateOrNull(page.meta.doneAt),
      "pageClosedAtMs" -> dateOrNull(page.meta.closedAt),
      "pageLockedAtMs" -> dateOrNull(page.meta.lockedAt),
      "pageFrozenAtMs" -> dateOrNull(page.meta.frozenAt),
      "pageHiddenAtMs" -> JsWhenMsOrNull(page.meta.hiddenAt),
      "pageDeletedAtMs" -> dateOrNull(page.meta.deletedAt),
      "numPosts" -> numPosts,
      "numRepliesVisible" -> numRepliesVisible,
      "numPostsRepliesSection" -> numPostsRepliesSection,
      "numPostsChatSection" -> numPostsChatSection,
      "numPostsExclTitle" -> numPostsExclTitle,
      "postsByNr" -> JsObject(allPostsJson),
      "parentlessReplyNrsSorted" -> JsArray(parentlessReplyNrsSorted),
      "progressPostNrsSorted" -> JsArray(progressPostNrsSorted),
      "horizontalLayout" -> JsBoolean(horizontalLayout),
      "is2dTreeDefault" -> JsBoolean(is2dTreeDefault))

    val site = dao.theSite()
    val idps = dao.getSiteCustomIdentityProviders(onlyEnabled = true)

    var jsonObj = Json.obj(
      "dbgSrc" -> "PgToJ",
      // These render params need to be known client side, so the page can be rendered in exactly
      // the same way, client side. Otherwise React can mess up the html structure, & things = broken.
      "widthLayout" -> renderParams.widthLayout.toInt,
      "isEmbedded" -> renderParams.isEmbedded,
      // For embedded comments pages, relative links don't work — then need to include
      // the Talkyard server origin in the links. [REMOTEORIGIN] [60MRKDJ56]
      "embeddedOriginOrEmpty" -> renderParams.embeddedOriginOrEmpty,
      "anyCdnOrigin" -> JsStringOrNull(renderParams.anyCdnOrigin),
      "anyUgcOrigin" -> JsStringOrNull(globals.anyUgcOriginFor(site)),
      "appVersion" -> globals.applicationVersion,
      "pubSiteId" -> JsString(site.pubId),
      "siteId" -> JsNumber(site.id), // LATER remove in Prod mode [5UKFBQW2]
      "siteStatus" -> site.status.toInt,
      "siteFeatureFlags" -> JsString(site.featureFlags),
      "serverFeatureFlags" -> JsString(globals.config.featureFlags),
      // CLEAN_UP Later: move these two userMustBe... to settings {} too.
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings, idps, globals),
      "publicCategories" -> pubCatsJson,
      "topics" -> anyLatestTopicsJsVal,
      "me" -> noUserSpecificData(pubAuthzCtx.tooManyPermissions, everyoneGroup).meJsOb,
      "rootPostId" -> JsNumber(renderParams.thePageRoot),
      "usersByIdBrief" -> usersByIdJson,
      "pageMetaBriefById" -> JsObject(Nil),
      "siteSections" -> makeSiteSectionsJson(),
      "socialLinksHtml" -> JsString(socialLinksHtml),
      "currentPageId" -> page.id,
      // Later:
      //"tagTypes" -> JsArray(tagTypes map JsTagType),
      // For now:
      "tagTypesById" -> JsObject(tagTypes.map(tt => tt.id.toString -> JsTagType(tt))),
      "pagesById" -> Json.obj(page.id -> pageJsonObj))

    // If listing topics, we've set `store.topics` to the topic list (just above),
    // but the client also wants to know for which category we're listing topics.
    // (Pat might be listing topics in a sub category in the forum. Currently, the
    // server side renderer always lists recently active topics in *all* forum
    // categories though.)
    if (page.pageType == PageType.Forum) {
      devDieIf(anyCurCatId.isEmpty, "TyE2GPS7N3")
      anyCurCatId.foreach(id => jsonObj += "listingCatId" -> JsNumber(id))
    }

    COULD_OPTIMIZE; SAVE_BANDWIDTH // Add only if needed  [authn_diag_bandw], that is,
    // if user not logged in.  Maybe inject at the bottom in a new <script> placeholder?
    // (Can't do > 1 from the top, since there's people's comments in one already,
    // which could include placeholder strings.)
    SAVE_BANDWIDTH // Exclude enableGoogleLogin, FacebookLogin, allowSignup, customIdps ...
    // too, if already logged in. [cached_html_loggedin_param]?
    if (siteSettings.authnDiagConf.value.nonEmpty) {
      jsonObj += "authnDiagConf" -> siteSettings.authnDiagConf
    }

    val reactStoreJsonString = jsonObj.toString()

    // Make sure we [dont_leak_true_ids].  This page json is for everyone, not a specific
    // person, and then no aliases' true ids should be included.  (However,
    // in  userDataJson()  and requestersJsonImpl()  (below) it can be ok with true ids.)
    val trueIds = (jsonObj \\ JsX.AnonForIdFieldName)
    if (trueIds.nonEmpty) {
      // Only include in the server logs, don't show to the end user.
      System.err.println(s"True ids in page json: $reactStoreJsonString  [TyEIDLEAKPAGE1]")
      die(s"Bug: True ids in page json, see server logs. [TyEIDLEAKPAGE2]")
    }

    val version = CachedPageVersion(
      siteVersion = transaction.loadSiteVersion(),
      pageVersion = page.version,
      appVersion = globals.applicationVersion,
      renderParams = renderParams,
      storeJsonHash = hashSha1Base64UrlSafe(reactStoreJsonString))

    COULD_OPTIMIZE // cache unapproved posts too?
    //
    // And which users have bookmarks,  [remember_if_bookmarks_or_priv_comts]
    // and if there are any rivate comments.
    // But then `page` needs to include private posts too, and we need to be careful
    // to not include any of them when rendering the public & cached version of the page.
    //
    val unapprovedPosts = posts.filter(!_.isSomeVersionApproved)
    val unapprovedPostAuthorIds = unapprovedPosts.map(_.createdById).toSet

    PageToJsonResult(reactStoreJsonString, version, pageTitleUnsafe, headTags,
          unapprovedPostAuthorIds, anonsByRealId = anonsByRealId)
  }


  def makeStrangersWatcbarJson(): JsValue = {
    val watchbar = dao.getStrangersWatchbar()
    val watchbarWithTitles = dao.fillInWatchbarTitlesEtc(watchbar)
    watchbarWithTitles.toJsonWithTitles
  }


  def makeSpecialPageJson(request: DebikiRequest[_], inclCatsTagsSects_unimpl: Bo): JsObject = {
    require(request.dao == dao, "TyE4JKTWQ0")
    val globals = request.context.globals
    val siteSettings = dao.getWholeSiteSettings()
    val site = dao.theSite()
    val everyoneGroup = dao.getTheGroup(Group.EveryoneId)
    val idps = dao.getSiteCustomIdentityProviders(onlyEnabled = true)

    var result = Json.obj(
      "dbgSrc" -> "SpecPgJ",
      "widthLayout" -> (if (request.isMobile) WidthLayout.Tiny else WidthLayout.Medium).toInt,
      "isEmbedded" -> false,  // what ??? Yes, if in emb editor iframe
      "embeddedOriginOrEmpty" -> "",  // what ??? but not in use, instead: [60MRKDJ56]
      "anyCdnOrigin" -> JsStringOrNull(globals.anyCdnOrigin),
      "anyUgcOrigin" -> JsStringOrNull(globals.anyUgcOriginFor(site)),
      "appVersion" -> globals.applicationVersion,
      "pubSiteId" -> JsString(site.pubId),
      "siteId" -> JsNumber(site.id), // LATER remove in Prod mode [5UKFBQW2]
      "siteStatus" -> site.status.toInt,
      "siteFeatureFlags" -> JsString(site.featureFlags),
      "serverFeatureFlags" -> JsString(globals.config.featureFlags),
      // CLEAN_UP remove these two; they should-instead-be/are-already included in settings: {...}.
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved),
      "settings" -> makeSettingsVisibleClientSideJson(siteSettings, idps, globals),
      "me" -> noUserSpecificData(dao.getPermsForEveryone(), everyoneGroup).meJsOb,
      "rootPostId" -> JsNumber(PageParts.BodyNr),
      "siteSections" -> makeSiteSectionsJson(),
      "usersByIdBrief" -> Json.obj(),
      "pageMetaBriefById" -> JsObject(Nil),
      "strangersWatchbar" -> makeStrangersWatcbarJson(),
      "pagesById" -> Json.obj(),
      // Special pages / the admin area don't need categories. [6TKQ20]
      // But the search page does!  if (inclCatsTagsSects_unimpl) ...  ?
      // SHOULD incl cats here? But currently loaded via an extra req instead,
      // see:  [search_page_cats_tags]  maybe can just leave it at that.
      "publicCategories" -> JsArray())

    // No need to incl authn diag text, if the person has logged in already.
    if (siteSettings.authnDiagConf.value.nonEmpty) {
      result += "authnDiagConf" -> siteSettings.authnDiagConf
    }

    result
  }


  /** Returns (any-forum-id, json-for-ancestor-forum-and-categories-forum-first).
    */
  def makeForumIdAndAncestorsJson(pageMeta: PageMeta)
        : (Option[PageId], Seq[JsObject]) = {
    val categoryId = pageMeta.categoryId getOrElse {
      return (None, Nil)
    }
    val categoriesRootFirst = dao.getAncestorCategoriesRootLast(categoryId).reverse
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


  private def makeSiteSectionsJson(): JsValue = {
    COULD_OPTIMIZE // use CategoriesDao.listMaySeeCategoryStuffAllSections() instead,
    // then we'll get  CategoryStuff:s which includes all we need,   [cache_cats_stuff]
    // with an 'isSectionPageDeleted' field?
    SECURITY; COULD // not show any hidden/private site sections. Currently harmless though:
    // there can be only 1 section and it always has the same id. (unless adds more manually via SQL)
    SECURITY; COULD // not show any section, if not logged in, and login-required-to-read.
    // Not that important though — just numbers, except for the url path, which can
    // include some info, but currently it's '/' (site index page).

    /* later, something like:  (but need requester too)
    val settings = dao.getWholeSiteSettings()
    if (settings.userMustBeAuthenticated)
      return JsArray() */

    val rootCats = dao.getRootCategories()
    val sectionJsonObjs: Seq[JsObject] = rootCats flatMap { rootCat: Category =>
      // (We're not in a transaction, the page might be gone.)
      dao.getPagePathAndMeta(rootCat.sectionPageId) flatMap { page =>
        if (page.deletedAt.isDefined) None
        else Some(
              Json.obj(  // ts: SiteSection
                "pageId" -> page.pageId,
                "path" -> page.pathSt,
                "pageRole" -> page.pageType.toInt,
                "defaultCategoryId" -> JsNumberOrNull(rootCat.defaultSubCatId),
                "rootCategoryId" -> rootCat.id))
      }
    }
    JsArray(sectionJsonObjs)
  }


  @deprecated("now", "use makeStorePatchForPostIds instead?")
  def postToJson2(postNr: PostNr, pageId: PageId,
        includeUnapproved: Boolean = false, showHidden: Boolean = false): JsObject =
    postToJson(postNr, pageId, includeUnapproved = includeUnapproved,
          showHidden = showHidden,
          // Currently only called w one post, not for a sub thread or whole page.
          maySquash = false)._1


  @deprecated("now", "use makeStorePatchForPostIds instead?")
  private def postToJson(postNr: PostNr, pageId: PageId,
        tagsAndBadges: Opt[TagsAndBadges] = None, includeUnapproved: Bo = false,
        showHidden: Bo = false, maySquash: Bo): (JsObject, PageVersion) = {
    dao.readTx { tx =>
      COULD_OPTIMIZE // Load only postNr, author and last editor — not the whole page.
      val page = dao.newPageDao(pageId, tx, WhichPostsOnPage.thoseMaybeRelatedTo(postNr),
                        useMemCache = true)
      val post = page.parts.thePostByNr(postNr)
      val theTagsAndBadges = tagsAndBadges.getOrElse(
            tx.loadPostTagsAndAuthorBadges(Seq(post.id)))
      // [tags_and_badges_missing]  but don't fix? Instead, start using
      // makeStorePatchForPostIds instead?
      val json = postToJsonImpl(post, page, theTagsAndBadges,
            includeUnapproved = includeUnapproved, showHidden = showHidden,
            maySquash = maySquash, dao.getSite())
      (json, page.version)
    }
  }


  ANNOYING ; COULD ; REFACTOR // postToJsonImpl's dependency on Page & a transaction is annoying.
  // Could create a StuffNeededToRenderPost class instead? and make some things, like
  // depth & siblings, optional, and then just exlude them from the resulting json, and
  // merge-update the post client side instead.

  /** Private, so it cannot be called outside a transaction.
    */
  private def postToJsonImpl(post: Post, page: Page, tagsAndBadges: TagsAndBadges,
        includeUnapproved: Bo, showHidden: Bo, maySquash: Bo, anySite: Opt[Site]): JsObject = {

    val depth = page.parts.depthOf(post.nr)

    // Max comments limits above which we'll summarize and collapse.  [sum_squash_lims]
    //
    // Hardcoded for now. Later, will be conf vals. Per site or cat? Maybe on blog post pages,
    // it's a better reading experience for most people, if the page is shorter, and
    // they see primarily the more interesting comments. And important for saving bandwidth!
    // Whilst in a forum, there'd be fewer page views generally, and less important to
    // save bandwidth — maybe the limits there, would be higher.
    // So, it seems, these should be configurable per *category* (emb comments cat), possibly
    // also per page type (so emb comments can have lower limits).
    val maxLim = 250 // or pages too large, takes annoyingly long to load. Better have
    // *some* limit, for now. Later, can instead remember what threads to auto-un-squash.

    // Tests:
    //  - dir.summarize-squash-siblings.2br  TyTESQUASHSIBL

    val summarizeLimit =
          if (anySite.exists(_.featureFlags.contains("ffDoNotSummarize"))) maxLim
          else SummarizeNumRepliesVisibleLimit
    val squashLimit =
          if (anySite.exists(_.featureFlags.contains("ffDoNotSquash"))) maxLim
          else SquashSiblingIndexLimit

    COULD; UX; BUG // ? what if there're really many progress comments — then don't want
    // to load all of those.

    // Find out if we should summarize post, or squash it and its subsequent siblings.
    //
    // This is simple but a bit too stupid? COULD come up with a better algorithm (better
    // in the sense that it better avoids summarizing or squashing interesting stuff).
    //
    // (Note: We'll probably have to do this server side in order to do it well, because
    // only server side all information is available, e.g. how trustworthy certain users
    // are or if they are trolls. Cannot include that in JSON sent to the browser, privacy issue.)
    //
    val (summarize, jsSummary, squash) =
      if (!maySquash) {
        // Typically if rendering one specific comment, e.g. to show a hidden one to the mods,
        // then, the requester wants to see it in full, not summarized or squashed.
        (false, JsNull, false)
      }
      else if (page.parts.numRepliesVisible < summarizeLimit) {
        (false, JsNull, false)
      }
      else {
        val (siblingIndex, hasNonDeletedSiblingTreesAfter) = page.parts.siblingIndexOf(post)
        val siblingsLimit = squashLimit / math.max(depth, 1)

        // If the previous sibling got squashed, then, squash this one too —
        // otherwise there'd be a "Click to show more replies" button [306UDRPJ24]
        // but after that button, the very last sibling would *not* have gotten
        // squashed, unless it has successors so hasNonDeletedSuccessor() is true,
        // because hasNonDeletedSiblingTreesAfter is false since it's the last sibling.
        val prevSiblingSquashed = (siblingIndex - 1) > siblingsLimit

        val (squash, tooManySiblings) =   // [SQUASHSIBL]
          if (prevSiblingSquashed) {
            (true, true)
          }
          else {
            val tooMany = siblingIndex > siblingsLimit
            // Don't squash a single last post with no replies – summarize it instead.
            // (Squashing it would be pointless, since there're no replies or
            // siblings-placed-after-it that would get squashed together with it.)
            val squash = tooMany && (
                hasNonDeletedSiblingTreesAfter ||
                page.parts.hasNonDeletedSuccessor(post.nr))
            (squash, tooMany)
          }

        var summarize = !squash && (
          // If tooManySiblings, but we couldn't squash it — let's summarize it instead.
          tooManySiblings ||
          // Or if we've exceeded the time-to-summarize limits.
          siblingIndex > SummarizeSiblingIndexLimit ||
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

    val childrenSorted = page.parts.childrenSortedOf(post.nr)

    val howRender = new HowRenderPostInPage(summarize = summarize, jsSummary = jsSummary,
        squash = squash, childrenSorted = childrenSorted)

    val postRenderSettings = dao.makePostRenderSettings(page.pageType)

    // We're about to renders CommonMark in a tx, slightly bad. [nashorn_in_tx]
    val renderer = RendererWithSettings(
          dao.context.postRenderer, postRenderSettings, dao.theSite())

    postToJsonNoDbAccess(post, showHidden = showHidden,
          includeUnapproved = includeUnapproved, tagsAndBadges, howRender, renderer)
  }


  def postToJsonOutsidePage(post: Post, pageRole: PageType, showHidden: Bo,
          includeUnapproved: Bo, tagsAndBadges: TagsAndBadges,
          inclPageId: Bo): JsObject = {
    val postRenderSettings = dao.makePostRenderSettings(pageRole)
    val renderer = RendererWithSettings(
          dao.context.postRenderer, postRenderSettings, dao.theSite(), inclPageId = inclPageId)

    postToJsonNoDbAccess(post, showHidden = showHidden,
          includeUnapproved = includeUnapproved, tagsAndBadges,
          new HowRenderPostInPage(false, JsNull, false, Nil), renderer)
  }


  def noUserSpecificData(everyonesPerms: Seq[PermsOnPages], everyone: Group): Me = {
    require(everyonesPerms.forall(_.forPeopleId == Group.EveryoneId), "TyE52WBG08")
    require(everyone.id == Group.EveryoneId, "TyE2WBG09")
    val perms = everyone.perms

    // Somewhat dupl code. (2WB4G7)
    val meJsOb = Json.obj(
      "dbgSrc" -> "2FBS6Z8",
      "trustLevel" -> TrustLevel.StrangerDummyLevel,
      "notifications" -> JsArray(),
      "watchbar" -> makeStrangersWatcbarJson(),
      "myGroupIds" -> Json.arr(Group.EveryoneId),
      "myDataByPageId" -> JsObject(Nil),
      "marksByPostId" -> JsObject(Nil),
      "closedHelpMessages" -> JsObject(Nil),
      "tourTipsSeen" -> JsArray(),
      "uiPrefsOwnFirst" -> JsArray(),
      "permsOnPages" -> permsOnPagesToJson(everyonesPerms, excludeEveryone = false),
      "effMaxUplBytes" -> JsNumber(perms.maxUploadBytes.getOrElse(0).toInt),
      "effAlwUplExts" -> JsArray(perms.allowedUplExtensionsAsSet.toSeq.map(JsString)))

    Me(meJsOb = meJsOb)
  }


  RENAME // this function (i.e. userDataJson) so it won't come as a
  // surprise that it updates the watchbar! But to what? Or reanme the class too? Or break out?
  def userDataJson(pageRequest: PageRequest[_], unapprovedPostAuthorIds: Set[UserId],
        anonsByRealId: Map[PatId, Seq[Anonym]])
        : Opt[MeAndStuff] = Some {

    require(pageRequest.dao == dao, "TyE4GKVRY3")
    val requester = pageRequest.user getOrElse {
      return None
    }

    val authzCtx: AuthzCtxOnAllWithReqer = pageRequest.authzCtxOnAllWithReqer.get
    val permissions = authzCtx.tooManyPermissions
    val permsOnSiteTooMany = dao.getPermsOnSiteForEveryone()  // backw compat

    var watchbar: BareWatchbar = dao.getOrCreateWatchbar(authzCtx)

    if (pageRequest.pageExists) {
      // (See comment above about ought-to-rename this whole function / stuff.)
      RACE // if the user opens a page, and someone adds her to a chat at the same time.
      watchbar = dao.watchbarAddRecentMarkSeen(watchbar, pageRequest.thePageMeta, authzCtx)
    }
    val watchbarWithTitles = dao.fillInWatchbarTitlesEtc(watchbar)
    val restrTopicsCatsLinks = listRestrictedCategoriesAndTopics(pageRequest)
    val myGroupsEveryoneLast: Seq[Group] =
          pageRequest.authzContext.groupIdsEveryoneLast map dao.getTheGroup

    val site = if (requester.isStaffOrCoreMember) dao.getSite else None

    dao.readOnlyTransaction { tx =>
      requestersJsonImpl(pageRequest.sid, requester, pageRequest.pageId, watchbarWithTitles,
            restrTopicsCatsLinks, permissions, permsOnSiteTooMany,
            unapprovedPostAuthorIds, anonsByRealId, myGroupsEveryoneLast, site, tx)
    }
  }


  def userNoPageToJson(request: DebikiRequest[_]): Opt[MeAndStuff] = Some {
    require(request.dao == dao, "TyE4JK5WS2")
    val authzContext: AuthzCtxOnAllWithReqer = request.authzCtxOnAllWithReqer getOrElse {
      return None
    }
    val requester = authzContext.theReqer
    val permissions = authzContext.tooManyPermissions
    val permsOnSiteTooMany = dao.getPermsOnSiteForEveryone()  // backw compat
    val watchbar = dao.getOrCreateWatchbar(authzContext)
    val watchbarWithTitles = dao.fillInWatchbarTitlesEtc(watchbar)
    val myGroupsEveryoneLast: Seq[Group] =
          authzContext.groupIdsEveryoneLast map dao.getTheGroup

    val site = if (requester.isStaffOrCoreMember) dao.getSite else None

    dao.readOnlyTransaction { tx =>
      requestersJsonImpl(request.sid, requester, anyPageId = None, watchbarWithTitles,
            RestrTopicsCatsLinks(JsArray(), Nil, Nil, Nil, Set.empty),
            permissions, permsOnSiteTooMany,
            unapprovedPostAuthorIds = Set.empty,
            anonsByRealId = Map.empty,
            myGroupsEveryoneLast, site, tx)
    }
  }


  private def requestersJsonImpl(
        sid: SidStatus, requester: Participant, anyPageId: Option[PageId],
        watchbar: WatchbarWithTitles, restrTopicsCatsLinks: RestrTopicsCatsLinks,
        permissions: Seq[PermsOnPages], permsOnSiteTooMany: PermsOnSite,
        unapprovedPostAuthorIds: Set[UserId], anonsByRealId: Map[PatId, Seq[Anonym]],
        myGroupsEveryoneLast: Seq[Group], site: Opt[Site], tx: SiteTransaction)
        : MeAndStuff = {

    val tagTypeIdsNeeded = mut.Set[TagTypeId]()
    restrTopicsCatsLinks.tagTypeIdsNeeded foreach tagTypeIdsNeeded.add

    val restrictedCategories: JsArray = restrTopicsCatsLinks.categoriesJson
    val restrictedTopics: Seq[JsValue] = restrTopicsCatsLinks.topicsJson
    val restrictedTopicsUsers: Seq[JsObject] = restrTopicsCatsLinks.topicParticipantsJson

    COULD_OPTIMIZE // If [its_a_node], then, can remember in the  PageToJsonResult
    // which users have any drafts?  [remember_if_bookmarks_or_priv_comts]
    // Then, wouldn't need this sql query.
    val draftsOnThisPage: imm.Seq[Draft] =
      anyPageId.map(tx.loadDraftsByUserOnPage(requester.id, _)).getOrElse(Nil)

    // Bug: If !isAdmin, might count [review tasks one cannot see on the review page]. [5FSLW20]
    val reviewTasksAndCounts =
      if (requester.isStaff) tx.loadReviewTaskCounts(requester.isAdmin)
      else ReviewTaskCounts(0, 0)

    // dupl line [8AKBR0]
    val notfsAndCounts = loadNotificationsToShowInMyMenu(
      requester.id, tx, unseenFirst = true, limit = 20, skipDeleted = !requester.isAdmin)

    // Hmm not needed? Group ids already incl in myGroupsEveryoneLast above —
    // if user = requester.
    COULD_OPTIMIZE // use:  requester.id +: myGroupsEveryoneLast.map(_.id)  instead of db request.
    val ownIdAndGroupIds = tx.loadGroupIdsMemberIdFirst(requester)

    COULD_OPTIMIZE // could cache this, unless on the user's profile page (then want up-to-date info)?
    // Related code: [6RBRQ204]
    val ownCatsTagsSiteNotfPrefs = tx.loadNotfPrefsForMemberAboutCatsTagsSite(ownIdAndGroupIds)
    val myCatsTagsSiteNotfPrefs = ownCatsTagsSiteNotfPrefs.filter(_.peopleId == requester.id)
    val groupsCatsTagsSiteNotfPrefs = ownCatsTagsSiteNotfPrefs.filter(_.peopleId != requester.id)

    val reqersTags = dao.getTags(forPat = Some (requester.id))
    reqersTags.foreach(t => tagTypeIdsNeeded.add(t.tagTypeId))

    val (pageNotfPrefs: Seq[PageNotfPref],
         ownVotesJson,
         ownAnonVoters: ImmSeq[Anonym],
         unapprovedPostsJson, // includes any bookmarks
         unapprovedAuthorsJson) =
      anyPageId map { pageId =>
        COULD_OPTIMIZE // load cat prefs together with page notf prefs here?
        val pageNotfPrefs = tx.loadNotfPrefsForMemberAboutPage(pageId, ownIdAndGroupIds)
        SECURITY // minor: filter out prefs for cats one may not access...  [7RKBGW02]
        SECURITY // Ensure done when generating notfs.

        // Later, load [priv_comts] here, & filter may-see? (looking at user & group ids)
        // But, COULD_OPTIMIZE, only if there actually *are* private comments — we can
        // remember in:  [remember_if_bookmarks_or_priv_comts]
        // loadPostsOnPage(pageId, WhichPostsOnPage.OnlyPrivate(... ? ...,
        //        activeOnly = true, mustBeApproved = Some(false))
        // } getOrElse Nil

        // The requester's own votes, and any anonyms han's used when voting.
        val (ownVotesJson, voterIds) = mkVotesJson(requester.id, pageId, tx)
        val ownVoters = tx.loadParticipants(voterIds)
        // This excludes the requester hanself, which is included elsewhere.
        val ownAnonVoters = ownVoters.collect({ case a:Anonym => a })

        // + flags, interesting for staff, & so people won't attempt to flag twice [7KW20WY1]
        val UnapprovedPostsAndAuthors(postsJson, postAuthorsJson, tagTypeIds) =
              unapprovedPostsAndAuthorsJson(
                  requester, pageId, unapprovedPostAuthorIds, tx)

        tagTypeIds foreach tagTypeIdsNeeded.add

        (pageNotfPrefs, ownVotesJson, ownAnonVoters, postsJson, postAuthorsJson)
      } getOrElse (
          Nil, JsEmptyObj, Vec.empty, JsEmptyObj, JsArray())

    COULD_OPTIMIZE // cache this?
    val effPerms = Authz.deriveEffPatPerms(myGroupsEveryoneLast, permsOnSiteTooMany)

    // Privacy prefs are _not_needed, the reqr can see everything about hanself anyway. Only
    // needed, on the user profile page, if editing one's prefs, see: JsUserInclDetails().
    // (To derive, see: Authz.deriveDefaultPrivPrefs().)

    val (threatLevel,
         tourTipsSeenJson,
         uiPrefsOwnFirstJsonSeq,
         // privacyPrefs — _not_needed, see above.
         anyStats) = requester match {
      case member: User =>
        COULD_OPTIMIZE // load stats together with other user fields, in the same db request
        val (requesterInclDetails, anyStats) = tx.loadTheUserInclDetailsAndStatsById(requester.id)

        val tourTipsSeenJson: Seq[JsString] = anyStats flatMap { stats: UserStats =>
          stats.tourTipsSeen.map((theTourTipsSeen: TourTipsSeen) =>
            theTourTipsSeen.map(JsString): Seq[JsString])
        } getOrElse Nil

        val groupsUiPrefsJson: Seq[JsValue] = myGroupsEveryoneLast.flatMap(_.uiPrefs)
        val ownUiPrefsJson = requesterInclDetails.uiPrefs getOrElse JsEmptyObj
        val uiPrefsOwnFirstJsonSeq: Seq[JsValue] = ownUiPrefsJson +: groupsUiPrefsJson
        (member.threatLevel,
          tourTipsSeenJson,
          uiPrefsOwnFirstJsonSeq,
          anyStats)
      case _ =>
        COULD // load or get-from-cache IP bans ("blocks") for this guest and derive the
        // correct threat level. However, for now, since this is for the browser only, this'll do:
        (ThreatLevel.HopefullySafe, Nil, Nil, None)
    }

    val anyReadingProgress = anyPageId.flatMap(tx.loadReadProgress(requester.id, _))
    val anyReadingProgressJson = anyReadingProgress.map(makeReadingProgressJson).getOrElse(JsNull)

    // later:  if (requester.isAdmin *and* wants to see who the anonyms are) ... hmm ..
    // (anonsByRealId is only anon *posters*, not necessarily any anon *voters*).
    val ownAnons: Seq[Anonym] =
          anonsByRealId.getOrElse(requester.id, Seq.empty) ++ ownAnonVoters

    val ownDataByPageId = anyPageId match {
      case None => Json.obj()
      case Some(pageId) =>
        Json.obj(pageId ->
          Json.obj(  // MyPageData
            "pageId" -> pageId,
            "myDrafts" -> draftsOnThisPage.map(JsDraft),
            "myPageNotfPref" -> pageNotfPrefs.find(_.peopleId == requester.id).map(JsPageNotfPref),
            "groupsPageNotfPrefs" -> pageNotfPrefs.filter(_.peopleId != requester.id).map(JsPageNotfPref),
            "readingProgress" -> anyReadingProgressJson,
            "votesByPostNr" -> ownVotesJson,
            "internalBacklinks" -> restrTopicsCatsLinks.internalBacklinksJson,
            // later: "flags" -> JsArray(...) [7KW20WY1]
            "unapprovedPosts" -> unapprovedPostsJson, // includes bookmarks
            "unapprovedPostAuthors" -> unapprovedAuthorsJson,  // should remove [5WKW219] + search for elsewhere
            "knownAnons" -> JsArray(ownAnons map JsKnownAnonym),
            // later: JsArray(real-anon-authors.map(a => JsUser(a))), if is staff.
            "patsBehindAnons" -> JsArray(),
            "postNrsAutoReadLongAgo" -> JsArray(Nil),      // should remove
            "postNrsAutoReadNow" -> JsArray(Nil),
            "marksByPostId" -> JsObject(Nil)))
    }

    // Parts 2 and other parts are all long enough themselves,  so we can include
    // part 1 in generated html pages. [sid_part1]
    val sidPart1: JsValue = sid match {
      case s: SidOk => JsString(s.part1CompId)
      case _ => JsNull
    }

    // Somewhat dupl code, (2WB4G7) and [B28JG4].
    var json = Json.obj(
      "dbgSrc" -> "4JKW7A0",
      "mySidPart1" -> sidPart1,
      "id" -> JsNumber(requester.id),
      "userId" -> JsNumber(requester.id), // try to remove, use 'id' instead
      "username" -> JsStringOrNull(requester.anyUsername),
      "fullName" -> JsStringOrNull(requester.anyName),
      "isLoggedIn" -> JsBoolean(true),
      "isAdmin" -> JsBoolean(requester.isAdmin),
      "isModerator" -> JsBoolean(requester.isModerator),
      "isDeactivated" -> JsBoolean(requester.isDeactivated),
      "isDeleted" -> JsBoolean(requester.isDeleted),
      "avatarSmallHashPath" -> JsStringOrNull(requester.smallAvatar.map(_.hashPath)),
      "isEmailKnown" -> JsBoolean(requester.email.nonEmpty),
      "isAuthenticated" -> JsBoolean(requester.isAuthenticated),
      "trustLevel" -> JsNumber(requester.effectiveTrustLevel.toInt),
      "threatLevel" -> JsNumber(threatLevel.toInt),

      "numUrgentReviewTasks" -> reviewTasksAndCounts.numUrgent,
      "numOtherReviewTasks" -> reviewTasksAndCounts.numOther,

      // dupl code [7KABR20]
      "numTalkToMeNotfs" -> notfsAndCounts.numTalkToMe,
      "numTalkToOthersNotfs" -> notfsAndCounts.numTalkToOthers,
      "numOtherNotfs" -> notfsAndCounts.numOther,
      "thereAreMoreUnseenNotfs" -> notfsAndCounts.thereAreMoreUnseen,
      "notifications" -> notfsAndCounts.notfsJson,

      "snoozeUntilMins" -> JsWhenMinsOrNull(anyStats.flatMap(_.snoozeUntil)),

      "watchbar" -> watchbar.toJsonWithTitles,

      // Inherited from ancestor groups — not one's own settings,
      // there fore starts with "eff" as in "effective".
      "effMaxUplBytes" -> JsNumber(effPerms.maxUploadSizeBytes),
      "effAlwUplExts" -> JsArray(effPerms.allowedUploadExtensions.toSeq.map(JsString)),

      // The Everyone group's permissions are included in the generic no-user json already;
      // don't include it here again. [8JUYW4B]
      "permsOnPages" -> permsOnPagesToJson(permissions, excludeEveryone = true),

      "restrictedTopics" -> restrictedTopics,
      "restrictedTopicsUsers" -> restrictedTopicsUsers,
      "restrictedCategories" -> restrictedCategories,
      "closedHelpMessages" -> JsObject(Nil),
      "tourTipsSeen" -> tourTipsSeenJson,
      "uiPrefsOwnFirst" -> JsArray(uiPrefsOwnFirstJsonSeq),
      "myCatsTagsSiteNotfPrefs" -> JsArray(myCatsTagsSiteNotfPrefs.map(JsPageNotfPref)),
      "groupsCatsTagsSiteNotfPrefs" -> JsArray(groupsCatsTagsSiteNotfPrefs.map(JsPageNotfPref)),
      "myGroupIds" -> JsArray(myGroupsEveryoneLast.map(g => JsNumber(g.id))),
      "pubTags" -> JsArray(reqersTags map JsTag),
      "myDataByPageId" -> ownDataByPageId,
      "marksByPostId" -> JsObject(Nil))

    if (requester.isAdmin) {
      val siteSettings = tx.loadSiteSettings()
      json += "isEmbeddedCommentsSite" -> JsBoolean(siteSettings.exists(_.allowEmbeddingFrom.nonEmpty))
      json += "siteCreatedAtMs" -> JsWhenMsOrNull(site.map(_.createdAt))

      // For now, for admins only (although the table notices_t supports notices to
      // all groups and users).
      COULD_OPTIMIZE // cache in SiteDao. Don't need to be milliseconds up-to-date.
      val adminNotices: Seq[Notice] = tx.loadAdminNotices()
      json += "adminNotices" -> JsArray(adminNotices map JsNotice)
    }

    // "talkyardVersion" -> _  maybe later.
    MeAndStuff(
        me = Me(meJsOb = json),
        StuffForMe(tagTypeIdsNeeded = tagTypeIdsNeeded.toSet))
  }


  COULD ; REFACTOR // move to CategoriesDao? and change from param PageRequest to
  // user + pageMeta?
  private def listRestrictedCategoriesAndTopics(request: PageRequest[_])
        : RestrTopicsCatsLinks = {

    require(request.dao == dao, "TyE5JKWC3")
    val authzCtx = request.authzContext
    val siteSettings = dao.getWholeSiteSettings()

    // If not a forum topic. Could instead show an option to add the page to the / a forum?
    def onlyBacklinks = {
      val internalBacklinksJson = Nil // later
      RestrTopicsCatsLinks(JsArray(), Nil, Nil, internalBacklinksJson, Set.empty)
    }

    val categoryId = request.thePageMeta.categoryId getOrElse {
      return onlyBacklinks
    }

    val pageQuery = request.parsePageQuery() getOrElse defaultPageQuery(siteSettings)

    // SHOULD avoid starting a new transaction, so can remove workaround [7YKG25P].
    // (request.dao might start a new transaction)
    val catsCanSee: CatsCanSee = dao.listMaySeeCategoriesInSameSectionAs(
          categoryId, authzCtx, exclPubCats = true,
          inclDeleted = pageQuery.pageFilter.includeDeleted) getOrElse {
      return onlyBacklinks
    }

    val (
        categoriesJson: JsArray,
        pagesCanSee: PagesCanSee,
        pageStuffById,
        internalBacklinksJson,
        ) =
      if (request.thePageRole != PageType.Forum) {
        // Not a forum page, so need not include any topic lists.
        val catsJson = makeCategoriesJsonNoDbAccess(catsCanSee, recentTopicsJson = None)
        val internalBacklinksJson: Seq[JsObject] = request.pageId.map(id =>
              makeInternalBacklinksJson(id, authzCtx, dao)) getOrElse Nil
        (catsJson, PagesCanSee.empty, Map[PageId, PageStuff](), internalBacklinksJson)
      }
      else {
        BUG // (minor): To include restricted categories & topics, sorted in the correct order, need
        // to know topic sort order & topic filter — but that's not incl in the url params. [2KBLJ80]

        // List forum topics per category. [per_cat_topics]
        COULD_OPTIMIZE // Remember cats, use below.  [2_many_cat_queries]
        val catsWithTopics = makeForumPageCatsAndTopicsJson(catsCanSee, pageQuery)
        // SHOULD avoid starting a new transaction, so can remove workaround [7YKG25P].
        // (We're passing dao to ForumController below.)

        // List forum topics in the base category.
        // (Reuse parts of the results from above?  [2_many_cat_queries])
        val topicsInBaseCat: PagesCanSee =
              dao.listPagesCanSeeInCatsCanSee(
                  catsCanSee, pageQuery, inclPinned = true,
                  limit = ForumController.NumTopicsToList, inSubTree = Some(categoryId))
        COULD_OPTIMIZE // reuse pageStuff in catsWithTopics.pageStuffById. [2_many_cat_queries]
        val pageStuffById = dao.getPageStuffById(topicsInBaseCat.pageIds)

        (catsWithTopics.catsAndTopicsJson, topicsInBaseCat, pageStuffById, Nil)
      }

    val userIds = mut.Set[UserId]()
    pageStuffById.values.foreach(_.addVisiblePatIdsTo(userIds))
    val users = dao.getUsersAsSeq(userIds)

    val tagTypeIdsNeeded = mut.Set[TagTypeId]()
    for (stuff <- pageStuffById.values; tag <- stuff.pageTags) {
      tagTypeIdsNeeded.add(tag.tagTypeId)
    }

    val topicJson = pagesCanSee.pages map { p: PagePathAndMeta =>
      ForumController.topicToJson(p, pageStuffById)
    }

    RestrTopicsCatsLinks(
          categoriesJson = categoriesJson,
          topicsJson = topicJson,
          topicParticipantsJson = users.map(JsPatNameAvatar),
          internalBacklinksJson = internalBacklinksJson,
          tagTypeIdsNeeded = tagTypeIdsNeeded.toSet)
  }


  def makeForumPageCatsAndTopicsJson(catsCanSee: CatsCanSee,
          pageQuery: PageQuery): CatsWithTopics = {
    // Tests:
    //  - category-perms.2br.d

    val recentTopicsByBaseCatId = mut.Map[CatId, Seq[PagePathAndMeta]]()
    val pageIds = MutArrBuf[PageId]()

    // We'll load recent topics, for [each base cats and its descendant cats].
    val catIds = catsCanSee.baseCatIdsOrOnlyId
    for (catId <- catIds) {
      val pagesInCats: PagesCanSee =
            dao.listPagesCanSeeInCatsCanSee(
                catsCanSee, pageQuery,
                // Or maybe excl pinned topics, on the cats list page?
                inclPinned = true,
                limit = ForumController.NumTopicsToListPerCat, inSubTree = Some(catId))
      recentTopicsByBaseCatId(catId) = pagesInCats.pages
      pageIds.append(pagesInCats.pageIds: _*)
    }

    val pageStuffById: Map[PageId, debiki.dao.PageStuff] =
          dao.getPageStuffById(pageIds)

    import ForumController.categoryToJson  // move to here somewhere?

    val json = JsArray(catsCanSee.catStuffsExclRoot.map({ catStuff =>
      categoryToJson(catStuff, catsCanSee.rootCategory,
            topicsInTree = recentTopicsByBaseCatId.get(catStuff.category.id),
            pageStuffById)
    }))

    CatsWithTopics(json, pageStuffById)
  }


  private def defaultPageQuery(siteSettings: EffectiveSettings) =
    PageQuery(
      PageOrderOffset.ByBumpTime(None),
      PageFilter(PageFilterType.AllTopics, includeDeleted = false),
      includeAboutCategoryPages = siteSettings.showCategories)


  private def activePagesPerCatQuery =
    PageQuery(
          PageOrderOffset.ByBumpTime(None),
          PageFilter(PageFilterType.AllTopics, includeDeleted = false),
          includeAboutCategoryPages = false)


  private def unapprovedPostsAndAuthorsJson(reqer: Pat, pageId: PageId,
        unapprovedPostAuthorIds: Set[UserId], tx: SiteTx): UnapprovedPostsAndAuthors = {

    // This loads bookmarks too (they're unapproved, and private: nrs < PageParts.MaxPrivateNr).
    var posts: Seq[Post] = {
      COULD_OPTIMIZE // [remember_if_bookmarks_or_priv_comts]
      // We currently don't know if there're [priv_comts] or bookmarks on this page,
      // so, if the user is logged in, we need to run a database query.
      // Later:
      // if (no unapproved posts & no bookmarks & no private comments  this user can see)
      //     Nil
      // else
      if (reqer.isAuthenticated) {
        tx.loadUnapprovedPosts(pageId, ownBy = reqer.id, allPublic = reqer.isStaff, limit = 999)
      }
      else {
        // Others cannot see unapproved posts. Except for category mods? [cat_mods]
        Nil
      }
    }

    COULD // load form replies also if user is page author?
    if (reqer.isAdmin) {
      posts ++= tx.loadCompletedForms(pageId, limit = 999)
    }

    if (posts.isEmpty)
      return UnapprovedPostsAndAuthors(JsObject(Nil), JsArray(), Set.empty)

    val tagsAndBadges = tx.loadPostTagsAndAuthorBadges(posts.map(_.id))

    val tagTypeIdsNeeded = mut.Set[TagTypeId]()
    tagsAndBadges.tagTypeIds foreach tagTypeIdsNeeded.add

    val pageMeta = tx.loadThePageMeta(pageId)

    val postIdsAndJson: Seq[(String, JsValue)] = posts.map { post =>
      val postRenderSettings = dao.makePostRenderSettings(pageMeta.pageType)
      val renderer = RendererWithSettings(
            dao.context.postRenderer, postRenderSettings, dao.theSite())

      post.nr.toString ->
        postToJsonNoDbAccess(post, showHidden = true, includeUnapproved = true,
              tagsAndBadges, new HowRenderPostInPage(false, JsNull, false,
            // Cannot currently reply to unapproved posts, so no children. [8PA2WFM]
            Nil), renderer)
    }

    // Tests:  tags-badges-not-missing.2br  TyTETAGS0MISNG.TyTTAGUNAPRPO
    val authors = tx.loadParticipants(posts.map(_.createdById).toSet)
    val authorsJson = JsArray(authors.map(JsPat(_, tagsAndBadges)))
    UnapprovedPostsAndAuthors(
          posts = JsObject(postIdsAndJson),
          authors = authorsJson,
          tagTypeIdsNeeded = tagTypeIdsNeeded.toSet)
  }


  def makeCatsPatchExclTopics(categoryId: CategoryId, authzCtx: ForumAuthzContext)
        : JsObject = {
    val restrCategoriesJson = makeCategoriesJson(
          categoryId, authzCtx, exclPublCats = true, recentTopicsJson = None)
    val pubAuthCtx = if (authzCtx.isPublic) authzCtx else dao.getForumPublicAuthzContext()
    val publCategoriesJson = makeCategoriesJson(
          categoryId, pubAuthCtx, exclPublCats = false, recentTopicsJson = None)
    Json.obj(
      "appVersion" -> dao.globals.applicationVersion,
      "restrictedCategories" -> restrCategoriesJson,
      "publicCategories" -> publCategoriesJson)
  }


  REFACTOR // move into above fn, only used there
  private def makeCategoriesJson(categoryId: CategoryId, authzCtx: ForumAuthzContext,
        exclPublCats: Bo, recentTopicsJson: Opt[Seq[JsObject]]): JsArray = {
    COULD_OPTIMIZE // exclPublCats currently ignored — but would result in less json generated
    val sectCatsCanSee = dao.listMaySeeCategoriesInSameSectionAs(categoryId, authzCtx,
          exclPubCats = exclPublCats, inclDeleted = true) getOrElse {
      return JsArray()
    }
    makeCategoriesJsonNoDbAccess(sectCatsCanSee, recentTopicsJson)
  }


  def makeInternalBacklinksJson(toPageId: PageId, authzCtx: ForumAuthzContext,
          daoOrTx: SiteDao): Seq[JsObject] = {
    daoOrTx match {
      case dao: SiteDao =>
        val linkerIds: Set[PageId] =
              dao.getPageIdsLinkingTo(toPageId,
                  inclDeletedHidden = false)  // [staff_can_see]
        val linkersMaybeSee: Map[PageId, PageStuff] =
              dao.getPageStuffById(linkerIds)
        val linkersOkSee: Iterable[PageStuff] =
              linkersMaybeSee.values.filter { page: PageStuff =>
                dao.maySeePageUseCacheAndAuthzCtx(
                      page.pageMeta, authzCtx,
                      maySeeUnlisted = false).maySee  // [staff_can_see]
              }
        val linksJson = linkersOkSee map { page =>
          ForumController.topicStuffToJson(page, s"/-${page.pageId}")
        }
        linksJson.toSeq
    }

      /*  Later, sometimes will want a tx instead of a dao + cache? Then:

      case Right(tx) =>
        val linkedFromPageIds: Set[PageId] =
              tx.loadPageIdsLinkingTo(toPageId, inclDeletedHidden = false)
        val linkedFromPageMetas: Seq[PageMeta] = tx.loadPageMetas(linkedFromPageIds)
        val linkedFromMaySee = linkedFromPageMetas flatMap { pageMeta =>
          val maySeeResult = dao.maySeePageUseCache(pageMeta, None, maySeeUnlisted = false)
          if (!maySeeResult.maySee) None
          else Some(pageMeta)
        }

        val linkingPageTitles = tx.loadPostsByNrs(
          linkedFromMaySee.map(pm => PagePostNr(pm.pageId, PageParts.TitleNr)))

    val internalBacklinksJson = linkingPageTitles flatMap { titlePost =>
      if (!titlePost.isSomeVersionApproved) None
      else {
        linkedFromMaySee.find(_.pageId == titlePost.pageId) flatMap { pageMeta =>  // [On2]
          Some(Json.obj(
            "titleHtmlSanitized" -> titlePost.approvedHtmlSanitized,
            "pageId" -> titlePost.pageId,
            "pageType" -> pageMeta.pageType.toInt,
            "pageStatus" -> pageMeta.doingStatus.toInt))
        }
      }
    }
    JsArray(internalBacklinksJson)
          */
  }


  def makeStorePatchForPostNr(pageId: PageId, postNr: PostNr, showHidden: Bo)
        : Opt[JsObject] = Some {
    COULD_OPTIMIZE // make makeStorePatchForPostIds work also with page-id, post-nr?
    // So can skip this lookup. Maybe could be a case class PostIdentifier, which
    // would be either a PageId+PostNr, or a PostId?
    // Maybe that'd be a PostRef: PostIdRef or PostNrRef? [post_id_nr_ref]
    val post = dao.loadPost(pageId, postNr) getOrElse {
      return None
    }
    makeStorePatchForPostIds(
          postIds = Set(post.id), showHidden = showHidden, inclUnapproved = true,
          maySquash = false, dao)
  }


  def makeStorePatchForPostIds(postIds: Set[PostId], showHidden: Bo,
        inclUnapproved: Bo, maySquash: Bo, dao: SiteDao): JsObject = {
    dieIf(Globals.isDevOrTest && dao != this.dao, "TyE602MWJL43") ; CLEAN_UP // remove dao param?
    dao.readTx { tx =>
      // This might render CommonMark, in a tx — slightly bad. [nashorn_in_tx]
      _makeStorePatchForPostIds(postIds, showHidden = showHidden,
            inclUnapproved = inclUnapproved, maySquash = maySquash, tx)
    }
  }

  // [post_to_json]
  private def _makeStorePatchForPostIds(postIds: Set[PostId],
          showHidden: Bo, inclUnapproved: Bo, maySquash: Bo,
          transaction: SiteTx): JsObject = {
    val posts = transaction.loadPostsByUniqueId(postIds).values
    val tagsAndBadges = transaction.loadPostTagsAndAuthorBadges(postIds)
    val tagTypes = dao.getTagTypes(tagsAndBadges.tagTypeIds)
    val pageIds = posts.map(_.pageId).toSet
    val pageIdVersions = transaction.loadPageMetas(pageIds).map(_.idVersion)
    val patIds = MutHashSet[PatId]()
    posts.foreach(_.addVisiblePatIdsTo(patIds))
    val pats = transaction.loadParticipants(patIds)
    makeStorePatch3(pageIdVersions, posts,
          showHidden = showHidden, inclUnapproved = inclUnapproved,
          maySquash = maySquash, tagsAndBadges, tagTypes,
          pats, appVersion = dao.globals.applicationVersion)(transaction)
  }


  def makeStorePatchForPost(post: Post, showHidden: Bo): JsObject = {
    makeStorePatchForPostIds(
          postIds = Set(post.id), showHidden = showHidden, inclUnapproved = true,
          maySquash = false, dao)
  }


  def makeStorePatchDeletePages(pageIds: Seq[PageId], appVersion: String): JsObject = {
    Json.obj(
      "appVersion" -> appVersion,
      "deletePageIds" -> JsArray(pageIds map JsString))
  }


  ANNOYING // needs a transaction, because postToJsonImpl needs one. Try to remove [nashorn_in_tx]
  private def makeStorePatch3(pageIdVersions: Iterable[PageIdVersion], posts: Iterable[Post],
          showHidden: Bo, inclUnapproved: Bo, maySquash: Bo,
          tagsAndBadges: TagsAndBadges, tagTypes: Seq[TagType],
          pats: Iterable[Pat], appVersion: St)(
          tx: SiteTx): JsObject = {
    require(posts.isEmpty || pats.nonEmpty, "Posts but no authors [EsE4YK7W2]")

    val pageVersionsByPageIdJson =
          JsObject(pageIdVersions.toSeq.map(p => p.pageId -> JsNumber(p.version)))

    val postsByPageId: Map[PageId, Iterable[Post]] = posts.groupBy(_.pageId)
    val postsByPageIdJson = JsObject(
      postsByPageId.toSeq.map(pageIdPosts => {
        val pageId = pageIdPosts._1
        val posts = pageIdPosts._2
        val page = dao.newPageDao(  // WOULD_OPTIMIZE: reuse from earlier in the same tx?
              pageId, tx, useMemCache = false,
              whichPosts =
                  // If it's private, we need also public posts, since private posts
                  // comment about or bookmark public posts.
                  if (posts.exists(_.isPrivate)) WhichPostsOnPage.AllByAnyone()
                  else WhichPostsOnPage.OnlyPublic() )
        val postsJson = posts map { p =>
          // We're in a tx, and postToJsonImpl renders CommonMark, slightly bad. [nashorn_in_tx]
          postToJsonImpl(p, page, tagsAndBadges,
                includeUnapproved = inclUnapproved, showHidden = showHidden,
                maySquash = maySquash,
                // (COULD specify anySite, to get the right summarize & squash feature flags.)
                anySite = None)
        }
        pageId -> JsArray(postsJson.toSeq)
      }))

    Json.obj(
      "appVersion" -> appVersion,
      "pageVersionsByPageId" -> pageVersionsByPageIdJson,
      "usersBrief" -> pats.map(JsPat(_, tagsAndBadges)),
      "tagTypes" -> tagTypes.map(JsTagType),
      "postsByPageId" -> postsByPageIdJson)
  }

}



object JsonMaker {

  /** If there are more than this many visible replies, we'll summarize the page, otherwise
    * it'll take a bit long to render in the browser, especially on mobiles.
    */
  private val SummarizeNumRepliesVisibleLimit = 65

  /** If we're summarizing a page, we'll show the first replies to each comment non-summarized.
    * But the rest will be summarized.
    */
  private val SummarizeSiblingIndexLimit = 7

  private val SummarizeAllDepthLimit = 5

  /** If we're summarizing a page, we'll squash the last replies to a comment into one
    * single "Click to show more comments..." html elem.
    */
  private val SquashSiblingIndexLimit = 12

  /** Like a tweet :-)  */
  private val PostSummaryLength = 140

  /** Posts shorter than this won't be summarized if they're one single paragraph only,
    * because the "Click to show..." text would then make the summarized post as large
    * as the non-summarized version.
    */
  private val SummarizePostLengthLimit: Int =
    PostSummaryLength + 80 // one line is roughly 80 chars


  private def makeSettingsVisibleClientSideJson(settings: EffectiveSettings,
        customIdps: Seq[IdentityProvider], globals: Globals): JsObject = {
    // Only include settings that differ from the default.

    var json = if (settings.useOnlyCustomIdps) JsEmptyObj else Json.obj(
      // The defaults depend on if these login methods are defined in the config files,
      // so need to always include, client side (client side, default values = unknown).
      "enableGoogleLogin" -> settings.enableGoogleLogin,
      "enableFacebookLogin" -> settings.enableFacebookLogin,
      "enableTwitterLogin" -> settings.enableTwitterLogin,
      "enableGitHubLogin" -> settings.enableGitHubLogin,
      "enableGitLabLogin" -> settings.enableGitLabLogin,
      "enableLinkedInLogin" -> settings.enableLinkedInLogin,
      "enableVkLogin" -> settings.enableVkLogin,
      "enableInstagramLogin" -> settings.enableInstagramLogin)

    if (customIdps.nonEmpty && settings.enableCustomIdps) {
      json += "customIdps" -> JsArray(customIdps map JsIdentityProviderPubFields)
    }

    val D = AllSettings.makeDefault(globals)
    if (settings.termsOfUseUrl != D.termsOfUseUrl)
      json += "termsOfUseUrl" -> JsString(settings.termsOfUseUrl)
    if (settings.privacyUrl != D.privacyUrl)
      json += "privacyUrl" -> JsString(settings.privacyUrl)
    if (settings.languageCode != D.languageCode)
      json += "languageCode" -> JsString(settings.languageCode)
    if (settings.inviteOnly != D.inviteOnly)
      json += "inviteOnly" -> JsBoolean(settings.inviteOnly)
    if (settings.allowSignup != D.allowSignup)
      json += "allowSignup" -> JsBoolean(settings.allowSignup)
    if (settings.enableCustomIdps != D.enableCustomIdps)
      json += "enableCustomIdps" -> JsBoolean(settings.enableCustomIdps)
    if (settings.useOnlyCustomIdps != D.useOnlyCustomIdps)
      json += "useOnlyCustomIdps" -> JsBoolean(settings.useOnlyCustomIdps)
    if (settings.allowLocalSignup != D.allowLocalSignup)
      json += "allowLocalSignup" -> JsBoolean(settings.allowLocalSignup)
    if (settings.isGuestLoginAllowed != D.allowGuestLogin)
      json += "allowGuestLogin" -> JsBoolean(settings.isGuestLoginAllowed)
    if (settings.requireVerifiedEmail != D.requireVerifiedEmail)
      json += "requireVerifiedEmail" -> JsBoolean(settings.requireVerifiedEmail)
    if (settings.mayComposeBeforeSignup != D.mayComposeBeforeSignup)
      json += "mayComposeBeforeSignup" -> JsBoolean(settings.mayComposeBeforeSignup)
    if (settings.mayPostBeforeEmailVerified != D.mayPostBeforeEmailVerified)
      json += "mayPostBeforeEmailVerified" -> JsBoolean(settings.mayPostBeforeEmailVerified)
    if (settings.doubleTypeEmailAddress != D.doubleTypeEmailAddress)
      json += "doubleTypeEmailAddress" -> JsBoolean(settings.doubleTypeEmailAddress)
    if (settings.doubleTypePassword != D.doubleTypePassword)
      json += "doubleTypePassword" -> JsBoolean(settings.doubleTypePassword)
    if (settings.minPasswordLength != AllSettings.MinPasswordLengthHardcodedDefault)
      json += "minPasswordLength" -> JsNumber(settings.minPasswordLength)
    if (settings.begForEmailAddress != D.begForEmailAddress)
      json += "begForEmailAddress" -> JsBoolean(settings.begForEmailAddress)
    if (settings.ssoUrl.nonEmpty)
      json += "ssoUrl" -> JsString(settings.ssoUrl)
    if (settings.ssoUrl.nonEmpty && settings.enableSso)
      json += "enableSso" -> JsTrue
    if (settings.effSsoLogoutFromTyRedirUrlIfAuthnReq.nonEmpty ||
        settings.effSsoLogoutAllRedirUrl.nonEmpty)
      json += "ssoWillRedirAfterLogout" -> JsTrue
    if (settings.ssoShowEmbAuthnBtns != D.ssoShowEmbAuthnBtns)
      json += "ssoShowEmbAuthnBtns" -> JsNumber(settings.ssoShowEmbAuthnBtns)
    if (settings.rememberEmbSess != D.rememberEmbSess)
      json += "rememberEmbSess" -> JsBoolean(settings.rememberEmbSess)
    if (settings.enableApi != D.enableApi)
      json += "enableApi" -> JsBoolean(settings.enableApi)
    if (settings.enableForum != D.enableForum)
      json += "enableForum" -> JsBoolean(settings.enableForum)
    if (settings.enableTags != D.enableTags)
      json += "enableTags" -> JsBoolean(settings.enableTags)
    if (settings.enableChat != D.enableChat)
      json += "enableChat" -> JsBoolean(settings.enableChat)
    if (settings.enableDirectMessages != D.enableDirectMessages)
      json += "enableDirectMessages" -> JsBoolean(settings.enableDirectMessages)
    if (settings.enableAnonSens != D.enableAnonSens)
      json += "enableAnonSens" -> JsBoolean(settings.enableAnonSens)
    if (settings.enablePresence != D.enablePresence)
      json += "enablePresence" -> JsBoolean(settings.enablePresence)
    if (settings.enableSimilarTopics != D.enableSimilarTopics)
      json += "enableSimilarTopics" -> JsBoolean(settings.enableSimilarTopics)
    if (settings.showSubCommunities != D.showSubCommunities)
      json += "showSubCommunities" -> JsBoolean(settings.showSubCommunities)
    if (settings.showExperimental != D.showExperimental)
      json += "showExperimental" -> JsBoolean(settings.showExperimental)
    if (settings.navConf != D.navConf)
      json += "navConf" -> settings.navConf
    if (settings.forumMainView != D.forumMainView)
      json += "forumMainView" -> JsString(settings.forumMainView)
    if (settings.forumTopicsSortButtons != D.forumTopicsSortButtons)
      json += "forumTopicsSortButtons" -> JsString(settings.forumTopicsSortButtons)
    if (settings.forumCategoryLinks != D.forumCategoryLinks)
      json += "forumCategoryLinks" -> JsString(settings.forumCategoryLinks)
    if (settings.forumTopicsLayout != D.forumTopicsLayout)
      json += "forumTopicsLayout" -> JsNumber(settings.forumTopicsLayout.toInt)
    if (settings.forumCategoriesLayout != D.forumCategoriesLayout)
      json += "forumCategoriesLayout" -> JsNumber(settings.forumCategoriesLayout.toInt)
    if (settings.showCategories != D.showCategories)
      json += "showCategories" -> JsBoolean(settings.showCategories)
    if (settings.showTopicFilterButton != D.showTopicFilterButton)
      json += "showTopicFilterButton" -> JsBoolean(settings.showTopicFilterButton)
    if (settings.showTopicTypes != D.showTopicTypes)
      json += "showTopicTypes" -> JsBoolean(settings.showTopicTypes)
    if (settings.selectTopicType != D.selectTopicType)
      json += "selectTopicType" -> JsBoolean(settings.selectTopicType)
    if (settings.showAuthorHow != D.showAuthorHow)
      json += "showAuthorHow" -> JsNumber(settings.showAuthorHow.toInt)
    if (settings.watchbarStartsOpen != D.watchbarStartsOpen)
      json += "watchbarStartsOpen" -> JsBoolean(settings.watchbarStartsOpen)
    // --- These and some more, could be in separate objs instead [DBLINHERIT]
    // Because they'll be configurable per page type. And per category (and page?
    // for Dev Diary pages / light weight by-time announcements topics,
    // instead of announcement categories with separate topics)
    //  Like the permission system.
    if (settings.discussionLayout != D.discussionLayout)
      json += "discussionLayout" -> JsNumber(settings.discussionLayout.toInt)
    if (settings.discPostNesting != D.discPostNesting)
      json += "discPostNesting" -> JsNumber(settings.discPostNesting)
    if (settings.discPostSortOrder != D.discPostSortOrder)
      json += "discPostSortOrder" -> JsNumber(settings.discPostSortOrder.toInt)
    if (settings.progressLayout != D.progressLayout)
      json += "progressLayout" -> JsNumber(settings.progressLayout.toInt)
    if (settings.embComSortOrder != D.embComSortOrder)
      json += "embComSortOrder" -> JsNumber(settings.embComSortOrder.toInt)
    if (settings.embComNesting != D.embComNesting)
      json += "embComNesting" -> JsNumber(settings.embComNesting)
    if (settings.origPostReplyBtnTitle != D.origPostReplyBtnTitle)
      json += "origPostReplyBtnTitle" -> JsString(settings.origPostReplyBtnTitle)

    // ----Not needed here? Are incl in per page json already: -----
    if (settings.origPostVotes != D.origPostVotes)
      json += "origPostVotes" -> JsNumber(settings.origPostVotes.toInt)
    if (settings.enableDisagreeVote != D.enableDisagreeVote)
      json += "enableDisagreeVote" -> JsBoolean(settings.enableDisagreeVote)
    // -------------------------------------------------------------
    // -----------------------------------------------------------------------

    json
  }


  /** Returns the URL path, category id and title for a forum or category.  [6FK02QFV]
    */
  private def makeForumOrCategoryJson(forumPath: PagePath, category: Category): JsObject = {
    val forumPathSlash = forumPath.value.endsWith("/") ? forumPath.value | forumPath.value + "/"
    val latestOrTop = category.doItVotesEnabled ? "top" | "latest"  // [anc_cat_path]
    val (name, path) =
      if (category.isRoot)
        ("Home", s"$forumPathSlash$latestOrTop")   // I18N
      else
        (category.name, s"$forumPathSlash$latestOrTop/${category.slug}")
    var result = Json.obj( // ts: Ancestor
          "categoryId" -> category.id,
          "title" -> name,
          "path" -> path)
    if (category.doItVotesEnabled) {
      result += "doItVotesPopFirst" -> JsTrue
    }
    if (category.unlistCategory) {
      result += "unlistCategory" -> JsTrue
    }
    if (category.unlistTopics) {
      result += "unlistTopics" -> JsTrue
    }
    if (category.isDeleted) {
      result += "isDeleted" -> JsTrue
    }
    result
  }


  /** Returns (tags-result, source-without-tags).
    */
  private def findHeadTags(postSource: String): FindHeadTagsResult = {
    if (postSource.trim.isEmpty)
      return FindHeadTagsResult.None

    val doc = Jsoup.parse(postSource)
    val head = doc.head()
    val resultBuilder = StringBuilder.newBuilder
    var includesTitleTag = false
    var includesDescription = false

    import scala.collection.JavaConverters._

    val anyTitleTag: Opt[jsoup_Element] =
          head.getElementsByTag("title").asScala.headOption
    anyTitleTag foreach { titleTag =>
      for (attribute: jsoup_Attribute <- titleTag.attributes().asScala) {
        titleTag.removeAttr(attribute.getKey)
      }
      resultBuilder append titleTag.toString append "\n"
      includesTitleTag = true
    }

    // Could break out fn, these 3 blocks are similar:

    val metaTags: MutBuf[jsoup_Element] = head.getElementsByTag("meta").asScala
    for (metaTag: jsoup_Element <- metaTags) {
      // Remove all attrs except for name, content, and proptype (used by Facebook Open Graph).
      val attributes: Iterable[jsoup_Attribute] = metaTag.attributes().asScala
      for (attribute: jsoup_Attribute <- attributes) {
        attribute.getKey match {
          case "property" | "content" => // fine
          case "name" => // fine
            if (attribute.getValue == "description")
              includesDescription = true
          case notAllowedAttr => metaTag.removeAttr(notAllowedAttr)
        }
      }
      resultBuilder append metaTag.toString append "\n"
    }

    val linkTags: MutBuf[jsoup_Element] = head.getElementsByTag("link").asScala
    for (linkTag: jsoup_Element <- linkTags) {
      val attributes: Iterable[jsoup_Attribute] = linkTag.attributes().asScala
      for (attribute: jsoup_Attribute <- attributes) {
        attribute.getKey match {
          case "rel" | "href" => // fine
          case notAllowedAttr => linkTag.removeAttr(notAllowedAttr)
        }
      }
      resultBuilder append linkTag.toString append "\n"
    }

    // Only allow  type="application/ld+json"  which is some structured data description of the
    // website.
    val scriptTags: MutBuf[jsoup_Element] = head.getElementsByTag("script").asScala
    for (scriptTag: jsoup_Element <- scriptTags) {
      val attributes: jl.Iterable[jsoup_Attribute] = scriptTag.attributes()
      var foundLdJson = false
      var foundAnythingElse = false
      for (attribute: jsoup_Attribute <- attributes.asScala) {
        attribute.getKey match {
          case "type" =>
            if (attribute.getValue == "application/ld+json") foundLdJson = true
            else foundAnythingElse = true
          case _ =>
            foundAnythingElse = true
        }
      }
      if (foundLdJson && !foundAnythingElse) {
        resultBuilder append scriptTag.toString append "\n"
      }
    }

    val allHeadTags = resultBuilder.toString

    // COULD allow only-admin to edit <style> tags too. Don't let anyone else do that though,
    // because: clickjacking.

    // For now, allow no one but admins, to edit any head tags at all. [2GKW0M]
    // Other people may edit only Title and meta keywords?
    val adminOnlyHeadTags = allHeadTags
    FindHeadTagsResult(
      includesTitleTag = includesTitleTag,
      includesDescription = includesDescription,
      allHeadTags,
      adminOnlyHeadTags)
  }


  case class NotfsAndCounts(
    numTalkToMe: Int,
    numTalkToOthers: Int,
    numOther: Int,
    thereAreMoreUnseen: Boolean,
    notfsJson: JsArray)


  def loadNotificationsToShowInMyMenu(userId: UserId, tx: SiteTransaction, unseenFirst: Boolean,
        limit: Int, skipDeleted: Boolean, upToWhen: Option[ju.Date] = None): NotfsAndCounts = {
    val notfs = tx.loadNotificationsToShowInMyMenu(
      userId, limit, unseenFirst, skipDeleted = skipDeleted, upToWhen)
    notificationsToJson(notfs, tx)
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
      case notf: Notification.NewPost if notf.tyype.isAboutReviewTask =>
        // No. These aren't shown in the notifications list. Instead, one looks at the
        // review tasks, on the /-/admin/review page. And, next to one's username menu,
        // there's a red circle that shows num pending review tasks.
        die("TyE2AKBES04", s"Shouldn't send review task notfs to the browser. Tried to send: $notf")
      case notf: Notification.NewPost =>
        userIds.append(notf.byUserId)
        import NotificationType._
        if (notf.seenAt.isEmpty) notf.tyype match {
          case DirectReply | Mention | Message | Assigned | Unassigned | OneLikeVote =>
            UX // Later, give Like votes their own happy looking color? [like_notf_ico]
            // And if there're no direct replies / messages / mentions, then,
            // show that color instead of the more urgent direct-reply-blue?
            numTalkToMe += 1
          case NewPost | IndirectReply | AssigneesChanged =>
            numTalkToOthers += 1
          case PostTagged =>
            numOther += 1
        }
      case _ => ()
    }

    // Unseen notfs are sorted first, so if the last one is unseen, there might be more unseen.
    val thereAreMoreUnseen = notfs.lastOption.exists(_.seenAt.isEmpty)

    val usersById = transaction.loadParticipantsAsMap(userIds)

    NotfsAndCounts(
      numTalkToMe = numTalkToMe,
      numTalkToOthers = numTalkToOthers,
      numOther = numOther,
      thereAreMoreUnseen = thereAreMoreUnseen,
      notfsJson = JsArray(notfs.flatMap(
        makeNotificationsJson(_, pageTitlesById, postsById, usersById))))
  }


  private def makeNotificationsJson(notf: Notification, pageTitlesById: Map[PageId, String],
        postsById: Map[PostId, Post], usersById: Map[UserId, Participant]): Option[JsObject] = {
    // Related code, for site patches: JsNotf [305RKDAP25]
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
          "byUser" -> JsUser(usersById.getOrElse(notf.byUserId, UnknownParticipant)),
          "seen" -> notf.seenAt.nonEmpty)
    })
  }


  /** Returns (voter json, voter ids).
    */
  private def mkVotesJson(reqrId: PatId, pageId: PageId, tx: SiteTx)
          : (JsObject, mut.Set[PatId]) = {
    // Currently one always loads one's own votes.
    val actions = tx.loadActionsByUserOnPage(reqrId = reqrId, userId = reqrId, pageId)
    // COULD load flags too, at least if user is staff [7KW20WY1]

    val votes: imm.Seq[PostVote] =
          actions.filter(_.isInstanceOf[PostVote]).asInstanceOf[imm.Seq[PostVote]]
    val votesByPostNr: Map[St, imm.Seq[PostVote]] = votes.groupBy(v => v.postNr.toString)

    val voterIds = mut.Set[PatId]()

    val votesJsonByNr: Map[St, JsArray] = votesByPostNr mapValues { votes =>
      JsArray(votes map { v =>
        voterIds.add(v.voterId.pubId)
        var jOb = Json.obj(  // Could create JsX.JsVote  ?
          "type" -> v.voteType.toInt,
          "byId" -> v.voterId.pubId,
          // Later: If some day one has a fixed number of Do-It votes,  (not impl)
          // then, instead of including X Do-It votes,  incl just one,
          // with howMany = X.
          // "howMany" -> v.howMany,  // or "value" instead?
          )
        // ---- Not needed, but nice if troubleshooting -------
        if (v.voterId.anyTrueId is reqrId) {
          jOb += "byTrueId_dbg" -> JsNumber(v.voterId.anyTrueId.getOrDie("TyE2602RKJ"))
        }
        if (v.voterId.anyTrueId.isDefined) {
          jOb += "isAnon_dbg" -> JsTrue
        }
        // ----------------------------------------------------
        jOb
      })
    }

    (JsObject(votesJsonByNr.toSeq), voterIds)
  }


  def permsOnPagesToJson(permsOnPages: Seq[PermsOnPages], excludeEveryone: Boolean): JsArray = {
    val perms =
      if (excludeEveryone) permsOnPages.filter(_.forPeopleId != Group.EveryoneId)
      else permsOnPages
    JsArray(perms.map(permissionToJson))
  }


  def permissionToJson(permsOnPages: PermsOnPages): JsObject = {
    var json = Json.obj(
      "id" -> permsOnPages.id,
      "forPeopleId" -> permsOnPages.forPeopleId)

    if (permsOnPages.onWholeSite.isDefined)
      json += "onWholeSite" -> JsBooleanOrNull(permsOnPages.onWholeSite)

    if (permsOnPages.onCategoryId.isDefined)
      json += "onCategoryId" -> JsNumberOrNull(permsOnPages.onCategoryId)

    if (permsOnPages.onPageId.isDefined)
      json += "onPageId" -> JsStringOrNull(permsOnPages.onPageId)

    if (permsOnPages.onPostId.isDefined)
      json += "onPostId" -> JsNumberOrNull(permsOnPages.onPostId)

    // later: "onTagId" -> JsNumberOrNull(permsOnPages.onTagId),

    if (permsOnPages.mayEditPage.isDefined)
      json += "mayEditPage" -> JsBooleanOrNull(permsOnPages.mayEditPage)

    if (permsOnPages.mayEditComment.isDefined)
      json += "mayEditComment" -> JsBooleanOrNull(permsOnPages.mayEditComment)

    if (permsOnPages.mayEditWiki.isDefined)
      json += "mayEditWiki" -> JsBooleanOrNull(permsOnPages.mayEditWiki)

    if (permsOnPages.mayEditOwn.isDefined)
      json += "mayEditOwn" -> JsBooleanOrNull(permsOnPages.mayEditOwn)

    if (permsOnPages.mayDeletePage.isDefined)
      json += "mayDeletePage" -> JsBooleanOrNull(permsOnPages.mayDeletePage)

    if (permsOnPages.mayDeleteComment.isDefined)
      json += "mayDeleteComment" -> JsBooleanOrNull(permsOnPages.mayDeleteComment)

    if (permsOnPages.mayCreatePage.isDefined)
      json += "mayCreatePage" -> JsBooleanOrNull(permsOnPages.mayCreatePage)

    if (permsOnPages.mayPostComment.isDefined)
      json += "mayPostComment" -> JsBooleanOrNull(permsOnPages.mayPostComment)

    if (permsOnPages.maySee.isDefined)
      json += "maySee" -> JsBooleanOrNull(permsOnPages.maySee)

    if (permsOnPages.maySeeOwn.isDefined)
      json += "maySeeOwn" -> JsBooleanOrNull(permsOnPages.maySeeOwn)

    json
  }


  def makeReadingProgressJson(readingProgress: PageReadingProgress): JsValue = {
    Json.obj(
      "lastViewedPostNr" -> readingProgress.lastViewedPostNr,
      // When including these, remove [5WKW219].
      "lastPostNrsReadRecentFirstBase64" -> "",
      "lowPostNrsReadBase64" -> "")
  }


  private def makeCategoriesJsonNoDbAccess(sectCats: CatsCanSee,
          recentTopicsJson: Opt[Seq[JsObject]]): JsArray = {
    JsArray(sectCats.catStuffsExclRoot map { categoryStuff =>
      makeCategoryJson(categoryStuff, sectCats.rootCategory, topicsInTreeJson = recentTopicsJson)
    })
  }


  def makeCategoryJson(categoryStuff: CategoryStuff, rootCategory: Cat,
        topicsInTreeJson: Opt[Seq[JsObject]], includeDetails: Bo = false): JsObject = {
    val category = categoryStuff.category
    COULD_OPTIMIZE; SAVE_BANDWIDTH // Exclude all zero (0)
    var json = Json.obj(
      "id" -> category.id,
      "parentId" -> JsNumberOrNull(category.parentId),
      "name" -> category.name,
      "slug" -> category.slug,
      // [refactor] [5YKW294] There should be only one default type.
      "defaultTopicType" -> JsNumber(
          category.newTopicTypes.headOption.getOrElse(PageType.Discussion).toInt),
      // [refactor] [5YKW294] delete this later:
      "newTopicTypes" -> JsArray(category.newTopicTypes.map(t => JsNumber(t.toInt))),
      "comtOrder" -> JsNum32OrNull(category.comtOrder.map(_.toInt)),
      "comtNesting" -> JsNum32OrNull(category.comtNesting),
      "comtsStartHidden" -> JsNum32OrNull(category.comtsStartHidden.map(_.toInt)),
      "comtsStartAnon" -> JsNum32OrNull(category.comtsStartAnon.map(_.toInt)),
      "opStartsAnon" -> JsNum32OrNull(category.opStartsAnon.map(_.toInt)),
      "newAnonStatus" -> JsNum32OrNull(category.newAnonStatus.map(_.toInt)),
      // For now, this cannot be configured in any more detail. [do_it_on_off]
      "doItVotesPopFirst" -> JsBoolOrNull(category.doVoteStyle.map(_ => true)),
      "unlistCategory" -> JsBoolean(category.unlistCategory),
      "unlistTopics" -> JsBoolean(category.unlistTopics),
      "includeInSummaries" -> JsNumber(category.includeInSummaries.toInt),
      "position" -> category.position,
      "description" -> JsStringOrNull(category.description), // [502RKDJWF5] repl w categoryStuff.descriptionBriefPlainText
      "thumbnailUrl" -> JsStringOrNull(categoryStuff.anyThumbnails.headOption))
    topicsInTreeJson foreach {
      json += "recentTopics" -> JsArray(_)  // RENAME to topicsInTree
    }
    if (rootCategory.defaultSubCatId is category.id) {
      json += "isDefaultCategory" -> JsTrue  // REMOVE do client side instead? SiteSectino.defaultCategoryId
    }
    if (category.isDeleted) {
      json += "isDeleted" -> JsTrue
    }
    if (includeDetails) {
      json += "sectionPageId" -> JsString(category.sectionPageId)
      // Needed if editing the category in the edit-category dialog:
      if (category.extImpId.isDefined) {
        json += "extId" -> JsString(category.extImpId.get)
      }
    }
    json
  }


  def reviewStufToJson(stuff: ReviewStuff): JsValue = {
    // Related code: JsReviewTask [073SMDR26]
    val anyPost = stuff.post match {
      case None => JsNull
      case Some(post) =>
        Json.obj(  // typescript interface PostToReview
          "pageId" -> post.pageId,
          "nr" -> post.nr,
          "uniqueId" -> post.id,
          "createdById" -> post.createdById,
          "currentSource" -> post.currentSource,
          "currRevNr" -> post.currentRevisionNr,
          "currRevComposedById" -> post.currentRevisionById,
          "approvedSource" -> JsStringOrNull(post.approvedSource),
          "approvedHtmlSanitized" -> JsStringOrNull(post.approvedHtmlSanitized),
          "approvedRevNr" -> JsNumberOrNull(post.approvedRevisionNr),
          "lastApprovedEditById" -> JsNumberOrNull(post.lastApprovedEditById),
          "lastApprovedById" -> JsNull,
          "bodyHiddenAtMs" -> JsDateMsOrNull(post.bodyHiddenAt),
          "bodyHiddenById" -> JsNumberOrNull(post.bodyHiddenById),
          "bodyHiddenReason" -> JsStringOrNull(post.bodyHiddenReason),
          "deletedAtMs" -> JsDateMsOrNull(post.deletedAt),
          "deletedById" -> JsNumberOrNull(post.deletedById),
          "numLikeVotes" -> JsNumber(post.numLikeVotes),
          "numWrongVotes" -> JsNumber(post.numWrongVotes),
          "numBuryVotes" -> JsNumber(post.numBuryVotes),
          "numUnwantedVotes" -> JsNumber(post.numUnwantedVotes))
    }
    Json.obj(  // typescript interface ReviewTask
      "id" -> stuff.id,
      "reasonsLong" -> ReviewReason.toLong(stuff.reasons),
      "createdAtMs" -> stuff.createdAt.getTime,
      "createdById" -> stuff.createdBy.id,
      "moreReasonsAtMs" -> JsDateMsOrNull(stuff.moreReasonsAt),
      "completedAtMs" -> JsDateMsOrNull(stuff.completedAt),
      "decidedById" -> JsNumberOrNull(stuff.decidedBy.map(_.id)),
      "invalidatedAtMs" -> JsDateMsOrNull(stuff.invalidatedAt),
      "decidedAtMs" -> JsWhenMsOrNull(stuff.decidedAt),
      "decision" -> JsNumberOrNull(stuff.decision.map(_.toInt)),
      "pageId" -> JsStringOrNull(stuff.pageId),
      "pageTitle" -> JsStringOrNull(stuff.pageTitle),
      "post" -> anyPost,
      "flags" -> stuff.flags.map(JsFlag))
  }


  private def postToJsonNoDbAccess(post: Post, showHidden: Bo, includeUnapproved: Bo,
          tagsAndBadges: TagsAndBadges, howRender: HowRenderPostInPage,
          renderer: RendererWithSettings): JsObject = {

    val (
      anySanitizedHtml: Option[String],
      unsafeSource: Option[String],
      isApproved: Boolean,
    ) = {
      if ((post.isBodyHidden || post.isDeleted) && !showHidden) {
        (None, post.approvedSource, post.approvedAt.isDefined)
      }
      else if (includeUnapproved) {
        SHOULD_OPTIMIZE // Don't render CommonMark in a db tx!
        // Later: Save sanitized html in the post always. [html_json] [nashorn_in_tx]
        val htmlString = renderer.renderAndSanitize(post, IfCached.Use)
        (Some(htmlString), Some(post.currentSource), post.isCurrentVersionApproved)
      }
      else {
        (post.approvedHtmlSanitized, post.approvedSource, post.approvedAt.isDefined)
      }
    }

    SHOULD // Don't show who the author is, until post approved (or if is
    // staff, or own post — then ok to know who the author is).
    val authorId = post.createdById
    /* Wait with this — the Unknown User is apparently not available browser side.
          if (isApproved || includeUnapproved) post.createdById
          else UnknownUserId
    */

    // For now, ignore ninja edits of the very first revision, because otherwise if
    // clicking to view the edit history, it'll be empty.
    val lastApprovedEditAtNoNinja =
      if (post.approvedRevisionNr.contains(FirstRevisionNr)) None
      else post.lastApprovedEditAt

    val postTags: Seq[Tag] = tagsAndBadges.tags(post.id)

    COULD_OPTIMIZE; SAVE_BANDWIDTH // Exclude all zero (0) fields? E.g. 0 like votes.
    // And use an ArrayBuffer instead of a Vector.
    // [post_to_json]
    var fields = Vector(
      "uniqueId" -> JsNumber(post.id),
      "nr" -> JsNumber(post.nr),
      "parentNr" -> post.parentNr.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostNrs" -> JsArray(post.multireplyPostNrs.toSeq.map(JsNumber(_))),
      "postType" -> JsNumber(post.tyype.toInt),
      "authorId" -> JsNumber(authorId),
      "createdAtMs" -> JsDateMs(post.createdAt),
      "approvedAtMs" -> JsDateMsOrNull(post.approvedAt),
      "lastApprovedEditAtMs" -> JsDateMsOrNull(lastApprovedEditAtNoNinja),
      "numEditors" -> JsNumber(post.numDistinctEditors),
      "numLikeVotes" -> JsNumber(post.numLikeVotes),
      "numWrongVotes" -> JsNumber(post.numWrongVotes),
      "numBuryVotes" -> JsNumber(post.numBuryVotes),
      "numUnwantedVotes" -> JsNumber(post.numUnwantedVotes),
      "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions),
      "summarize" -> JsBoolean(howRender.summarize),
      "summary" -> howRender.jsSummary,
      "squash" -> JsBoolean(howRender.squash),
      "isTreeDeleted" -> JsBoolean(post.deletedStatus.isTreeDeleted),
      "isPostDeleted" -> JsBoolean(post.deletedStatus.isPostDeleted),
      "isTreeCollapsed" -> (
        if (howRender.summarize) JsString("Truncated")
        else JsBoolean(!howRender.squash && post.collapsedStatus.isTreeCollapsed)),
      "isPostCollapsed" -> JsBoolean(
          !howRender.summarize && !howRender.squash && post.collapsedStatus.isPostCollapsed),
      "isTreeClosed" -> JsBoolean(post.closedStatus.isTreeClosed),
      "isApproved" -> JsBoolean(isApproved),
      "pinnedPosition" -> JsNumberOrNull(post.pinnedPosition),
      "branchSideways" -> JsNumberOrNull(post.branchSideways.map(_.toInt)),
      "likeScore" -> JsNumber(decimal(post.likeScore)),
      "childNrsSorted" -> JsArray( // [derive_client_side_instead]?  [bookmarks_filtered_out]
            howRender.childrenSorted.flatMap(reply =>
                if (reply.tyype == PostType.Bookmark) None else Some(JsNumber(reply.nr)))),
      "sanitizedHtml" -> JsStringOrNull(anySanitizedHtml),
      "pubTags" -> JsArray(postTags map JsTag),
      )

    if (howRender.childrenSorted.exists(_.tyype == PostType.Bookmark))
      fields :+= "bookmarkNrs" ->  // [derive_client_side_instead]?  [bookmarks_filtered_out]
            JsArray(howRender.childrenSorted.flatMap(reply =>
                  if (reply.tyype != PostType.Bookmark) None
                  else Some(JsNumber(reply.nr))))

    if (post.isBodyHidden)
      fields :+= "isBodyHidden" -> JsTrue

    if (!isApproved) {
      // Then need to know which revision nr we'll approve, if clicking
      // the Approve button. [in_pg_apr]
      fields :+= "currRevNr" -> JsNumber(post.currentRevisionNr)
      // Nice for troubleshooting?
      fields :+= "approvedRevNr" -> JsNumberOrNull(post.approvedRevisionNr)
    }

    if (renderer.inclPageId)
      fields :+= "pageId" -> JsString(post.pageId)

    // For now. So can edit the title without extra loading the title post's source. [5S02MR4]
    // Bookmarks use the current source  [dont_format_bookmarks],  need not be approved
    // (others can't see them).
    if (post.isTitle || post.tyype == PostType.Bookmark)
      fields :+= "unsafeSource" -> JsStringOrNull(unsafeSource)

    // Later: Don't incl any private members. [private_pats]
    if (post.authorIds.nonEmpty)
      fields :+= "authorIds" -> JsArray(post.authorIds.map(JsNumber(_)))

    // Also check permissions — may one see who's assigned? [can_see_assigned]
    // And if one may see these people at all. [private_pats]
    if (post.assigneeIds.nonEmpty)
      fields :+= "assigneeIds" -> JsArray(post.assigneeIds.map(JsNumber(_)))

    JsObject(fields)
  }


  def postRevisionToJson(revision: PostRevision, usersById: Map[UserId, Participant],
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
  def embeddedCommentsDummyRootPost(parentlessReplyNrsSorted: imm.Seq[JsNumber]): JsObject = {
    val badNrs = parentlessReplyNrsSorted.filter(_.value < PageParts.MinPublicNr)
    dieIf(badNrs.nonEmpty,  // [bookmarks_filtered_out]
          "TyEPRIVCOMTNR", s"Non-public nr among dummy root reply nrs: $badNrs")

    Json.obj(
      "nr" -> JsNumber(PageParts.BodyNr),
      "isApproved" -> JsTrue,
      // COULD link to embedding article, change text to: "Discussion of the text at https://...."
      "sanitizedHtml" -> JsString("(Embedded comments dummy root post [EdM2PWKV06]"),
      "childNrsSorted" -> parentlessReplyNrsSorted)
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

    val nodeVisitor = new NodeVisitor() {
      override def head(node: Node, depth: Int): Unit = {
        node match {
          case textNode: TextNode =>
            if (!firstLineOnly || isInFirstParagraph) {
              // I think there can be newlines in a text node? When a browser renders html, they
              // are ignored (unless maybe inside sth like a <pre> tag) — so remove them here too
              // (don't care about <pre>, for now).
              val textMaybeNewlines = textNode.getWholeText
              val text = CollapseSpacesRegex.replaceAllIn(textMaybeNewlines, " ")
              result.append(text)
            }
          case _ => ()
        }
      }

      override def tail(node: Node, depth: Int): Unit = {
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
    }

    val jsoupDoc = Jsoup.parse(htmlText)
    try NodeTraversor.traverse(nodeVisitor, jsoupDoc.body)
    catch {
      case _: ControlThrowable => () // thrown above
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
  def findImageUrls(htmlText: String): imm.Seq[String] = {
    findImageUrlsImpl(Jsoup.parse(htmlText))
  }


  // Move to new classs ed.server.util.HtmlUtils? [5WK9GP6FUQ]
  def findImageUrlsImpl(jsoupDoc: org.jsoup.nodes.Document): imm.Seq[String] = {
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
    import collection.JavaConverters._
    for (elem <- imageElems.asScala) {
      imageUrls :+= elem.attr("src")
    }
    imageUrls
  }


  def makeCatsAndTagsPatch(catsJsArr: JsArray, tagTypes: ImmSeq[TagType],
        appVersion: St): JsObject = {
    // We haven't checked which cats are public and which are access restricted,
    // so just include all in the restrictedCategories list.
    makeStorePatch(Json.obj(
        "publicCategories" -> JsArray(Nil), // to enter an if [upd_store_cats_hack]
        "restrictedCategories" -> catsJsArr,
        "allTagTypes" -> JsArray(tagTypes map JsX.JsTagType)), appVersion)
  }


  def makeStorePatch(json: JsObject, appVersion: String): JsObject = {
    // Better wrap the store patch in a { storePatch: ... } field? Then, lower bug
    // risk, when client side code knows what's in and outside the patch.
    // Later: Json.obj("storePatch" -> json, "appVersion" -> ...)  [storepatch_field]
    json + ("appVersion" -> JsString(appVersion))
  }

}



