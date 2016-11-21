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

package io.efdi.server.http

import com.debiki.core._
import com.debiki.core.DbDao.EmailAddressChangedException
import com.debiki.core.Prelude._
import org.apache.commons.lang3.exception.ExceptionUtils.getStackTrace
import controllers.Utils
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.{api => p}
import play.api.Play.current
import play.api.mvc._
import play.api.{Logger, Play}
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global


/**
 * These actions check Debiki's session id cookie, and always
 * require a valid xsrf token for POST requests.
 * Also understand Debiki's internal throwBadReq etcetera functions.
 */
object SafeActions {


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
  def MakeInternetExplorerSaveIframeCookiesHeader =  // should move to PlainApiActions
    "P3P" -> """CP="This_is_not_a_privacy_policy""""


  val allowFakeIp = {
    val allow = !Play.isProd || Play.configuration.getBoolean("ed.allowFakeIp").getOrElse(false)
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
  object ExceptionAction extends ActionBuilder[Request] {

    def invokeBlock[A](request: Request[A], block: Request[A] => Future[Result]): Future[Result] = {
      var futureResult = try {
        SECURITY ; COULD /* add back this extra check.
        // No longer works, even when HTTPS is used. Something happenend when upgrading
        // Play from 2.4.0 to 2.4.8?
        if (Globals.secure && !request.secure) {
          // Reject this request, unless an 'insecure' param is set and we're on localhost.
          val insecureOk = request.queryString.get("insecure").nonEmpty &&
            request.host.matches("^localhost(:[0-9]+)?$".r)
          if (!insecureOk)
            return Future.successful(Results.InternalServerError(o"""I think this is a
              HTTP request, but I, the Play Framework app, am configured to be secure, that is,
              all requests should be HTTPS. You can:
              ${"\n"} - Change from http:// to https:// in the URL, and update the Nginx
              configuration accordingly.
              ${"\n"} - If you use https:// already, then have a look at the Nginx configuration
              — does Nginx send the 'X-Forwarded-Proto' header?
              ${"\n"} - Or set debiki.secure=false in the Play Framework application config file.
              ${"\n\n"}You can also append '?insecure' to the URL if you want
              to proceed nevertheless — this works from localhost only. [DwE8KNW2]"""))
        }
        */
        block(request)
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
        case DebikiHttp.ResultException(result) =>
          Future.successful(result)
        case ex: play.api.libs.json.JsResultException =>
          Future.successful(Results.BadRequest(s"Bad JSON: $ex [DwE70KX3]"))
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
      futureResult = futureResult recover {
        case DebikiHttp.ResultException(result) => result
        case ex: play.api.libs.json.JsResultException =>
          Results.BadRequest(s"Bad JSON: $ex [error DwE6PK30]")
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
      anyNewFakeIp foreach { fakeIp =>
        futureResult = futureResult map { result =>
          result.withCookies(SecureCookie("dwCoFakeIp", fakeIp))
        }
      }

      def setTestPasswordCookie(paramName: String, cookieName: String) {
        val anyPassword = request.queryString.get(paramName).flatMap(_.headOption)
        anyPassword foreach { password =>
          futureResult = futureResult map { result =>
            result.withCookies(SecureCookie(cookieName, password, maxAgeSeconds = Some(600)))
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
    val scheme = if (request.secure) "https://" else "http://"
    val url = request.method + " " + scheme + request.host + request.uri
    p.Logger.error(s"Replying internal error to: $url [$errorCode]",
      throwable)
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |Something went wrong: [$errorCode]
      |
      |${getStackTrace(throwable)}
      |""")
  }

  private val ImStartingError = {
    Results.InternalServerError(i"""500 Internal Server Error
      |
      |Play Framework is starting. Please wait a few seconds, then reload this page.
      |""")
  }


  private def databaseGoneError(request: Request[_], throwable: Throwable, startingUp: Boolean) = {
    val scheme = if (request.secure) "https://" else "http://"
    val url = request.method + " " + scheme + request.host + request.uri
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
      if (!Play.isDev) ("", "")
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
