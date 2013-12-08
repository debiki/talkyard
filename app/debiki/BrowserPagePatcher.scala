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
import scala.collection.{mutable => mut}
import DebikiHttp._
import Prelude._
import HtmlPageSerializer.SerializedSingleThread
import BrowserPagePatcher._



object BrowserPagePatcher {

  case class TreePatchSpec(
    id: PostId,
    wholeTree: Boolean,
    uncollapse: Boolean = false) {

    def mergeWith(otherSpec: TreePatchSpec) = {
      require(otherSpec.id == id)
      copy(
        wholeTree = wholeTree || otherSpec.wholeTree,
        uncollapse = uncollapse || otherSpec.uncollapse)
    }
  }


  /** Merges duplicates and sorts by parent-post-before-child-post (ancestors first).
    */
  def sortAndMerge(patchSpecs: Seq[TreePatchSpec]): Seq[TreePatchSpec] = {
    val patchesById = mut.Map[PostId, TreePatchSpec]()
    for (curSpec <- patchSpecs) {
      val anyDuplicate = patchesById.get(curSpec.id)
      val specToUse = anyDuplicate match {
        case None => curSpec
        case Some(duplicate) => duplicate.mergeWith(curSpec)
      }
      patchesById(specToUse.id) = specToUse
    }
    patchesById.values.toVector sortWith { (a, b) =>
      PageParts.canBeAncestorOf(a.id, b.id)
    }
  }


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
    if (showAllUnapproved || request.user.map(_.isAdmin) == Some(true)) ShowUnapproved.All
    else request.user match {
      case None => ShowUnapproved.None
      case Some(user) => ShowUnapproved.WrittenByUser(user.id)
    }


  // ========== JSON for threads


  type JsPatchesByPageId = Map[String, Seq[JsPatch]]
  def newJsPatchesByPageId() = Map[String, Vector[JsPatch]]()


  def jsonForTreePatches(page: PageParts, threadIds: Seq[ActionId]): Vector[JsPatch] = {
    val threadSpecs = threadIds.map(id => TreePatchSpec(id, wholeTree = true))
    val threadPatches = makeTreePatchesSinglePage(page, threadSpecs)
    threadPatches
  }


  def jsonForTrees(page: PageParts, patchSpecs: TreePatchSpec*): JsValue = {
    jsonForTrees(List((page, patchSpecs.toList)))
  }


  def jsonForTrees(pagesAndPatchSpecs: List[(PageParts, List[TreePatchSpec])]): JsValue = {
    val threadPatchesByPageId = jsonForTreesImpl(pagesAndPatchSpecs)
    toJson(Map(
      "threadsByPageId" -> threadPatchesByPageId))
  }


  private def jsonForTreesImpl(pagesAndPatchSpecs: List[(PageParts,  List[TreePatchSpec])])
        : JsPatchesByPageId = {

    var threadPatchesByPageId = newJsPatchesByPageId()

    for ((page, patchSpecs) <- pagesAndPatchSpecs) {

      val threadPatchesOnCurPage = makeTreePatchesSinglePage(page, patchSpecs)
      threadPatchesByPageId += page.id -> threadPatchesOnCurPage
    }

    threadPatchesByPageId
  }


  /** COULD fix: Currently includes a thread T twice, if patchSpecs mentions
    * both T and one of its ancestors.
    */
  private def makeTreePatchesSinglePage(page: PageParts,
        patchSpecsDuplicatedUnsorted: Seq[TreePatchSpec]): Vector[JsPatch] = {

    val patchSpecs = sortAndMerge(patchSpecsDuplicatedUnsorted)

    val pageRoot = request match {
      case p: PageRequest[_] => p.pageRoot
      case _ => AnyPageRoot.TheBody
    }

    val serializer = HtmlPageSerializer(
      page, PageTrust(page), pageRoot, request.host, showUnapproved = showUnapproved,
      showStubsForDeleted = showStubsForDeleted)

    var threadPatches = Vector[JsPatch]()

    for (TreePatchSpec(postId, wholeThread, uncollapse) <- patchSpecs) {
      val post = page.getPost(postId) getOrElse logAndThrowInternalError(
         "DwE573R2", s"Post not found, id: $postId, page: ${page.id}")
      // If the post has been deleted and `!showStubsForDeleted`. renderSingleThread()
      // might return nothing.
      // SHOULD consider `wholeTread` and render only `postId` + collapsed children, if false,
      // and rename `wholeThread` to... what? also.
      serializer.renderSingleThread(postId, pageRoot) foreach { serializedThread =>
        threadPatches :+= _jsonForThread(post, serializedThread)
      }
    }

    threadPatches
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


  // ========== JSON for posts and edits


  def jsonForPosts(postIdsAndPages: Seq[(Seq[PostId], PageParts)]): JsValue = {
    jsonForPostsImpl(postIdsAndPages, jsonForEdits = false)
  }


  def jsonForMyEditedPosts(editIdsAndPages: List[(List[ActionId], PageParts)]): JsValue = {
    jsonForPostsImpl(editIdsAndPages, jsonForEdits = true)
  }


  private def jsonForPostsImpl(
        idsAndPages: Seq[(Seq[ActionId], PageParts)], jsonForEdits: Boolean): JsValue = {
    var patchesByPageId = newJsPatchesByPageId()

    for ((ids: Seq[ActionId], page: PageParts) <- idsAndPages) {
      val patchesOnCurPage = for (id <- ids) yield {
        if (jsonForEdits)
          _jsonForEditedPost(id, page)
        else
          jsonForPost(page.getPost_!(id))
      }
      patchesByPageId += page.pageId -> patchesOnCurPage.toVector
    }

    toJson(Map("postsByPageId" -> patchesByPageId))
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
