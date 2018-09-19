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

package ed.server.pubsub

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.EdHttp._
import debiki._
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api.libs.json.Json
import play.api.mvc.{Action, ControllerComponents}


/** Authorizes and subscribes a user to pubsub messages.
  */
class SubscriberController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals

  /** This request is sent by Nchan to the app server's ip address so we don't know which site
    * it concerns (because the normal functionality that looks at the hostname doesn't work,
    * since Nchan sends to the ip address, not the correct hostname).
    * However we get the site id (and user id) in the channel id url param.   ... But ...
    *
    * ... But, Nchan *does* apparently include headers and cookies from the original request.
    * So, below, we compare the 'siteId-userId' in the specified Nchan channel,
    * with the site id and user id in the host header & sessiond id hash.
    */
  def authorizeSubscriber(channelId: String) = GetAction { request =>
    play.api.Logger.info("AUTH SUBS")
    SECURITY ; COULD // include a xsrf token? They're normally used for post requests only,
    // but perhaps it makes sense to prevent someone from tricking a browser to subscribe
    // to events? Not sure what harm that could do, but ... add xsrf token just in case?

    // If the user has logged in, we've verified the session cookie & user id therein already.
    // Only need to verify that it matches the user id specified in the channelId url param.
    // (nchan will subscribe the browser to all events the server sends to a channel
    // with id = 'siteId-userId')

    // The channel contains the site id, so we won't accidentally send messages to browser
    // at the wrong site. [7YGK082]
    var isTestSite: Boolean = false
    val (siteIdString, dashUserId) = {
      isTestSite = channelId.headOption.contains('-')
      val c = if (isTestSite) channelId.drop(1) else channelId
      c.span(_ != '-')
    }

    if (dashUserId.isEmpty)
      throwForbidden("EsE5GU0W2", s"Bad channel id: $channelId")

    var siteId = siteIdString.toIntOrThrow(
      "EdE2WDSX7", s"Bad channel site id, not an integer: $siteIdString")
    if (isTestSite) {
      siteId = -siteId
    }

    if (siteId != request.siteId)
      throwForbidden("EsE4FK20X", s"Bad site id: $siteId, should be: ${request.siteId}")

    val userIdString = dashUserId.drop(1)
    val userId = userIdString.toIntOption getOrElse throwForbidden(
      "EsE26GKW2", s"Bad user id in channel id: $channelId")

    // (This'd be suspect. Perhaps log something in some suspicious ip addresses log?)
    if (request.theUserId != userId)
      throwForbidden("EsE7UMJ2", s"Wrong user id, cookie: ${request.theUserId} != url: $userId")

    /*
    // For now, guests may not subscribe. Perhaps later somehow, or in some different ways.
    // Perhaps per topic channels? Instead of per user. For guests, only?
    val sessionCookieUserId = request.sidStatus.roleId getOrElse throwForbidden(
      "EsE5UJGKF2", "Not logged in as a site member")
      */

    SECURITY; COULD // secret-salt hash the 'siteId-userId' and include-append in the channel id,
    // to make it extra impossible to listen to someone else's 'siteId-userId' events. Not really
    // needed though, because site & user id already secure-salt hashed in the session id [4WKRQ1A]
    SECURITY; TESTS_MISSING // test that cannot specify the wrong host HTTP param or the wrong
    // 'siteId-userId' channel id, and in that way subscribe e.g. as someone else at the same site,
    // or someone with the same user id, at a different site.

    RACE // fairly harmless though. If the user updates the watchbar vi another browser tab right now.
    val watchbar: BareWatchbar = request.dao.getOrCreateWatchbar(request.theUser.id)
    globals.pubSub.userSubscribed(request.siteId, request.theUser, request.theBrowserIdData,
      watchbar.watchedPageIds)
    Ok
  }


  def loadOnlineUsers(): Action[Unit] = GetActionRateLimited(RateLimits.ExpensiveGetRequest) {
        request =>
    val stuff = request.dao.loadUsersOnlineStuff()
    OkSafeJson(
      Json.obj(
        "numOnlineStrangers" -> stuff.numStrangers,
        "onlineUsers" -> stuff.usersJson))
  }


  private def lookupSiteId(host: String): SiteId = {
    COULD // use a cache. hostname --> site id won't change
    val siteId = globals.systemDao.lookupCanonicalHost(host) match {
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

