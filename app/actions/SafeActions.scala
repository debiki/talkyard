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

package actions

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.Play.current
import play.api.mvc.{Action => _, _}
import requests._
import scala.concurrent.Future


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
        (f: (SidStatus, XsrfOk, Option[BrowserId], Request[Option[Any]]) => SimpleResult) =
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
   * @param maySetCookies Set to false for JS and CSS so the replies can be cached by servers.
   */
  // COULD rename to CheckSidAndXsrfAction?
  def CheckSidAction[A]
        (parser: BodyParser[A], maySetCookies: Boolean = true)
        (f: (SidStatus, XsrfOk, Option[BrowserId], Request[A]) => SimpleResult): mvc.Action[A] =
    ExceptionAction[A](parser) { request =>

      val (sidStatus, xsrfOk, newCookies) =
         DebikiSecurity.checkSidAndXsrfToken(request, maySetCookies = maySetCookies)

      val (anyBrowserId, moreNewCookies) =
        BrowserId.checkBrowserId(request, maySetCookies = maySetCookies)

      // Parts of `f` might be executed asynchronously. However any LoginNotFoundException
      // should happen before the async parts, because access control should be done
      // before any async computations are started. So I don't try to recover
      // any AsyncResult(future-result-that-might-be-a-failure) here.

      val resultOldCookies = try {
        f(sidStatus, xsrfOk, anyBrowserId, request)
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
        if (newCookies.isEmpty && moreNewCookies.isEmpty) resultOldCookies
        else {
          assert(maySetCookies)
          resultOldCookies
            .withCookies((newCookies ::: moreNewCookies): _*)
            .withHeaders(MakeInternetExplorerSaveIframeCookiesHeader)
        }

      resultOkSid
    }


  /** IE9 blocks cookies in iframes unless the site in the iframe clarifies its
    * in a P3P header (Platform for Privacy Preferences). (But Debiki's embedded comments
    * needs to work in iframes.) See:
    * - http://stackoverflow.com/questions/389456/cookie-blocked-not-saved-in-iframe-in-internet-explorer
    * - http://stackoverflow.com/questions/7712327/any-recommendation-for-p3p-policy-editor
    * - http://stackoverflow.com/a/16475093/694469
    * - http://www.w3.org/P3P/details.html (don't read it! :-P simply use the below workaround
    *     instead)
    *
    * Apparently the policy is legally binding, but I'm not a lawyer so I don't want to construct
    * any policy. Also, the policy would vary from site to site, in case Debiki is installed
    * by other people than me. So it ought to be customizable. Fortunately, the P3P standard
    * is dying and abandoned. So work around the dead standard by including a dummy header,
    * that makes IE9 happy. Write it as a single word, so IE doesn't think that e.g.
    * "is" or "not" actually means something.
    */
  private def MakeInternetExplorerSaveIframeCookiesHeader =
    "P3P" -> """CP="This_is_not_a_privacy_policy""""


  /**
   * Converts DebikiHttp.ResultException to nice replies,
   * e.g. 403 Forbidden and a user friendly message,
   * instead of 500 Internal Server Error and a stack trace or Ooops message.
   */
  object ExceptionAction extends ActionBuilder[Request] {
    def invokeBlock[A](request: Request[A], block: Request[A] => Future[SimpleResult]) = {
      import scala.concurrent.ExecutionContext.Implicits.global
      var futureResult = block(request) recover {
        case DebikiHttp.ResultException(result) => result
        case ex: play.api.libs.json.JsResultException =>
          Results.BadRequest(s"Bad JSON: $ex [error DwE70KX3]")
      }
      if (!Play.isProd) {
        val anyNewFakeIp = request.queryString.get("fakeIp").flatMap(_.headOption)
        anyNewFakeIp foreach { fakeIp =>
          futureResult = futureResult map { simpleResult =>
            simpleResult.withCookies(Cookie("dwCoFakeIp", fakeIp))
          }
        }
      }
      futureResult
    }
  }

}

