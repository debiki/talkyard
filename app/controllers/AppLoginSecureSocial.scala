/**
 * Parts Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 *
 * Parts Copyright 2012 Jorge Aliss (jaliss at gmail dot com) - twitter: @jaliss
 *
 * I (KajMagnus) copied Jorge Aliss' code from here:
 *   securesocial-git/module-code/app/securesocial/controllers/ProviderController.scala
 *
 * and Jorge Aliss' code is:
 *   Licensed under the Apache License, Version 2.0 (the "License"),
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */

package controllers

import com.debiki.v0.Prelude._
import debiki.DebikiHttp._
import play.api._
import i18n.Messages
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import securesocial.core.{AccessDeniedException, Registry, SecureSocial}
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
            user =>
              Logger.debug(s"User logged in: $user")
              Redirect(toUrl).withSession { session +
                (SecureSocial.UserKey -> user.id.id) +
                SecureSocial.lastAccess +
                (SecureSocial.ProviderKey -> user.id.providerId) -
                SecureSocial.OriginalUrlKey
              }
          })
        } catch {
          case ex: AccessDeniedException => {
            Redirect(RoutesHelper.login()).flashing(
              "error" -> Messages("securesocial.login.accessDenied"))
          }
          case other: Throwable => {
            Logger.error("Unable to log user in. An exception was thrown", other)
            Redirect(RoutesHelper.login()).flashing(
              "error" -> Messages("securesocial.login.errorLoggingIn"))
          }
        }
      }
      case _ =>
        throwNotFound("DwE26SK3", s"No provider with id `$provider'")
    }
  }

}
