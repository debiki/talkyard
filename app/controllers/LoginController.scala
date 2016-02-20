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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.mvc._
import play.api.mvc.BodyParsers.parse.empty
import play.api.Play.current


/** Logs in and out.
  */
object LoginController extends mvc.Controller {

  val BecomeOwnerEmailConfigValue = "debiki.becomeOwnerEmailAddress"

  val DiscardingSessionCookie = DiscardingSecureCookie("dwCoSid")


  /** Opens a popup and a login dialog inside that popup. Useful when logging in
    * in an iframe, because it's not feasible to open modal dialogs from inside
    * iframes — only the iframe would be disabled by the modal dialog, but not
    * the rest of the page.
    */
  def showLoginPopup(mode: String, returnToUrl: String) = ExceptionAction(empty) { request =>
    Ok(views.html.login.loginPopup(
      mode = mode,
      serverAddress = s"//${request.host}",
      returnToUrl = returnToUrl)) as HTML
  }


  /** Clears login related cookies and OpenID and OpenAuth stuff, unsubscribes
    * from any event channel.
    */
  def logout = GetActionAllowAnyone { request =>
    request.user foreach { user =>
      request.dao.pubSub.unsubscribeUser(request.siteId, user, request.theBrowserIdData)
    }
    // Keep the xsrf cookie, so login dialog works:
    Ok.discardingCookies(DiscardingSessionCookie)
  }


  /** Tests if we're currently logging in as the very first user — s/he will
    * be made admin if s/he has the correct email address.
    */
  def shallBecomeOwner(request: JsonPostRequest, emailAddress: String): Boolean = {
    val ownerEmailInDatabase = request.dao.loadSiteStatus() match {
      case SiteStatus.OwnerCreationPending(email) =>
        email
      case _ =>
        // The very first signup has happened already, owner already created.
        return false
    }

    val ownerEmail =
      if (request.siteId == Site.FirstSiteId)
        Play.configuration.getString(BecomeOwnerEmailConfigValue) getOrElse {
          val errorCode = "DwE8PY25"
          val errorMessage = s"Config value '$BecomeOwnerEmailConfigValue' missing"
          Logger.error(s"$errorMessage [$errorCode]")
          throwInternalError(errorCode, errorMessage)
        }
      else
        ownerEmailInDatabase

    if (emailAddress != ownerEmail)
      // Error code used client side; don't change.
      throwForbidden("_EsE403WEA_", "Wrong email address")

    true
  }

}
