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

import com.debiki.core._
import com.debiki.core.Prelude._
//import com.twitter.ostrich.stats.Stats
//import com.twitter.ostrich.{admin => toa}
import controllers.Utils.parseIntOrThrowBadReq
import debiki._
import play.api._
import play.api.mvc._
import DebikiHttp._


/** Delegates to debiki.Globals. Also provides some query string based routing,
  * which I'd rather remove actually.
  */
object Global extends GlobalSettings {


  /** Query string based routing and tenant ID lookup.
    * COULD refactor and remove, see QueryStringBasedRouting.
    */
  override def onRouteRequest(request: RequestHeader): Option[Handler] = {
    try {
      routeRequestOrThrow(request)
    }
    catch {
      case DebikiHttp.ResultException(result) =>
        Some(Action(BodyParsers.parse.empty){ _ => result })
    }
  }


  /** Routes requests to the correct controller, based on the query string,
    * e.g. routes ...?reply to AppReply.
    *
    * COULD try to remove this, use the `routes` file instead:
    * I once thuoght that would be a useful API for troubleshooting stuff
    * and trying out things manually, but it turned out not being very useful.
    * So I could remove all this and use Play's routes file instead,
    * and a "standard" server/api/function/... URL * naming approach instead.
    */
  private def routeRequestOrThrow(request: RequestHeader): Option[Handler] = {

    // Ignore the internal API and Javascript and CSS etcetera, in /-/.
    // Right now, when porting from Lift-Web, /classpath/ is also magic.
    if (request.path.startsWith("/-/") ||
        request.path.startsWith("/classpath/") ||
        request.path == "/favicon.ico")
      return super.onRouteRequest(request)

    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, debiki.Globals.systemDao)

    // Parse URL path: find folder, page id and slug.
    val pagePath = PagePath.fromUrlPath(tenantId, request.path) match {
      case PagePath.Parsed.Good(pagePath) => pagePath
      case PagePath.Parsed.Bad(error) => throwBadReq("DwE0kI3E4", error)
      case PagePath.Parsed.Corrected(newPath) => throwRedirect(newPath)
    }

    // BUG: debiki-core html.scala places view=<root> just after '?',
    // so `view' will always be the main funcion.
    // Possible solution: Require that the main function start with
    // version number? v0-reply-to=... but don't require it to be the
    // first one. Also rename `view' to `root' when it identifies the
    // root post -- no, don't rename it, root=title doesn't look nice,
    // but view=title looks nice.

    // Find API version and main function in query string.
    // Example: page?v0-reply-to=123 means version 0 and function `reply-to'.
    val versionAndMainFun =
      request.rawQueryString.takeWhile(x => x != '=' && x != '&')
    // Later:
    //val versionSeparator = versionAndMainFun.indexOf('-')
    //val (versionPrefix, mainFun) =
    // versionAndMainFun.splitAt(versionSeparator)
    //val version = versionPrefix.drop(1).dropRight(1).toInt
    // For now: (until I've updated all HTTP calls to include 'v0-')
    val version = 0
    val versionPrefix = ""
    val mainFun = versionAndMainFun

    // Query string param value lookup.
    def firstValueOf(param: String): Option[String] =
      request.queryString.get(param).map(_.headOption).getOrElse(None)
    def mainFunVal: String =  // COULD be Option instead, change "" to None
      firstValueOf(versionAndMainFun) getOrElse ""
    lazy val mainFunVal_! : String = firstValueOf(versionAndMainFun).getOrElse(
      throwBadReq("DwE0k32", "No `"+ mainFun +"` value specified"))
    def mainFunValAsInt_! = parseIntOrThrowBadReq(mainFunVal_!, "DwE451RW0")

    // Route based on the query string.
    import controllers._
    val App = Application
    val GET = "GET"
    val POST = "POST"
    val action = (mainFun, request.method) match {
      case ("edit", GET) =>
        AppEdit.showEditForm(pagePath, postId = mainFunValAsInt_!)
      case ("view", GET) =>
        PageViewer.viewPost(pagePath)
      case ("rate", POST) =>
        App.handleRateForm(pagePath, postId = mainFunValAsInt_!)
      case ("flag", POST) =>
        App.handleFlagForm(pagePath, postId = mainFunValAsInt_!)
      case ("delete", POST) =>
        App.handleDeleteForm(pagePath, postId = mainFunValAsInt_!)
      case ("viewedits", GET) =>
        AppEditHistory.showForm(pagePath, postId = mainFunValAsInt_!)
      case ("applyedits", POST) =>
        AppEditHistory.handleForm(pagePath)
      case ("get-view-new-page-url", GET) =>
        AppCreatePage.getViewNewPageUrl(pagePath)
      case ("view-new-page", GET) =>
        AppCreatePage.viewNewPage(pagePath, pageId = mainFunVal_!)
      case ("move-page", GET) =>
        AppMoveRenamePage.showMovePageForm(pagePath)
      case ("move-page", POST) =>
        AppMoveRenamePage.handleMovePageForm(pagePath)
      case ("rename-slug", GET) =>
        AppMoveRenamePage.showRenamePageSlugForm(pagePath)
      case ("rename-slug", POST) =>
        AppMoveRenamePage.handleRenamePageSlugForm(pagePath)
      case ("list-pages", GET) =>
        AppList.listPages(pagePath, DebikiHttp.ContentType.Html)
      case ("list-pages.json", GET) =>
        AppList.listPages(pagePath, DebikiHttp.ContentType.Json)
        /*
      case ("list-newest-pages", GET) =>
        AppList.listNewestPages(pagePath, DebikiHttp.ContentType.Html)
      case ("list-newest-pages.json", GET) =>
        AppList.listNewestPages(pagePath, DebikiHttp.ContentType.Json)
        */
      case ("list-actions", GET) =>
        AppList.listActions(pagePath, DebikiHttp.ContentType.Html)
      case ("list-actions.json", GET) =>
        AppList.listActions(pagePath, DebikiHttp.ContentType.Json)
      case ("feed", GET) =>
        App.feed(pagePath)
      case ("act", GET) =>
        PageViewer.showActionLinks(pagePath, postId = mainFunValAsInt_!)
      case ("page-info", GET) =>
        PageViewer.showPageInfo(pagePath)
      case ("unsubscribe", GET) =>
        AppUnsubscribe.showForm(tenantId)
      case ("unsubscribe", POST) =>
        AppUnsubscribe.handleForm(tenantId)
      // If no main function specified:
      case ("", GET) =>
        // CSS and JS are served via asset bundles, so they can be cached forever.
        PageViewer.viewPost(pagePath)
      // If invalid function specified:
      case (fun, met) => throwBadReq(
        "DwEQ435", s"Bad method or query string: `$met' `?$fun'")
    }
    Some(action)
  }


  override def onStart(app: Application) {
    debiki.Globals.onServerStartup(app)
  }


  override def onStop(app: Application) {
    debiki.Globals.onServerShutdown(app)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

