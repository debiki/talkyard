/**
 * Copyright (c) 2013-2014, 2018 Kaj Magnus Lindberg
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
import debiki._
import debiki.EdHttp._
import ed.server._
import ed.server.http.{ApiRequest, JsonOrFormDataBody}
import ed.server.security.EdSecurity
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents, Result}
import scala.concurrent.Future



/** Loads the admin app page.
  */
class AdminController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.SecureCookie


  def redirectToAdminPage(): Action[Unit] = GetAction { _ =>
    Redirect(routes.AdminController.viewAdminPage("").url)
  }


  def viewAdminPage(whatever: String): Action[Unit] = AsyncGetAction { apiReq =>
    dieIfAssetsMissingIfDevTest()

    if (!apiReq.user.exists(_.isStaff)) {
      Future.successful(Ok(views.html.login.loginPopup(
        SiteTpi(apiReq),
        mode = "LoginToAdministrate",
        serverAddress = s"//${apiReq.host}",
        returnToUrl = apiReq.uri)) as HTML)
    }
    else {
      showAdminAppPage(apiReq)
    }
  }


  def showTestSsoPage(): Action[Unit] = AsyncGetActionIsLogin { apiReq =>
    showAdminAppPage(apiReq)
  }


  private def showAdminAppPage(apiReq: ApiRequest[_]): Future[Result] = {
    val siteTpi = SiteTpi(apiReq, isAdminArea = true)
    val adminPageHtmlStr = views.html.adminPage(siteTpi, appId = "dw-react-admin-app").body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(adminPageHtmlStr,
      unapprovedPostAuthorIds = Set.empty, apiReq) map { response =>
      response withCookies SecureCookie(
        EdSecurity.XsrfCookieName, apiReq.xsrfToken.value)
    }
  }



  def showAdminOneTimeLoginPage: Action[Unit] = GetActionAllowAnyone { request =>
    Ok(views.html.adminlogin.adminLoginPage(
        SiteTpi(request), xsrfToken = request.xsrfToken.value))
  }


  def handleAdminOneTimeLoginForm: Action[JsonOrFormDataBody] =
        JsonOrFormDataPostAction(RateLimits.ResetPassword, maxBytes = 200, allowAnyone = true) {
          request =>

    import request.dao

    def throwNoSuchAdmin() =
      throwNotFound("TyE0ADMEML_", "No admin has that primary email address")

    val emailAdress = request.body.getOrThrowBadReq("emailAddress")

    val admin = request.dao.loadMemberByPrimaryEmailAddress(emailAdress) getOrElse {
      throwNoSuchAdmin()
    }
    if (!admin.isAdmin) {
      throwNoSuchAdmin()
    }

    throwForbiddenIf(admin.emailVerifiedAt.isEmpty,
        "TyE3ABK0720", "Email address not verified")

    val oneTimeSecret = nextRandomString()

    dao.redisCache.saveOneTimeLoginSecret(
      oneTimeSecret, admin.id, expireSeconds = Some(MaxResetPasswordEmailAgeInHours * 3600))

    sendOneTimeLoginEmail(
        admin, request, emailTitle = "Admin one time login link", secret = oneTimeSecret)

    Ok("Email sent, with a one time login link.") as TEXT
  }


  private def sendOneTimeLoginEmail(user: User, request: ApiRequest[_],
                                    emailTitle: String, secret: String) {
    import request.dao

    val origin = globals.originOf(request.host)
    val url = origin +
      controllers.routes.ApiV0Controller.getFromApi("login-with-secret") +   // [305KDDN24]
      "?oneTimeSecret=" + secret + "&thenGoTo=/-/users/" + user.theUsername

    val email = Email(
      EmailType.OneTimeLoginLink,
      createdAt = globals.now(),
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = s"[${dao.theSiteName()}] $emailTitle",
      bodyHtmlText = (emailId: String) => {
        views.html.adminlogin.oneTimeLoginLinkEmail(
          siteAddress = request.host,
          url = url,
          member = user,
          expirationTimeInHours = MaxResetPasswordEmailAgeInHours).body
      })

    dao.saveUnsentEmail(email)
    globals.sendEmail(email, dao.siteId)
  }

}
