/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions.{GetAction, StaffPostJsonAction}
import debiki.dao.PageStuff
import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.ReactJson.{DateEpochOrNull, JsNumberOrNull, JsStringOrNull}
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import requests.GetRequest
import scala.collection.mutable.ArrayBuffer
import Utils.OkSafeJson
import Utils.ValidationImplicits._
import DebikiHttp.throwBadReq


/** Handles requests related to forums and forum categories.
 */
object ForumController extends mvc.Controller {

  /** Keep synced with client/forum/list-topics/ListTopicsController.NumNewTopicsPerRequest. */
  val NumTopicsToList = 40


  def createForumCategory = StaffPostJsonAction(maxLength = 10 * 1000) { request =>
    val parentPageId = (request.body \ "parentPageId").as[PageId]
    val anySlug = (request.body \ "categorySlug").asOpt[String]
    val titleText = (request.body \ "categoryTitle").as[String]
    val descriptionText = (request.body \ "categoryDescription").as[String]

    val result = request.dao.createForumCategory(parentPageId, anySlug,
      titleText, descriptionText, authorId = request.theUserId, request.theBrowserIdData)

    OkSafeJson(Json.obj(
      "allCategories" -> ReactJson.categoriesJson(result.forumId, request.dao),
      "newCategoryId" -> result.newCategoryId,
      "newCategorySlug" -> result.newCategorySlug))
  }


  def listTopics(categoryId: PageId) = GetAction { request =>
    val orderOffset = parseSortOrderAndOffset(request)
    val topics = listTopicsInclPinned(categoryId, orderOffset, request.dao)
    val pageStuffById = request.dao.loadPageStuff(topics.map(_.pageId))
    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_, pageStuffById))
    val json = Json.obj("topics" -> topicsJson)
    OkSafeJson(json)
  }


  def listCategories(forumId: PageId) = GetAction { request =>
    val categories = request.dao.listChildPages(parentPageIds = Seq(forumId),
      orderOffset = PageOrderOffset.ByPublTime, // COULD create a PageOrderOffset.ByPinOrder instead
      limit = 999, onlyPageRole = Some(PageRole.Category))

    val recentTopicsByCategoryId =
      mutable.Map[PageId, Seq[PagePathAndMeta]]()

    val pageIds = ArrayBuffer[PageId]()

    for (category <- categories) {
      val recentTopics = listTopicsInclPinned(category.id, PageOrderOffset.ByBumpTime(None),
        request.dao, limit = 5)
      recentTopicsByCategoryId(category.id) = recentTopics
      pageIds.append(category.pageId)
      pageIds.append(recentTopics.map(_.pageId): _*)
    }

    val pageStuffById: Map[PageId, debiki.dao.PageStuff] =
      request.dao.loadPageStuff(pageIds)

    val json = Json.obj("categories" -> categories.map({ category =>
      categoryToJson(category, recentTopicsByCategoryId(category.id), pageStuffById)
    }))

    OkSafeJson(json)
  }


  private def listTopicsInclPinned(categoryId: PageId, orderOffset: PageOrderOffset,
        dao: debiki.dao.SiteDao, limit: Int = NumTopicsToList): Seq[PagePathAndMeta] = {
    val topics: Seq[PagePathAndMeta] =
      dao.listTopicsInTree(rootPageId = categoryId, orderOffset, limit = limit)

    // If sorting by bump time, sort pinned topics first. Otherwise, don't.
    val topicsInclPinned = orderOffset match {
      case orderOffset: PageOrderOffset.ByBumpTime if orderOffset.offset.isEmpty =>
        val pinnedTopics = dao.listTopicsInTree(
          rootPageId = categoryId, PageOrderOffset.ByPinOrderLoadOnlyPinned,
          limit = limit)
        val notPinned = topics.filterNot(topic => pinnedTopics.exists(_.id == topic.id))
        val topicsSorted = (pinnedTopics ++ notPinned) sortBy { topic =>
          val isPinned = topic.meta.pinWhere.contains(PinPageWhere.Globally) ||
            (topic.meta.isPinned && (
              topic.meta.parentPageId.contains(categoryId) ||
              topic.id == categoryId)) // hack, will vanish when creating category table [forumcategory]
          if (isPinned) topic.meta.pinOrder.get // 1..100
          else Long.MaxValue - topic.meta.bumpedOrPublishedOrCreatedAt.getTime // much larger
        }
        // Remove about-category pages for sub categories (or categories, if listing all cats).
        // Will have to change this once categories have their own table. [forumcategory]
        topicsSorted filterNot { topic =>
          topic.meta.parentPageId.contains(categoryId) &&
            topic.meta.pageRole == PageRole.Category
        }
      case _ => topics
    }

    topicsInclPinned
  }


  private def parseSortOrderAndOffset(request: GetRequest): PageOrderOffset = {
    val sortOrderStr = request.queryString.getOrThrowBadReq("sortOrder")
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
            throwBadReq("Please specify both 'num' and 'epoch' or none at all")
        }
      case x => throwBadReq("DwE05YE2", s"Bad sort order: `$x'")
    }
    orderOffset
  }


  private def categoryToJson(category: PagePathAndMeta, recentTopics: Seq[PagePathAndMeta],
      pageStuffById: Map[PageId, debiki.dao.PageStuff]): JsObject = {
    val categoryStuff = pageStuffById.get(category.pageId) getOrDie "DwE5IKJ3"
    val name = categoryStuff.title
    val slug = categoryNameToSlug(name)
    val topicsNoAboutCategoryPage = recentTopics.filterNot(_.id == category.id)
    val recentTopicsJson = topicsNoAboutCategoryPage.map(topicToJson(_, pageStuffById))
    Json.obj(
      "pageId" -> category.id,
      "name" -> name,
      "slug" -> slug,
      "description" -> categoryStuff.bodyExcerpt.getOrDie("DwE4KIGW3"),
      "numTopics" -> category.meta.numChildPages, // COULD use ??cachedNumTopics?? instead?
                                                // because child pages includes categories too.
      "recentTopics" -> recentTopicsJson)
  }


  /** For now only. In the future I'll generate the slug when the category is created?
    */
  def categoryNameToSlug(name: String): String = {
    name.toLowerCase.replaceAll(" ", "-") filterNot { char =>
      "()!?[].," contains char
    }
  }


  def topicToJson(topic: PagePathAndMeta, pageStuffById: Map[PageId, PageStuff]): JsObject = {
    val topicStuff = pageStuffById.get(topic.pageId) getOrDie "DwE1F2I7"
    val createdEpoch = topic.meta.createdAt.getTime
    val bumpedEpoch = DateEpochOrNull(topic.meta.bumpedAt)
    val lastReplyEpoch = DateEpochOrNull(topic.meta.lastReplyAt)
    val title =
      if (topic.meta.pageRole == PageRole.Category) {
        // Temp hack until I've moved categories to their own table, and
        // there are PageRole.About topics for each category, a la Discourse, with
        // "About the ... category" titles. [forumcategory]
        s"About the ${topicStuff.title} category"
      }
      else {
        topicStuff.title
      }

    Json.obj(
      "pageId" -> topic.id,
      "title" -> title,
      "url" -> topic.path.value,
      "categoryId" -> topic.parentPageId.getOrDie(
        "DwE49Fk3", s"Topic `${topic.id}', site `${topic.path.siteId}', has no parent page"),
      "pinOrder" -> JsNumberOrNull(topic.meta.pinOrder),
      "pinWhere" -> JsNumberOrNull(topic.meta.pinWhere.map(_.toInt)),
      // loadPageStuff() loads excerps for pinned topics (and categories).
      "excerpt" -> JsStringOrNull(topicStuff.bodyExcerpt),
      "numPosts" -> JsNumber(topic.meta.numRepliesVisible + 1),
      "numLikes" -> topic.meta.numLikes,
      "numWrongs" -> topic.meta.numWrongs,
      "numBurys" -> topic.meta.numBurys,
      "createdEpoch" -> createdEpoch,
      "bumpedEpoch" -> bumpedEpoch,
      "lastReplyEpoch" -> lastReplyEpoch)
  }

}

