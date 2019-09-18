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

package ed.server.http

import com.debiki.core._
import com.debiki.core.DbDao.EmailAddressChangedException
import com.debiki.core.Prelude._
import org.apache.commons.lang3.exception.ExceptionUtils.getStackTrace
import debiki._
import ed.server.security.EdSecurity
import play.{api => p}
import play.api.mvc._
import play.api.libs.typedmap.TypedKey
import play.api.Logger
import scala.concurrent.{ExecutionContext, Future}
import SafeActions._


object SafeActions {
  val TracerSpanKey: TypedKey[io.opentracing.Span] = TypedKey[io.opentracing.Span]("tracerSpan")
}


/**
 * These actions check Debiki's session id cookie, and always
 * require a valid xsrf token for POST requests.
 * Also understand Debiki's internal throwBadReq etcetera functions.
 */
class SafeActions(val globals: Globals, val security: EdSecurity, parsers: PlayBodyParsers) {

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
    val allow = !globals.isProd || globals.conf.getBoolean("talkyard.allowFakeIp").getOrElse(false)
    if (allow) {
      Logger.info("Enabling fake IPs [DwM0Fk258]")
    }
    allow
  }


  /**
   * Converts DebikiHttp.ResultException to nice replies,
   * e.g. 403 Forbidden and a user friendly message,
   * instead of 500 Internal Server Error and a stack trace or Ooops message.
   */
  object ExceptionAction extends ActionBuilder[Request, AnyContent] {

    val parser: BodyParser[AnyContent] = parsers.anyContent  // [play26ask]

    override implicit protected def executionContext: ExecutionContext =
      globals.executionContext

    def invokeBlock[A](requestNoTracing: Request[A], block: Request[A] => Future[Result])
          : Future[Result] = {
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

      var futureResult = try {
        val fr = block(request)
        exceptionThrown = false
        fr
      }
      catch {
        case ex: OverQuotaException =>
          Future.successful(Results.Forbidden(o"""You cannot do that, because this site's
            disk quota has been exceeded, sorry. [DwE7GH4R2]"""))
        case ex: UserNotFoundException =>
          Future.successful(Results.NotFound(
            s"User '${ex.userId}' not found [DwE404US3R]"))
        case ex: PageNotFoundException =>
          Future.successful(Results.NotFound(
            s"Page '${ex.pageId}' not found [DwE404WU5]"))
        case ex: PostNotFoundException =>
          Future.successful(Results.NotFound(
            s"Post ${ex.postNr} on page '${ex.pageId}' not found [DwE404GP3]"))
        case ex: EmailAddressChangedException =>
          Future.successful(Results.Forbidden(
            "The email address related to this request has been changed. Access denied"))
        case ResultException(result) =>
          Future.successful(result)
        case ex: play.api.libs.json.JsResultException =>
          Future.successful(Results.BadRequest(s"Bad JSON: $ex [DwE70KX3]"))
        case Globals.AppSecretNotChangedException =>
          Future.successful(BadAppSecretError)
        case Globals.StillConnectingException =>
          Future.successful(ImStartingError)
        case ex: Globals.DatabasePoolInitializationException =>
          Future.successful(databaseGoneError(request, ex, startingUp = true))
        case ex: java.sql.SQLTransientConnectionException =>
          Future.successful(databaseGoneError(request, ex, startingUp = false))
        case ex: RuntimeException =>
          Future.successful(internalError(request, ex, "DwE500REX"))
        case ex: Exception =>
          Future.successful(internalError(request, ex, "DwE500EXC"))
        case ex: Error =>
          Future.successful(internalError(request, ex, "DwE500ERR"))
      }
      finally {
        if (exceptionThrown) {
          tracerSpan.finish()
        }
      }

      futureResult = futureResult recover {
        case ResultException(result) => result
        case ex: play.api.libs.json.JsResultException =>
          Results.BadRequest(s"Bad JSON: $ex [error DwE6PK30]")
        case Globals.AppSecretNotChangedException =>
          BadAppSecretError
        case Globals.StillConnectingException =>
          ImStartingError
        case ex: Globals.DatabasePoolInitializationException =>
          databaseGoneError(request, ex, startingUp = true)
        case ex: java.sql.SQLTransientConnectionException =>
          databaseGoneError(request, ex, startingUp = false)
        case ex: RuntimeException =>
          internalError(request, ex, "DwE500REXA")
        case ex: Exception =>
          internalError(request, ex, "DwE500EXCA")
        case ex: Error =>
          internalError(request, ex, "DwE500ERRA")
      }

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

      def setTestPasswordCookie(paramName: String, cookieName: String) {
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

  private def internalError(request: Request[_], throwable: Throwable,
        errorCode: String) = {
    val url = request.method + " //" + request.host + request.uri
    p.Logger.error(s"Replying internal error to: $url [$errorCode]",
      throwable)
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |Something went wrong: [$errorCode]
      |
      |${getStackTrace(throwable)}
      |""")
  }

  private val BadAppSecretError = {
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |Admin: Please edit the '${Globals.AppSecretConfValName}' config value, in file /opt/talkyard/conf/play-framework.conf.
      |
      |It's still set to "${Globals.AppSecretDefVal}".
      |
      |Replace it with about 80 random characters. Then, in /opt/talkyard/, do:  docker-compose restart app
      |and wait ten? twenty? seconds, then reload this page. [EdEDEFAPPSECRET]
      |""")
  }

  private val ImStartingError = {
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |Play Framework is starting. Please wait a few seconds, then reload this page. [TyEIMSTARTING]
      |""")
  }


  private def databaseGoneError(request: Request[_], throwable: Throwable, startingUp: Boolean) = {
    val url = request.method + " //" + request.host + request.uri
    var rootCause = throwable
    var loopLimit = 99
    while ((rootCause.getCause ne null) && loopLimit > 0) {
      rootCause = rootCause.getCause
      loopLimit -= 1
    }
    val roleMissing = isRoleNotFoundException(rootCause)
    val badPassword = isBadPasswordException(rootCause)
    val (errorMessage, errorCode, orQueryTooLong) =
      if (roleMissing) {
        if (startingUp)
          ("Play Framework is trying to start, but it seems no database user has been created",
              "EsE500DBUM", "")
        else
          ("The database user has suddenly disappeared", "EsE500DBUD", "")
      }
      else if (badPassword) {
        (o"""Play Framework cannot connect to the database. Wrong database password?
             Or the database user doesn't exist?""",
          "EsE500BPWD", "")
      }
      else {
        if (startingUp)
          ("Play Framework is trying to start, but cannot connect to the database", "EsE500DBNR", "")
        else
          ("Database no longer reachable", "EsE500DBG", "Or did a query take too long?")
      }
    p.Logger.error(s"Replying database-not-reachable error to: $url [$errorCode]", throwable)
    val (hasItStoppedPerhaps, fixProblemTips) =
      if (globals.isProd) ("", "")
      else if (roleMissing || badPassword) (
        "", i"""If you use Docker-Compose: You can create the database user like so:
        |  'docker/drop-database-create-empty.sh'
        |""")
      else (s"\nHas the database stopped or is there a network problem? $orQueryTooLong", i"""
        |If you use Docker-Compose: run 'docker-compose ps' to see if the database container is running.
        |If not running, start it:  'docker-compose start rdb'
        |If running, then check logs:  'docker-compose logs -f'
        |Or login with Bash:  'docker-compose exec rdb bash'
        |""")
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |$errorMessage [$errorCode]
      |$hasItStoppedPerhaps
      |$fixProblemTips
      |${getStackTrace(throwable)}
      |""")
  }

  // Move to a database package? io.efdi.server.db?
  def isRoleNotFoundException(throwable: Throwable) =
    throwable.isInstanceOf[org.postgresql.util.PSQLException] &&
      RoleMissingRexec.matches(throwable.getMessage)

  def isBadPasswordException(throwable: Throwable) =
    throwable.isInstanceOf[org.postgresql.util.PSQLException] &&
      throwable.getMessage.contains("assword")

  private val RoleMissingRexec = ".* role .+ does not exist.*".r

}
