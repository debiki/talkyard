/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */


import play.api._


object Global extends GlobalSettings {

  /**
   * Query string based routing.
   */
  override def onRouteRequest(
    request: mvc.RequestHeader): Option[mvc.Handler] = {

    // Ignore the internal API and Javascript and CSS etcetera.
    if (request.path startsWith "/-/")
      return super.onRouteRequest(request)

    // Route based on the query string.
    val mainFun = request.rawQueryString.takeWhile(_ != '=')
    val App = controllers.Application
    val action = mainFun match {
      case "edit" => App.editPost(request.path)
      case "view" => App.viewPost(request.path)
      case _ => return super.onRouteRequest(request)
    }
    Some(action)
  }


  // Could:
  // override def onError(request: RequestHeader, ex: Throwable)
  // override def onBadRequest
  // override def onActionNotFound

}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqn list ft=scala

