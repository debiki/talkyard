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
   * Throws Forbidden, and deletes the SID cookie, if any SID login id
   * doesn't map to any login entry.
   *
   * @param f The SidStatus passed to `f` is either SidAbsent or a SidOk.
   */
  // COULD rename to CheckSidAndXsrfAction?
  def CheckSidAction[A]
        (parser: BodyParser[A], maySetCookies: Boolean = true)
        (f: (SidStatus, XsrfOk, Request[A]) => PlainResult) =
    ExceptionAction[A](parser) { request =>
      val (sidStatus, xsrfOk, newCookies) =
         DebikiSecurity.checkSidAndXsrfToken(
           request, maySetCookies = maySetCookies)
      val resultOldCookies = try {
        f(sidStatus, xsrfOk, request)
      } catch {
        case e: Utils.LoginNotFoundException =>
          // This might happen if I manually deleted stuff from the
          // database during development, or if the server has fallbacked
          // to a standby database.
          throw ResultException(ForbiddenResult(
            "DwE034ZQ3", "Internal error, please try again, sorry. "+
               "(A certain login id has become invalid. You now have "+
               "a new id, but you will probably need to login again.)")
             .discardingCookies(DiscardingCookie("dwCoSid")))
      }
      val resultOkSid =
        if (newCookies isEmpty) resultOldCookies
        else {
          assert(maySetCookies)
          resultOldCookies.withCookies(newCookies: _*)
        }
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

