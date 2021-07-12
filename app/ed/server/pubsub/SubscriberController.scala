/**
 * Copyright (c) 2015, 2020 Kaj Magnus Lindberg
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

package ed.server.pubsub

import akka.stream.scaladsl.Flow
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp._
import debiki._
import ed.server.{EdContext, EdController}
import ed.server.http._
import ed.server.security.CheckSidAndXsrfResult
import javax.inject.Inject
import org.scalactic.{Bad, Good, Or}
import play.{api => p}
import p.libs.json.{JsValue, Json}
import p.mvc.{Action, ControllerComponents, RequestHeader, Result}
import scala.concurrent.Future
import talkyard.server.TyLogging
import talkyard.server.RichResult
import talkyard.server.pubsub.WebSocketMessageHandler



/** Authorizes and subscribes a user to pubsub messages.
  */
class SubscriberController @Inject()(cc: ControllerComponents, tyCtx: EdContext)
  extends EdController(cc, tyCtx) with TyLogging {

  import context.globals


  def webSocket: p.mvc.WebSocket = p.mvc.WebSocket.acceptOrResult[JsValue, JsValue] {
        request: RequestHeader =>
    webSocketImpl(request)
      // map { if  Left[Result = Problem ... log to admin problem log ?  }
      // [ADMERRLOG]
  }


  private def webSocketImpl(request: RequestHeader): Future[Either[
        // Either an error response, if we reject the connection.
        Result,
        // Or an In and Out stream, for talking with the client.
        Flow[JsValue, JsValue, _]]] = {

    val site = globals.lookupSiteOrThrow(request)

    // Sync w normal HTTP requests endpoint. [SITESTATUS].
    site.status match {
      case SiteStatus.Active =>
        // Fine
      case SiteStatus.NoAdmin | SiteStatus.ReadAndCleanOnly =>
        return Future.successful(Left(
                ForbiddenResult("TyEWSSITE0ACTV", "Site not active so WebSocket disabled")))
      case _ =>
        // This also for HiddenUnlessStaff and HiddenUnlessAdmin.
        return Future.successful(Left(
                SiteNotFoundResult(request.host, "WS0SITE")))
    }

    val authnReq = authenticateWebSocket(site, request) getOrIfBad { result =>
      // Reject the connection. The browser won't find out why — Chrome etc just
      // shows the status code, e.g. 403 Forbidden, nothing more, apparently to make
      // it harder to use WebSocket for port scanning or DoS-attack generating
      // many connections, see:
      //   https://stackoverflow.com/a/19305172/694469
      COULD // log the problem to a site admin accessible Talkyard log? [ADMERRLOG]
      // So a site admin, at least, can find out what's wrong.

      logger.debug(s"s${site.id}: Rejecting WebSocket with status ${
              result.statusCode}: ${result.bodyAsUtf8String}")
      return Future.successful(Left(result))
    }

    globals.pubSub.mayConnectClient(authnReq.theSiteUserId) map {
      case problem: Problem =>
        Left(ForbiddenResult("TyEWSTOOMANY", s"You cannot connect: ${problem.message}"))
      case Fine =>
        // Rate limit connections per ip: set user = None.
        // (We rate limit messages too, per user, see RateLimits.SendWebSocketMessage.)
        context.rateLimiter.rateLimit(
                RateLimits.ConnectWebSocket, authnReq.copy(user = None))

        // Later: If accepting new topics and replies via WebSocket, then, need to
        // remember a SpamRelReqStuff here? [WSSPAM]

        val messageHandler = new WebSocketMessageHandler(
              authnReq.site, authnReq.theRequester, authnReq.context.rateLimiter,
              authnReq.theBrowserIdData, authnReq.context.globals, authnReq.xsrfToken)

        val flow: Flow[JsValue, JsValue, _] = messageHandler.flow
        Right(flow)
    }
  }



  private def authenticateWebSocket(site: SiteBrief, request: RequestHeader)
        : AuthnReqHeaderImpl Or Result = {
    import tyCtx.security

    val dao = globals.siteDao(site.id)
    val requestOrigin = request.headers.get(play.api.http.HeaderNames.ORIGIN)
    val siteCanonicalOrigin = globals.originOfSiteId(site.id)

    // If the Origin header isn't the server's origin, then, maybe this is a
    // xsrf attack request — reply Forbidden. (We look for a xsrf token in the first
    // WebSocket message too, [WSXSRF].)
    // Could allow site-NNN origins, in dev mode, maybe?
    SEC_TESTS_MISSING // TyTWSAUTH
    if (requestOrigin != siteCanonicalOrigin) {
      logger.debug(o"""s${site.id}: Rejecting WebSocket: Request origin: $requestOrigin
              but site canon orig: $siteCanonicalOrigin  [TyM305RKDJ6]""")
      return Bad(ForbiddenResult(
              "TyEWSBADORIGIN", s"Bad Origin header: $requestOrigin"))
    }

    // Below: A bit dupl code, same as for normal HTTP requests. [WSHTTPREQ]

    val expireIdleAfterMins = dao.getWholeSiteSettings().expireIdleAfterMins

    // We check the xsrf token later — since a WebSocket upgrade request
    // cannot have a request body or custom header with xsrf token.
    // (checkSidAndXsrfToken() won't throw for GET requests. [GETNOTHROW])
    val CheckSidAndXsrfResult(sessionId, xsrfOk, newCookies, delFancySidCookies) =
          security.checkSidAndXsrfToken(
                request, anyRequestBody = None, site, dao,
                expireIdleAfterMins = expireIdleAfterMins, maySetCookies = false,
                skipXsrfCheck = false)

    COULD // delete any delFancySidCookies.

    // Needs to have a cookie already. [WSXSRF]
    dieIf(newCookies.nonEmpty, "TyE503RKDJL2")
    throwForbiddenIf(xsrfOk.value.isEmpty, "TyEWS0XSRFCO", "No xsrf cookie")

    SECURITY // Later: Maybe shouldn't show that the sid is bad?
    if (!sessionId.canUse)
      return Bad(ForbiddenResult("TyEWSSID", "Bad session id"))

    if (sessionId.userId.isEmpty)
      return Bad(ForbiddenResult("TyEWS0SID", "No session id"))

    // For now, let's require a browser id cookie — then, *in some cases* simpler
    // to detect WebSocket abuse or attacks? (Also see: [GETLOGIN] — an id cookie
    // needs to be set also via GET requests, if they're for logging in.)
    val anyBrowserId = security.getAnyBrowserId(request)
    //if (anyBrowserId.isEmpty)
    //  return Bad(ForbiddenResult("TyEWS0BRID", "No browser id"))

    dao.perhapsBlockRequest(request, sessionId, anyBrowserId)

    val anyRequester: Option[Participant] =
          dao.getUserBySessionId(sessionId) getOrIfBad { ex =>
            throw ex
          }

    val requesterMaybeSuspended: User = anyRequester getOrElse {
      return Bad(ForbiddenResult("TyEWS0LGDIN", "Not logged in"))
    } match {
      case user: User => user
      case other =>
        return Bad(ForbiddenResult("TyEWS0USR", s"Not a user account, but a ${
              other.accountType} account: ${other.nameHashId}"))
    }

    if (requesterMaybeSuspended.isDeleted)
      return Bad(ForbiddenResult("TyEWSUSRDLD", "User account deleted")
          .discardingCookies(security.DiscardingSessionCookies: _*))
          // + discard browser id co too   *edit:* Why?

    val isSuspended = requesterMaybeSuspended.isSuspendedAt(new java.util.Date)
    if (isSuspended)
      return Bad(ForbiddenResult("TyEWSSUSPENDED", "Your account has been suspended")
          .discardingCookies(security.DiscardingSessionCookies: _*))

    val requester = requesterMaybeSuspended

    val authnReq = AuthnReqHeaderImpl(site, sessionId, xsrfOk,
          anyBrowserId, Some(requester), dao, request)

    Good(authnReq)
  }



  def loadOnlineUsers(): Action[Unit] = GetActionRateLimited(RateLimits.ExpensiveGetRequest) {
        request =>
    val stuff = request.dao.loadUsersOnlineStuff()
    OkSafeJson(
      Json.obj(
        "numOnlineStrangers" -> stuff.numStrangers,
        "onlineUsers" -> stuff.usersJson))
  }

}

