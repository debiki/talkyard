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

import com.debiki.v0.Prelude._
import debiki.DebikiHttp._
import play.api._
import i18n.Messages
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import securesocial.core._
import securesocial.controllers.TemplatesPlugin
import securesocial.core.providers.utils.RoutesHelper


object AppLoginSecureSocial extends mvc.Controller {

  import securesocial.controllers.ProviderController.toUrl

  val Logger = play.api.Logger("app.securesocial")


  /**
   * Renders a not authorized page if the Authorization object passed to the action
   * does not allow execution.
   *
   * @see Authorization
   */
  def notAuthorized() = mvc.Action { implicit request =>
    import com.typesafe.plugin._
    Forbidden(use[TemplatesPlugin].getNotAuthorizedPage)
  }

  /**
   * The authentication flow for all providers starts here.
   *
   * @param provider The id of the provider that needs to handle the call
   */
  def authenticate(provider: String) = handleAuth(provider)
  def authenticateByPost(provider: String) = handleAuth(provider)


  // Not async? This blocks a thread?
  private def handleAuth(provider: String) = mvc.Action { implicit request =>
    Registry.providers.get(provider) match {
      case Some(p) => {
        try {
          p.authenticate().fold( result => result , {
            user => completeAuthentication(user, session)
          })
        } catch {
          case ex: AccessDeniedException => {
            Redirect(RoutesHelper.login()).flashing("error" -> Messages("securesocial.login.accessDenied"))
          }

          case other: Throwable => {
            Logger.error("Unable to log user in. An exception was thrown", other)
            Redirect(RoutesHelper.login()).flashing("error" -> Messages("securesocial.login.errorLoggingIn"))
          }
        }
      }
      case _ =>
        throwNotFound("DwE26SK3", s"No provider with id `$provider'")
    }
  }


  private def completeAuthentication(user: Identity, session: Session)(
        implicit request: RequestHeader): PlainResult = {
    if ( Logger.isDebugEnabled ) {
      Logger.debug("[securesocial] user logged in : [" + user + "]")
    }
    val withSession = Events.fire(new LoginEvent(user)).getOrElse(session)
    Authenticator.create(user) match {
      case Right(authenticator) => {
        Redirect(toUrl).withSession(withSession -
          SecureSocial.OriginalUrlKey -
          IdentityProvider.SessionId -
          OAuth1Provider.CacheKey).withCookies(authenticator.toCookie)
      }
      case Left(error) => {
        // improve this
        throw new RuntimeException("Error creating authenticator")
      }
    }
  }

}
