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
import controllers.Utils._
import debiki._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import requests.DebikiRequest
import xml.{Node, NodeSeq}
import DebikiHttp._
import Utils.ValidationImplicits._


/**
 * Lists folders, pages and actions.
 */
object ListController extends mvc.Controller {


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
      orderOffset = PageOrderOffset.ByPath,
      limit = Int.MaxValue)

    def renderPageListHtml(pagePathsDetails: Seq[PagePathAndMeta]) =
      <ol>{
        for (PagePathAndMeta(pagePath, _, details) <- pagePathsDetails) yield {
          <li>
            <a href={pagePath.value}>{pagePath.value}</a>,
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
        OkSafeJson(toJson(Map("pages" -> pathsAndDetails.map(jsonForPathAndMeta(_)))))
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


  def listUsers = GetAction { implicit request =>
    if (!request.user_!.isAdmin) {
      // Could list the current user itself only. But for now:
      throwForbidden("DwE71FKZ0", "Insufficient permissions to list users")
    }
    val usersAndIdEndpoints = request.dao.listUsers(UserQuery())
    OkSafeJson(toJson(Map("users" -> (
      usersAndIdEndpoints map { case (user, identityEndpoints) =>
        jsonForUser(user)
      }))))
  }


  def listIps(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    Ok
  }


  def jsonForPath(pagePath: PagePath): JsValue =
    toJson(jsonMapForPath(pagePath))


  // COULD move to other file, e.g. DebikiJson.scala?
  private def jsonForPathAndMeta(pathAndMeta: PagePathAndMeta): JsValue = {
    var data = jsonMapForPath(pathAndMeta.path)
    def pageMeta = pathAndMeta.meta

    data += "role" -> JsString(pageMeta.pageRole.toString)
    data += "status" -> JsString(pageMeta.status.toString)

    if (pageMeta.parentPageId.isDefined)
      data += "parentPageId" -> JsString(pageMeta.parentPageId.get)

    unimplemented("Loading pagle title, inserting as json. SHOULD.") /*
    if (pageMeta.cachedTitle.isDefined)
      data += "title" -> JsString(pageMeta.cachedTitle.get)
      */

    if (pageMeta.embeddingPageUrl.isDefined)
      data += "embeddingPageUrl" -> JsString(pageMeta.embeddingPageUrl.get)

    toJson(data)
  }


  private def jsonMapForPath(pagePath: PagePath): Map[String, JsString] = Map(
    "id" -> JsString(pagePath.pageId.get),
    "folder" -> JsString(pagePath.folder),
    "path" -> JsString(pagePath.value))


  private def jsonForUser(user: User): JsValue = {
    var info = Map[String, JsValue](
      "id" -> JsNumber(user.id),
      "displayName" -> JsString(user.displayName),
      "country" -> JsString(user.country))

    if (user.isAdmin) info += "isAdmin" -> JsBoolean(true)
    if (user.isOwner) info += "isOwner" -> JsBoolean(true)
    // Skip email for now, currently no particular access control.

    toJson(info)
  }

}

