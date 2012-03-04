/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


import com.debiki.v0._
import com.debiki.v0.Prelude._
import debiki._
import play.api._
import play.api.mvc._


object Global extends GlobalSettings {

  /**
   * Query string based routing and tenant ID lookup.
   */
  override def onRouteRequest(request: RequestHeader): Option[Handler] = {

    def notFound(errCode: String, message: String): Option[Handler] =
      Some(Action { DebikiHttp.NotFoundResult(errCode, message) })
    def badRequest(errCode: String, message: String): Option[Handler] =
      Some(Action { DebikiHttp.BadReqResult(errCode, "Bad URL: "+ message) })
    def redirect(newPath: String): Option[Handler] =
      Some(Action { Results.Redirect(newPath) })

    // Ignore the internal API and Javascript and CSS etcetera, in /-/.
    // Right now, when porting from Lift-Web, /classpath/ is also magic.
    if (request.path.startsWith("/-/") ||
        request.path.startsWith("/classpath/"))
      return super.onRouteRequest(request)

    // Lookup tenant id in database. (Should cache it.)
    val scheme = "http" // for now
    val tenantId = Debiki.Dao.lookupTenant(scheme, request.host) match {
      case found: FoundChost => found.tenantId
      case found: FoundAlias => found.role match {
        case TenantHost.RoleRedirect =>
          return redirect(found.canonicalHostUrl + request.path)
        case TenantHost.RoleLink => unimplemented("<link rel='canonical'>")
        case _ =>
          // lookupTenant should have returned FoundChost instead
          // of FoundAlias with RoleCanonical/Duplicate.
          assErr("DwE01k5Bk08")
      }
      case FoundNothing =>
        return notFound("DwEI5F2", "The specified host name maps to no tenant.")
    }

    // Parse URL path: find folder, page id and slug.
    val pagePath = PagePath.fromUrlPath(tenantId, request.path) match {
      case PagePath.Parsed.Good(pagePath) => pagePath
      case PagePath.Parsed.Bad(error) => return badRequest("DwE0kI3E4", error)
      case PagePath.Parsed.Corrected(newPath) => return redirect(newPath)
    }

    // Find API version and main function in query string.
    // Example: page?v0-reply-to=123 means version 0 and function `reply-to'.
    val versionAndMainFun = request.rawQueryString.takeWhile(_ != '=')
    // Later:
    //val versionSeparator = versionAndMainFun.indexOf('-')
    //val (versionPrefix, mainFun) =
    // versionAndMainFun.splitAt(versionSeparator)
    //val version = versionPrefix.drop(1).dropRight(1).toInt
    // For now: (until I've updated all HTTP calls to include 'v0-')
    val version = 0
    val versionPrefix = ""
    val mainFun = versionAndMainFun

    // Find parameters common to almost all requests.
    val pageRoot: PageRoot =
      request.queryString.get("view").map(rootPosts => rootPosts.size match {
        case 1 => PageRoot(rootPosts.head)
        // It seems this cannot hapen with Play Framework:
        case 0 => assErr("DwE03kI8", "Query string param with no value")
        case _ => return badRequest("DwE0k35", "Too many `view' values")
      }) getOrElse PageRoot.TheBody

    // Query string param value lookup.
    def firstValueOf(param: String): Option[String] =
      request.queryString.get(param).map(_.headOption).getOrElse(None)
    def mainFunVal: String =  // COULD be Option instead, change "" to None
      firstValueOf(versionAndMainFun) getOrElse ""
    lazy val mainFunVal_! : String = firstValueOf(versionAndMainFun).getOrElse(
      return badRequest("DwE0k32", "No post to edit specified"))

    // Route based on the query string.
    import controllers._
    val App = Application
    val GET = "GET"
    val POST = "POST"
    val action = (mainFun, request.method) match {
      case ("edit", GET) =>
        AppEdit.showEditForm(pagePath, pageRoot, postId = mainFunVal_!)
      case ("edit", POST) =>
        AppEdit.handleEditForm(pagePath, pageRoot, postId = mainFunVal_!)
      case ("view", GET) =>
        App.viewPost(pagePath, postId = mainFunVal)
      case ("feed", GET)
        => App.feedNews(pagePath)
      // If no main function specified:
      case ("", GET) =>
        pagePath.suffix match {
          case "css" => App.rawBody(pagePath)
          case _ => App.viewPost(pagePath, postId = Page.BodyId)
        }
      // If invalid function specified:
      case (fun, met) => return badRequest(
        "DwEQ435", "Bad method or query string main function: "+
           met +" ?"+ fun)
    }
    Some(action)
  }

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

