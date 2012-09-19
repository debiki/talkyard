/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.Utils._
import debiki._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import xml.{Node, NodeSeq}
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


  def listPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>
    val pathsAndDetails = pageReq.dao.listPagePaths(
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
        val pageNode = renderPageListHtml(pathsAndDetails)
        OkHtml(<html><body>{pageNode}</body></html>)
      case DebikiHttp.ContentType.Json =>
        OkSafeJson(toJson(Map("pages" -> (
           pathsAndDetails map { case (pagePath, pageDetails) =>
             toJson(Map(
               "id" -> pagePath.pageId.get,
               "folder" -> pagePath.folder,
               "path" -> pagePath.path
             ))
           }))))
    }
  }


  def listNewestPages(pathIn: PagePath, contentType: DebikiHttp.ContentType) =
        PageGetAction(pathIn, pageMustExist = false) { pageReq =>

    val pathsAndDetails = pageReq.dao.listPagePaths(
      Utils.parsePathRanges(pathIn, pageReq.queryString),
      include = PageStatus.Published::Nil,
      sortBy = PageSortOrder.ByPublTime,
      limit = 10,
      offset = 0)

    // For now:
    // As of now, this function is used to build blog article list pages.
    // So exclude JS and CSS and template pages and hidden pages and
    // folder/or/index/pages/.
    // In the future: Pass info via URL to `listPagePaths` on which
    // pages to include. Some PageType param? PageType.Article/Css/Js/etc.
    val articlePaths = pathsAndDetails map (_._1) filterNot { pagePath =>
      pagePath.isCodePage || pagePath.isTemplatePage ||
         pagePath.isHiddenPage || pagePath.isFolderOrIndexPage
    }

    val pathsAndPages: Seq[(PagePath, Option[Debate])] =
      pageReq.dao.loadPageBodiesTitles(articlePaths)

    def titleOf(page: Option[Debate]): String =
      // Currenply HtmlSerializer ignores the `.markup` for a title Post.
      page.flatMap(_.title).map(_.text).getOrElse("(No title)")

    def bodyOf(page: Option[Debate]): String =
      page.flatMap(_.body).map(
        HtmlSerializer.markupTextOf(_, pageReq.host)).getOrElse("")

    def pageTitlesAndBodiesHtml =
      <ol>{
        pathsAndPages map { case (path, pageOpt) =>
          val pageApproved = pageOpt map (_.approvedVersion)
          <li>
            <h1>{xml.Unparsed(titleOf(pageApproved))}</h1>
            <p><a href={path.path}>{path.path}</a></p>
            <div>{xml.Unparsed(bodyOf(pageApproved))}</div>
          </li>
        }
      }</ol>

    def pageTitlesAndBodiesJson =
      toJson(Map("pages" -> (
         pathsAndPages map { case (pagePath, pageOpt: Option[Debate]) =>
           val pageApproved = pageOpt map (_.approvedVersion)
           toJson(Map(
             "id" -> pagePath.pageId.get,
             "folder" -> pagePath.folder,
             "path" -> pagePath.path,
             "title" -> titleOf(pageApproved),
             "body" -> bodyOf(pageApproved)))
         })))

    contentType match {
      case DebikiHttp.ContentType.Html =>
        // For debugging mostly.
        OkHtmlBody(pageTitlesAndBodiesHtml)
      case DebikiHttp.ContentType.Json =>
        // For rendering e.g. newest blog articles list via Javascrpit.
        OkSafeJson(pageTitlesAndBodiesJson)
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

    val (actions, people: People) = pageReq.dao.loadRecentActionExcerpts(
      fromIp = fromIpOpt, byIdentity = byIdtyOpt, pathRanges = pathRanges,
      limit = ActionCountLimit)

    // COULD rename this function to listPosts?
    // Or:  ?list-actions&type=posts&...
    def posts = actions filter (_.action.isInstanceOf[Post])

    contentType match {
      case DebikiHttp.ContentType.Html =>
        Ok(views.html.listActions(actions))
      case DebikiHttp.ContentType.Json =>
        OkSafeJson(toJson(Map(
          "actions" -> JsArray(posts.map(_jsonFor _)),
          "users" -> JsArray(people.users.map(_jsonFor _)),
          "postTextLengthLimit" -> JsNumber(PostTextLengthLimit),
          // This limit is only approximate, if you list pages both
          // by folder path and by page id. see
          //   RelDbTenantDao.loadRecentActionExcerpts(),
          // which does a `(select ... limit ...) union (select ... limit ...)`.
          "actionCountApproxLimit" -> JsNumber(ActionCountLimit))))
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


  private def _jsonFor(action: ViAc): JsValue = {
    var data = Map[String, JsValue](
      "id" -> JsString(action.id),
      "pageId" -> JsString(action.page.id),
      "type" -> JsString(classNameOf(action.action)),
      "userId" -> JsString(action.user_!.id),
      "idtyId" -> JsString(action.identity_!.id),
      "loginId" -> JsString(action.loginId),
      "cdati" -> JsString(toIso8601T(action.creationDati)))

    action match {
      case post: ViPo =>
        data += "text" -> JsString(post.text take PostTextLengthLimit)
        if (post.editsAppliedDescTime.nonEmpty)
          data += "editsAppliedCount" -> JsNumber(post.editsAppliedDescTime.length)
        if (post.editsPendingDescTime.nonEmpty)
          data += "editsPendingCount" -> JsNumber(post.editsPendingDescTime.length)

        val status =
          if (post.currentVersionApproved) "Approved"
          else if (post.currentVersionRejected) {
            if (post.someVersionApproved) "EditsRejected"
            else "Rejected"
          }
          else if (post.someVersionApproved) "NewEdits"
          else "New"
        data += "status" -> JsString(status)

        if (post.flagsPendingReview nonEmpty)
          data += "newFlags" -> _jsonFor(post.flagsPendingReview)
        if (post.flagsReviewed nonEmpty)
          data += "oldFlags" -> _jsonFor(post.flagsReviewed)

      case _ =>
    }

    toJson(data)
  }


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
  }

}

