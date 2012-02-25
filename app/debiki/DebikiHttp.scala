package debiki

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import play.api.mvc._

/**
 * HTTP utilities.
 */
object DebikiHttp {

  def badRequest(errCode: String, message: String): Option[Action[_]] =
    Some(Action(Results.BadRequest(
      "400 Bad Request\nBad URL: " + message + " [error " + errCode + "]"
    )))

  def notFound(errCode: String, message: String): Option[Action[_]] =
    Some(Action(Results.NotFound(
      "404 Not Found\n" + message + " [error " + errCode + "]"
    )))

  def redirect(newPath: String): Option[Action[_]] =
    Some(Action {
      Results.Redirect(newPath)
    })

}

