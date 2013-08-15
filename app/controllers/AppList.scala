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
import com.debiki.core.Prelude._
import controllers.Utils._
import debiki._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
import ApiActions._
import PageActions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._


/**
 * Lists folders, pages and actions.
 */
object AppList extends mvc.Controller {


  val ActionCountLimit = 100
  val PostTextLengthLimit = 500


  def listPages = GetAction { implicit request =>
    val pathRanges = Utils.parsePathRanges("/", request.queryString)
    listPagesImpl(pathRanges, DebikiHttp.ContentType.Json)
  }


  def listPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { implicit pageReq =>
    if (!pageReq.user_!.isAdmin) {
      // If ever allowing non-admins to list any pages, fitler out
      // folders that start with a dot, e.g. /some/.folder/.
      throwForbidden("DwE84Zi31", "Insufficient permissions to list pages")
    }
    val pathRanges = Utils.parsePathRanges(pathIn.folder, pageReq.queryString)
    listPagesImpl(pathRanges, contentType)
  }


  def listPagesImpl(pathRanges: PathRanges, contentType: DebikiHttp.ContentType)(
        implicit request: DebikiRequest[_]) = {

    val pathsAndDetails = request.dao.listPagePaths(
      pathRanges,
      include = PageStatus.All,
      sortBy = PageSortOrder.ByPath,
      limit = Int.MaxValue,
      offset = 0)

    def renderPageListHtml(pagePathsDetails: Seq[PagePathAndMeta]) =
      <ol>{
        for (PagePathAndMeta(pagePath, _, details) <- pagePathsDetails) yield {
          <li>
            <a href={pagePath.path}>{pagePath.path}</a>,
            { details.pageRole.toString +
              details.parentPageId.map(", parent page id: "+ _).getOrElse("") }
          </li>
        }
      }</ol>

    contentType match {
      case DebikiHttp.ContentType.Html =>
        val pageNode = renderPageListHtml(pathsAndDetails)
        OkHtml(<html><body>{pageNode}</body></html>)
      case DebikiHttp.ContentType.Json =>
        OkSafeJson(toJson(Map("pages" -> pathsAndDetails.map(jsonFor(_)))))
    }
  }


  /*
  def listNewestPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>

    val tpi = TinyTemplateProgrammingInterface(pageReq)

    val pages = tpi.listNewestPages(
      Utils.parsePathRanges(pathIn.folder, pageReq.queryString))

    def pageTitlesAndBodiesHtml =
      <ol>{
        pages map { page =>
          <li>
            <h1>{xml.Unparsed(page.title)}</h1>
            <p><a href={page.path}>{page.path}</a></p>
            <div>{xml.Unparsed(page.safeBodyHtml)}</div>
          </li>
        }
      }</ol>

    def pageTitlesAndBodiesJson =
      toJson(Map("pages" -> (
        pages map { page =>
          toJson(Map(
            "id" -> page.id,
            "path" -> page.path,
            "title" -> page.title,
            "body" -> page.safeBodyHtml))
        })))

    contentType match {
      case DebikiHttp.ContentType.Html =>
        // For debugging mostly.
        OkHtmlBody(pageTitlesAndBodiesHtml)
      case DebikiHttp.ContentType.Json =>
        // For rendering e.g. newest blog articles list via Javascrpit.
        OkSafeJson(pageTitlesAndBodiesJson)
    }
  }*/


  def listActions(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>

    if (!pageReq.user_!.isAdmin) {
      // If ever allowing non-admins to list actions, by default,
      // show only the user's own actions, and replies to them.  ?
      throwForbidden("DwE401zG7", "Insufficient permissions to list actions")
    }

    /*
    val fromIpOpt = pageReq.queryString.getEmptyAsNone("from-ip")
    val byIdtyOpt = pageReq.queryString.getEmptyAsNone("by-identity")
    val pathRanges = {
      import pageReq.pagePath
      if (pagePath.isFolderOrIndexPage)
        Utils.parsePathRanges(pagePath.folder, pageReq.queryString)
      else throwBadReq(
        "DwE92GK31", "Currently you cannot list actions on single pages. "+
        "Try with http://server-address/?list-actions")
    }

    val (actions, people: People) = pageReq.dao.loadRecentActionExcerpts(
      fromIp = fromIpOpt, byIdentity = byIdtyOpt, pathRanges = pathRanges,
      limit = ActionCountLimit)

    // COULD rename this function to listPosts?
    // Or:  ?list-actions&type=posts&...
    def posts = actions filter (_.isInstanceOf[Post])
      */

    val (posts, people: People) =
      pageReq.dao.loadPostsRecentlyActive(limit = ActionCountLimit)

    contentType match {
      case DebikiHttp.ContentType.Html =>
        unimplemented // Ok(views.html.listActions(actions))
      case DebikiHttp.ContentType.Json =>
        // Include the SystemUser, because it's the author of the
        // default homepage. (COULD skip adding it, in the future when
        // there's a Robots table and it's added automatically, if needed.)
        val peopleAndSystemUser = people + SystemUser.User
        OkSafeJson(toJson(Map(
          "actions" -> JsArray(posts.map(_jsonFor _)),
          "users" -> JsArray(peopleAndSystemUser.users.map(_jsonFor _)),
          "postTextLengthLimit" -> JsNumber(PostTextLengthLimit),
          // This limit is only approximate, if you list pages both
          // by folder path and by page id. see
          //   RdbSiteDao.loadRecentActionExcerpts(),
          // which does a `(select ... limit ...) union (select ... limit ...)`.
          "actionCountApproxLimit" -> JsNumber(ActionCountLimit))))
    }
  }


  def listUsers = GetAction { implicit request =>
    if (!request.user_!.isAdmin) {
      // Could list the current user itself only. But for now:
      throwForbidden("DwE71FKZ0", "Insufficient permissions to list users")
    }
    val usersAndIdEndpoints = request.dao.listUsers(UserQuery())
    OkSafeJson(toJson(Map("users" -> (
      usersAndIdEndpoints map { case (user, identityEndpoints) =>
        _jsonFor(user)
      }))))
  }


  def listIps(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    Ok
  }


  private def _jsonFor(action: PostActionOld): JsValue = {
    var data = Map[String, JsValue](
      "id" -> JsString(action.id.toString),
      "pageId" -> JsString(action.page.id),
      "type" -> JsString(classNameOf(action)),
      "userId" -> JsString(action.user_!.id),
      "loginId" -> JsString(action.loginId),
      "cdati" -> JsString(toIso8601T(action.creationDati)))

    action match {
      case post: Post =>
        post.approvedText foreach { text =>
          data += "approvedText" -> JsString(text take PostTextLengthLimit)
        }
        post.unapprovedText foreach { text =>
          data += "unapprovedText" -> JsString(text take PostTextLengthLimit)
        }

        val status =
          if (post.currentVersionPrelApproved) {
            if (post.someVersionPermanentlyApproved) "EditsPrelApproved"
            else "NewPrelApproved"
          }
          else if (post.currentVersionApproved) "Approved"
          else if (post.currentVersionRejected) {
            if (post.someVersionPermanentlyApproved) "EditsRejected"
            else "Rejected"
          }
          else if (post.someVersionPermanentlyApproved) "NewEdits"
          else "New"

        data += "status" -> JsString(status)

        if (post.numEditsToReview > 0)
          data += "numEditsToReview" -> JsNumber(post.numEditsToReview)
        if (post.numPendingEditSuggestions > 0)
          data += "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions)
        if (post.numFlags > 0) {
          data += "numPendingFlags" -> JsNumber(post.numPendingFlags)
          data += "numHandledFlags" -> JsNumber(post.numHandledFlags)
        }

        // This info is currently not present in DW1_POSTS and is thus not available
        // in `post` (since it's loaded from DW1_POSTS, not constructed from DW1_PAGE_ACTIONS.
        /*
        if (post.numFlags > 0) {
          data += "flagCountsByReason" -> toJson(post.flagsByReason map { case (reason, flags) =>
            (reason.toString, flags.length)
          })
          data += "firstPendingFlaggerUrl" -> JsString("FIRST_FLAGGER_URL")
          data += "firstPendingFlaggerName" -> JsString("FIRST_FLAGGER_NAME")
          data += "firstPendingFlaggerIp" -> JsString("FIRST_FLAGGER_IP")
          data += "firstPendingFlaggerIpUrl" -> JsString("FIRST_FLAGGER_IP_URL")
        } */

      case _ =>
    }

    toJson(data)
  }


  def jsonFor(pagePath: PagePath): JsValue =
    toJson(_jsonMapFor(pagePath))


  // COULD move to other file, e.g. DebikiJson.scala?
  def jsonFor(pathAndMeta: PagePathAndMeta): JsValue = {
    var data = _jsonMapFor(pathAndMeta.path)
    def pageMeta = pathAndMeta.meta

    data += "role" -> JsString(pageMeta.pageRole.toString)
    data += "status" -> JsString(pageMeta.status.toString)

    if (pageMeta.parentPageId.isDefined)
      data += "parentPageId" -> JsString(pageMeta.parentPageId.get)

    if (pageMeta.cachedTitle.isDefined)
      data += "title" -> JsString(pageMeta.cachedTitle.get)

    toJson(data)
  }


  private def _jsonMapFor(pagePath: PagePath): Map[String, JsString] = Map(
    "id" -> JsString(pagePath.pageId.get),
    "folder" -> JsString(pagePath.folder),
    "path" -> JsString(pagePath.path))


  private def _jsonFor(user: User): JsValue = {
    var info = Map[String, JsValue](
      "id" -> JsString(user.id),
      "displayName" -> JsString(user.displayName),
      "country" -> JsString(user.country))

    if (user.isAdmin) info += "isAdmin" -> JsBoolean(true)
    if (user.isOwner) info += "isOwner" -> JsBoolean(true)
    // Skip email for now, currently no particular access control.

    toJson(info)
  }


  /*
  private def _jsonFor(flags: List[Flag]): JsValue = {
    def jsonForFlag(flag: Flag): JsValue = {
      var data = Map[String, JsValue](
        "cdati" -> JsString(toIso8601T(flag.ctime)),
        "reason" -> JsString(flag.reason.toString))
        // COULD: "userId" -> JsString(flag.user_!.id)
      if (flag.details nonEmpty) data += "details" -> JsString(flag.details)
      toJson(data)
    }
    JsArray(flags map (jsonForFlag _))
  } */

}

