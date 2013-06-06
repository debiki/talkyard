/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.v0._
import com.debiki.v0.{liftweb => lw}
import controllers._
import controllers.Utils.OkSafeJson
import play.api.{mvc => pm}
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import DebikiHttp._
import Prelude._
import HtmlPageSerializer.SerializedSingleThread


/**
 * Makes HTTP replies that describe changes to a page.
 * When a browser gets such a reply, it updates the page.
 * For example, the browser adds a new reply, or updates a comment
 * to show the most recent edits.
 */
object BrowserPagePatcher {

  implicit private val logger = play.api.Logger(this.getClass)


  case class PostPatchSpec(id: ActionId, wholeThread: Boolean)


  def jsonForThreadsAndPosts(
        pagesAndPatchSpecs: List[(PageParts, List[PostPatchSpec])],
        request: DebikiRequest[_]): pm.PlainResult = {

    var threadPatchesByPageId = Map[String, List[Map[String, JsValue]]]()
    var postPatchesByPageId   = Map[String, List[Map[String, JsValue]]]()

    val pageRoot = request match {
      case p: PageRequest[_] => p.pageRoot
      case _ => PageRoot.TheBody
    }

    for ((page, postPatchRequests) <- pagesAndPatchSpecs) {

      val serializer = HtmlPageSerializer(
        page, PageTrust(page), pageRoot, DebikiHttp.newUrlConfig(request.host))

      var threadPatchesOnCurPage = List[Map[String, JsValue]]()
      var postPatchesOnCurPage   = List[Map[String, JsValue]]()

      for (PostPatchSpec(postId, wholeThread) <- postPatchRequests) {
        if (wholeThread) {
          val serializedThread = serializer.renderSingleThread(postId) getOrElse
            logAndThrowInternalError(
              "DwE573R2", s"Post not found, id: $postId, page: ${page.id}")
          threadPatchesOnCurPage ::=
            _jsonForThread(page.getPost_!(postId), serializedThread)
        }
        else {
          postPatchesOnCurPage ::=
            jsonForPost(page.getPost_!(postId), request)
        }
      }

      threadPatchesByPageId += page.id -> threadPatchesOnCurPage
      postPatchesByPageId += page.id -> postPatchesOnCurPage
    }

    OkSafeJson(toJson(Map(
      "threadsByPageId" -> threadPatchesByPageId,
      "postsByPageId" -> postPatchesByPageId)))
  }


  def jsonForMyEditedPosts(editIdsAndPages: List[(List[ActionId], PageParts)],
        request: DebikiRequest[_]): pm.PlainResult = {

    var patchesByPageId = Map[String, List[Map[String, JsValue]]]()

    for ((editIds: List[ActionId], page: PageParts) <- editIdsAndPages) {

      val patchesOnCurPage = for (editId <- editIds) yield {
        _jsonForEditedPost(editId, page, request)
      }

      patchesByPageId += page.pageId -> patchesOnCurPage
    }

    OkSafeJson(toJson(Map(
      "postsByPageId" -> patchesByPageId)))
  }


  private def _jsonForThread(post: Post, serializedThread: SerializedSingleThread)
        : Map[String, JsValue] = {
    var data = Map[String, JsValue](
      "id" -> JsString(post.id.toString),
      "cdati" -> JsString(toIso8601T(post.creationDati)),
      "approved" -> JsBoolean(post.someVersionApproved),
      "html" -> JsString(serializedThread.htmlNodes.foldLeft("") {
        (html, htmlNode) => html + lw.Html5.toString(htmlNode)
      }))

    if (post.parentId != post.id) {
      data += "parentThreadId" -> JsString(post.parentId.toString)
    }

    serializedThread.prevSiblingId.foreach { siblingId =>
      data += "prevThreadId" -> JsString(siblingId.toString)
    }

    data
  }


  private def jsonForPost(post: Post, request: DebikiRequest[_])
        : Map[String, JsValue] = {
    val (headAndBodyHtml, actionsHtml) = {
      val pageStats = new PageStats(post.page, PageTrust(post.page))
      val renderer = HtmlPostRenderer(post.page, pageStats, hostAndPort = request.host)
      val renderedPost = renderer.renderPost(post.id, uncollapse = true)
      val headAndBodyHtml = lw.Html5.toString(renderedPost.headAndBodyHtml)
      val actionsHtml = lw.Html5.toString(renderedPost.actionsHtml)
      (headAndBodyHtml, actionsHtml)
    }
    Map(
      "postId" -> JsString(post.id.toString),
      "isPostApproved" -> JsBoolean(post.currentVersionApproved),
      "html" -> JsString(headAndBodyHtml),
      "actionsHtml" -> JsString(actionsHtml))
  }


  private def _jsonForEditedPost(editId: ActionId, page: PageParts,
        request: DebikiRequest[_]): Map[String, JsValue] = {
    val edit = page.getPatch_!(editId)

    // Include HTML only if the edit was applied. (Otherwise I don't know
    // how to handle subsequent edits, since they would be based on an edit
    // that was never applied, that is, on a future version of the post
    // that will perhaps never exist.)
    val (jsHeadAndBodyHtml, jsActionsHtml) =
      if (edit.isApplied) {
        val pageStats = new PageStats(page, PageTrust(page))
        val renderer = HtmlPostRenderer(page, pageStats, hostAndPort = request.host)
        val renderedPost = renderer.renderPost(edit.post_!.id, uncollapse = true)
        val headAndBodyHtml = lw.Html5.toString(renderedPost.headAndBodyHtml)
        val actionsHtml = lw.Html5.toString(renderedPost.actionsHtml)
        (JsString(headAndBodyHtml), JsString(actionsHtml))
      }
      else (JsUndefined(""), JsUndefined(""))

    Map(
      "postId" -> JsString(edit.post_!.id.toString),
      "editId" -> JsString(edit.id.toString),
      "isEditApplied" -> JsBoolean(edit.isApplied),
      "isPostApproved" -> JsBoolean(edit.post_!.currentVersionApproved),
      "html" -> jsHeadAndBodyHtml,
      "actionsHtml" -> jsActionsHtml)
  }

}
