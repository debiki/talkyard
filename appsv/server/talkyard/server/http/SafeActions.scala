/**
 * Copyright (c) 2012-2015 Kaj Magnus Lindberg
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

package talkyard.server.http

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import talkyard.server.security.EdSecurity
import play.api.mvc._
import play.api.libs.typedmap.TypedKey
import scala.concurrent.{ExecutionContext, Future}
import SafeActions._
import talkyard.server.TyLogging


object SafeActions {
  val TracerSpanKey: TypedKey[io.opentracing.Span] = TypedKey[io.opentracing.Span]("tracerSpan")
}


/**
 * These actions check Debiki's session id cookie, and always
 * require a valid xsrf token for POST requests.
 * Also understand Debiki's internal throwBadReq etcetera functions.
 */
class SafeActions(val globals: Globals, val security: EdSecurity, parsers: PlayBodyParsers)
  extends TyLogging {

  import EdHttp._

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
  def MakeInternetExplorerSaveIframeCookiesHeader: (PageId, PageId) =  // move to PlainApiActions?
    "P3P" -> """CP="This_is_not_a_privacy_policy""""


  val allowFakeIp: Boolean = {
    val allow = !globals.isProd ||
      globals.conf.getOptional[Boolean]("talkyard.allowFakeIp").getOrElse(false)
    if (allow) {
      logger.info("Enabling fake IPs [TyM0Fk258]")
    }
    allow
  }


  /**
   * Converts DebikiHttp.ResultException to nice replies,
   * e.g. 403 Forbidden and a user friendly message,
   * instead of 500 Internal Server Error and a stack trace or Ooops message.
   */
  object ExceptionAction extends ActionBuilder[Request, AnyContent] {
    SECURITY // stop using ExceptionAction at most places — change to PlainApiActionImpl + rate limits

    val parser: BodyParser[AnyContent] = parsers.anyContent  // [play26ask]

    override implicit protected def executionContext: ExecutionContext =
      globals.executionContext

    def invokeBlock[A](requestNoTracing: Request[A], block: Request[A] => Future[Result])
          : Future[Result] = {
      if (Globals.isDevOrTest && globals.secure) {
        val isHttp = requestNoTracing.headers.get("X-Forwarded-Proto") is "http"
        if (isHttp) {
          return Future.successful(ForbiddenResult("TyE0HTTPS",
              o"""This dev-test server uses https but the request is over http.
              Likely this would make something fail, e.g. a test."""))
        }
      }

      val tracerSpan = {
        val path = requestNoTracing.path
        val traceOpName =
          if (path.startsWith("/-/v0/") || path == "/manifest.webmanifest") {
            path
          }
          else if (path.startsWith("/-/")) {
            val withoutPrefix = path.drop("/-/".length)
            var opName = withoutPrefix.takeWhile(_ != '/')
            if (withoutPrefix.contains('/')) {
              opName += "/*"
            }
            "/-/" + opName
          }
          else {
            "/view-page"
          }
        globals.tracer.buildSpan(traceOpName).start()
      }

      val request = requestNoTracing.addAttr(TracerSpanKey, tracerSpan)
      var exceptionThrown = true

      // _Catch synchronous failures.
      var futureResult =
            try {
              val fr = block(request)
              exceptionThrown = false
              fr
            }
            catch HttpResults(request, globals).exceptionToSuccessResultHandler
            finally {
              if (exceptionThrown) {
                tracerSpan.finish()
              }
            }

      // "_Catch" async failures too.
      futureResult = futureResult recover HttpResults(request, globals).exeptionToResultHandler

      val anyNewFakeIp = request.queryString.get("fakeIp").flatMap(_.headOption)

      futureResult = futureResult map { result =>
        if (!exceptionThrown) {
          tracerSpan.finish()
        }
        anyNewFakeIp match {
          case None => result
          case Some(fakeIp) => result.withCookies(security.SecureCookie("dwCoFakeIp", fakeIp))
        }
      }

      def setTestPasswordCookie(paramName: String, cookieName: String): Unit = {
        val anyPassword = request.queryString.get(paramName).flatMap(_.headOption)
        anyPassword foreach { password =>
          futureResult = futureResult map { result =>
            result.withCookies(security.SecureCookie(cookieName, password, maxAgeSeconds = Some(600)))
          }
        }
      }
      setTestPasswordCookie("e2eTestPassword", "esCoE2eTestPassword")
      setTestPasswordCookie("forbiddenPassword", "esCoForbiddenPassword")

      futureResult
    }
  }

}
