/**
 * - Parts Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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


object LoginWithSecureSocialController extends mvc.Controller {

  val Logger = play.api.Logger("app.securesocial")

  /**
   * The authentication flow for all providers starts here.
   *
   * @param provider The id of the provider that needs to handle the call
   */
  def authenticate(provider: String) = handleAuth(provider)
  def authenticateByPost(provider: String) = handleAuth(provider)


  // Not async? This blocks a thread?
  private def handleAuth(provider: String) = GetAction { request =>
    Registry.providers.get(provider) match {
      case Some(p) => {
        try {
          p.authenticate()(request.request).fold( result => result , {
            ssid: securesocial.core.Identity =>
              val ssUser = ssid.asInstanceOf[securesocial.core.SocialUser]
              completeAuthentication(ssUser, request)
          })
        } catch {
          case ex: AccessDeniedException => {
            //throwForbidden("DwE830ES2", "Access denied")
            Redirect("/")
          }

          case other: Throwable => {
            Logger.error("Unable to log user in. An exception was thrown", other)
            //throwForbidden("DwE7ZCW4", "Unable to login. Exception thrown.")
            Redirect("/")
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
    val cookies = userConfigCookie::sidAndXsrfCookies

    Redirect("/").withCookies(cookies: _*)
  }

}
