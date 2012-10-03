/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import Prelude._


/**
 * These actions check Debiki's session id cookie, and always
 * require a valid xsrf token for POST requests.
 * Also understand Debiki's internal throwBadReq etcetera functions.
 */
object SafeActions {


  /**
   * Throws 403 Forbidden if the xsrf token (for POST requests)
   * or the session id is invalid.
   */
  def CheckSidActionNoBody
        (f: (SidStatus, XsrfOk, Request[Option[Any]]) => PlainResult) =
    CheckSidAction(BodyParsers.parse.empty)(f)


  /**
   * Checks the SID and XSRF token.
   *
   * Throws Forbidden if this is a POST request with no valid XSRF token.
   * Creates a new XSRF token cookie, if there is none, or if it's invalid.
   *
   * @param f The SidStatus passed to `f` is either SidAbsent or a SidOk.
   */
  // COULD rename to CheckSidAndXsrfAction?
  def CheckSidAction[A]
        (parser: BodyParser[A])
        (f: (SidStatus, XsrfOk, Request[A]) => PlainResult) =
    ExceptionAction[A](parser) { request =>
      val (sidStatus, xsrfOk, newCookies) =
         DebikiSecurity.checkSidAndXsrfToken(request)
      val resultOldCookies = f(sidStatus, xsrfOk, request)
      val resultOkSid =
        if (newCookies isEmpty) resultOldCookies
        else resultOldCookies.withCookies(newCookies: _*)
      resultOkSid
    }


  /**
   * Converts DebikiHttp.ResultException to nice replies,
   * e.g. 403 Forbidden and a user friendly message,
   * instead of 500 Internal Server Error and a stack trace or Ooops message.
   */
  def ExceptionAction[A](parser: BodyParser[A])(f: Request[A] => Result) =
        mvc.Action[A](parser) { request =>
    try {
      f(request)
    } catch {
      case DebikiHttp.ResultException(result) => result
    }
  }


  def ExceptionActionNoBody(f: Request[Option[Any]] => Result) =
    ExceptionAction(BodyParsers.parse.empty)(f)

}

