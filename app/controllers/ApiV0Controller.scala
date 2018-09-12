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
import com.debiki.core.Prelude._
import debiki.EdHttp._
import debiki.RateLimits
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import play.api.libs.json._
import play.api.mvc._
import scala.util.Try
import Utils.OkXml


// How test API?
//  https://medium.com/javascript-scene/why-i-use-tape-instead-of-mocha-so-should-you-6aa105d8eaf4
//  looks nice:  https://github.com/vesln/hippie
// Markdown not Yaml?  https://apiblueprint.org/developers.html
//
// https://apiblueprint.org/   or Swagger?  or sth else?
//
// Dredd?  https://github.com/apiaryio/dredd
//    https://dredd.readthedocs.io/en/latest/    http://dredd.org/en/latest/
//
// Want:
//  - API docs that can be generated to interactive HTML, so can click-&-edit-run-examples
//  - API docs that can be parsed into JS and auto-tested by api-e2e-test-suite
//
// docs how? Slate? like these use:
// https://developers.giosg.com/http_api.html#list-external-subscriptions-for-scheduled-email-report
//


class ApiV0Controller @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.{security, globals}
  import play.api.Logger


  def getFromApi(apiEndpoint: String): Action[Unit] =
        GetActionRateLimited(RateLimits.NoRateLimits) { request: GetRequest =>

    import request.{siteId, queryString, dao, theRequester => requester}
    lazy val now = context.globals.now()

    def getOnly(queryParam: String): Option[String] =
      queryString.get(queryParam).flatMap(values =>
        if (values.length > 1) throwBadArgument("TyE6ABKP2", queryParam, "Too many values")
        else values.headOption)

    def getOnlyOrThrow(queryParam: String, errorCode: String): String =
      getOnly(queryParam) getOrThrowBadArgument(errorCode, queryParam)

    apiEndpoint match {
      // ex: http://localhost/-/v0/sso-login?oneTimeSecret=nnnnn&thenGoTo=/
      case "sso-login" =>
        val oneTimeSecret = getOnlyOrThrow("oneTimeSecret", "TyE7AKK25")
        val anyUserId = dao.redisCache.getSsoLoginUserIdDestroySecret(oneTimeSecret)
        val userId = anyUserId getOrElse {
          throwForbidden("TyE4AKBR02", "Non-existing or expired or already used one time secret")
        }
        val user = dao.getTheMember(userId)
        dao.pubSub.userIsActive(siteId, user, request.theBrowserIdData)
        val (_, _, sidAndXsrfCookies) = security.createSessionIdAndXsrfToken(siteId, user.id)

        // Remove server origin, so one cannot somehow get redirected to a phishing website
        // (if one follows a link with an "evil" go-next url param to the SSO login page,
        // which then redirects to this endpoint with that bad go-next url).
        val thenGoToUnsafe = getOnly("thenGoTo")
        val thenGoTo = thenGoToUnsafe.flatMap(Prelude.stripOrigin) getOrElse "/"

        TemporaryRedirect(thenGoTo)
            .withCookies(sidAndXsrfCookies: _*)
      case "feed" =>
        /*
        https://server.address/-/v0/recent-posts.rss
        https://server.address/-/v0/feed?
            type=atom&
            include=replies,chatMessages,topics&
            limit=10&
            minLikeVotes=1&
            path=/some/category/or/page

        Just going to:  https://www.talkyard.io/-/feed  = includes all new posts, type Atom, limit 10 maybe.

          /page/path.atom  = new replies to that page
          /directory/ *.atom  = new topics,
          /directory/ **.atom  = new topics in all deeper dirs, and (?) use:
          /directory*.atom  = new topics, and (?) use:
            dao.listPagePaths(
              Utils.parsePathRanges(pageReq.pagePath.folder, pageReq.request.queryString,
         */
        val atomXml = dao.getAtomFeedXml()
        OkXml(atomXml, "application/atom+xml; charset=UTF-8")
      case _ =>
        throwForbidden("TyEAPIGET404", s"No such API endpoint: $apiEndpoint")
    }
  }


  def postToApi(apiEndpoint: String): Action[JsValue] =
        PostJsonAction(RateLimits.NoRateLimits, maxBytes = 1000) { request: JsonPostRequest =>

    import request.{siteId, body, dao, theRequester => requester}
    lazy val now = context.globals.now()

    throwForbiddenIf(!request.isViaApiSecret,
        "TyEAPI0SECRET", "The API may be called only via Basic Auth and an API secret")

    apiEndpoint match {
      case "sso-upsert-user-generate-login-secret" =>
        val extUser = Try(ExternalUser(
          externalId = (body \ "externalUserId").as[String].trim,
          primaryEmailAddress = (body \ "primaryEmailAddress").as[String].trim,
          isEmailAddressVerified = (body \ "isEmailAddressVerified").as[Boolean],
          username = (body \ "username").asOptStringNoneIfBlank,
          fullName = (body \ "fullName").asOptStringNoneIfBlank,
          avatarUrl = (body \ "avatarUrl").asOptStringNoneIfBlank,
          aboutUser = (body \ "aboutUser").asOptStringNoneIfBlank,
          isAdmin = (body \ "isAdmin").asOpt[Boolean].getOrElse(false),
          isModerator = (body \ "isModerator").asOpt[Boolean].getOrElse(false))) getOrIfFailure { ex =>
            throwBadRequest("TyEBADEXTUSR", ex.getMessage)
          }

        throwForbiddenIf(!extUser.isEmailAddressVerified, "TyESSOEMLUNVERF", o"""s$siteId:
            The email address ${extUser.primaryEmailAddress} of external user '${extUser.externalId}'
            hasn't been verified.""")

        val user = request.dao.readWriteTransaction { tx =>
          // Look up by external id. If found, login.
          // Look up by email. If found, reuse account, set external id, and login.
          // Else, create new user with specified external id and email.

          tx.loadMemberInclDetailsByExternalId(extUser.externalId).map({ user =>  // (7KAB2BA)
            dieIf(user.externalId isNot extUser.externalId, "TyE5KR02A")
            // TODO update fields, if different.
            if (extUser.primaryEmailAddress != user.primaryEmailAddress) {
              // TODO later: The external user's email address has been changed? Update this Talkyard
              // user's email address too, then.  —  However, would be weird,
              // if there already is another Talkyard account that mirrors [*another* external user
              // with that email]?
              val anyUser2 = tx.loadMemberByPrimaryEmailOrUsername(extUser.primaryEmailAddress)
              anyUser2 foreach { user2 =>
                throwForbidden("TyE2ABK40", o"""s$siteId: Cannot update the email address of
                    Talkyard user ${user.usernameHashId} with external id
                    '${extUser.externalId}' to match the external user's new email address
                    ('${extUser.primaryEmailAddress}'): The new address is already used
                    by another Talkyard user: ${user2.usernameHashId}""")
              }

              // TODO also check non-primary addrs. (5BK02A5)
            }
            // email:  UserController.scala:  setPrimaryEmailAddresses (don't forget to upd email table)
            // mod / admin:  UserDao:  editMember
            // name etc:  UserDao:  saveAboutMemberPrefs
            // For now, just generate a login secret; don't sync users:
            user
          }) orElse
              // TODO what about looking up by secondary email addresses, or not?
              // Don't do that? They aren't supposed to be used for login. And do require
              // that there isn't any clash here: (5BK02A5)?
              tx.loadMemberInclDetailsByEmailAddr(extUser.primaryEmailAddress).map({ user =>

            dieIf(user.externalId is extUser.externalId, "TyE7AKBR2") // ought to have been found by id
            dieIf(user.primaryEmailAddress != extUser.primaryEmailAddress, "TyE7AKBR8")

            throwForbiddenIf(user.externalId.isDefined,
                "TyE5AKBR20", o"""s$siteId: Email address ${extUser.primaryEmailAddress} is already
                  in use by Talkyard user ${user.usernameHashId} which mirrors
                  external user '${user.externalId}' — cannot create a mirror account for
                  external user '${extUser.externalId} that use that same email address""")

            throwForbiddenIf(user.emailVerifiedAt.isEmpty,
               "TyE7BKG52A4", o"""s$siteId: Cannot connect Talkyard user ${user.usernameHashId}
                  with external user '${user.externalId}': The Talkyard user account's email address
                  hasn't been verified.""")

            // Apparently this Talkyard user was created "long ago", and now we're
            // single-sign-on logging in as that user, for the first time. Connect this Talkyard account
            // with the external user account, and, in the future, we'll find it via external
            // id lookup instead (in code block (7KAB2BA) above).
            Logger.info(o"""s$siteId:
                Connecting Talkyard user ${user.usernameHashId}
                to external user '${extUser.externalId}', because they have the same
                email address: ${extUser.primaryEmailAddress}, and the Talkyard
                user account doesn't currently mirror any external user. [TyM2DKW07X]""")

            val updatedUser = user.copyWithExternalData(extUser)
            dieIf(updatedUser == user, "TyE4AKBRE2")
            tx.updateMemberInclDetails(updatedUser)
            updatedUser
          }) getOrElse {
            // Create a new Talkyard user account, for this external user.
            // (There's no mirror account with a matching external id or email address.)

            def makeName(): String = "unnamed_" + (nextRandomLong() % 1000)
            val usernameToTry = extUser.username.orElse(extUser.fullName).getOrElse(makeName())
            val okayUsername = User.makeOkayUsername(usernameToTry, allowDotDash = false,  // [CANONUN]
              tx.isUsernameInUse)  getOrElse throwForbidden("TyE2GKRC4C2", s"Cannot generate username")

            Logger.info(o"""s$siteId: Creating new Talkyard user, with username @$okayUsername,
                for external user '${extUser.externalId}'... [TyM5BKA2WA0]""")

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
                  throwUnprocessableEntity("TyE4BKR03J", s"$errorMessage, please try again.")
              }
            dao.createUserForExternalSsoUser(userData, request.theBrowserIdData, tx)
          }
        }

        val secret = nextRandomString()
        dao.redisCache.saveOneTimeSsoLoginSecret(secret, user.id)
        OkApiJson(Json.obj(
          "ssoLoginSecret" -> secret))

      case _ =>
        throwForbidden("TyEAPIPST404", s"No such API endpoint: $apiEndpoint")
    }
  }

}
