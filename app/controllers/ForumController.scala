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
import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import requests.GetRequest
import Utils.OkSafeJson
import Utils.ValidationImplicits._
import DebikiHttp.throwBadReq


/** Handles requests related to forums and forum categories.
 */
object ForumController extends mvc.Controller {


  def listTopics(categoryId: PageId) = GetAction { request =>

    val orderOffset = parseSortOrderAndOffset(request)

    val childCategories = request.dao.listChildPages(parentPageIds = Seq(categoryId),
      PageOrderOffset.Any, limit = 999, filterPageRole = Some(PageRole.ForumCategory))
    val childCategoryIds = childCategories.map(_.id)
    val allCategoryIds = childCategoryIds :+ categoryId

    val topics: Seq[PagePathAndMeta] = request.dao.listChildPages(parentPageIds = allCategoryIds,
      orderOffset, limit = 50, filterPageRole = Some(PageRole.ForumTopic))

    val topicsJson: Seq[JsObject] = topics.map(topicToJson(_))
    val json = Json.obj("topics" -> topicsJson)
    OkSafeJson(json)
  }


  def listCategories(forumId: PageId) = GetAction { request =>
    val categories = request.dao.listChildPages(parentPageIds = Seq(forumId),
      PageOrderOffset.ByPublTime, // COULD use PageOrderOffset.Manual instead
      limit = 999, filterPageRole = Some(PageRole.ForumCategory))

    val recentTopicsByCategoryId =
      mutable.Map[PageId, Seq[PagePathAndMeta]]()

    for (category <- categories) {
      val recentTopics = request.dao.listChildPages(parentPageIds = Seq(category.id),
        PageOrderOffset.ByPublTime, limit = 5, filterPageRole = Some(PageRole.ForumTopic))
      recentTopicsByCategoryId(category.id) = recentTopics
    }

    val json = Json.obj("categories" -> categories.map({ category =>
      categoryToJson(category, recentTopicsByCategoryId(category.id))
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


  private def categoryToJson(category: PagePathAndMeta, recentTopics: Seq[PagePathAndMeta])
        : JsObject = {
    val name = category.meta.cachedTitle getOrElse "(Unnamed category)"
    val slug = categoryNameToSlug(name)
    val recentTopicsJson = recentTopics.map(topicToJson(_))
    Json.obj(
      "pageId" -> category.id,
      "name" -> name,
      "slug" -> slug,
      "description" -> "Forum category description, bla bla blah bla bla-bla bla-bla-bla bla blaa.",
      "numTopics" -> category.meta.cachedNumChildPages, // COULD use ??cachedNumTopics?? instead?
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


  private def topicToJson(topic: PagePathAndMeta): JsObject = {
    val createdEpoch = topic.meta.creationDati.getTime
    val lastPostEpoch = topic.meta.cachedLastVisiblePostDati.map(_.getTime).get
    Json.obj(
      "pageId" -> topic.id,
      "title" -> topic.meta.cachedTitle,
      "url" -> topic.path.path,
      "categoryId" -> topic.parentPageId.getOrDie(
        "DwE49Fk3", s"Topic `${topic.id}', site `${topic.path.siteId}', has no parent page"),
      "numPosts" -> JsNumber(topic.meta.cachedNumRepliesVisible + 1),
      "numLikes" -> topic.meta.cachedNumLikes,
      "numWrongs" -> topic.meta.cachedNumWrongs,
      "createdEpoch" -> createdEpoch,
      "lastPostEpoch" -> lastPostEpoch)
  }


  /*
  /**
   * Wraps a forum in a forum group. That is, wraps a page F with role PageRole.Forum
   * in a new page FG with role PageRole.Forum. FG's parent will be F's
   * original parent, if any. F's new parent will be FG.
   *
   * JSON format, as Yaml:
   *  wrapForumsInNewGroup:
   *    - forumPageId
   *    - ... more forums to wrap, in the same group
   */
  def wrapForumsInNewGroup = PostJsonAction(maxLength = 1000) {
        request: JsonPostRequest =>

    // Access control.

    if (!request.user_!.isAdmin)
      throwForbidden("DwE6GdC9", "Please login as admin")

    // Parse request.

    val forumPathsAndMetas: List[PagePathAndMeta] = {
      val jsonBody = request.body.as[Map[String, List[String]]]

      val idsOfForumsToWrap: List[String] =
        jsonBody.getOrElse("wrapForumsInNewGroup", Nil)

      if (idsOfForumsToWrap.isEmpty)
        unimplemented // return Ok

      idsOfForumsToWrap map { forumPageId =>
        request.dao.loadPageMetaAndPath(forumPageId) match {
          case Some(pathAndMeta) => pathAndMeta
          case None =>
            throwNotFound("DwE3kE1", s"Forum not found, page id: $forumPageId")
        }
      }
    }

    // Find common parent page and folder, and check for bugs.

    val (commonAncestorIdsParentFirst, commonParentFolder, makeIndexPage) = {
      var ancestorIdsParentFirst: List[PageId] = Nil
      var commonParentFolder = ""
      var makeIndexPage = false

      for (forum <- forumPathsAndMetas) {
        if (forum.role != PageRole.ForumCategory && forum.role != PageRole.Forum) {
          throwForbidden("DwE4UWx3", o"""Page `${forum.id}' is not a forum
            nor a forum group""")
        }
        else if (ancestorIdsParentFirst.isEmpty) {
          ancestorIdsParentFirst = forum.ancestorIdsParentFirst
          commonParentFolder = forum.folder
          makeIndexPage = forum.path.isFolderOrIndexPage
        }
        else if (ancestorIdsParentFirst != forum.ancestorIdsParentFirst) {
          throwForbidden("DwE2YKf8", o"""Specified forums have different parent pages,
            namely `$ancestorIdsParentFirst' and `${forum.ancestorIdsParentFirst}'""")
        }
        else if (forum.folder != commonParentFolder) {
          throwForbidden("DwE5XAw8", o"""Specified forums are located in different
            folders, namely `$commonParentFolder' and `${forum.folder}'""")
        }
        else if (makeIndexPage || forum.path.isFolderOrIndexPage) {
          throwForbidden("DwE6BcH8", o"""Cannot wrap specified forums in a group:
            Many forums specified, but one of them is an index page.
            Forums that are index pages can only be wrapped one at a time.""")
        }
      }

      (ancestorIdsParentFirst, commonParentFolder, makeIndexPage)
    }

    // Move any index page forum.

    // If we're wrapping a folder index page, first move it
    // elsewhere, so we can place the new parent group as the folder index.
    // (Or there'll be a PathClashException.)

    val forumsWithAnyIndexMoved =
      if (makeIndexPage) {
        assErrIf(forumPathsAndMetas.length != 1, "DwE73BK3")
        forumPathsAndMetas map { forum =>
          val newPath = request.dao.moveRenamePage(
            forum.id, showId = Some(true), newSlug = Some("forum"))
          forum.copy(path = newPath)
        }
      }
      else {
        forumPathsAndMetas
      }

    // Create a forum group with parent `anyCommonParentId`.

    val anyCommonParentId = commonAncestorIdsParentFirst.headOption

    val groupMeta = PageMeta.forNewPage(
      PageRole.Forum, request.user_!, PageParts("?"), request.ctime,
      parentPageId = anyCommonParentId, publishDirectly = true)

    val groupPath = PagePath(tenantId = request.tenantId, folder = commonParentFolder,
      pageId = None, showId = !makeIndexPage,
      pageSlug = if (makeIndexPage) "" else "forum")

    val parentGroup = request.dao.createPage(
      Page(groupMeta, groupPath, commonAncestorIdsParentFirst, PageParts(groupMeta.pageId)))

    // Update other forums: Set their parent page to the parent group.
    // Is `makeIndexPage`, there should be only one child forum, and we need
    // to change its path (so it won't clash with the new group).

    val newCommonAncestorIds = parentGroup.id :: commonAncestorIdsParentFirst
    val childForums = for (forum <- forumsWithAnyIndexMoved) {
      val metaWithGroupAsParent = forum.meta.copy(parentPageId = Some(parentGroup.id))
      request.dao.updatePageMeta(metaWithGroupAsParent, old = forum.meta)

      PagePathAndMeta(forum.path, newCommonAncestorIds, metaWithGroupAsParent)
    }

    Ok

    // BrowserPagePatcher.jsonForNewAndEditedPages(
    //    newPages = List(PagePathAndMeta(groupPath, groupMeta)),
    //    modifiedPages = childForums)
  }*/

}

