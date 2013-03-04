// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package debiki

import com.debiki.v0._
import com.debiki.v0.{liftweb => lw}
import controllers._
import play.api.{mvc => pm}
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import DebikiHttp._
import Prelude._
import Utils.OkSafeJson
import HtmlPageSerializer.SerializedSingleThread


/**
 * Makes HTTP replies that describe changes to a page.
 * When a browser gets such a reply, it updates the page.
 * For example, the browser adds a new reply, or updates a comment
 * to show the most recent edits.
 */
object BrowserPagePatcher {

  implicit private val logger = play.api.Logger(this.getClass)


  def jsonForThreads(
        pagesAndPostIds: List[(Debate, List[String])], request: DebikiRequest[_])
        : pm.PlainResult = {

    var patchesByPageId = Map[String, List[Map[String, JsValue]]]()
    for ((page: Debate, postIds: List[String]) <- pagesAndPostIds) {

      val pageRoot = request match {
        case p: PageRequest[_] => p.pageRoot
        case _ => PageRoot.TheBody
      }

      val serializer = HtmlPageSerializer(
        page, PageTrust(page), pageRoot, DebikiHttp.newUrlConfig(request.host))

      val patchesOnCurPage = for (postId <- postIds) yield {
        val serializedThread = serializer.renderSingleThread(postId) getOrElse
          logAndThrowInternalError(
            "DwE573R2", "Post not found, id: "+ postId +", page: "+ page.id)
        _jsonForThread(page.vipo_!(postId), serializedThread)
      }

      patchesByPageId += page.pageId -> patchesOnCurPage
    }

    OkSafeJson(toJson(Map(
      "threadsByPageId" -> patchesByPageId)))
  }


  def jsonForMyEditedPosts(editIdsAndPages: List[(List[String], Debate)],
        request: DebikiRequest[_]): pm.PlainResult = {

    var patchesByPageId = Map[String, List[Map[String, JsValue]]]()

    for ((editIds: List[String], page: Debate) <- editIdsAndPages) {

      val patchesOnCurPage = for (editId <- editIds) yield {
        _jsonForEditedPost(editId, page, request)
      }

      patchesByPageId += page.pageId -> patchesOnCurPage
    }

    OkSafeJson(toJson(Map(
      "editedPostsByPageId" -> patchesByPageId)))
  }


  private def _jsonForThread(post: Post, serializedThread: SerializedSingleThread)
        : Map[String, JsValue] = {
    var data = Map[String, JsValue](
      "id" -> JsString(post.id),
      "cdati" -> JsString(toIso8601T(post.creationDati)),
      "approved" -> JsBoolean(post.someVersionApproved),
      "html" -> JsString(serializedThread.htmlNodes.foldLeft("") {
        (html, htmlNode) => html + lw.Html5.toString(htmlNode)
      }))

    if (post.parentId != post.id) {
      data += "parentThreadId" -> JsString(post.parentId)
    }

    serializedThread.prevSiblingId.foreach { siblingId =>
      data += "prevThreadId" -> JsString(siblingId)
    }

    data
  }


  private def _jsonForEditedPost(editId: String, page: Debate,
        request: DebikiRequest[_]): Map[String, JsValue] = {
    val edit = page.vied_!(editId)

    // Include HTML only if the edit was applied. (Otherwise I don't know
    // how to handle subsequent edits, since they would be based on an edit
    // that was never applied, that is, on a future version of the post
    // that will perhaps never exist.)
    val jsHtml =
      if (edit.isApplied) {
        val pageStats = new PageStats(page, PageTrust(page))
        val renderer = HtmlPostRenderer(page, pageStats,
          hostAndPort = request.host)
        val renderedPost = renderer.renderPost(edit.post_!.id)
        val htmlText = lw.Html5.toString(renderedPost.html)
        JsString(htmlText)
      }
      else JsUndefined("")

    Map(
      "postId" -> JsString(edit.post_!.id),
      "editId" -> JsString(edit.id),
      "isEditApplied" -> JsBoolean(edit.isApplied),
      "isPostApproved" -> JsBoolean(edit.post_!.currentVersionApproved),
      "html" -> jsHtml)
  }

}
