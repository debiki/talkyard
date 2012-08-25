/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import java.{util => ju}
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.libs.json.Json
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
import Actions._
import DebikiHttp._
import Prelude._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}


/**
 * Lists folders, pages and actions.
 */
object AppList extends mvc.Controller {


  def listPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pagePaths = pageReq.dao.listPagePaths(
      Utils.parsePathRanges(pathIn, pageReq.queryString),
      include = PageStatus.All,
      sortBy = PageSortOrder.ByPath,
      limit = Int.MaxValue,
      offset = 0)

    def renderPageListHtml(pagePathsDetails: Seq[(PagePath, PageDetails)]) =
      <ol>{
        for ((pagePath, details) <- pagePathsDetails) yield {
          <li><a href={pagePath.path}>{pagePath.path}</a></li>
        }
      }</ol>

    contentType match {
      case DebikiHttp.ContentType.Html =>
        val pageNode = renderPageListHtml(pagePaths)
        OkHtml(<html><body>{pageNode}</body></html>)
      case DebikiHttp.ContentType.Json =>
        Ok(toJson(Map("pages" -> (
           pagePaths map { case (pagePath, pageDetails) =>
             toJson(Map(
               "id" -> pagePath.pageId.get,
               "folder" -> pagePath.folder,
               "path" -> pagePath.path
             ))
           }))))
    }
  }


  def listActions(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>

    val fromIpOpt = pageReq.queryString.getEmptyAsNone("from-ip")
    val byIdtyOpt = pageReq.queryString.getEmptyAsNone("by-identity")
    val pathRanges = {
      import pageReq.pagePath
      if (pagePath.isFolderOrIndexPage)
        Utils.parsePathRanges(pagePath, pageReq.queryString)
      else throwBadReq(
        "DwE92GK31", "Currently you cannot list actions on single pages. "+
        "Try with http://server-address/?list-actions")
    }

    val actions = pageReq.dao.loadRecentActionExcerpts(
      fromIp = fromIpOpt, byIdentity = byIdtyOpt, pathRanges = pathRanges,
      limit = 500)

    contentType match {
      case DebikiHttp.ContentType.Html =>
        Ok(views.html.listActions(actions))
      case DebikiHttp.ContentType.Json =>
        Ok(toJson(Map("actions" -> (
          actions map { action =>
            toJson(Map(
              "id" -> action.id,
              "pageId" -> action.page.id,
              "type" -> "Moo", //DebikiHttp.typeNameOf(action),
              "userId" -> "Mää", // action.user_!.id
              "idtyId" -> "Möö", // action.identity_!.id
              "loginId" -> action.action.loginId,
              "cdati" -> toIso8601T(action.ctime)
            ))
          }))))
    }
  }


  def listUsers(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    Ok
  }


  def listIps(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    Ok
  }

}

