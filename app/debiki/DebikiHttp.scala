package debiki

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import play.api.mvc._
import com.debiki.v0.{HtmlConfig}

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

  // Clean up, delete members.
  def newUrlConfig(_hostAndPort: String) = new HtmlConfig {
    override val loginActionSimple = "/-/api/login-simple"
    override val loginActionOpenId = "/openid/login"  // COULD preifx w "/-/"
    override val logoutAction = "/-/api/logout"
    override val hostAndPort = _hostAndPort
    // COULD avoid recalculating the xsrf token here, already done
    // at the top of _serveActionRequest in Boot.scala.
    override def xsrfToken: String =
      "dummy-xsrf-token"  // TODO //  Xsrf.newToken(ReqVar.sid.get)
    override def termsOfUseUrl = "/terms-of-use"
  }

}

