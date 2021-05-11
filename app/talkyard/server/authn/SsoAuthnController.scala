/**
 * Copyright (c) 2018, 2021 Kaj Magnus Lindberg
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

package talkyard.server.authn

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.OkApiJson
import debiki.EdHttp._
import debiki.RateLimits
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import play.api.libs.json._
import play.api.mvc._
import scala.util.Try
import debiki.dao.RemoteRedisClientError


class SsoAuthnController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  private val logger = talkyard.server.TyLogger("SsoAuthnController")

  import context.{security, globals}

  def apiv0_loginWithSecret: Action[U] =
        GetActionRateLimited(RateLimits.NoRateLimits) { request: GetRequest =>

    import request.{siteId, queryString, dao}

    val settings = dao.getWholeSiteSettings()

    def getOnly(queryParam: String): Option[String] =
      queryString.get(queryParam).flatMap(values =>
        if (values.length > 1) throwBadArgument("TyE6ABKP2", queryParam, "Too many values")
        else values.headOption)

    def getOnlyOrThrow(queryParam: String, errorCode: String): String =
      getOnly(queryParam) getOrThrowBadArgument(errorCode, queryParam)

    // Let's always allow one-time login — works only if this server has generated a secret.
    // Needed for embedded comments signup-login to work if 3rd party cookies blocked. [306KUD244]
    val isOneTimeLogin = request.underlying.path == "login-with-secret"

    throwForbiddenIf(!settings.enableApi && !isOneTimeLogin, "TyEAPIDSBLD",
          s"API not enabled. You tried to call: ${request.method} ${request.uri}")

    // Fix indentation in a separate Git commit.
    {
      // [GETLOGIN] should generate browser id cookie.
      // ex: http://localhost/-/v0/sso-login?oneTimeSecret=nnnnn&thenGoTo=/
      /*
      case "sso-login" | // deprecated name, remove (because login secrets are generated
           // in more ways than just sso. E.g. for one-time-login via email, [305KDDN24]).
           "login-with-secret" =>
       */
        // [SSOBUGHACK] This endpoint should not be inside ApiV0Controller.
        // Instead, it needs to be in its own GetAction, with isLogin=true, so
        // one can reach it also if login required to read content. Otherwise,
        // if login required, then, SSO won'twork, because ... one would need to be
        // logged in already, to login  :- P
        // In a new controller: LoginWithSecretController ?

        // Dupl code? Use this API endpoint also from impersonateWithKey?   [7AKBRW02]

        // Log problems to admin error log. [ADMERRLOG]

        val oneTimeSecret = getOnlyOrThrow("oneTimeSecret", "TyE7AKK25")
        val userIdOrError = dao.redisCache.getOneTimeLoginUserIdDestroySecret(oneTimeSecret)
        val userId = userIdOrError match {
          case Good(id) => id
          case Bad(problem) =>
            // It's fine to tell people exactly what the problem is? If they indeed have
            // a real one-time login secret, then they know for sure already that it's
            // a real one? The secrets cannot be guessed, so the only way to get one,
            // is by eavesdropping somehow — and an attacker probably knows if hen has
            // done that or not.
            val (subCode, errorDetails) = problem match {
              case RemoteRedisClientError.DoubleKeyUsage(numTimes) =>
                ("EMANY_", s"Attempting to use a *one*-time login secret $numTimes times")
              case RemoteRedisClientError.ValueExpired =>
                ("EEXP_", "One-time login secret expired; you need to make use of it sooner")
              case RemoteRedisClientError.ValueNeverExisted =>
                ("ENONE_", "I don't remember having created that one-time login secret")
            }
            throwForbidden(s"TyELGISECR_$subCode", errorDetails)
        }

        // The System user should only do things based on Talkyard's source code. [SYS0LGI]
        throwForbiddenIf(userId == SystemUserId, "TyELGISYS", "Cannot login as System.")

        // The Sysbot user should only do things based API requests.
        throwForbiddenIf(userId == SysbotUserId, "TyELGIBOT", "Cannot login as Sysbot.")

        val user = dao.getTheUser(userId)
        dao.pubSub.userIsActive(siteId, user, request.theBrowserIdData)
        val (sid, _, sidAndXsrfCookies) = security.createSessionIdAndXsrfToken(siteId, user.id)

        val response = if (request.isAjax) {
          // As of 2019-12: This is embedded comments login, when 3rd party cookies blocked. [306KUD244]
          SECURITY // a session cookie will get attached too — would be good if it could
          // be deleted server side. [serversid]
          OkSafeJson(Json.obj(
            // Not yet weak but later. [weaksid]
            "weakSessionId" -> JsString(sid.value)))  // [NOCOOKIES]
        }
        else {
          // Remove server origin, so one cannot somehow get redirected to a phishing website
          // (if one follows a link with an "evil" go-next url param to the SSO login page,
          // which then redirects to this endpoint with that bad go-next url).
          val thenGoToUnsafe = getOnly("thenGoTo")

          val thenGoToSafe = thenGoToUnsafe.map(url => {
            TESTS_MISSING // 1) url path (already tested), 2) this server, 3) other server, forbidden,
            // 4) other server in the Allow Embedding From list = ok, 5) = 4 with url path.

            val isOk = LoginWithSecretController.isAllowedRedirectUrl(
              url, request.origin, request.siteSettings.allowEmbeddingFromBetter, globals.secure)

/* BUG just above: spaces not '+' encoded

    {"eventTime":"2020-10-04T21:03:10.913Z",
    "message":"Replying internal error to:
       GET //ty.ex.co/-/v0/login-with-secret
          ?oneTimeSecret=pc2...mb
          &thenGoTo=%2F-%2Fsearch%3Fq%3Dmono%20mode%20connect [DwE500EXC]
       \njava.net.URISyntaxException: Illegal character in query at index 16:
           /-/search?q=mono mode connect
       \n\tat java.net.URI$Parser.fail(URI.java:2848)
       \n\tat java.net.URI$Parser.checkChars(URI.java:3021)
       ...
       \n\tat java.net.URI.<init>(URI.java:588)
       \n\tat controllers.LoginWithSecretController$.isAllowedRedirectUrl(ApiV0Controller.scala:453)
       \n\tat controllers.ApiV0Controller.$anonfun$getFromApi$8(ApiV0Controller.scala:190)
       ...
       \n\tat ed.server.http.PlainApiActions$$anon$1.runBlockIfAuthOk(PlainApiActions.scala:573)
       ...
       \n\tat java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:157)
       \n","severity":"ERROR","serviceContext":{"service":"talkyard-app","version":"v0.2020.24"},"context":{"reportLocation":{"filePath":"SafeActions.scala","lineNumber":213,"functionName":"ed$server$http$SafeActions$$internalError","className":"ed.server.http.SafeActions"}}}

       */

            // Later, but for now only in dev & test:  (also see: [306SKTGR43])
            throwForbiddenIf(!globals.isProd && !isOk,
              "TyEEXTREDIR1", o"""Bad thenGoTo url: '$url' — it's to a different server
                not in the Allow-Embedding-From list ( /-/admin/settings/embedded-comments ).
                This could be a phishing attempt.""")
            // But for now, backw compat, but not programmer friendly: Remove this after
            // some week, after having searched for BAD_REDIR_URL in the logs:
            if (!isOk) {
              val onlyPath = Prelude.stripOrigin(url)
              logger.warn(s"BAD_REDIR_URL: $url, changed to $onlyPath [TyE20549RKT4]")
              onlyPath getOrElse "/"
            }
            else {
              if (url.isEmpty) "/"
              else url
            }
          })

          val thenGoToHashEncoded = thenGoToSafe getOrElse "/"

          // The hash '#' in any '#post-NN' in the URL has been encoded (since the browser
          // would otherwise try to jump to the hash fragment, e.g. when going to a SSO login page).
          // Unencode it back to a hash '#'.
          CLEAN_UP; RENAME // __dwHash__ to __escHash__.  'dw' = really old.
          val thenGoTo = thenGoToHashEncoded.replaceAllLiterally("__dwHash__", "#")

          TemporaryRedirect(thenGoTo)
        }

        response.withCookies(sidAndXsrfCookies: _*)
    }
  }


  def apiv0_upsertUserGenLoginSecret: Action[JsValue] =
        PostJsonAction(RateLimits.NoRateLimits, maxBytes = 1000) { request: JsonPostRequest =>

    import request.{siteId, body, dao}
    lazy val now = context.globals.now()

    throwForbiddenIf(!request.isViaApiSecret,
        "TyEAPI0SECRET", "The API may be called only via Basic Auth and an API secret")

    // Fix indentation later in a separate Git commit
    {
        val extUser = Try(ExternalUser(  // Typescript ExternalUser [7KBA24Y] no SingleSignOnUser
          ssoId = (body \ "ssoId").asOpt[String].getOrElse(  // [395KSH20]
                  (body \ "externalUserId") // DEPRECATED 2019-08-18 v0.6.43
                    .as[String]).trim,
          extId = (body \ "extId").asOptStringNoneIfBlank,
          primaryEmailAddress = (body \ "primaryEmailAddress").as[String].trim,
          isEmailAddressVerified = (body \ "isEmailAddressVerified").as[Boolean],
          username = (body \ "username").asOptStringNoneIfBlank,
          fullName = (body \ "fullName").asOptStringNoneIfBlank,
          avatarUrl = (body \ "avatarUrl").asOptStringNoneIfBlank,
          aboutUser = (body \ "aboutUser").asOptStringNoneIfBlank,  // RENAME to 'bio', right
          isAdmin = (body \ "isAdmin").asOpt[Boolean].getOrElse(false),
          isModerator = (body \ "isModerator").asOpt[Boolean].getOrElse(false))) getOrIfFailure { ex =>
            throwBadRequest("TyEBADEXTUSR", ex.getMessage)
          }

        throwForbiddenIf(!extUser.isEmailAddressVerified, "TyESSOEMLUNVERF", o"""s$siteId:
            The email address ${extUser.primaryEmailAddress} of external user 'ssoid:${extUser.ssoId}'
            hasn't been verified.""")

        val (user, isNew) = request.dao.readWriteTransaction { tx =>
          // Look up by Single Sign-On id. If found, login.
          // Look up by email. If found, reuse account, set SSO id, and login.
          // Else, create new user with specified external id and email.

          tx.loadUserInclDetailsBySsoId(extUser.ssoId).map({ user =>  // (7KAB2BA)
            dieIf(user.ssoId isNot extUser.ssoId, "TyE5KR02A")
            // TODO update fields, if different.
            if (extUser.primaryEmailAddress != user.primaryEmailAddress) {
              // TODO later: The external user's email address has been changed? Update this Talkyard
              // user's email address too, then.  —  However, would be weird,
              // if there already is another Talkyard account that mirrors [*another* external user
              // with that email]?
              val anyUser2 = tx.loadUserByPrimaryEmailOrUsername(extUser.primaryEmailAddress)
              anyUser2 foreach { user2 =>
                throwForbidden("TyE2ABK40", o"""s$siteId: Cannot update the email address of
                    Talkyard user ${user.usernameHashId} with Single Sign-On id
                    '${extUser.ssoId}' to match the external user's new email address
                    ('${extUser.primaryEmailAddress}'): The new address is already used
                    by another Talkyard user: ${user2.usernameHashId}""")
              }

              // TODO also check non-primary addrs. (5BK02A5)
            }
            // email:  UserController.scala:  setPrimaryEmailAddresses (don't forget to upd email table)
            // mod / admin:  UserDao:  editMember
            // name etc:  UserDao:  saveAboutMemberPrefs
            // For now, just generate a login secret; don't sync users:
            (user, false)
          }) orElse
              // TODO what about looking up by secondary email addresses, or not?
              // Don't do that? They aren't supposed to be used for login. And do require
              // that there isn't any clash here: (5BK02A5)?
              tx.loadUserInclDetailsByEmailAddr(extUser.primaryEmailAddress).map({ user =>

            dieIf(user.ssoId is extUser.ssoId, "TyE7AKBR2") // ought to have been found by id
            dieIf(user.primaryEmailAddress != extUser.primaryEmailAddress, "TyE7AKBR8")

            throwForbiddenIf(user.ssoId.isDefined,
                "TyESSOEMLCONFL_", o"""s$siteId: Email address ${extUser.primaryEmailAddress} is
                  already in use by Talkyard user ${user.usernameHashId} which mirrors
                  external user 'ssoid:${user.ssoId}' — cannot create a mirror account for
                  external user 'ssoid:${extUser.ssoId} that use that same email address""")

            throwForbiddenIf(user.emailVerifiedAt.isEmpty,
               "TyE7BKG52A4", o"""s$siteId: Cannot connect Talkyard user ${user.usernameHashId}
                  with external user 'ssoid:${user.ssoId}': The Talkyard user account's
                  email address hasn't been verified.""")

            // Apparently this Talkyard user was created "long ago", and now we're
            // single-sign-on logging in as that user, for the first time. Connect this Talkyard account
            // with the external user account, and, in the future, we'll find it via external
            // id lookup instead (in code block (7KAB2BA) above).
            logger.info(o"""s$siteId:
                Connecting Talkyard user ${user.usernameHashId}
                to external user 'ssoid:${extUser.ssoId}', because they have the same
                email address: ${extUser.primaryEmailAddress}, and the Talkyard
                user account doesn't currently mirror any external user. [TyM2DKW07X]""")

            val updatedUser = user.copyWithExternalData(extUser)
            dieIf(updatedUser == user, "TyE4AKBRE2")
            tx.updateUserInclDetails(updatedUser)
            (updatedUser, false)
          }) getOrElse {
            // Create a new Talkyard user account, for this external user.
            // (There's no mirror account with a matching external id or email address.)

            def makeName(): String = "unnamed_" + (nextRandomLong() % 1000)
            val usernameToTry = extUser.username.orElse(extUser.fullName).getOrElse(makeName())
            val okayUsername = Participant.makeOkayUsername(usernameToTry, allowDotDash = false,  // [CANONUN]
              tx.isUsernameInUse)  getOrElse throwForbidden("TyE2GKRC4C2", s"Cannot generate username")

            logger.info(o"""s$siteId: Creating new Talkyard user, with username @$okayUsername,
                for external user 'ssoid:${extUser.ssoId}'... [TyM5BKA2WA0]""")

            val userData = // [5LKKWA10]
              NewPasswordUserData.create(
                name = extUser.fullName,
                username = okayUsername,
                email = extUser.primaryEmailAddress,
                password = None,
                ssoId = Some(extUser.ssoId),
                extId = extUser.extId,
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
            val newUser = dao.createUserForExternalSsoUser(userData, request.theBrowserIdData, tx)
            (newUser, true)
          }
        }

        if (isNew) {
          // COULD make these Dao methods protected/private — then need to move this
          // ApiV0Controller code to inside the Dao.
          dao.uncacheBuiltInGroups()
          // Plus uncache any custom groups, if can sso-login user and auto add to group. [inv2groups]
          dao.memCache.fireUserCreated(user.briefUser)
        }

        val secret = nextRandomString()
        val expireSeconds = Some(globals.config.oneTimeSecretSecondsToLive)

        dao.redisCache.saveOneTimeLoginSecret(secret, user.id, expireSeconds)
        OkApiJson(Json.obj(
          "loginSecret" -> secret,
          "ssoLoginSecret" -> secret))  // REMOVE deprecated old name
    }
  }

}


object LoginWithSecretController {

  /** allowEmbeddingFrom should be a <source> list for
    * Content-Security-Policy frame-ancestors,
    * of type host-source.
    * Read more here:
    *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors
    *
    * Let's ignore entries with wildcards, for simplicity, for now.
    * If Talkyard runs over https, and 'http(s):' isn't specified for a <source>, then,
    * as per the frame-ancestor rules, we'll try that source with https only (not http).
    */
  def isAllowedRedirectUrl(unsafeUrlMaybeEmpty: String, serverOrigin: String,
        allowEmbeddingFrom: Seq[String], secure: Boolean): Boolean = {
    // Tests here: LoginWithSecretControllerSpec [305KSTTH2]

    // Content-Security-Policy frame-ancestors host-source shouldn't include any path.
    // We remove paths here: [402KSHRJ3] so if they're sill present, that's a bug.
    val sourceWithPath = allowEmbeddingFrom.find(_.indexOf("/", "https://".length) >= 0)
    require(sourceWithPath.isEmpty, s"Source with path: ${sourceWithPath.get} [TyE204AKTDTH42]")

    val unsafeUrl = if (unsafeUrlMaybeEmpty.isEmpty) "/" else unsafeUrlMaybeEmpty

    // Local URL paths are fine.
    val isUrlPath = {
      val uri = new java.net.URI(unsafeUrl)
      uri.getScheme == null && uri.getHost == null &&
        uri.getRawAuthority == null && uri.getPath != null  // query & hash = fine
    }

    if (isUrlPath)
      return true

    // Full local server paths are fine too.
    if (unsafeUrl == serverOrigin || unsafeUrl.startsWith(serverOrigin + "/"))
      return true

    // Now the server address must match one of the allow-embedding-from addresses
    // (frame-ancestor sources):

    val okayMatchingSource: Option[String] = allowEmbeddingFrom.find(frameAncestorSource => {
      if (frameAncestorSource.startsWith("https://") || frameAncestorSource.startsWith("http://")) {
        unsafeUrl.startsWith(frameAncestorSource + "/") || unsafeUrl == frameAncestorSource
      }
      else {
        def withHttps = "https://" + frameAncestorSource
        def withHttp = "http://" + frameAncestorSource
        if (unsafeUrl.startsWith(withHttps + "/") || unsafeUrl == withHttps) {
          true
        }
        else if (!secure) {
          unsafeUrl.startsWith(withHttp + "/") || unsafeUrl == withHttp
        }
        else {
          false
        }
      }
    })

    okayMatchingSource.isDefined
  }

}