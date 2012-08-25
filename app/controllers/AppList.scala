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
        unimplemented
    }
  }


  def listActions(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val actionLocators = pageReq.dao.listActions(
      Utils.parsePathRanges(pathIn, pageReq.queryString),
      includePages = PageStatus.All,
      limit = 700, offset = 0)
    contentType match {
      case DebikiHttp.ContentType.Html =>
        Ok(views.html.listActions(actionLocators))
      case DebikiHttp.ContentType.Json =>
        unimplemented
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

