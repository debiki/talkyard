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

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import ApiActions._
import PageActions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Miscellaneous controller functions, including rate, flag and delete comment.
  */
object Application extends mvc.Controller {


  /**
   * Fallback to "public" so public web proxies caches the assets
   * and so certain versions of Firefox caches the assets to disk even
   * if in the future they'll be served over HTTPS.
   *
   * Fallback to 1 hour, for now (I change site specific CSS somewhat
   * infrequently, and might as well disable my browser's cache).
   * MUST set to 0 or use fingerprinting, before allowing anyone but
   * me to edit JS and CSS — or they won't understand why their changes
   * doesn't take effect.
   *
   * See: https://developers.google.com/speed/docs/best-practices/caching
   */
  val siteSpecificCacheControl =
    Play.configuration.getString("debiki.site.assets.defaultCache")
      .getOrElse("public, max-age=3600")


  def handleRateForm(pathIn: PagePath, postId: ActionId)
        = PagePostAction(maxUrlEncFormBytes = 1000)(pathIn) { pageReq =>

    val ratingTags =
      pageReq.listSkipEmpty(HtmlForms.Rating.InputNames.Tag)
      .ifEmpty(throwBadReq("DwE84Ef6", "No rating tags"))

    var rating = Rating(
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

    pageReq.dao.savePageActionsGenNotfs(pageReq, flag::Nil)

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

    if (!pageReq.permsOnPage.deleteAnyReply)
      throwForbidden("DwE0523k1250", "You may not delete that comment")

    val deletion = PostActionDto.toDeletePost(andReplies = wholeTree,
      id = PageParts.UnassignedId, postIdToDelete = postId, loginId = pageReq.loginId_!,
      userId = pageReq.user_!.id, newIp = pageReq.newIp,
      createdAt = pageReq.ctime)

    pageReq.dao.savePageActionsGenNotfs(pageReq, deletion::Nil)

    // COULD include the page html, so Javascript can update the browser.
    OkDialogResult("Deleted", "", // (empty summary)
      "You have deleted it. Sorry but you need to reload the"+
      " page, to notice that it is gone.")
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
      ). map(_._1)  // discards PageMeta, ._2

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
