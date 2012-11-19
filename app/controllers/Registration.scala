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
import play.api.data._
import play.api.data.Forms._
import play.api.data.validation.Constraints._
import play.api.{Play, Logger}
import securesocial.core.providers.UsernamePasswordProvider
import securesocial.core.{AuthenticationMethod, SocialUser, UserId, UserService}
import com.typesafe.plugin._
import Play.current
import securesocial.core.providers.utils.{GravatarHelper, PasswordHasher}


/**
 * A controller to handle user registration.
 *
 */
object Registration extends Controller {

  val providerId = UsernamePasswordProvider.UsernamePassword

  case class RegistrationInfo(userName: String, fullName: String, email: String, password: String)

  val form = Form[RegistrationInfo](
    mapping(
      "userName" -> nonEmptyText.verifying( "Username already taken", userName => {
        UserService.find(UserId(userName,providerId)).isEmpty
      }),
      "fullName" -> nonEmptyText,
      ("email" ->
        tuple(
          "email1" -> email.verifying( nonEmpty ),
          "email2" -> email.verifying( nonEmpty )
        ).verifying("Email addresses do not match", emails => emails._1 == emails._2)
      ),
      ("password" ->
        tuple(
          "password1" -> nonEmptyText,
          "password2" -> nonEmptyText
        ).verifying("Passwords do not match", passwords => passwords._1 == passwords._2)
      )
    )
    // binding
    ((userName, fullName, email, password) => RegistrationInfo(userName, fullName, email._1, password._1))
    // unbinding
    (info => Some(info.userName, info.fullName, (info.email, info.email), (info.password, "")))
  )

  /**
   * Renders the sign up page
   * @return
   */
  def signUp = Action { implicit request =>
    throw new _root_.java.lang.UnsupportedOperationException("securesocial signUp") /*
    Ok(securesocial.views.html.Registration.signUp(form))
    */
  }

  /**
   * Handles posts from the sign up page
   */
  def handleSignUp = Action { implicit request =>
    throw new _root_.java.lang.UnsupportedOperationException("securesocial handleSignUp") /*
    form.bindFromRequest.fold (
      errors => {
        Logger.info("errors " + errors)
        BadRequest(securesocial.views.html.Registration.signUp(errors))
      },
      info => {
        Logger.info(info.userName)
        val userId = UserId(info.userName,providerId)
        val user = SocialUser(userId, info.fullName,
          Some(info.email),
          GravatarHelper.avatarFor(info.email),
          AuthenticationMethod.UserPassword,
          passwordInfo = Some(use[PasswordHasher].hash(info.password)))
        UserService.save(user)
        Redirect(routes.LoginPage.login()).flashing("success" -> "Thank you for signing up.  Check your email for further instructions")
      }
    )
    */
  }

  /**
   * The action invoked from the activation email the user receives after signing up
   * @return
   */
  def activateAccount = Action { implicit request =>
    Ok("")
  }

}
