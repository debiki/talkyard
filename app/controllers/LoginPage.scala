/**
 * Copyright 2012 Jorge Aliss (jaliss at gmail dot com) - twitter: @jaliss
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
package securesocial.controllers

import play.api.mvc.{Action, Controller}
import play.api.i18n.Messages
import securesocial.core._
import play.api.{Play, Logger}
import Play.current
import play.api.data._
import play.api.data.Forms._
import play.api.data.validation.Constraints._


/**
 * The Login page controller
 */
object LoginPage extends Controller
{
  /**
   * The property that specifies the page the user is redirected to if there is no original URL saved in
   * the session.
   */
  val onLoginGoTo = "securesocial.onLoginGoTo"

  /**
   * The property that specifies the page the user is redirected to after logging out.
   */
  val onLogoutGoTo = "securesocial.onLogoutGoTo"

  /**
   * The root path
   */
  val Root = "/"



  /**
   * Renders the login page
   * @return
   */
  def login = Action { implicit request =>
    /*
    Ok(securesocial.views.html.login(ProviderRegistry.all().values, securesocial.core.providers.UsernamePasswordProvider.loginForm))
    */
    throw new _root_.java.lang.UnsupportedOperationException("securesocial login")
  }

  /**
   * Logs out the user by clearing the credentials from the session.
   * The browser is redirected either to the login page or to the page specified in the onLogoutGoTo property.
   *
   * @return
   */
  def logout = Action { implicit request =>
    /*
    val to = Play.configuration.getString(onLogoutGoTo).getOrElse(routes.LoginPage.login().absoluteURL())
    Redirect(to).withSession(session - SecureSocial.UserKey - SecureSocial.ProviderKey)
    */
    throw new _root_.java.lang.UnsupportedOperationException("securesocial logout")
  }

  /**
   * The authentication flow for all providers starts here.
   *
   * @param provider The id of the provider that needs to handle the call
   * @return
   */
  def authenticate(provider: String) = handleAuth(provider)
  def authenticateByPost(provider: String) = handleAuth(provider)

  private def handleAuth(provider: String) = Action { implicit request =>
    throw new _root_.java.lang.UnsupportedOperationException("securesocial handleAuth")
    /*
    ProviderRegistry.get(provider) match {
      case Some(p) => {
        try {
          p.authenticate().fold( result => result , {
            user =>
              if ( Logger.isDebugEnabled ) {
                Logger.debug("User logged in : [" + user + "]")
              }
              val toUrl = session.get(SecureSocial.OriginalUrlKey).getOrElse(
                Play.configuration.getString(onLoginGoTo).getOrElse(Root)
              )
              Redirect(toUrl).withSession { session +
                (SecureSocial.UserKey -> user.id.id) +
                (SecureSocial.ProviderKey -> user.id.providerId) -
                SecureSocial.OriginalUrlKey
              }
          })
        } catch {
          case ex: AccessDeniedException => Logger.warn("User declined access using provider " + provider)
          Redirect(routes.LoginPage.login()).flashing("error" -> Messages("securesocial.login.accessDenied"))
        }
      }
      case _ => NotFound
    }
  */
  }



}
