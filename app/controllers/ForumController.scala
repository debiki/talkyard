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

import debiki.dao.{CategoriesDao, CategoryToSave, PageStuff, SiteDao}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.ReactJson._
import ed.server.http._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc._
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import scala.util.Try
import Utils.ValidationImplicits._
import DebikiHttp.{throwBadReq, throwBadRequest, throwNotFound}


/** Handles requests related to forums and forum categories.
 */
object ForumController extends mvc.Controller {

  /** Keep synced with client/forum/list-topics/ListTopicsController.NumNewTopicsPerRequest. */
  val NumTopicsToList = 40


  def createForum: Action[JsValue] = AdminPostJsonAction(maxBytes = 200) { request =>
    val title = (request.body \ "title").as[String]
    val folder = (request.body \ "folder").as[String]
    val pagePath = request.dao.createForum(title, folder = folder, request.who).pagePath
    OkSafeJson(JsString(pagePath.value))
  }


  def loadCategory(id: String): Action[Unit] = AdminGetAction { request =>
    import request.dao
    val categoryId = Try(id.toInt) getOrElse throwBadRequest("DwE6PU1", "Invalid category id")
    val (category, isDefault) = dao.loadTheCategory(categoryId)
    val catJson = categoryToJson(category, isDefault, recentTopics = Nil, pageStuffById = Map.empty)
    val (allPerms, groups) = dao.readOnlyTransaction { tx =>
      (tx.loadPermsOnPages(), tx.loadGroupsAsSeq())
    }
    val catPerms = allPerms.filter(_.onCategoryId.contains(categoryId))
    OkSafeJson(Json.obj(
      "category" -> catJson,
      "permissions" -> catPerms.map(permissionToJson),
      "groups" -> groups.map(groupToJson)))
  }


  def saveCategory: Action[JsValue] = AdminPostJsonAction(maxBytes = 1000) { request =>
    BUG // fairly harmless in this case: The lost update bug.
    val body = request.body
    val categoryJson = (body \ "category").as[JsObject]
    val permissionsJson = (body \ "permissions").as[JsArray]

    val sectionPageId = (categoryJson \ "sectionPageId").as[PageId]
    val unlisted = (categoryJson \ "unlisted").asOpt[Boolean].getOrElse(false)
    // --delete: ----
    val staffOnly = (categoryJson \ "staffOnly").asOpt[Boolean].getOrElse(false)
    val onlyStaffMayCreateTopics = (categoryJson \ "onlyStaffMayCreateTopics").asOpt[Boolean].getOrElse(false)
    // --/delete------
    val defaultTopicTypeInt = (categoryJson \ "defaultTopicType").as[Int]
    val defaultTopicType = PageRole.fromInt(defaultTopicTypeInt) getOrElse throwBadReq(
        "DwE7KUP3", s"Bad new topic type int: $defaultTopicTypeInt")

    val shallBeDefaultCategory = (categoryJson \ "isDefaultCategory").as[Boolean]
    val anyId = (categoryJson \ "id").as[Int] match {
      case NoCategoryId => None
      case x => Some(x)
    }

    val categoryData = CategoryToSave(
      anyId = anyId,
      sectionPageId = sectionPageId,
      parentId = (categoryJson \ "parentCategoryId").as[CategoryId],
      name = (categoryJson \ "name").as[String],
      slug = (categoryJson \ "slug").as[String],
      description = CategoriesDao.CategoryDescriptionSource,
      position = (categoryJson \ "position").as[Int],
      newTopicTypes = List(defaultTopicType),
      shallBeDefaultCategory = shallBeDefaultCategory,
      unlisted = unlisted,
      staffOnly = staffOnly,
      onlyStaffMayCreateTopics = onlyStaffMayCreateTopics)

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
        mayDeletePage = (permsJsObj \ "mayDeletePage").asOpt[Boolean],
        mayDeleteComment = (permsJsObj \ "mayDeleteComment").asOpt[Boolean],
        mayCreatePage = (permsJsObj \ "mayCreatePage").asOpt[Boolean],
        mayPostComment = (permsJsObj \ "mayPostComment").asOpt[Boolean],
        maySee = (permsJsObj \ "maySee").asOpt[Boolean])
      permissions.append(newPerm)
    }

    val category = categoryData.anyId match {
      case Some(_) =>
        request.dao.editCategory(categoryData, permissions.to[immutable.Seq], request.who)
      case None =>
        request.dao.createCategory(categoryData, permissions.to[immutable.Seq], request.who)._1
    }

    // ... save permissions ...  and alloc new id if perm id < 0 [9P1U6E5].

    OkSafeJson(Json.obj(
      "allCategories" -> ReactJson.makeCategoriesJson(
        isStaff = true, restrictedOnly = false, request.dao),
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
    val categoryId = (request.body \ "categoryId").as[CategoryId]
    request.dao.deleteUndeleteCategory(categoryId, delete = delete, request.who)
    val patch = ReactJson.makeCategoriesStorePatch(
      isStaff = true, restrictedOnly = false, request.dao)
    OkSafeJson(patch)
  }


  /** Later, I'll add about user pages? About tag? So category-id is optional, might
    * be user-id or tag-id instead.
    */
  def redirectToAboutPage(categoryId: Option[CategoryId]) = AdminGetAction { request =>
    val pageId =
      categoryId map { id =>
        request.dao.loadAboutCategoryPageId(id) getOrElse {
          throwNotFound("EsE5GK2F7", s"No about page found for category $categoryId")
        }
      } getOrElse {
        throwBadRequest("EsE7KPE0", "No category id")
      }
    DebikiHttp.throwTemporaryRedirect("/-" + pageId)
  }


  def listTopics(categoryId: Int) = GetAction { request =>
    val pageQuery: PageQuery = parseThePageQuery(request)
    throwForbiddenIf(pageQuery.pageFilter.includesDeleted && !request.isStaff, "EdE5FKZX2",
      "Only staff can list deleted pages")
    val topics = listTopicsInclPinned(categoryId, pageQuery, request.dao,
      includeDescendantCategories = true, isStaff = request.isStaff, restrictedOnly = false)
    makeTopicsResponse(topics, request.dao)
  }


  def listTopicsByUser(userId: UserId) = GetAction { request =>
    val caller = request.user
    val isStaffOrSelf = caller.exists(_.isStaff) || caller.exists(_.id == userId)
    val topicsInclForbidden = request.dao.loadPagesByUser(
      userId, isStaffOrSelf = isStaffOrSelf, limit = 200)
    val topics = topicsInclForbidden filter { page: PagePathAndMeta =>
      request.dao.maySeePageUseCache(page.meta, caller, maySeeUnlisted = isStaffOrSelf)._1
    }
    makeTopicsResponse(topics, request.dao)
  }


  private def makeTopicsResponse(topics: Seq[PagePathAndMeta], dao: SiteDao): Result = {
    val pageStuffById = dao.getPageStuffById(topics.map(_.pageId))
    val users = dao.getUsersAsSeq(pageStuffById.values.flatMap(_.userIds))
    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_, pageStuffById))
    val json = Json.obj(
      "topics" -> topicsJson,
      "users" -> users.map(JsUser))
    OkSafeJson(json)
  }


  def listCategories(forumId: PageId) = GetAction { request =>
    unused("EsE4KFC02")
    val (categories, defaultCategoryId) = request.dao.listSectionCategories(forumId,
      isStaff = request.isStaff, restrictedOnly = false)
    val json = JsArray(categories.map({ category =>
      categoryToJson(category, category.id == defaultCategoryId, recentTopics = Nil,
          pageStuffById = Map.empty)
    }))
    OkSafeJson(json)
  }


  def listCategoriesAndTopics(forumId: PageId) = GetAction { request =>
    val (categories, defaultCategoryId) = request.dao.listSectionCategories(forumId,
      isStaff = request.isStaff, restrictedOnly = false)

    val recentTopicsByCategoryId =
      mutable.Map[CategoryId, Seq[PagePathAndMeta]]()

    val pageIds = ArrayBuffer[PageId]()
    val pageQuery = PageQuery(PageOrderOffset.ByBumpTime(None), parsePageFilter(request))

    for (category <- categories) {
      val recentTopics = listTopicsInclPinned(category.id, pageQuery, request.dao,
        includeDescendantCategories = true, isStaff = request.isStaff, restrictedOnly = false,
        limit = 6)
      recentTopicsByCategoryId(category.id) = recentTopics
      pageIds.append(recentTopics.map(_.pageId): _*)
    }

    val pageStuffById: Map[PageId, debiki.dao.PageStuff] =
      request.dao.getPageStuffById(pageIds)

    val json = JsArray(categories.map({ category =>
      categoryToJson(category, category.id == defaultCategoryId,
          recentTopicsByCategoryId(category.id), pageStuffById)
    }))

    OkSafeJson(json)
  }


  def listTopicsInclPinned(categoryId: CategoryId, pageQuery: PageQuery, dao: debiki.dao.SiteDao,
        includeDescendantCategories: Boolean, isStaff: Boolean, restrictedOnly: Boolean,
        limit: Int = NumTopicsToList)
        : Seq[PagePathAndMeta] = {
    var topics: Seq[PagePathAndMeta] = dao.loadPagesInCategory(
      categoryId, includeDescendantCategories, isStaff = isStaff, restrictedOnly = restrictedOnly,
      pageQuery, limit)

    // For now. COULD do the filtering in the db query instead, so won't find 0 pages just because
    // all most-recent-pages are hidden.
    if (!isStaff) {
      topics = topics.filter(!_.meta.isHidden)
    }

    // If sorting by bump time, sort pinned topics first. Otherwise, don't.
    val topicsInclPinned = pageQuery.orderOffset match {
      case orderOffset: PageOrderOffset.ByBumpTime if orderOffset.offset.isEmpty =>
        val pinnedTopics = dao.loadPagesInCategory(
          categoryId, includeDescendantCategories, isStaff = isStaff, restrictedOnly = restrictedOnly,
          pageQuery.copy(orderOffset = PageOrderOffset.ByPinOrderLoadOnlyPinned), limit)
        val notPinned = topics.filterNot(topic => pinnedTopics.exists(_.id == topic.id))
        val topicsSorted = (pinnedTopics ++ notPinned) sortBy { topic =>
          val meta = topic.meta
          val pinnedGlobally = meta.pinWhere.contains(PinPageWhere.Globally)
          val pinnedInThisCategory = meta.isPinned && meta.categoryId.contains(categoryId)
          val isPinned = pinnedGlobally || pinnedInThisCategory
          if (isPinned) topic.meta.pinOrder.get // 1..100
          else Long.MaxValue - topic.meta.bumpedOrPublishedOrCreatedAt.getTime // much larger
        }
        topicsSorted
      case _ => topics
    }

    topicsInclPinned
  }


  def parseThePageQuery(request: DebikiRequest[_]): PageQuery =
    parsePageQuery(request) getOrElse throwBadRequest(
      "DwE2KTES7", "No sort-order-offset specified")


  def parsePageQuery(request: DebikiRequest[_]): Option[PageQuery] = {
    val sortOrderStr = request.queryString.getFirst("sortOrder") getOrElse { return None }
    def anyDateOffset = request.queryString.getLong("epoch") map (new ju.Date(_))
    def anyNumOffset = request.queryString.getInt("num")

    val orderOffset: PageOrderOffset = sortOrderStr match {
      case "ByBumpTime" =>
        PageOrderOffset.ByBumpTime(anyDateOffset)
      case "ByLikesAndBumpTime" =>
        (anyNumOffset, anyDateOffset) match {
          case (Some(num), Some(date)) =>
            PageOrderOffset.ByLikesAndBumpTime(Some(num, date))
          case (None, None) =>
            PageOrderOffset.ByLikesAndBumpTime(None)
          case _ =>
            throwBadReq("DwE4KEW21", "Please specify both 'num' and 'epoch' or none at all")
        }
      case x => throwBadReq("DwE05YE2", s"Bad sort order: `$x'")
    }

    val filter = parsePageFilter(request)
    Some(PageQuery(orderOffset, filter))
  }


  def parsePageFilter(request: DebikiRequest[_]): PageFilter =
    request.queryString.getFirst("filter") match {
      case None => PageFilter.ShowAll
      case Some("ShowAll") => PageFilter.ShowAll
      case Some("ShowWaiting") => PageFilter.ShowWaiting
      case Some("ShowDeleted") =>
        if (!request.isStaff)
          throwForbidden2("EsE5YKP3", "Only staff may list deleted topics")
        PageFilter.ShowDeleted
      case Some(x) => throwBadRequest("DwE5KGP8", s"Bad topic filter: $x")
    }


  private def categoryToJson(category: Category, isDefault: Boolean,
        recentTopics: Seq[PagePathAndMeta], pageStuffById: Map[PageId, debiki.dao.PageStuff])
        : JsObject = {
    require(recentTopics.isEmpty || pageStuffById.nonEmpty, "DwE8QKU2")
    val topicsNoAboutCategoryPage = recentTopics.filter(_.pageRole != PageRole.AboutCategory)
    val recentTopicsJson = topicsNoAboutCategoryPage.map(topicToJson(_, pageStuffById))
    ReactJson.makeCategoryJson(category, isDefault, recentTopicsJson)
  }


  def topicToJson(topic: PagePathAndMeta, pageStuffById: Map[PageId, PageStuff]): JsObject = {
    val topicStuff = pageStuffById.get(topic.pageId) getOrDie "DwE1F2I7"
    Json.obj(
      "pageId" -> topic.id,
      "pageRole" -> topic.pageRole.toInt,
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
      "lastReplyAtMs" -> JsDateMsOrNull(topic.meta.lastReplyAt),
      "lastReplyerId" -> JsNumberOrNull(topicStuff.lastReplyerId),
      "frequentPosterIds" -> JsArray(topicStuff.frequentPosterIds.map(JsNumber(_))),
      "answeredAtMs" -> dateOrNull(topic.meta.answeredAt),
      "answerPostUniqueId" -> JsNumberOrNull(topic.meta.answerPostUniqueId),
      "plannedAtMs" -> dateOrNull(topic.meta.plannedAt),
      "doneAtMs" -> dateOrNull(topic.meta.doneAt),
      "closedAtMs" -> dateOrNull(topic.meta.closedAt),
      "lockedAtMs" -> dateOrNull(topic.meta.lockedAt),
      "frozenAtMs" -> dateOrNull(topic.meta.frozenAt),
      "hiddenAtMs" -> JsWhenMsOrNull(topic.meta.hiddenAt),
      "deletedAtMs" -> JsDateMsOrNull(topic.meta.deletedAt))
  }


  def permissionToJson(permsOnPages: PermsOnPages): JsObject = {
    Json.obj(
      "id" -> permsOnPages.id,
      "forPeopleId" -> permsOnPages.forPeopleId,
      "onWholeSite" -> JsBooleanOrNull(permsOnPages.onWholeSite),
      "onCategoryId" -> JsNumberOrNull(permsOnPages.onCategoryId),
      "onPageId" -> JsStringOrNull(permsOnPages.onPageId),
      "onPostId" -> JsNumberOrNull(permsOnPages.onPostId),
      // later: "onTagId" -> JsNumberOrNull(permsOnPages.onTagId),
      "mayEditPage" -> JsBooleanOrNull(permsOnPages.mayEditPage),
      "mayEditComment" -> JsBooleanOrNull(permsOnPages.mayEditComment),
      "mayEditWiki" -> JsBooleanOrNull(permsOnPages.mayEditWiki),
      "mayDeletePage" -> JsBooleanOrNull(permsOnPages.mayDeletePage),
      "mayDeleteComment" -> JsBooleanOrNull(permsOnPages.mayDeleteComment),
      "mayCreatePage" -> JsBooleanOrNull(permsOnPages.mayCreatePage),
      "mayPostComment" -> JsBooleanOrNull(permsOnPages.mayPostComment),
      "maySee" -> JsBooleanOrNull(permsOnPages.maySee))
  }


  REFACTOR // Move to ... JsonMaker? later when has been created.
  def groupToJson(group: Group): JsObject = {
    var json = Json.obj(
      "id" -> group.id,
      "username" -> group.theUsername,
      "fullName" -> group.name)
      // "grantsTrustLevel" -> group.grantsTrustLevel)
    group.tinyAvatar foreach { uploadRef =>
      json += "avatarUrl" -> JsString(uploadRef.url)
    }
    json
  }

}

