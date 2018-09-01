/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude.{nextRandomLong, nextRandomString, dieIf}
import debiki.EdHttp._
import debiki.RateLimits
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import play.api.libs.json._
import play.api.mvc._
import scala.util.Try


class ApiV0Controller @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.{security, globals}


  def getFromApi(apiEndpoint: String): Action[Unit] =
        GetActionRateLimited(RateLimits.NoRateLimits) { request: GetRequest =>

    import request.{queryString, dao, theRequester => requester}
    lazy val now = context.globals.now()

    def getOnly(queryParam: String): Option[String] =
      queryString.get(queryParam).flatMap(values =>
        if (values.length > 1) throwBadArgument("TyE6ABKP2", queryParam, "Too many values")
        else values.headOption)

    def getOnlyOrThrow(queryParam: String, errorCode: String): String =
      getOnly(queryParam) getOrThrowBadArgument(errorCode, queryParam)

    apiEndpoint match {
      // ex: http://localhost/-/v0/sso-create-session?oneTimeSecret=nnnnn
      case "sso-create-session" =>
        val oneTimeSecret = getOnlyOrThrow("oneTimeSecret", "TyE7AKK25")
        val thenGoToUnsafe = getOnly("thenGoTo")
        val anyUserId = dao.redisCache.getOneTimeSsoLoginUserIdDestroySecret(oneTimeSecret)
        val userId = anyUserId getOrElse {
          throwForbidden("TyE4AKBR02", "Bad or expired one time secret")
        }
        val user = dao.getTheMember(userId)
        dao.pubSub.userIsActive(request.siteId, user, request.theBrowserIdData)
        val (_, _, sidAndXsrfCookies) = security.createSessionIdAndXsrfToken(request.siteId, user.id)
        // Remove server origin, so Mallory cannot somehow redirect to a phishing website.
        val thenGoTo = thenGoToUnsafe.flatMap(Prelude.stripOrigin) getOrElse "/"
        TemporaryRedirect(thenGoTo)
            .withCookies(sidAndXsrfCookies: _*)
      case _ =>
        throwForbidden("TyEAPIGET404", s"No such API endpoint: $apiEndpoint")
    }
  }


  def postToApi(apiEndpoint: String): Action[JsValue] =
        PostJsonAction(RateLimits.NoRateLimits, maxBytes = 1000) { request: JsonPostRequest =>

    import request.{body, dao, theRequester => requester}
    lazy val now = context.globals.now()

    throwForbiddenIf(!request.isViaApiSecret,
        "TyEAPI0SYSBT", "The API may be called only via Basic Auth and an API secret")

    apiEndpoint match {
      case "sso-upsert-user" =>
        val extUser = Try(ExternalUser(
          externalId = (body \ "externalUserId").as[String],
          primaryEmailAddress = (body \ "primaryEmailAddress").as[String],
          isEmailAddressVerified = (body \ "isEmailAddressVerified").as[Boolean],
          username = (body \ "username").asOpt[String],
          fullName = (body \ "fullName").asOpt[String],
          avatarUrl = (body \ "avatarUrl").asOpt[String],
          aboutUser = (body \ "aboutUser").asOpt[String],
          isAdmin = (body \ "isAdmin").asOpt[Boolean].getOrElse(false),
          isModerator = (body \ "isModerator").asOpt[Boolean].getOrElse(false))) getOrIfFailure { ex =>
            throwBadRequest("TyEBADEXTUSR", ex.getMessage)
          }

        request.dao.readWriteTransaction { tx =>
          def makeName(): String = "unnamed_" + (nextRandomLong() % 1000)
          val usernameToTry = extUser.username.orElse(extUser.fullName).getOrElse(makeName())
          val okayUsername = User.makeOkayUsername(usernameToTry, allowDotDash = false,  // [CANONUN]
            tx.isUsernameInUse)  getOrElse throwForbidden("TyE2GKRC4C2", s"Cannot generate username")

          // Look up by external id, if found, login.
          // Look up by email. If found, reuse account, set external id, and login.
          // Else, create new user with specified external id and email.

          val user = tx.loadMemberInclDetailsByExternalId(extUser.externalId).map({ user =>
            // TODO update fields, if different.
            // email:  UserController.scala:  setPrimaryEmailAddresses
            // mod / admin:  UserDao:  editMember
            // name etc:  UserDao:  saveAboutMemberPrefs
            user
          }) orElse tx.loadMemberInclDetailsByEmailAddr(extUser.primaryEmailAddress).map({ user =>
            throwForbiddenIf(user.externalId.isDefined,
                "TyE5AKBR20", "Another external user has this email address")
            // Apparently this Talkyard user was created "long ago", and now we're'
            // single-sign-on logging in as that user, for the first time. Connect this old account
            // with the external user account, and thereafter it'll get looked up via external
            // id instead.
            val updatedUser = user.copyWithExternalData(extUser)
            dieIf(updatedUser == user, "TyE4AKBRE2")
            tx.updateMemberInclDetails(updatedUser)
            updatedUser
          }) getOrElse {
            // Create new account.
            val userData = // [5LKKWA10]
              NewPasswordUserData.create(
                name = extUser.fullName,
                username = okayUsername,
                email = extUser.primaryEmailAddress,
                password = None,
                externalId = Some(extUser.externalId),
                createdAt = now,
                isOwner = false,
                isAdmin = extUser.isAdmin,
                isModerator = extUser.isModerator,
                emailVerifiedAt = if (extUser.isEmailAddressVerified) Some(now) else None)
              match {
                case Good(data) => data
                case Bad(errorMessage) =>
                  throwUnprocessableEntity("DwE805T4", s"$errorMessage, please try again.")
              }
            dao.createUserForExternalSsoUser(userData, request.theBrowserIdData, tx)
          }

          val secret = nextRandomString()
          dao.redisCache.saveOneTimeSsoLoginSecret(secret, user.id)
          OkApiJson(Json.obj(
            "createSessionSecret" -> secret))
        }

      case _ =>
        throwForbidden("TyEAPIPST404", s"No such API endpoint: $apiEndpoint")
    }
  }

}
