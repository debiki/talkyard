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

package controllers

import actions.ApiActions._
import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.OkSafeJson
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import requests.PageRequest
import DebikiHttp._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Miscellaneous controller functions, including rate, flag and delete comment.
  */
object Application extends mvc.Controller {


  def flag = PostJsonAction(RateLimits.FlagPost, maxLength = 2000) { request =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val postId = (body \ "postId").as[PostId]
    val typeStr = (body \ "type").as[String]
    val reason = (body \ "reason").as[String]

    val tyype = try { FlagType withName typeStr }
      catch {
        case _: NoSuchElementException =>
          throwBadReq("DwE93Kf3", "Invalid flag type")
      }

    val flag = RawPostAction(id = PageParts.UnassignedId, creationDati = request.ctime,
      payload = PostActionPayload.Flag(tyype = tyype, reason = reason),
      postId = postId, userIdData = request.userIdData)

    // Cancel any preliminary approval, sice post has been flagged.
    /*
    val flaggedPost = pageReq.page_!.getPost_!(postId)
    val anyPrelApprovalCancellation =
      if (!flaggedPost.currentVersionPrelApproved) Nil
      else {
        RawPostAction.forCancellationOfPrelApproval
      } */

    val pageReq = PageRequest.forPageThatExists(request, pageId) getOrElse throwNotFound(
      "DwE739W2", s"Page `$pageId' not found")

    val (updatedPage, _) =
      request.dao.savePageActionsGenNotfs(pageReq, flag::Nil) // anyPrelApprovalCancellation)

    val post = updatedPage.parts.thePost(postId)
    OkSafeJson(ReactJson.postToJson(post))
  }


  def handleDeleteForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(RateLimits.DeletePost, MaxDetailsSize)(pathIn) { pageReq =>

    import HtmlForms.Delete.{InputNames => Inp}
    val wholeTree = "t" == pageReq.getNoneAsEmpty(Inp.DeleteTree).
       ifNotOneOf("tf", throwBadReq("DwE93kK3", "Bad whole tree value"))
    val reason = pageReq.getNoneAsEmpty(Inp.Reason)

    val post = pageReq.thePageParts.getPost_!(postId)
    val isAuthor = post.userId == pageReq.user_!.id

    if (!isAuthor && !pageReq.permsOnPage.deleteAnyReply)
      throwForbidden("DwE0523k1250", "You may not delete that comment")

    if (post.isDeletedSomehow)
      throwForbidden("DwE7Hf038", "Comment already deleted")

    if (wholeTree && !pageReq.permsOnPage.deleteAnyReply) {
      // Deny operation, even if there are 0 replies, because another JVM thread
      // might create a reply at any time.
      throwForbidden("DwE74GKt5", "You may not delete that whole comment tree")
    }

    val deletion = RawPostAction.toDeletePost(andReplies = wholeTree,
      id = PageParts.UnassignedId, postIdToDelete = postId,
      userIdData = pageReq.userIdData,
      createdAt = pageReq.ctime)

    val (updatedPage, _) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, deletion::Nil)

    val postAfter = updatedPage.parts.thePost(postId)
    OkSafeJson(ReactJson.postToJson(postAfter))
  }


  /**
   * Usage example:
   *   /some/site/section/?feed=atom&for-tree&limit=X&partial
   * — this would feed atom for pages below /some/site/section/,
   * the 10 most recent pages only, and only parts of each page
   * would be included (e.g. the first 50 words).
   *
   * However: &limit and &partial | &full haven't been implemented.
   *
   * `limit` may be at most 10.
   */
  def feed(pathIn: PagePath) = PageGetAction(pathIn, pageMustExist = false) {
        pageReq =>

    import pageReq.{pagePath}

    // The tenant's name will be included in the feed.
    val tenant: Tenant = pageReq.dao.loadTenant()

    val feedPagePaths =
      if (!pagePath.isFolderOrIndexPage) List(pagePath)
      else pageReq.dao.listPagePaths(
        Utils.parsePathRanges(pageReq.pagePath.folder, pageReq.request.queryString,
           urlParamPrefix = "for"),
        include = List(PageStatus.Published),
        orderOffset = PageOrderOffset.ByPublTime,
        limit = 10).map(_.path)

    // Access control.
    // Somewhat dupl code, see AppList.listNewestPages.
    val feedPathsPublic = feedPagePaths filter (Utils.isPublicArticlePage _)

    val pathsAndPages: Seq[(PagePath, PageParts)] = feedPathsPublic flatMap {
      feedPagePath =>
        val pageId: String = feedPagePath.pageId.getOrElse {
          errDbgDie("[error DwE012210u9]")
          "GotNoGuid"
        }
        val page = pageReq.dao.loadPageParts(pageId)
        page.map(p => List(feedPagePath -> p)).getOrElse(Nil)
    }

    val mostRecentPageCtime: ju.Date =
      pathsAndPages.headOption.map(pathAndPage =>
        pathAndPage._2.getPost_!(PageParts.BodyId).creationDati
      ).getOrElse(new ju.Date)

    val feedUrl = "http://"+ pageReq.request.host + pageReq.request.uri

    val feedXml = AtomFeedXml.renderFeed(
      hostUrl = "http://"+ pageReq.request.host,
      feedId = feedUrl,
      feedTitle = tenant.name +", "+ pagePath.value,
      feedUpdated = mostRecentPageCtime,
      pathsAndPages)

    OkXml(feedXml, "application/atom+xml")
  }

}
