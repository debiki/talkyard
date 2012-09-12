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
import HtmlSerializer.SerializedSingleThread


/**
 * Makes HTTP replies that describe changes to a page.
 * When a browser gets such a reply, it updates the page.
 * For example, the browser adds a new reply, or updates a comment
 * to show the most recent edits.
 */
object BrowserPagePatcher {

  implicit private val logger = play.api.Logger(this.getClass)


  def jsonForMyNewPosts(pageReq: PageRequest[_], myNewPosts: List[Post])
        : pm.PlainResult = {

    val page = pageReq.pageWithMe_! ++ myNewPosts
    val pageTrust = PageTrust(page)
    val config = DebikiHttp.newUrlConfig(pageReq.host)
    val serializer = HtmlSerializer(page, pageTrust, config,
      // If replying with a comment, comments should be shown of course.
      // If editing, replies aren't (well, won't be) included in the patch
      // anyway, so the value of `showComments` wouldn't matter.
      showComments = true)
    val postsAndHtml: List[(Post, SerializedSingleThread)] =
          myNewPosts map { post =>
      val serializedThread = serializer.serializeSingleThread(
         post.id, pageReq.pageRoot) getOrElse logAndThrowInternalError(
            "DwE3EH48", "Post not found, id: "+ post.id +", page: "+ page.id)
      (post, serializedThread)
    }

    OkSafeJson(toJson(Map(
      "newThreads" -> JsArray(postsAndHtml map {
            case (post, serializedThread) =>
              _jsonForNewPost(post, serializedThread)
      })
   )))
  }


  private def _jsonForNewPost(post: Post,
        serializedThread: SerializedSingleThread): JsValue = {
    var data = Map[String, JsValue](
      "id" -> JsString(post.id),
      "cdati" -> JsString(toIso8601T(post.ctime)),
      "approved" -> JsBoolean(post.approval.isDefined),
      "html" -> JsString(serializedThread.htmlNodes.foldLeft("") {
        (html, htmlNode) => html + lw.Html5.toString(htmlNode)
      }))

    if (post.parent != post.id) {
      data += "parentThreadId" -> JsString(post.parent)
    }

    serializedThread.prevSiblingId.foreach { siblingId =>
      data += "prevThreadId" -> JsString(siblingId)
    }

    toJson(data)
  }

}
