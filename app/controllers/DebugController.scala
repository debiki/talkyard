/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

import actions.SafeActions.{ExceptionAction, SessionAction}
import actions.ApiActions.{GetAction, PostJsonAction, AdminGetAction}
import com.debiki.core.Prelude._
import debiki.{RateLimits, Globals}
import java.{util => ju, io => jio}
import play.api._
import play.{api => p}
import play.api.mvc.BodyParsers.parse.empty


/** Intended for troubleshooting, via the browser.
  */
object DebugController extends mvc.Controller {


  /** If a JS error happens in the browser, it'll post the error message to this
    * endpoint, which logs it, so we'll get to know about client side errors.
    */
  def logBrowserError = PostJsonAction(RateLimits.BrowserError, maxLength = 1000) { request =>
    val errorMessage = request.body.toString()
    p.Logger.warn(o"""Browser error: $errorMessage,
      ip: ${request.ip},
      user: ${request.user.map(_.id)},
      site: ${request.siteId}
      [DwE4KF6]""")
    Ok
  }


  // SECURITY SHOULD allow only if a Ops team password header? is included?
  def showMetrics = AdminGetAction { request =>
    val outputStream = new jio.ByteArrayOutputStream(100 * 1000)
    val printStream = new jio.PrintStream(outputStream, false, "utf-8")
    val metricsText = try {
      val metricsReporter =
        com.codahale.metrics.ConsoleReporter.forRegistry(Globals.metricRegistry)
          .convertRatesTo(ju.concurrent.TimeUnit.SECONDS)
          .convertDurationsTo(ju.concurrent.TimeUnit.MILLISECONDS)
          .outputTo(printStream)
          .build()
      metricsReporter.report()
      outputStream.toString("utf-8")
    }
    finally {
      org.apache.lucene.util.IOUtils.closeWhileHandlingException(printStream, outputStream)
    }
    Ok(metricsText) as TEXT
  }


  /** For performance tests. */
  def pingExceptionAction = ExceptionAction(empty) { request =>
    Ok("exception-action-pong")
  }


  /** For performance tests. */
  def pingSessionAction = SessionAction(empty) {
    request: actions.SafeActions.SessionRequestNoBody =>
      Ok("session-action-pong")
  }


  def origin = GetAction { request =>
    val canonicalHost = request.dao.loadSite().canonicalHost
    val isFirstSite = Some(request.hostname) == Globals.firstSiteHostname
    val response =
      s"""Globals.secure: ${Globals.secure}
         |Globals.scheme: ${Globals.scheme}
         |Globals.port: ${Globals.port}
         |Globals.baseDomainWithPort: ${Globals.baseDomainWithPort}
         |Globals.baseDomainNoPort: ${Globals.baseDomainNoPort}
         |
         |Is first site: $isFirstSite
         |First site hostnam: ${Globals.firstSiteHostname}
         |
         |OAuth login origin: ${LoginWithOpenAuthController.anyLoginOrigin}
         |
         |Request host: ${request.host}
         |Request secure: ${request.request.secure}
         |
         |Site canonical hostname: ${canonicalHost.map(_.hostname)}
         |Site canonical host origin: ${canonicalHost.map(Globals.originOf)}
       """.stripMargin
    Ok(response)
  }

}

