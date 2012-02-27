/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import net.liftweb.common.{Box, Full, Empty, Failure}
import play.api._
import play.api.mvc.{Action => _, _}
import Prelude._

object Actions {

  /**
   * A page related request.
   *
   * Sometimes only the browser ip is known (then there'd be no
   * Login/Identity/User).
   */
  // COULD rename RequestInfo to PermsOnPageRequest,
  // and use PageRequest instead.
  case class PageRequest(
    tenantId: String,
    ip: String,
    loginId: Option[String],
    identity: Option[Identity],
    user: Option[User],
    /** Ids of groups to which the requester belongs. */
    // userMemships: List[String],
    pagePath: PagePath,
    permsOnPage: PermsOnPage,
    request: Request[AnyContent]
  ){
    require(pagePath.tenantId == tenantId) //COULD remove tenantId from pagePath
  }

  def PageReqAction(pathIn: PagePath)(f: PageRequest => PlainResult) =
        CheckSidAndPathAction(pathIn) { (sidOk, xsrfOk, pathOk, request) =>
     f(unimplemented)
  }

  /**
   * Checks the session id and, for POST request, the xsrf token.
   */
  def CheckSidAndPathAction[A](parser: BodyParser[A])(pathIn: PagePath)(
        f: (SidOk, XsrfOk, PagePath, Request[A]) => PlainResult) =
        RedirBadPathAction[A](parser)(pathIn) { (pathOk, request) =>
    val (sidOk, xsrfOk, newCookies) = AppAuth.checkSidAndXsrfToken(request)
    val resultOldCookies = f(sidOk, xsrfOk, pathOk, request)
    val resultOkSid =
      if (newCookies isEmpty) resultOldCookies
      else resultOldCookies.withCookies(newCookies: _*)
    resultOkSid
  }

  def CheckSidAndPathAction(pathIn: PagePath)(
        f: (SidOk, XsrfOk, PagePath, Request[Option[Any]]) => PlainResult)
        : mvc.Action[Option[Any]] =
    CheckSidAndPathAction(BodyParsers.parse.empty)(pathIn)(f)

  /**
   * Redirects requests to the correct path,
   * e.g. adds/removes an absent or superflous trailing slash
   * or looks up a page id and finds out that the page has been moved.
   */
  def RedirBadPathAction[A](parser: BodyParser[A])(pathIn: PagePath)(
        f: (PagePath, Request[A]) => PlainResult)
        : mvc.Action[A] = ErrorAction[A](parser) { request =>
    Debiki.Dao.checkPagePath(pathIn) match {
      case Full(correct: PagePath) =>
        if (correct.path == pathIn.path) f(correct, request)
        else Results.MovedPermanently(correct.path)
      case Empty => Results.NotFound("404 Page not found: "+ pathIn.path)
      case f: Failure => runErr("DwE03ki2", "Internal error"+ f.toString)
    }
  }

  def RedirBadPathAction(pathIn: PagePath)(
       f: (PagePath, Request[Option[Any]]) => PlainResult)
       : mvc.Action[Option[Any]] =
    RedirBadPathAction(BodyParsers.parse.empty)(pathIn)(f)


  /**
   * Converts DebikiHttp.ResultException to nice replies.
   */
  def ErrorAction[A](parser: BodyParser[A])(f: Request[A] => PlainResult) =
        mvc.Action[A](parser) { request =>
    try {
      f(request)
    } catch {
      case DebikiHttp.ResultException(result) => result
    }
  }

  def ErrorAction(f: Request[AnyContent] => PlainResult)
        : mvc.Action[AnyContent] =
    ErrorAction(BodyParsers.parse.anyContent)(f)

}
