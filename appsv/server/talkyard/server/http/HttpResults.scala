/**
 * Copyright (c) 2012-2025 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.http

import com.debiki.core._
import com.debiki.core.DbDao.EmailAddressChangedException
import com.debiki.core.Prelude._
import org.apache.commons.lang3.exception.ExceptionUtils.getStackTrace
import debiki._
import debiki.EdHttp.ResultException
import play.api.mvc.{Request => p_Request, Result => p_Result, Results => p_Results}
import scala.concurrent.Future
import talkyard.server.TyLogging


case class HttpResults(request: p_Request[_], globals: Globals, site: Opt[SiteBrief])
      extends TyLogging {
  import HttpResults._

  val exceptionToSuccessResultHandler: PartialFunction[Throwable, Future[p_Result]] = {
    exeptionToResultHandler.andThen(r => Future.successful(r))
  }

  def exeptionToResultHandler: PartialFunction[Throwable, p_Result] = {
        // Maybe later:
        // case ex: ProblemException  or  AdminProblemEx  or  PerSiteProblemEx  ?   =>
        //   Rememebr the problem in a per site admin error log  [ADMERRLOG]  + tracer tag?
        //   Then developers building integrations with Ty, can look at this per site log
        //   and see what happened — also if the site is hosted on a multitenant server.
        //   Return status code 422 Unprocessable Entity,
        //     or maybe sth else depending on some ProblemException field value.
        case ex: NotFoundEx =>
          p_Results.NotFound(ex.getMessage)
        case ex: BadRequestEx =>
          p_Results.BadRequest(ex.getMessage)
        case ex: ForbiddenEx =>
          p_Results.Forbidden(ex.getMessage)
        case ex: UnimplementedEx =>
          p_Results.NotImplemented(ex.getMessage)
        case ex: OverQuotaException =>
          p_Results.Forbidden(o"""You cannot do that, because this site's
            disk quota has been exceeded, sorry. [DwE7GH4R2]""")
        case ex: UserNotFoundException =>
          p_Results.NotFound(
            s"User '${ex.userId}' not found [DwE404US3R]")
        case ex: PageNotFoundException =>
          p_Results.NotFound(
            s"Page '${ex.pageId}' not found [DwE404WU5]")
        case ex: PostNotFoundException =>
          p_Results.NotFound(
            s"Post ${ex.postNr} on page '${ex.pageId}' not found [DwE404GP3]")
        case ex: EmailAddressChangedException =>
          p_Results.Forbidden(
            "The email address related to this request has been changed. Access denied")
        case ResultException(result) =>
          result
        // [Scala_3] Can join these 2 case into 1:
        //se ex: play.api.libs.json.JsResultException | debiki.JsonUtils.BadJsonException =>
        case ex: play.api.libs.json.JsResultException =>
          _badJsonResult(ex, site)
        case ex: debiki.JsonUtils.BadJsonException =>
          _badJsonResult(ex, site)
        case Globals.AppSecretNotChangedException =>
          _BadAppSecretError
        case Globals.StillConnectingException =>
          _imStartingError(globals)
        case ex: Globals.DatabasePoolInitializationException =>
          _databaseGoneError(request, ex, startingUp = true, globals, site)
        case ex: java.sql.SQLTransientConnectionException =>
          _databaseGoneError(request, ex, startingUp = false, globals, site)
        case ex: RuntimeException =>
          _internalError(request, ex, "TyE500REX", globals, site)
        case ex: Exception =>
          _internalError(request, ex, "TyE500EXC", globals, site)
        case ex: Error =>
          _internalError(request, ex, "TyE500ERR", globals, site)
  }
}


object HttpResults extends TyLogging {

  /** This is typically a browser/client that sends json with the wrong structure,
    * e.g. a Talkyard site admin trying to create some integration.
    * In some rare cases, could be a server bug though. [maybe_server_error]
    *
    * Maybe remember & show in an admin error log? [ADMERRLOG]  [dev_friendly]
    * And maybe show on some frequent client errors Talkyard server admin internal page?
    * Exception line no. and stack trace or error code (but no json, no details)?
    */
  private def _badJsonResult(ex: Exception, site: Opt[SiteBrief]) = {
    val msg = s"Bad JSON: $ex [TyEBADJSN]"
    val siteId = site.map(_.id) getOrElse "?"
    logger.debug(s"s$siteId: $msg", ex)
    p_Results.BadRequest(msg)
  }

  private def _internalError(request: p_Request[_], throwable: Throwable,
        errorCode: St, globals: Globals, site: Opt[SiteBrief]) = {
    val url = request.method + " //" + request.host + request.uri
    val siteId = site.map(_.id) getOrElse "?"
    logger.error(s"s$siteId: Replying internal error to: $url [$errorCode]",
      throwable)
    p_Results.InternalServerError(i"""500 Internal Server Error
      |
      |Something went wrong: [$errorCode]
      |
      |${getStackTrace(throwable)}
      |""")
  }

  private val _BadAppSecretError = {
    p_Results.InternalServerError(i"""500 Internal Server Error
      |
      |Admin: Please edit the '${Globals.AppSecretConfValName}' config value,
      |in file ${talkyard.server.ProdConfFilePath}.
      |
      |It's still set to "${Globals.AppSecretDefVal}".
      |
      |Replace it with about 80 random characters. Then, in /opt/talkyard/, do:  docker compose restart app
      |and wait ten? twenty? seconds, then reload this page. [EdEDEFAPPSECRET]
      |""")
  }

  private def _imStartingError(globals: Globals) = {
    p_Results.InternalServerError(i"""500 Internal Server Error
      |
      |The server is starting:
      |    ${globals.startupStep}
      |
      |Please wait a few seconds, then reload this page. [TyEIMSTARTING]
      |""")
  }


  private def _databaseGoneError(request: p_Request[_], throwable: Throwable, startingUp: Bo,
          globals: Globals, site: Opt[SiteBrief]): p_Result = {
    val url = request.method + " //" + request.host + request.uri
    val rootCause = getRootCause(throwable)

    // Seems role-missing never happens, nowadays — instead, Postgres says:
    // "password authentication failed" also if the user doesn't exist.
    val roleMissing = isRoleNotFoundException(rootCause)
    val badPassword = isBadPasswordException(rootCause)
    val dbMissing = isDatabaseNotFoundException(rootCause)

    val (errorMessage, errorCode, orQueryTooLong) =
      if (roleMissing) {
        if (startingUp)
          (o"""Talkyard's application server is trying to start,
              but it seems no database user has been created?""",
            "TyEDATABUSRM", "")
        else
          ("The database user has suddenly disappeared", "TyEDATABUSRG", "")
      }
      else if (badPassword) {
        (o"""Talkyard's application server cannot login to the database
             (but can connect to it).
             Wrong database password? Or the database user doesn't exist?""",
          "TyEDATABPWD", "")
      }
      else if (dbMissing) {
        (o"""Talkyard's application server has logged in to the PostgreSQL database server,
              but the PostgreSQL user's database does not exist?""",
            "TyE0DATAB", "")
      }
      else {
        if (startingUp)
          (o"""Talkyard's application server is trying to start,
              but cannot connect to the PostgreSQL database server""",
            "TyEDATABCONN1", "")
        else
          (o"""Talkyard's application server suddenly can no longer connect
            to the PostgreSQL database server. — Maybe the database ran out of disk?""",
            "TyEDATABCONN2", "Or did a query take too long?")
      }

    val siteId = site.map(_.id) getOrElse "?"
    logger.error(s"s$site: Replying database-not-reachable error to: $url [$errorCode]",
          throwable)

    val (hasItStoppedPerhaps, fixProblemTips) =
      if (globals.isProd)
        ("", "")
      else if (roleMissing || badPassword || dbMissing) (
        // STALE_DOCS: Not using Make for *running* Ty any more, only for *building*, right.
        "", i"""You can create a PostgreSQL user and database like so:
        |
        |    make dead-app  # stop the app server
        |    s/drop-database-create-empty.sh
        |
        |You can change the PostgreSQL user's password:
        |
        |    make db-cli  # starts the PostgreSQL psql client
        |    talkyard=> alter user talkyard password 'public';
        |
        |Then update  conf/my.conf with your password:
        |
        |    vi conf/my.conf
        |
        |    # Add/edit this line:
        |    talkyard.postgresql.password="public"
        |
        |Start everything: (if you stopped the app server above)
        |
        |    make up
        |""")
      else (
        s"\nHas the database stopped or is there a network problem? $orQueryTooLong",
        i"""
        |See if the database container is running — it's name is something like 'tyd_rdb_X':
        |    docker compose ps
        |
        |If not running, start it:
        |    docker compose start rdb
        |
        |If running, check the logs:
        |    docker compose logs -f --tail 999 app rdb
        |
        |Or login with Bash:
        |    docker compose exec rdb bash
        |""")

    p_Results.InternalServerError(i"""500 Internal Server Error
      |
      |$errorMessage [$errorCode]
      |$hasItStoppedPerhaps
      |$fixProblemTips
      |${getStackTrace(throwable)}
      |""")
  }

  private def isRoleNotFoundException(throwable: Throwable) =
    throwable.isInstanceOf[org.postgresql.util.PSQLException] &&
      RoleMissingRexec.matches(throwable.getMessage)

  private def isDatabaseNotFoundException(throwable: Throwable) =
    throwable.isInstanceOf[org.postgresql.util.PSQLException] &&
      DatabaeMissingRexec.matches(throwable.getMessage)

  private def isBadPasswordException(throwable: Throwable) =
    throwable.isInstanceOf[org.postgresql.util.PSQLException] &&
      throwable.getMessage.contains("assword")

  private val DatabaeMissingRexec = ".* database .+ does not exist.*".r
  private val RoleMissingRexec = ".* role .+ does not exist.*".r

}
