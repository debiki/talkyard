/**
 * Copyright (C) 2013-2017 Kaj Magnus Lindberg
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

package controllers

import debiki.dao._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import debiki.JsonUtils.parseOptInt32
import talkyard.server.http._
import play.api.libs.json._
import play.api.mvc._
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import ForumController._
import talkyard.server.JsX._


/** Handles requests related to forums and forum categories.
 */
class ForumController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  def createForum: Action[JsValue] = AdminPostJsonAction(maxBytes = 500) { request =>
    import request.body

    val title = (body \ "title").as[String]
    val folder = (body \ "folder").as[String]
    val useCategories = (body \ "useCategories").as[Boolean]

    val no = if (!useCategories) Some(false) else None
    val createSupportCategory = no getOrElse (body \ "createSupportCategory").as[Boolean]
    val createIdeasCategory = no getOrElse (body \ "createIdeasCategory").as[Boolean]

    val createSampleTopics = (body \ "createSampleTopics").as[Boolean]

    val topicListStyleInt = (body \ "topicListStyle").as[Int]
    val topicListStyle = TopicListLayout.fromInt(topicListStyleInt) getOrElse throwBadRequest(
      "TyE5JKSEW2", "Bad topic list layout number")

    val options = CreateForumOptions(
      isForEmbeddedComments = false,
      title = title,
      folder = folder,
      useCategories = useCategories,
      createSupportCategory = createSupportCategory,  // [NODEFCATS]
      createIdeasCategory = createIdeasCategory,
      createSampleTopics = createSampleTopics,
      topicListStyle = topicListStyle)

    request.dao.createForum2(options, request.who)
    Ok
  }


  def listForums: Action[Unit] = GetAction { request =>
    import request.dao
    SECURITY // Later, not now: Set permissions on site sections, load only those the requester may see.
    val rootCats = dao.getRootCategories()
    val sectionPageIds = rootCats.map(_.sectionPageId)
    val pageStuffById = dao.getPageStuffById(sectionPageIds)
    val forumJsObjs: Seq[JsObject] = for {
      rootCat <- rootCats
      pageId = rootCat.sectionPageId
      // (We're not in a transaction, the page might just have been deleted.)
      pageStuff: PageStuff <- pageStuffById.get(pageId)
      if pageStuff.pageRole == PageType.Forum
      pagePath: PagePath <- dao.getPagePath(pageId)
    } yield {
      // Return model.ts: interface Forum.
      Json.obj(
        "pageId" -> pageId,
        "path" -> pagePath.value,
        "title" -> pageStuff.title,
        "description" -> pageStuff.bodyExcerpt,
        "defaultCategoryId" -> JsNumberOrNull(rootCat.defaultSubCatId),
        "rootCategoryId" -> rootCat.id)
    }
    OkSafeJson(Json.obj("forums" -> JsArray(forumJsObjs)))
  }


  def loadCategoryToEdit(categoryId: CategoryId): Action[Unit] = AdminGetAction { request =>
    import request.dao
    val (catStuff, rootCat) = dao.getTheCategoryStuffAndRootSkipChilds(categoryId)
    val catJson = categoryToJson(
          catStuff, rootCat, topicsInTree = None, pageStuffById = Map.empty, includeDetails = true)
    val (allPerms, groups) = dao.readOnlyTransaction { tx =>
      (tx.loadPermsOnPages(), tx.loadAllGroupsAsSeq())
    }
    val catPerms = allPerms.filter(_.onCategoryId.contains(categoryId))
          // Better sort, otherwise listed in random order, client side. [SORTCATPERMS]
          .sortBy(_.id)

    OkSafeJson(Json.obj(  // Typescript: LoadCategoryResponse
      "category" -> catJson,
      "permissions" -> catPerms.map(JsonMaker.permissionToJson),
      "groups" -> groups.map(JsGroup)))
  }


  def saveCategory: Action[JsValue] = AdminPostJsonAction(maxBytes = 5000) { request =>
    BUG // fairly harmless in this case: The lost update bug.

    import request.{dao, body, requester}
    val categoryJson = (body \ "category").as[JsObject]
    val catJo = categoryJson ; RENAME // to catJo
    val permissionsJson = (body \ "permissions").as[JsArray]

    val sectionPageId = (categoryJson \ "sectionPageId").as[PageId]
    val unlistCategory = (categoryJson \ "unlistCategory").asOpt[Boolean] is true
    val unlistTopics = (categoryJson \ "unlistTopics").asOpt[Boolean] is true
    val includeInSummariesInt = (categoryJson \ "includeInSummaries").asOpt[Int]
    val includeInSummaries = includeInSummariesInt.flatMap(IncludeInSummaries.fromInt)
        .getOrElse(IncludeInSummaries.Default)
    val defaultTopicTypeInt = (categoryJson \ "defaultTopicType").as[Int]
    val defaultTopicType = PageType.fromInt(defaultTopicTypeInt) getOrElse throwBadReq(
        "DwE7KUP3", s"Bad new topic type int: $defaultTopicTypeInt")

    // For now, do-it-votes just on or off:  [do_it_on_off]
    val doItVotesPopFirst = (categoryJson \ "doItVotesPopFirst").asOpt[Bo] getOrElse false

    // Dupl code, will remove after [add_nodes_t].
    val anyComtOrder = PostSortOrder.fromOptVal(parseOptInt32(categoryJson, "comtOrder"))
    val anyComtNesting = None // later: parseOptInt32("comtNesting").map(x => x.map(_.toShort)) ?

    val repliesStartHidden = NeverAlways.fromOptInt(parseOptInt32(catJo, "comtsStartHidden"))
    val repliesStartAnon = NeverAlways.fromOptInt(parseOptInt32(catJo, "comtsStartAnon"))
    val opStartsAnon = NeverAlways.fromOptInt(parseOptInt32(catJo, "opStartsAnon"))
    val newAnonStatus = AnonStatus.fromOptInt(parseOptInt32(catJo, "newAnonStatus"))

    val shallBeDefaultCategory = (categoryJson \ "isDefaultCategory").asOpt[Boolean] is true
    val categoryId = (categoryJson \ "id").as[Int]
    if (categoryId == NoCategoryId)
      throwBadRequest("EdE5PJB2L", s"Bad category id: $NoCategoryId")

    val extId = (categoryJson \  "extId").asOptStringNoneIfBlank

    val categoryData = try CategoryToSave(
      anyId = Some(categoryId),
      extId = extId,
      sectionPageId = sectionPageId,
      parentId = (categoryJson \ "parentId").as[CategoryId],
      name = (categoryJson \ "name").as[String],
      slug = (categoryJson \ "slug").as[String].toLowerCase,
      description = CategoriesDao.CategoryDescriptionSource,
      position = (categoryJson \ "position").as[Int],
      newTopicTypes = List(defaultTopicType),
      defaultSortOrder =
            if (!doItVotesPopFirst) None
            else Some(PageOrderOffset.ByScoreAndBumpTime(
                  offset = None, TopTopicsPeriod.Year)),
      comtOrder = anyComtOrder,
      comtNesting = anyComtNesting,
      comtsStartHidden = repliesStartHidden,
      comtsStartAnon = repliesStartAnon,
      opStartsAnon = opStartsAnon,
      newAnonStatus = newAnonStatus,
      doVoteStyle =
            if (!doItVotesPopFirst) None
            else Some(DoVoteStyle.Likes),
      doVoteInTopicList =
            if (!doItVotesPopFirst) None
            else Some(true),
      shallBeDefaultCategory = shallBeDefaultCategory,
      unlistCategory = unlistCategory,
      unlistTopics = unlistTopics,
      includeInSummaries = includeInSummaries)
    catch {
      case ex: IllegalArgumentException =>
        throwBadRequest("TyEBADCATTOSAV", ex.getMessage)
    }

    val permissions = ArrayBuffer[PermsOnPages]()
    permissionsJson.value foreach { permsJsValue: JsValue =>
      val permsJsObj: JsObject = permsJsValue match {
        case obj: JsObject => obj
        case bad => throwBadRequest("EdE2W4UY0", s"Bad permission list entry: ${classNameOf(bad)}")
      }

      val onCategoryId: Option[CategoryId] = (permsJsObj \ "onCategoryId").asOpt[Int]
      if (onCategoryId isNot categoryId)
        throwBadRequest("EdE6UWK02", o"""A permission's onCategoryId = $onCategoryId is different
          from the category's id = $categoryId""")

      CLEAN_UP  // Dupl code [dupl_parse_perms_on_pgs]
      throwForbiddenIf(onCategoryId.isEmpty, "EdE6PJ0S2", "No onCategoryId specified")
      val newPerm = PermsOnPages(
        id = (permsJsObj \ "id").as[PermissionId],
        forPeopleId = (permsJsObj \ "forPeopleId").as[UserId],
        onWholeSite = None,
        onCategoryId = onCategoryId,
        onPageId = None,
        onPostId = None,
        onTagId = None,
        mayEditPage = (permsJsObj \ "mayEditPage").asOpt[Boolean],
        mayEditComment = (permsJsObj \ "mayEditComment").asOpt[Boolean],
        mayEditWiki = (permsJsObj \ "mayEditWiki").asOpt[Boolean],
        mayEditOwn = (permsJsObj \ "mayEditOwn").asOpt[Boolean],
        mayDeletePage = (permsJsObj \ "mayDeletePage").asOpt[Boolean],
        mayDeleteComment = (permsJsObj \ "mayDeleteComment").asOpt[Boolean],
        mayCreatePage = (permsJsObj \ "mayCreatePage").asOpt[Boolean],
        mayPostComment = (permsJsObj \ "mayPostComment").asOpt[Boolean],
        maySee = (permsJsObj \ "maySee").asOpt[Boolean],
        maySeeOwn = (permsJsObj \ "maySeeOwn").asOpt[Boolean])
      permissions.append(newPerm)
    }

    val (category, permsWithIds) =
      if (categoryData.isNewCategory) {
        val result = request.dao.createCategory(
          categoryData, permissions.to[immutable.Seq], request.who, IfBadAbortReq)
        (result.category, result.permissionsWithIds)
      }
      else {
        val editedCategory = request.dao.editCategory(
          categoryData, permissions.to[immutable.Seq], request.who)
        (editedCategory, permissions)
      }

    val callersGroupIds = request.authzContext.groupIdsUserIdFirst
    val callersNewPerms = permsWithIds.filter(callersGroupIds contains _.forPeopleId)

    var json = dao.jsonMaker.makeCatsPatchExclTopics(
          category.id, dao.getForumAuthzContext(requester))

    json += "myNewPermissions" -> JsArray(callersNewPerms map JsonMaker.permissionToJson)
    json += "newCategoryId" -> JsNumber(category.id)
    json += "newCategorySlug" -> JsString(category.slug)

    OkSafeJson(json)  // Typescript: SaveCategoryResponse
  }


  def deleteCategory: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    deleteUndeleteCategory(request, delete = true)
  }


  def undeleteCategory: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    deleteUndeleteCategory(request, delete = false)
  }


  private def deleteUndeleteCategory(request: JsonPostRequest, delete: Boolean): Result = {
    import request.{dao, requester}
    val categoryId = (request.body \ "categoryId").as[CategoryId]
    request.dao.deleteUndeleteCategory(categoryId, delete = delete, request.who)
    val patch = dao.jsonMaker.makeCatsPatchExclTopics(
          categoryId, dao.getForumAuthzContext(requester))
    OkSafeJson(patch)
  }


  /** Later, I'll add about user pages? About tag? So category-id is optional, might
    * be user-id or tag-id instead.
    */
  def redirectToAboutPage(categoryId: Option[CategoryId]): Action[Unit] = AdminGetAction { request =>
    val pageId =
      categoryId map { id =>
        request.dao.getAboutCategoryPageId(id) getOrElse {
          throwNotFound("EsE5GK2F7", s"No about page found for category $categoryId")
        }
      } getOrElse {
        throwBadRequest("EsE7KPE0", "No category id")
      }
    throwTemporaryRedirect("/-" + pageId)
  }


  def listTopics(categoryId: CatId): Action[U] = GetAction { request =>
    // Tests:
    //  - category-perms.2br.d

    import request.{dao, requester}
    val authzCtx = dao.getForumAuthzContext(requester)
    var pageQuery: PageQuery = request.parseThePageQuery()
    throwForbiddenIf(pageQuery.pageFilter.includeDeleted && !request.isStaff, "EdE5FKZX2",
      "Only staff can list deleted pages")

    // If category deleted, load deleted topics too. Otherwise rather confusing, if one
    // navigates to the deleted category, and sees its name, but no topics.
    val showDeletedTopicsAnyway = dao.getCategory(categoryId) exists { category =>
      category.isDeleted
    }
    if (showDeletedTopicsAnyway) {
      pageQuery = pageQuery.copy(pageFilter = pageQuery.pageFilter.copy(includeDeleted = true))
    }

    val anyCatsCanSee: Opt[CatsCanSee] =
          dao.listMaySeeCategoriesInSameSectionAs(
              categoryId, authzCtx, inclDeleted = pageQuery.pageFilter.includeDeleted)

    val catsCanSee = anyCatsCanSee getOrElse {
      throwOkJson(
            noTopicsJson())
    }

    val pagesCanSee: PagesCanSee =
          dao.listPagesCanSeeInCatsCanSee(
              catsCanSee, pageQuery, inclPinned = true,
              limit = NumTopicsToList, inSubTree = Some(categoryId))

    makeTopicsResponse(pagesCanSee.pages, dao)
  }


  /** Doesn't include per category recent topics.
    */
  // Break out to [CatsAndTagsController]?
  def listCategoriesAllSections(): Action[Unit] = GetActionRateLimited() { request =>
    // Tested here: TyT5WKB2QR0
    val jsArr = loadCatsJsArrayMaySee(request)
    OkSafeJson(Json.obj("catsAllSects" -> jsArr))
  }


  /** Includes the per category most recently active topics. [per_cat_topics]
    */
  def listCategoriesAndTopics(forumId: PageId): Action[Unit] = GetAction { request =>
    // Tests:
    //  - category-perms.2br.d

    import request.{dao, requester}
    val authzCtx = dao.getForumAuthzContext(requester)

    UX // Would be nice if this was configurable? If one could choose to show e.g.
    // Trending topics per category?  But for now, recently-active (bump time) first.
    // [cats_topics_order]
    val pageQuery = PageQuery(
          PageOrderOffset.ByBumpTime(None), request.parsePageFilter(),
          includeAboutCategoryPages = false)

    val catsInSection = dao.listMaySeeCategoriesInSection(
          forumId, inclDeleted = pageQuery.pageFilter.includeDeleted, authzCtx) getOrElse {
      throwOkJson(Json.obj("catsWithTopics" -> JsArray()))
    }

    val catsAndTopics = dao.jsonMaker.makeForumPageCatsAndTopicsJson(catsInSection, pageQuery)

    OkSafeJson(Json.obj("catsWithTopics" -> catsAndTopics.catsAndTopicsJson))
  }
}


object ForumController {

  /** Keep synced with client/forum/list-topics/ListTopicsController.NumNewTopicsPerRequest. */
  val NumTopicsToList = 40

  val NumTopicsToListPerCat = 6

  def loadCatsJsArrayMaySee(request: GetRequest): JsArray = {
    import request.{dao, requester}
    val authzCtx = dao.getForumAuthzContext(requester)
    val sectCats: Seq[CatsCanSee] =
          request.dao.listMaySeeCategoryStuffAllSections(inclDeleted = false, authzCtx)
    val rootCats = sectCats.map(_.rootCategory)
    val catsNotRoot = sectCats.flatMap(_.catStuffsExclRoot)
    val jsArr = JsArray(catsNotRoot.map({ catStuff: CategoryStuff =>
      val category = catStuff.category
      val rootCat = rootCats.find(_.sectionPageId == category.sectionPageId).getOrDie(
        "TyE305RMGH5", s"No root cat with matching sect page id, for category $category")
      categoryToJson(catStuff, rootCat, topicsInTree = None, pageStuffById = Map.empty)
    }))
    jsArr
  }


  MOVE // next to JsonMaker.makeCategoryJson in ReactJson.scala?
  def categoryToJson(categoryStuff: CategoryStuff, rootCategory: Cat,  // [JsObj]
        topicsInTree: Opt[Seq[PagePathAndMeta]], pageStuffById: Map[PageId, PageStuff],
        includeDetails: Bo = false)
        : JsObject = {
    require(topicsInTree.forall(_.isEmpty) || pageStuffById.nonEmpty, "DwE8QKU2")
    val topicsInTreeJson: Opt[Seq[JsObject]] = topicsInTree map { topics =>
      val topicsNoAboutCategoryPage = topics.filter(_.pageType != PageType.AboutCategory)
      topicsNoAboutCategoryPage.map(topicToJson(_, pageStuffById))
    }
    JsonMaker.makeCategoryJson(
        categoryStuff, rootCategory, topicsInTreeJson, includeDetails = includeDetails)
  }


  // Vaguely similar code: ThingsFoundJson.makePagesFoundResponseImpl()  [406RKD2JB]
  //
  def makeTopicsResponse(topics: Seq[PagePathAndMeta], dao: SiteDao): Result = {
    val pageStuffById = dao.getPageStuffById(topics.map(_.pageId))
    val pageStuffList: Iterable[PageStuff] = pageStuffById.values

    val users = dao.getUsersAsSeq(pageStuffList.flatMap(_.userIds).toSet)

    // In the topic list, we show only post tags (not author badges),
    // so we don't need any pat tags (user badges).

    val tagTypeIds = pageStuffList.flatMap(_.pageTags.map(_.tagTypeId))
    val tagTypes = dao.getTagTypes(tagTypeIds.toSet)

    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_, pageStuffById))
    val json = Json.obj(   // ts: LoadTopicsResponse
      "topics" -> topicsJson,
      "storePatch" -> Json.obj(
        "tagTypes" -> JsArray(tagTypes map JsTagType),
        "usersBrief" -> users.map(JsPatNameAvatar)))
    OkSafeJson(json)
  }


  def noTopicsJson(): JsObject = {
    Json.obj(   // ts: LoadTopicsResponse
      "topics" -> JsArray(),
      "storePatch" -> Json.obj())
  }


  // Vaguely similar code: ThingsFoundJson.JsPageFound()  [4026RKCN2]
  //
  def topicToJson(topic: PagePathAndMeta, pageStuffById: Map[PageId, PageStuff]): JsObject = {
    val topicStuff = pageStuffById.get(topic.pageId) getOrDie "DwE1F2I7"
    topicToJsonImpl(topic.meta, topicStuff, topic.path.value)
  }


  def topicStuffToJson(topicStuff: PageStuff, urlPath: String): JsObject = {
    topicToJsonImpl(topicStuff.pageMeta, topicStuff, urlPath)
  }


  private def topicToJsonImpl(page: PageMeta, topicStuff: PageStuff, urlPath: String)
        : JsObject = {
    // Try to remove 'page' or topicStuff.pageMeta? Don't need both.
    dieIf(Globals.isDevOrTest && page != topicStuff.pageMeta, "TyE305DRJ24")

    Json.obj(
      "pageId" -> page.pageId,
      "pageRole" -> page.pageType.toInt,
      // If a person may know a certain unapproved topic exists, it's ok to show
      // its title (for that person).
      "title" -> topicStuff.titleMaybeUnapproved,
      "url" -> urlPath,
      // Private chats & formal messages might not belong to any category.
      "categoryId" -> JsNumberOrNull(page.categoryId),
      "pubTags" -> JsArray(topicStuff.pageTags map JsTag),
      "pinOrder" -> JsNumberOrNull(page.pinOrder),
      "pinWhere" -> JsNumberOrNull(page.pinWhere.map(_.toInt)),
      "excerpt" -> JsStringOrNull(topicStuff.bodyExcerpt),
      "firstImageUrls" -> JsArray(topicStuff.bodyImageUrls.map(JsString)),
      "popularRepliesImageUrls" -> JsArray(topicStuff.popularRepliesImageUrls.map(JsString)),
      "numPosts" -> JsNumber(page.numRepliesVisible + 1),
      "numLikes" -> page.numLikes,
      "numWrongs" -> page.numWrongs,
      "numBurys" -> page.numBurys,
      "numUnwanteds" -> page.numUnwanteds,
      "numOrigPostDoItVotes" -> page.numOrigPostDoItVotes,
      "numOrigPostDoNotVotes" -> page.numOrigPostDoNotVotes,
      "numOrigPostLikes" -> page.numOrigPostLikeVotes,
      "numOrigPostReplies" -> page.numOrigPostRepliesVisible,
      "authorId" -> JsNumber(page.authorId),
      "createdAtMs" -> JsDateMs(page.createdAt),
      "bumpedAtMs" -> JsDateMsOrNull(page.bumpedAt),
      "lastReplyAtMs" -> JsDateMsOrNull(page.lastApprovedReplyAt),
      "lastReplyerId" -> JsNumberOrNull(topicStuff.lastReplyerId),
      "frequentPosterIds" -> JsArray(topicStuff.frequentPosterIds.map(JsNumber(_))),
      "answeredAtMs" -> dateOrNull(page.answeredAt),
      "answerPostUniqueId" -> JsNumberOrNull(page.answerPostId),
      "plannedAtMs" -> dateOrNull(page.plannedAt),
      "startedAtMs" -> dateOrNull(page.startedAt),
      "doneAtMs" -> dateOrNull(page.doneAt),
      "closedAtMs" -> dateOrNull(page.closedAt),
      "lockedAtMs" -> dateOrNull(page.lockedAt),
      "frozenAtMs" -> dateOrNull(page.frozenAt),
      "hiddenAtMs" -> JsWhenMsOrNull(page.hiddenAt),
      "deletedAtMs" -> JsDateMsOrNull(page.deletedAt))
      // Could incl deletedById but only if requester is staff?
  }

}

