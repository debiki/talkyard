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

import com.debiki.core._
import debiki._
import io.efdi.server.http._
import javax.inject.Inject
import play.api._
import play.api.mvc.{Action => _, _}
import DebikiHttp._



/** Miscellaneous controller functions -- try to move elsewhere and/or rename this class
  */
class Application @Inject() extends mvc.Controller {


  def methodNotAllowed = ExceptionAction { request =>
    MethodNotAllowedResult
  }


  def flag = PostJsonAction(RateLimits.FlagPost, maxBytes = 2000) { request =>
    val body = request.body
    val dao = request.dao
    val pageId = (body \ "pageId").as[PageId]
    val postNr = (body \ "postNr").as[PostNr]
    val typeStr = (body \ "type").as[String]
    val reason = (body \ "reason").as[String]

    val flagType = typeStr match {
      case "Spam" => PostFlagType.Spam
      case "Inapt" => PostFlagType.Inapt
      case "Other" => PostFlagType.Other
      case x => throwBadReq("DwE7PKTS3", s"Bad flag type: '$x'")
    }

    // COULD save `reason` somewhere, but where? Where does Discourse save it?

    dao.throwIfMayNotSeePageUseCache(pageId, request.user)

    val postsHidden = try {
      dao.flagPost(pageId = pageId, postNr = postNr, flagType,
        flaggerId = request.theUser.id)
    }
    catch {
      case DbDao.DuplicateVoteException =>
        throwForbidden("EdE5PKY02", "You have already flagged this post")
    }

    // If some posts got hidden, then rerender them as hidden, so the flagger sees they got hidden.
    val json = ReactJson.makeStorePatchForPosts(
      postsHidden.map(_.id).toSet, showHidden = false, dao)
    OkSafeJson(json)
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
   * /
  def feed(pathIn: PagePath) = PageGetAction(pathIn, pageMustExist = false) {
        pageReq =>

    throwNotImplemented("DwE5JKP4", "Currently disabled: Atom or RSS feeds, not with new Post2") /*
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
        unimplemented("Loading pages in order to render Atom feeds", "DwE0GY23") /* loadPageParts is gone
        val page = pageReq.dao.loadPageParts(pageId)
        page.map(p => List(feedPagePath -> p)).getOrElse(Nil)
        */
    }

    val mostRecentPageCtime: ju.Date =
      pathsAndPages.headOption.map(pathAndPage =>
        pathAndPage._2.getPost_!(PageParts.BodyId).creationDati
      ).getOrElse(new ju.Date)

    val feedUrl = pageReq.origin + pageReq.request.uri

    val feedXml = AtomFeedXml.renderFeed(
      hostUrl = pageReq.origin,  // should rename hostUrl to origin
      feedId = feedUrl,  // send url path + query instead?
      feedTitle = tenant.name +", "+ pagePath.value,
      feedUpdated = mostRecentPageCtime,
      pathsAndPages)

    OkXml(feedXml, "application/atom+xml")
    */
  } */

}
