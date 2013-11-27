/**
 * - Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
 *
 * - Parts Copyright 2012 Jorge Aliss (jaliss at gmail dot com) - twitter: @jaliss
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
 * ---
 *
 * I (KajMagnus) copied Jorge Aliss' code from here:
 *   securesocial-git/module-code/app/securesocial/controllers/ProviderController.scala
 * (and Jorge Aliss' code is licensed under the Apache License, Version 2.0,
 * http://www.apache.org/licenses/LICENSE-2.0)
 */

package controllers

import actions.ApiActions.GetAction
import actions.ApiActions.GetRequest
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import play.api._
import i18n.Messages
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import requests.ApiRequest
import securesocial.core._
import securesocial.controllers.TemplatesPlugin
import securesocial.core.providers.utils.RoutesHelper


/** OpenAuth 1 and 2 login, provided by SecureSocial. E.g. for Facebook and Twitter.
  */
object LoginWithSecureSocialController extends mvc.Controller {

  val Logger = play.api.Logger("app.securesocial")

  private val ReturnToUrlCookieName = "dwCoReturnToUrl"


  /** The authentication flow starts here, if it happens in the main window and you
    * thus have a page you want to return to afterwards.
    */
  def startAuthentication(provider: String, returnToUrl: String) = GetAction { request =>
    val theReply = handleAuthImpl(provider)(request)
    theReply.withCookies(Cookie(name = ReturnToUrlCookieName, value = returnToUrl))
  }


  /** The authentication starts here if it happens in a popup. Then, afterwards,
    * the popup window will be sent some Javascript that tells the popup opener
    * what has happened (i.e. that the user logged in).
    */
  def startAuthenticationInPopupWindow(provider: String) = GetAction { request =>
    handleAuthImpl(provider)(request)
  }


  /** OAuth callbacks. SecureSocial assumes these method names; cannot rename them.
    */
  def authenticate(provider: String) = handleAuth(provider)
  def authenticateByPost(provider: String) = handleAuth(provider)

  private def handleAuth(provider: String) = GetAction { request =>
    handleAuthImpl(provider)(request)
  }


  private def handleAuthImpl(provider: String)(request: GetRequest) = {
    Registry.providers.get(provider) match {
      case Some(p) => {
        try {
          p.authenticate()(request.request).fold( result => result , {
            ssid: securesocial.core.Identity =>
              val ssUser = ssid.asInstanceOf[securesocial.core.SocialUser]
              completeAuthentication(ssUser, request)
          })
        }
        catch {
          case ex: AccessDeniedException => {
            throwForbidden("DwE830ES2", "Access denied")
          }
          case other: Throwable => {
            Logger.error("Unable to log user in. An exception was thrown", other)
            throwInternalError("DwE7ZCW4", "Unable to login: internal error.")
          }
        }
      }
      case _ =>
        throwNotFound("DwE26SK3", s"No provider with id `$provider'")
    }
  }


  private def completeAuthentication(secureSocialCoreUser: securesocial.core.SocialUser,
        request: GetRequest): PlainResult = {

    Logger.debug(s"User logged in : [$secureSocialCoreUser]")

    val siteId = debiki.DebikiHttp.lookupTenantIdOrThrow(request, debiki.Globals.systemDao)
    val dao = debiki.Globals.siteDao(siteId, ip = request.ip)

    val loginAttempt = SecureSocialLoginAttempt(
      ip = request.ip,
      date = request.ctime,
      prevLoginId = request.loginId,
      secureSocialCoreUser)

    val loginGrant: LoginGrant = dao.saveLogin(loginAttempt)

    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = AppConfigUser.userConfigCookie(loginGrant)
    val newSessionCookies = userConfigCookie::sidAndXsrfCookies

    val response = request.request.cookies.get(ReturnToUrlCookieName) match {
      case Some(returnToUrlCookie) =>
        Redirect(returnToUrlCookie.value).discardingCookies(DiscardingCookie(ReturnToUrlCookieName))
      case None =>
        // We're logging in in a popup.
        Ok(views.html.login.loginPopupCallback("LoginOk",
          s"You have been logged in, welcome ${loginGrant.displayName}!",
          anyReturnToUrl = None))
    }

    response.withCookies(newSessionCookies: _*)
  }

}
