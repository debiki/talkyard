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

import actions.ApiActions._
import actions.ApiActions.JsonOrFormDataPostAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.ApiRequest


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
object ResetPasswordController extends mvc.Controller {

  val MaxResetPasswordEmailAgeInDays = 1


  def showResetPasswordPage = GetAction { request =>
    ???
    //Ok(views.html.resetpassword.resetPassword(xsrfToken = request.xsrfToken.value)
  }


  def handleResetPasswordForm = GetAction { request =>
    ???
    //Ok(views.html.resetpassword.passwordHasBeenReset())
  }


  def handleResetPasswordLink(emailId: String) = GetAction { request =>
    ???
    //Ok(views.html.resetpassword.passwordHasBeenReset())
  }

}
