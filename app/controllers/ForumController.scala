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
import ed.server.http._
import play.api.libs.json._
import play.api.mvc._
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import scala.util.Try
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import ForumController._
import talkyard.server.JsX._


/** Handles requests related to forums and forum categories.
 */
class ForumController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


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

    request.dao.createForum(options, request.who)
    Ok
  }


  def listForums: Action[Unit] = GetAction { request =>
    import request.dao
    SECURITY // Later, not now: Set permissions on site sections, load only those the requester may see.
    val sectionPageIds = dao.getSectionPageIdsAsSeq()
    val pageStuffById = dao.getPageStuffById(sectionPageIds)
    val forumJsObjs = for {
      pageId <- sectionPageIds
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
        "description" -> pageStuff.bodyExcerpt)
    }
    OkSafeJson(JsArray(forumJsObjs))
  }


  def loadCategoryToEdit(categoryId: CategoryId): Action[Unit] = AdminGetAction { request =>
    import request.dao
    val (category, isDefault) = dao.getTheCategoryAndIsDefault(categoryId)
    val catJson = categoryToJson(category, isDefault, recentTopics = Nil, pageStuffById = Map.empty)
    val (allPerms, groups) = dao.readOnlyTransaction { tx =>
      (tx.loadPermsOnPages(), tx.loadAllGroupsAsSeq())
    }
    val catPerms = allPerms.filter(_.onCategoryId.contains(categoryId))
    OkSafeJson(Json.obj(  // Typescript: LoadCategoryResponse
      "category" -> catJson,
      "permissions" -> catPerms.map(JsonMaker.permissionToJson),
      "groups" -> groups.map(JsGroup)))
  }


  def saveCategory: Action[JsValue] = AdminPostJsonAction(maxBytes = 1000) { request =>
    BUG // fairly harmless in this case: The lost update bug.
    import request.{dao, body, requester}
    val categoryJson = (body \ "category").as[JsObject]
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

    val shallBeDefaultCategory = (categoryJson \ "isDefaultCategory").asOpt[Boolean] is true
    val categoryId = (categoryJson \ "id").as[Int]
    if (categoryId == NoCategoryId)
      throwBadRequest("EdE5PJB2L", s"Bad category id: $NoCategoryId")

    val categoryData = CategoryToSave(
      anyId = Some(categoryId),
      sectionPageId = sectionPageId,
      parentId = (categoryJson \ "parentId").as[CategoryId],
      name = (categoryJson \ "name").as[String],
      slug = (categoryJson \ "slug").as[String].toLowerCase,
      description = CategoriesDao.CategoryDescriptionSource,
      position = (categoryJson \ "position").as[Int],
      newTopicTypes = List(defaultTopicType),
      shallBeDefaultCategory = shallBeDefaultCategory,
      unlistCategory = unlistCategory,
      unlistTopics = unlistTopics,
      includeInSummaries = includeInSummaries)

    import Category._

    if (categoryData.name.isEmpty)
      throwBadRequest("EsE5JGKU1", s"Please type a category name")

    if (categoryData.name.length > MaxNameLength)
      throwBadRequest("EsE8RSUY0", s"Too long category name: '${categoryData.name}'")

    if (categoryData.slug.isEmpty)
      throwBadRequest("EsE4PKL6", s"Please type a category slug")

    if (categoryData.slug.length > MaxSlugLength)
      throwBadRequest("EsE9MFU4", s"Too long category slug: '${categoryData.slug}'")

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
          categoryData, permissions.to[immutable.Seq], request.who)
        (result.category, result.permissionsWithIds)
      }
      else {
        val editedCategory = request.dao.editCategory(
          categoryData, permissions.to[immutable.Seq], request.who)
        (editedCategory, permissions)
      }

    val callersGroupIds = request.authzContext.groupIdsUserIdFirst
    val callersNewPerms = permsWithIds.filter(callersGroupIds contains _.forPeopleId)
    val mkJson = dao.jsonMaker.makeCategoriesJson _

    OkSafeJson(Json.obj(
      // 2 dupl lines [7UXAI1]
      "publicCategories" -> mkJson(category.id, dao.getForumPublicAuthzContext()),
      "restrictedCategories" -> mkJson(category.id, dao.getForumAuthzContext(requester)),
      "myNewPermissions" -> JsArray(callersNewPerms map JsonMaker.permissionToJson),
      "newCategoryId" -> category.id,
      "newCategorySlug" -> category.slug))
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
    val patch = dao.jsonMaker.makeCategoriesStorePatch(
      categoryId, dao.getForumAuthzContext(requester))
    OkSafeJson(patch)
  }


  /** Later, I'll add about user pages? About tag? So category-id is optional, might
    * be user-id or tag-id instead.
    */
  def redirectToAboutPage(categoryId: Option[CategoryId]): Action[Unit] = AdminGetAction { request =>
    val pageId =
      categoryId map { id =>
        request.dao.loadAboutCategoryPageId(id) getOrElse {
          throwNotFound("EsE5GK2F7", s"No about page found for category $categoryId")
        }
      } getOrElse {
        throwBadRequest("EsE7KPE0", "No category id")
      }
    throwTemporaryRedirect("/-" + pageId)
  }


  def listTopics(categoryId: Int): Action[Unit] = GetAction { request =>
    SECURITY; TESTS_MISSING  // securified
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

    val topics = dao.listMaySeeTopicsInclPinned(categoryId, pageQuery,
      includeDescendantCategories = true, authzCtx, limit = NumTopicsToList)

    makeTopicsResponse(Some(categoryId), topics, dao)
  }


  def listCategoriesAllSections(): Action[Unit] = GetActionRateLimited() { request =>
    // Tested here: TyT5WKB2QR0
    import request.{dao, requester}
    val authzCtx = dao.getForumAuthzContext(requester)
    val sectionCategoriesList =
      request.dao.listMaySeeCategoriesAllSections(includeDeleted = false, authzCtx)
    val allCategories = sectionCategoriesList.flatMap(_.categories)
    val defaultCategoryIds = sectionCategoriesList.map(_.defaultCategoryId).toSet
    val json = JsArray(allCategories.map({ category =>
      categoryToJson(category, defaultCategoryIds.contains(category.id), recentTopics = Nil,
          pageStuffById = Map.empty)
    }))
    OkSafeJson(json)
  }


  def listCategoriesAndTopics(forumId: PageId): Action[Unit] = GetAction { request =>
    TESTS_MISSING
    import request.{dao, requester}
    val authzCtx = dao.getForumAuthzContext(requester)

    val pageQuery = PageQuery(
      PageOrderOffset.ByBumpTime(None), request.parsePageFilter(), includeAboutCategoryPages = false)

    val SectionCategories(_, categories, defaultCategoryId) = dao.listMaySeeCategoriesInSection(
        forumId, includeDeleted = pageQuery.pageFilter.includeDeleted, authzCtx) getOrElse {
      throwOkSafeJson(JsArray())
    }

    val recentTopicsByCategoryId =
      mutable.Map[CategoryId, Seq[PagePathAndMeta]]()

    val pageIds = ArrayBuffer[PageId]()

    for (category <- categories) {
      val recentTopics = dao.listMaySeeTopicsInclPinned(category.id, pageQuery,
        includeDescendantCategories = true, authzCtx, limit = 6)
      recentTopicsByCategoryId(category.id) = recentTopics
      pageIds.append(recentTopics.map(_.pageId): _*)
    }

    val pageStuffById: Map[PageId, debiki.dao.PageStuff] =
      dao.getPageStuffById(pageIds)

    val json = JsArray(categories.map({ category =>
      categoryToJson(category, category.id == defaultCategoryId,
          recentTopicsByCategoryId(category.id), pageStuffById)
    }))

    OkSafeJson(json)
  }
}


object ForumController {

  /** Keep synced with client/forum/list-topics/ListTopicsController.NumNewTopicsPerRequest. */
  val NumTopicsToList = 40


  private def categoryToJson(category: Category, isDefault: Boolean,  // [JsObj]
        recentTopics: Seq[PagePathAndMeta], pageStuffById: Map[PageId, debiki.dao.PageStuff])
        : JsObject = {
    require(recentTopics.isEmpty || pageStuffById.nonEmpty, "DwE8QKU2")
    val topicsNoAboutCategoryPage = recentTopics.filter(_.pageType != PageType.AboutCategory)
    val recentTopicsJson = topicsNoAboutCategoryPage.map(topicToJson(_, pageStuffById))
    JsonMaker.makeCategoryJson(category, isDefault, recentTopicsJson)
  }


  def makeTopicsResponse(categoryId: Option[CategoryId], topics: Seq[PagePathAndMeta], dao: SiteDao): Result = {
    val category: Option[Category] = categoryId.flatMap(dao.getCategory)
    val pageStuffById = dao.getPageStuffById(topics.map(_.pageId))
    val users = dao.getUsersAsSeq(pageStuffById.values.flatMap(_.userIds))
    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_, pageStuffById))
    val json = Json.obj(   // LoadTopicsResponse
      "categoryId" -> JsNumberOrNull(categoryId),
      "categoryParentId" -> JsNumberOrNull(category.flatMap(_.parentId)),
      "topics" -> topicsJson,
      "users" -> users.map(JsUser))
    OkSafeJson(json)
  }


  def topicToJson(topic: PagePathAndMeta, pageStuffById: Map[PageId, PageStuff]): JsObject = {
    val topicStuff = pageStuffById.get(topic.pageId) getOrDie "DwE1F2I7"
    Json.obj(
      "pageId" -> topic.id,
      "pageRole" -> topic.pageType.toInt,
      "title" -> topicStuff.title,
      "url" -> topic.path.value,
      // Private chats & formal messages might not belong to any category.
      "categoryId" -> JsNumberOrNull(topic.categoryId),
      "pinOrder" -> JsNumberOrNull(topic.meta.pinOrder),
      "pinWhere" -> JsNumberOrNull(topic.meta.pinWhere.map(_.toInt)),
      "excerpt" -> JsStringOrNull(topicStuff.bodyExcerpt),
      "firstImageUrls" -> JsArray(topicStuff.bodyImageUrls.map(JsString)),
      "popularRepliesImageUrls" -> JsArray(topicStuff.popularRepliesImageUrls.map(JsString)),
      "numPosts" -> JsNumber(topic.meta.numRepliesVisible + 1),
      "numLikes" -> topic.meta.numLikes,
      "numWrongs" -> topic.meta.numWrongs,
      "numBurys" -> topic.meta.numBurys,
      "numUnwanteds" -> topic.meta.numUnwanteds,
      "numOrigPostLikes" -> topic.meta.numOrigPostLikeVotes,
      "numOrigPostReplies" -> topic.meta.numOrigPostRepliesVisible,
      "authorId" -> JsNumber(topic.meta.authorId),
      "createdAtMs" -> JsDateMs(topic.meta.createdAt),
      "bumpedAtMs" -> JsDateMsOrNull(topic.meta.bumpedAt),
      "lastReplyAtMs" -> JsDateMsOrNull(topic.meta.lastApprovedReplyAt),
      "lastReplyerId" -> JsNumberOrNull(topicStuff.lastReplyerId),
      "frequentPosterIds" -> JsArray(topicStuff.frequentPosterIds.map(JsNumber(_))),
      "answeredAtMs" -> dateOrNull(topic.meta.answeredAt),
      "answerPostUniqueId" -> JsNumberOrNull(topic.meta.answerPostId),
      "plannedAtMs" -> dateOrNull(topic.meta.plannedAt),
      "startedAtMs" -> dateOrNull(topic.meta.startedAt),
      "doneAtMs" -> dateOrNull(topic.meta.doneAt),
      "closedAtMs" -> dateOrNull(topic.meta.closedAt),
      "lockedAtMs" -> dateOrNull(topic.meta.lockedAt),
      "frozenAtMs" -> dateOrNull(topic.meta.frozenAt),
      "hiddenAtMs" -> JsWhenMsOrNull(topic.meta.hiddenAt),
      "deletedAtMs" -> JsDateMsOrNull(topic.meta.deletedAt))
  }

}

