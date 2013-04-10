/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import ApiActions._
import Prelude._
import Utils.ValidationImplicits._
import BrowserPagePatcher.PostPatchSpec


/** Handles simple actions like closing and collapsing trees and posts.
  *
  * (They're simple in the sense that they're represented by a case *object* only,
  * and they can therefore be handled together here.)
  */
object AppSimple extends mvc.Controller {


  def closeTree = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CloseTree)
  }


  def collapsePost = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CollapsePost)
  }


  def collapseReplies = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CollapseReplies)
  }


  def collapseTree = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CollapseTree)
  }


  def loadThreads =
    loadThreadsOrPosts { (page, postIds) =>
      postIds.map(PostPatchSpec(_, wholeThread = true))
    }


  def loadPosts =
    loadThreadsOrPosts { (page, postIds) =>
      postIds.map(PostPatchSpec(_, wholeThread = false))
    }


  def loadReplies =
    loadThreadsOrPosts { (page, postIds) =>
      val posts = postIds map { postId => page.getPost_!(postId) }
      val patchSpecs = posts.foldLeft(Nil: List[PostPatchSpec]) { (specs, post) =>
        post.replies.map(reply => PostPatchSpec(reply.id, wholeThread = true)) ::: specs
      }
      patchSpecs
    }


  private def loadThreadsOrPosts(
        loadWhatFn: (PageParts, List[String]) => List[PostPatchSpec]) =
      PostJsonAction(maxLength = 5000) { apiReq =>

    SECURITY // What about access control?! Page ids generally unknown however, but
    // should really fix anyway.

    val pageActionIds = apiReq.body.as[List[Map[String, String]]]

    val actionsByPageId: Map[String, List[String]] =
      Utils.parsePageActionIds(pageActionIds)(identity)

    var pagesAndPatchSpecs = List[(PageParts, List[PostPatchSpec])]()

    actionsByPageId foreach { case (pageId, postIds) =>
      val page = apiReq.dao.loadPage(pageId) getOrElse throwNotFound(
        "DwE80Bw2", s"Page not found, id: `$pageId'; could not do all changes")
      val postIdsToLoad = loadWhatFn(page, postIds)
      pagesAndPatchSpecs ::= (page, postIdsToLoad)
    }

    BrowserPagePatcher.jsonForThreadsAndPosts(pagesAndPatchSpecs, apiReq)
  }


  private def closeOrReopenTree(apiReq: JsonPostRequest, payload: PostActionPayload)
        : mvc.PlainResult = {

    if (!apiReq.user_!.isAdmin)
      throwForbidden("DwE95Xf2", "Insufficient permissions to close and reopen threads")

    // *WARNING* duplicated code, see AppReview (and info on how to resolve issue).

    // Play throws java.util.NoSuchElementException: key not found: pageId
    // and e.g. new RuntimeException("String expected")
    // on invalid JSON structure. COULD in some way convert to 400 Bad Request
    // instead of failing with 500 Internal Server Error in Prod mode.
    val pageActionIds = apiReq.body.as[List[Map[String, String]]]

    val actionsByPageId = Utils.parsePageActionIds(pageActionIds) { actionId =>
      PostActionDto("?", apiReq.ctime, payload, postId = actionId,
        loginId = apiReq.loginId_!, userId = apiReq.user_!.id, newIp = None)
    }

    var pagesAndPatchSpecs = List[(PageParts, List[PostPatchSpec])]()

    actionsByPageId foreach { case (pageId, actions) =>
      val pageWithoutMe = apiReq.dao.loadPage(pageId) getOrElse throwNotFound(
        "DwE6Xf80", s"Page not found, id: `$pageId'; could not do all changes")
      val page = pageWithoutMe ++ apiReq.meAsPeople_!

      val (pageWithNewActions, _) = apiReq.dao.savePageActionsGenNotfs(page, actions)

      val patchSpecs = actions.map(a => PostPatchSpec(a.postId, wholeThread = true))
      pagesAndPatchSpecs ::= (pageWithNewActions.parts, patchSpecs)
    }

    BrowserPagePatcher.jsonForThreadsAndPosts(pagesAndPatchSpecs, apiReq)
  }

}

