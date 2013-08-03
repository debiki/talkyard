/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
        (f: (SidStatus, XsrfOk, Request[Option[Any]]) => Result) =
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
        (f: (SidStatus, XsrfOk, Request[A]) => Result) =
    ExceptionAction[A](parser) { request =>

      val (sidStatus, xsrfOk, newCookies) =
         DebikiSecurity.checkSidAndXsrfToken(request, maySetCookies = maySetCookies)

      // Parts of `f` might be executed asynchronously. However any LoginNotFoundException
      // should happen before the async parts, because access control should be done
      // before any async computations are started. So I don't try to recover
      // any AsyncResult(future-result-that-might-be-a-failure) here.

      val resultOldCookies = try {
        f(sidStatus, xsrfOk, request)
      } catch {
        case e: Utils.LoginNotFoundException =>
          // This might happen if I manually deleted stuff from the
          // database during development, or if the server has fallbacked
          // to a standby database.
          throw ResultException(InternalErrorResult(
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

    def exceptionRecoverer: PartialFunction[Throwable, PlainResult] = {
      case DebikiHttp.ResultException(result) => result
      case ex: play.api.libs.json.JsResultException =>
        Results.BadRequest(s"Bad JSON: $ex [error DwE70KX3]")
    }

    // An exception might be thrown before any async computation is started,
    // or whilst any async computation happens. So check for any exception twice:

    val perhapsAsyncResult = try {
      f(request)
    }
    catch exceptionRecoverer

    import scala.concurrent.ExecutionContext.Implicits.global

    perhapsAsyncResult match {
      case AsyncResult(futureResultMaybeException) =>
        val futureResult = futureResultMaybeException recover exceptionRecoverer
        AsyncResult(futureResult)
      case x => x
    }
  }


  def ExceptionActionNoBody(f: Request[Option[Any]] => Result) =
    ExceptionAction(BodyParsers.parse.empty)(f)

}

