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

import actions.ApiActions.GetAction
import debiki.dao.PageStuff
import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
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


  def listTopics(categoryId: PageId) = GetAction { request =>
    val orderOffset = parseSortOrderAndOffset(request)
    val topics: Seq[PagePathAndMeta] =
      request.dao.listTopicsInTree(rootPageId = categoryId, orderOffset, limit = NumTopicsToList)
    val pageStuffById = request.dao.loadPageStuff(topics.map(_.pageId))
    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_, pageStuffById))
    val json = Json.obj("topics" -> topicsJson)
    OkSafeJson(json)
  }


  def listCategories(forumId: PageId) = GetAction { request =>
    val categories = request.dao.listChildPages(parentPageIds = Seq(forumId),
      PageOrderOffset.ByPublTime, // COULD use PageOrderOffset.Manual instead
      limit = 999, filterPageRole = Some(PageRole.ForumCategory))

    val recentTopicsByCategoryId =
      mutable.Map[PageId, Seq[PagePathAndMeta]]()

    val pageIds = ArrayBuffer[PageId]()

    for (category <- categories) {
      val recentTopics = request.dao.listChildPages(parentPageIds = Seq(category.id),
        PageOrderOffset.ByPublTime, limit = 5, filterPageRole = Some(PageRole.ForumTopic))
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
    val recentTopicsJson = recentTopics.map(topicToJson(_, pageStuffById))
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
    val lastPostEpoch = topic.meta.bumpedAt.map(_.getTime) getOrElse createdEpoch
    Json.obj(
      "pageId" -> topic.id,
      "title" -> topicStuff.title,
      "url" -> topic.path.value,
      "categoryId" -> topic.parentPageId.getOrDie(
        "DwE49Fk3", s"Topic `${topic.id}', site `${topic.path.siteId}', has no parent page"),
      "numPosts" -> JsNumber(topic.meta.numRepliesVisible + 1),
      "numLikes" -> topic.meta.numLikes,
      "numWrongs" -> topic.meta.numWrongs,
      "numBurys" -> topic.meta.numBurys,
      "createdEpoch" -> createdEpoch,
      "lastPostEpoch" -> lastPostEpoch)
  }

}

