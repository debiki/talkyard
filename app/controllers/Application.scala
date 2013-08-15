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
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import DebikiHttp._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Miscellaneous controller functions, including rate, flag and delete comment.
  */
object Application extends mvc.Controller {


  def handleRateForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(maxUrlEncFormBytes = 1000)(pathIn) { pageReq =>

    val ratingTags =
      pageReq.listSkipEmpty(HtmlForms.Rating.InputNames.Tag)
      .ifEmpty(throwBadReq("DwE84Ef6", "No rating tags"))

    val rating = Rating(
      id = PageParts.UnassignedId, postId = postId, ctime = pageReq.ctime,
      loginId = pageReq.loginId_!, userId = pageReq.user_!.id, newIp = pageReq.newIp,
      // COULD use a Seq not a List, and get rid of the conversion
      tags = ratingTags.toList)

    pageReq.dao.savePageActionsGenNotfs(pageReq, rating::Nil)
    Utils.renderOrRedirect(pageReq)
  }


  def handleFlagForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(MaxDetailsSize)(pathIn) { pageReq =>

    import HtmlForms.FlagForm.{InputNames => Inp}

    val reasonStr = pageReq.getEmptyAsNone(Inp.Reason) getOrElse
      throwBadReq("DwE1203hk10", "Please select a reason")
    val reason = try { FlagReason withName reasonStr }
      catch {
        case _: NoSuchElementException =>
          throwBadReq("DwE93Kf3", "Invalid reason")
      }
    val details = pageReq.getNoneAsEmpty(Inp.Details)

    val flag = Flag(id = PageParts.UnassignedId, postId = postId,
      loginId = pageReq.loginId_!, userId = pageReq.user_!.id, newIp = pageReq.newIp,
      ctime = pageReq.ctime, reason = reason, details = details)

    // Cancel any preliminary approval, sice post has been flagged.
    /*
    val flaggedPost = pageReq.page_!.getPost_!(postId)
    val anyPrelApprovalCancellation =
      if (!flaggedPost.currentVersionPrelApproved) Nil
      else {
        PostActionDto.forCancellationOfPrelApproval
      } */

    pageReq.dao.savePageActionsGenNotfs(pageReq, flag::Nil) // anyPrelApprovalCancellation)

    // COULD include the page html, so Javascript can update the browser.
    OkDialogResult("Thanks", "", // (empty summary)
      "You have reported it. Someone will review it and"+
      " perhaps delete it or remove parts of it.")
  }


  def handleDeleteForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(MaxDetailsSize)(pathIn) { pageReq =>

    import HtmlForms.Delete.{InputNames => Inp}
    val wholeTree = "t" == pageReq.getNoneAsEmpty(Inp.DeleteTree).
       ifNotOneOf("tf", throwBadReq("DwE93kK3", "Bad whole tree value"))
    val reason = pageReq.getNoneAsEmpty(Inp.Reason)

    val post = pageReq.page_!.getPost_!(postId)
    val isAuthor = post.userId == pageReq.user_!.id

    if (!isAuthor && !pageReq.permsOnPage.deleteAnyReply)
      throwForbidden("DwE0523k1250", "You may not delete that comment")

    if (wholeTree && !pageReq.permsOnPage.deleteAnyReply) {
      // Deny operation, even if there are 0 replies, because another JVM thread
      // might create a reply at any time.
      throwForbidden("DwE74GKt5", "You may not delete that whole comment tree")
    }

    val deletion = PostActionDto.toDeletePost(andReplies = wholeTree,
      id = PageParts.UnassignedId, postIdToDelete = postId, loginId = pageReq.loginId_!,
      userId = pageReq.user_!.id, newIp = pageReq.newIp,
      createdAt = pageReq.ctime)

    val (page, _) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, deletion::Nil)

    val json = BrowserPagePatcher(pageReq).jsonForThreadsAndPosts(
      page.parts, BrowserPagePatcher.PostPatchSpec(postId, wholeThread = wholeTree))

    Utils.OkSafeJson(json)
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
        sortBy = PageSortOrder.ByPublTime,
        limit = 10,
        offset = 0
      ).map(_.path)

    // Access control.
    // Somewhat dupl code, see AppList.listNewestPages.
    val feedPathsPublic = feedPagePaths filter (Utils.isPublicArticlePage _)

    val pathsAndPages: Seq[(PagePath, PageParts)] = feedPathsPublic flatMap {
      feedPagePath =>
        val pageId: String = feedPagePath.pageId.getOrElse {
          errDbgDie("[error DwE012210u9]")
          "GotNoGuid"
        }
        val page = pageReq.dao.loadPage(pageId)
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
      feedTitle = tenant.name +", "+ pagePath.path,
      feedUpdated = mostRecentPageCtime,
      pathsAndPages)

    OkXml(feedXml, "application/atom+xml")
  }


  def viewAdminPage() = GetAction { apiReq =>
    if (apiReq.user.map(_.isAdmin) != Some(true))
      Ok(views.html.login(xsrfToken = apiReq.xsrfToken.value,
        returnToUrl = apiReq.uri, title = "Login", message = Some(
          "Login as administrator to access this page.")))
    else
      Ok(views.html.adminPage(apiReq.host).body) as HTML withCookies (
          mvc.Cookie(
            DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value,
            httpOnly = false))
  }

}
