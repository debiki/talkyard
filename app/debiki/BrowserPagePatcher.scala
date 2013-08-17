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

import com.debiki.core._
import com.debiki.core.{liftweb => lw}
import play.api.{mvc => pm}
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import requests._
import DebikiHttp._
import Prelude._
import HtmlPageSerializer.SerializedSingleThread
import BrowserPagePatcher._



object BrowserPagePatcher {

  case class PostPatchSpec(id: ActionId, wholeThread: Boolean)

  type JsPatch = Map[String, JsValue]

}



/** Builds JSON that describe changes to a page.
  *
  * This JSON is then sent to the browser, which uses it to update parts of the page.
  * For example, it adds a new reply, or updates a comment
  * to show the most recent edits.
  *
  * Shows unapproved comments and edits written by the current user, unless
  * s/he is a moderator or admin, in which case all unapproved things are shown.
  */
case class BrowserPagePatcher(
  request: DebikiRequest[_],
  showAllUnapproved: Boolean = false,
  showStubsForDeleted: Boolean = false) {

  implicit private val logger = play.api.Logger(this.getClass)

  private val showUnapproved: ShowUnapproved =
    if (showAllUnapproved || request.user_!.isAdmin) ShowUnapproved.All
    else ShowUnapproved.WrittenByUser(request.user_!.id)


  type JsPatchesByPageId = Map[String, List[JsPatch]]
  def newJsPatchesByPageId() = Map[String, List[JsPatch]]()


  def jsonForThreadPatches(page: PageParts, threadIds: Seq[ActionId]): List[JsPatch] = {
    val threadSpecs = threadIds.map(id => PostPatchSpec(id, wholeThread = true))
    val (threadPatches, _) = makeThreadAndPostPatchesSinglePage(page, threadSpecs)
    threadPatches
  }


  def jsonForThreadsAndPosts(page: PageParts, patchSpecs: PostPatchSpec*): JsValue = {
    jsonForThreadsAndPosts(List((page, patchSpecs.toList)))
  }


  def jsonForThreadsAndPosts(pagesAndPatchSpecs: List[(PageParts, List[PostPatchSpec])])
        : JsValue = {
    val (threadPatchesByPageId, postPatchesByPageId) =
      jsonForThreadsAndPostsImpl(pagesAndPatchSpecs)
    toJson(Map(
      "threadsByPageId" -> threadPatchesByPageId,
      "postsByPageId" -> postPatchesByPageId))
  }


  private def jsonForThreadsAndPostsImpl(
        pagesAndPatchSpecs: List[(PageParts,  List[PostPatchSpec])])
        : (JsPatchesByPageId, JsPatchesByPageId) = {

    var threadPatchesByPageId = newJsPatchesByPageId()
    var postPatchesByPageId = newJsPatchesByPageId()

    for ((page, patchSpecs) <- pagesAndPatchSpecs) {

      val (threadPatchesOnCurPage, postPatchesOnCurPage) =
        makeThreadAndPostPatchesSinglePage(page, patchSpecs)

      threadPatchesByPageId += page.id -> threadPatchesOnCurPage
      postPatchesByPageId += page.id -> postPatchesOnCurPage
    }

    (threadPatchesByPageId, postPatchesByPageId)
  }


  /** COULD fix: Currently includes a thread T twice, if patchSpecs mentions
    * both T and one of its ancestors.
    */
  private def makeThreadAndPostPatchesSinglePage(page: PageParts, patchSpecs: Seq[PostPatchSpec])
        : (List[JsPatch],  List[JsPatch]) = {

    val pageRoot = request match {
      case p: PageRequest[_] => p.pageRoot
      case _ => PageRoot.TheBody
    }

    val serializer = HtmlPageSerializer(
      page, PageTrust(page), pageRoot, request.host, showUnapproved = showUnapproved,
      showStubsForDeleted = showStubsForDeleted)

    var threadPatches = List[JsPatch]()
    var postPatches = List[JsPatch]()

    for (PostPatchSpec(postId, wholeThread) <- patchSpecs) {
      val post = page.getPost(postId) getOrElse logAndThrowInternalError(
         "DwE573R2", s"Post not found, id: $postId, page: ${page.id}")
      if (wholeThread) {
        // If the post has been deleted and `!showStubsForDeleted`. renderSingleThread()
        // might return nothing.
        serializer.renderSingleThread(postId) foreach { serializedThread =>
          threadPatches ::= _jsonForThread(post, serializedThread)
        }
      }
      else {
        postPatches ::= jsonForPost(post)
      }
    }

    (threadPatches, postPatches)
  }


  def jsonForMyEditedPosts(editIdsAndPages: List[(List[ActionId], PageParts)]): JsValue = {

    var patchesByPageId = newJsPatchesByPageId()

    for ((editIds: List[ActionId], page: PageParts) <- editIdsAndPages) {
      val patchesOnCurPage = for (editId <- editIds) yield {
        _jsonForEditedPost(editId, page)
      }
      patchesByPageId += page.pageId -> patchesOnCurPage
    }

    toJson(Map("postsByPageId" -> patchesByPageId))
  }


  private def _jsonForThread(post: Post, serializedThread: SerializedSingleThread): JsPatch = {
    var data = Map[String, JsValue](
      "id" -> JsString(post.id.toString),
      "cdati" -> JsString(toIso8601T(post.creationDati)),
      "ancestorThreadIds" -> toJson(post.ancestorPosts.map(_.id)),
      "html" -> JsString(serializedThread.htmlNodes.foldLeft("") {
        (html, htmlNode) => html + lw.Html5.toString(htmlNode)
      }))

    post.lastApprovalType.foreach { approval =>
      data += "approval" -> JsString(approval.toString)
    }

    serializedThread.prevSiblingId.foreach { siblingId =>
      data += "prevThreadId" -> JsString(siblingId.toString)
    }

    data
  }


  private def jsonForPost(post: Post): JsPatch = {
    val (headAndBodyHtml, actionsHtml) = {
      val pageStats = new PageStats(post.page, PageTrust(post.page))
      val renderer = HtmlPostRenderer(post.page, pageStats, hostAndPort = request.host,
        showUnapproved = showUnapproved)
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


  /** Only edits that have been applied are included. — Unapproved (but applied)
    * edits *are* included.
    */
  private def _jsonForEditedPost(editId: ActionId, page: PageParts): JsPatch = {
    val edit = page.getPatch_!(editId)

    // Even if the edit hasn't been applied, generate new HTML anyway, because
    // an unapplied edit suggestion does affect the action list, i.e. `jsActionsHtml`
    // below: a pen icon with num-pending-suggestions might appear.
    val (jsHeadAndBodyHtml, jsActionsHtml) = {
        val pageStats = new PageStats(page, PageTrust(page))
        val renderer = HtmlPostRenderer(page, pageStats, hostAndPort = request.host,
          showUnapproved = showUnapproved)
        val renderedPost = renderer.renderPost(edit.post_!.id, uncollapse = true)
        val headAndBodyHtml = lw.Html5.toString(renderedPost.headAndBodyHtml)
        val actionsHtml = lw.Html5.toString(renderedPost.actionsHtml)
        (JsString(headAndBodyHtml), JsString(actionsHtml))
      }

    Map(
      "postId" -> JsString(edit.post_!.id.toString),
      "editId" -> JsString(edit.id.toString),
      "isEditApplied" -> JsBoolean(edit.isApplied),
      "isPostApproved" -> JsBoolean(edit.post_!.currentVersionApproved),
      "html" -> jsHeadAndBodyHtml,
      "actionsHtml" -> jsActionsHtml)
  }

}
