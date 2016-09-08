/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package io.efdi.server.pubsub

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import debiki._
import io.efdi.server.http._
import play.api._
import play.api.libs.json.{JsArray, JsString, Json}
import scala.concurrent.ExecutionContext.Implicits.global


/** Authorizes and subscribes a user to pubsub messages.
  */
object SubscriberController extends mvc.Controller {


  /** This request is sent to the server's ip address so we don't yet know which site
    * it concerns (because the normal functionality that looks at the hostname doesn't work).
    * However we get the hostname (an user id) in the url.
    */
  def authorizeSubscriber(channelId: String) = GetAction { request =>
    SECURITY ; COULD // include a xsrf token? They're normally used for post requests only,
    // but perhaps it makes sense to prevent someone from tricking a browser to subscribe
    // to events? Not sure what harm that could do, but ... add xsrf token just in case?

    // If the user has logged in, we've verified the session cookie & user id therein already.
    // Only need to verify that it matches the user id specified in the url.
    // (nchan will subscribe the browser to all events the server sends to a channel
    // with id = userId)

    // The channel contains the site id, so we won't accidentally send messages to browser
    // at the wrong site. [7YGK082]
    val (siteId, dashUserId) = channelId.span(_ != '-')
    if (dashUserId.isEmpty)
      throwForbidden("EsE5GU0W2", s"Bad channel id: $channelId")
    if (siteId != request.siteId)
      throwForbidden("EsE4FK20X", s"Bad site id: $siteId, should be: ${request.siteId}")

    val userIdString = dashUserId.drop(1)
    val userId = userIdString.toIntOption getOrElse throwForbidden(
      "EsE26GKW2", s"Bad user id in channel id: $channelId")

    // (This'd be suspect. Perhaps log something in some suspicious ip addresses log?)
    if (request.theUserId != userId)
      throwForbidden("EsE7UMJ2", s"Wrong user id, cookie: ${request.theUserId} != url: $userId")

    /*
    if (request.sidStatus == SidAbsent)
      throwForbidden("EsE4ZYUG0", "Not logged in")

    // For now, guests may not subscribe. Perhaps later somehow, or in some different ways.
    // Perhaps per topic channels? Instead of per user. For guests, only?
    val sessionCookieUserId = request.sidStatus.roleId getOrElse throwForbidden(
      "EsE5UJGKF2", "Not logged in as a site member")

    // (This'd be suspect. Perhaps log something in some suspicious ip addresses log?)
    if (sessionCookieUserId != userIdInt)
      throwForbidden("EsE7UMJ2", s"Wrong user id. Cookie: $sessionCookieUserId != url: $userIdInt")
      */

    SECURITY ; SHOULD // include the site id in the session id hash / thing somehow so the
    // browser cannot specify the wrong host url param and in that way subscribe with the same
    // user id but at a different site.

    Globals.pubSub.userSubscribed(request.siteId, request.theUser, request.theBrowserIdData)
    Ok
  }


  def loadOnlineUsers() = GetActionRateLimited(RateLimits.ExpensiveGetRequest) {
        request =>
    val stuff = request.dao.loadUsersOnlineStuff()
    OkSafeJson(
      Json.obj(
        "numOnlineStrangers" -> stuff.numStrangers,
        "onlineUsers" -> stuff.usersJson))
  }


  private def lookupSiteId(host: String): SiteId = {
    COULD // use a cache. hostname --> site id won't change
    val siteId = Globals.systemDao.lookupCanonicalHost(host) match {
      case Some(result) =>
        if (result.thisHost == result.canonicalHost)
          result.siteId
        else result.thisHost.role match {
          case SiteHost.RoleDuplicate =>
            result.siteId
          case SiteHost.RoleRedirect =>
            throwForbidden("EsE6U80K3", s"May not subscribe to a RoleRedirect host: $host")
          case SiteHost.RoleLink =>
            die("EsE4GUK20", "Not implemented: <link rel='canonical'>")
          case _ =>
            die("EsE2WKF7")
        }
      case None =>
        throwNotFound("DwE2GKU80", s"Non-existing host: $host")
    }
    siteId
  }

}

