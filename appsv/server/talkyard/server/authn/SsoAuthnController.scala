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
import talkyard.server.JsX
import talkyard.server.parser.PasetoParSer
import dev.paseto.{jpaseto => pas}
import dev.paseto.jpaseto.{Paseto => pas_Paseto}


class SsoAuthnController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  private val logger = talkyard.server.TyLogger("SsoAuthnController")

  import context.{security, globals}



  /** This endpoint logs in a pat via a GET request — and there needs to be
    * a one-time secret in a query param.  [GETLOGIN]
    * ex: http://localhost/-/v0/login-with-secret?oneTimeSecret=nnnnn&thenGoTo=/
    *
    * Always allowed, also if API not enabled —
    * ?? old comment follows: needed for embedded comments
    *   signup-login to work if 3rd party cookies blocked. [306KUD244]
    *   Otherwise, works only if this server has generated a secret, that is,
    *   API enabled.
    */
  def apiv0_loginWithSecret: Action[U] = GetActionIsLogin { request: GetRequest =>

    import request.{siteId, queryString, dao}

    val settings = dao.getWholeSiteSettings()

    def getOnly(queryParam: String): Option[String] =
      queryString.get(queryParam).flatMap(values =>
        if (values.length > 1) throwBadArgument("TyE6ABKP2", queryParam, "Too many values")
        else values.headOption)

    def getOnlyOrThrow(queryParam: String, errorCode: String): String =
      getOnly(queryParam) getOrThrowBadArgument(errorCode, queryParam)

    // Fix indentation in a separate Git commit.  [.reindent]
    {
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



  def apiV0_upsertUserAndLogin: Action[JsValue] =
        PostJsonAction(RateLimits.Login, isLogin = true, maxBytes = 1000) {
          req: JsonPostRequest =>

    import req.{siteId, siteSettings}
    import debiki.JsonUtils._

    val anyUserJsObj: Opt[JsObject] = if (globals.isProd) None else {
      // Later: "user" field, if prod — then would need an API secret.
      // But maybe everyone can just use /-/v0/upsert-user instead.
      parseOptJsObject(req.body, "userDevTest")
    }

    // SECURITY [stop_emb_aun_tkn_rply] Incl seq nr in token, bump on
    // each login, store highest seen in pats_t, require next is greater.
    val anyAuthnToken = parseOptSt(req.body, "userAuthnToken")

    throwBadReqIf(anyUserJsObj.isEmpty && anyAuthnToken.isEmpty,
      "TyE0SSOTKN", "No 'user' or 'userAuthnToken' field")
    throwBadReqIf(anyUserJsObj.isDefined && anyAuthnToken.isDefined,
      "TyE0SSOTKN", "Got both 'userDevTest' and 'userAuthnToken'")

    val extUserFromJson: Opt[ExternalUser] = anyUserJsObj map { userJsObj =>
      JsX.apiV0_parseExternalUser(userJsObj)
    }

    val symmetricSecret: St = siteSettings.ssoPasetoV2LocalSecret

    val extUserFromToken: Opt[ExternalUser] = anyAuthnToken map { prefixAndToken: St =>
      val token: pas_Paseto = talkyard.server.security.PasetoSec.decodePasetoV2LocalToken(
            prefixAndToken, symmetricSecret = symmetricSecret)

      if (token.getClaims.getExpiration ne null) {
        // Fine. the lib has checked the expiration time already.
      }
      else {
        //throwBadReq("TyENOCLAIMS052", "Paseto token has no expiration, 'exp', claim")
      }

      SECURITY; SHOULD // require expiration time above, and max two hours or days?
      SECURITY; COULD  // remember issued-at, per user, and require that
      // it's > the highest seen issued at — that'd prevent reply attacks,
      // also within the expiration window.

      PasetoParSer.apiV0_parseExternalUser(token) getOrIfBad { problem =>
        throwBadReq("TyEPASCLAIMS_", s"Error parsing Paseto token claims: $problem")
      }
    }

   val extUser: ExternalUser =
         extUserFromJson.orElse(extUserFromToken) getOrDie "TyE5033MRS"

    val (user, _) =
          upsertUser(extUser, req, mayOnlyInsertNotUpdate = true)

    val (sid, _, _) =
          security.createSessionIdAndXsrfToken(siteId, user.id)

    OkSafeJson(Json.obj(
      // Not yet weak but later. [weaksid]  [NOCOOKIES]
      "weakSessionId" -> JsString(sid.value)))
  }



  def apiv0_upsertUserGenLoginSecret: Action[JsValue] =
        PostJsonAction(RateLimits.NoRateLimits, maxBytes = 1000) { request: JsonPostRequest =>

    import request.dao

    throwForbiddenIf(!request.isViaApiSecret,
        "TyEAPI0SECRET03", "The API may be called only via Basic Auth and an API secret")

    // Better name?:  "soId"  — because isn't necessarily *Single* Sign-On.
    // So just keep the "SO" in "SSO"? "Talkyard Sign-On"?
    // --- Old thoughts -----
    // "ssoId" —> external Identity Provider user identity ID —> extIdpUserId or extIdpUserId ?
    // or "authnId" or "apiAuthnId"  ?   Or  extIdId  'extidid:...'
    // external identity id (from and IDP)"
    // Maybe better to use  'extId' by default,  and 'extIdId' only in the (very) rare
    // cases where it'd be needed.
    //
    // "extAuId" for ext authentication id — better than extIdId, the latter looks like a typo?
    // Or instead,  "soId" and 'soid:....' for Single Sign-On ID, but without "single" since
    // can be combined with other ways to login  ?
    // ----------------------
    val (ssoId, bodyObj) = Try {
      val body = debiki.JsonUtils.asJsObject(request.body, "request body")
      val ssoId = (body \ "ssoId").asOpt[String].getOrElse(  // [395KSH20]
                  (body \ "externalUserId") // DEPRECATED 2019-08-18 v0.6.43
                    .as[String]).trim
      (ssoId, body)
    } getOrIfFailure { ex =>
      throwBadRequest("TyEBADEXTUSR", ex.getMessage)
    }

    val extUser: ExternalUser = JsX.apiV0_parseExternalUser(bodyObj, ssoId = Some(ssoId))

    val (user, isNew) =
          upsertUser(extUser, request, mayOnlyInsertNotUpdate = true)

        /* CLEAN_UP  remove when [.reindent]inig.
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
          } */

    val secret = nextRandomString()
    val expireSeconds = Some(globals.config.oneTimeSecretSecondsToLive)

    dao.redisCache.saveOneTimeLoginSecret(secret, user.id, expireSeconds)
    OkApiJson(Json.obj(
      "loginSecret" -> secret,
      "ssoLoginSecret" -> secret))  // REMOVE deprecated old name
  }



  def apiV0_upsertUser: Action[JsValue] =
        PostJsonAction(RateLimits.Login, maxBytes = 5000) { request: JsonPostRequest =>

    import debiki.JsonUtils.{asJsObject, parseSt}

    throwForbiddenIf(!request.isViaApiSecret,
        "TyEAPI0SECR04", "The API may be called only via Basic Auth and an API secret")

    val bodyObj = Try {
      asJsObject(request.body, "request body")
    } getOrIfFailure { ex =>
      throwBadRequest("TyEBADEXTUSR03", ex.getMessage)
    }

    val extUser: ExternalUser = JsX.apiV0_parseExternalUser(bodyObj)

    // Send back the user incl username — we might have changed it: removed forbidden
    // punctuation, for example, and the requester might want to know about that so it can
    // generate a user profile link.
    val (user, isNew) = upsertUser(extUser, request, mayUpdate = true)
    OkSafeJson(Json.obj(
      "user" -> JsX.JsUserApiV0(user.briefUser, brief = true)))
  }



  /** Returns (user: User, isNew: Bo).
    *
    * If mayUpdate, then, updates any existing user with a matching ssoId,
    * and throws Error if there's an email collision — but auto fixes any
    * new username (if specified), e.g. removes punctuation chars Ty doesn't like.
    * Otherwise won't try to update, won't throw error.
    */
  private def upsertUser(extUser: ExternalUser, request: JsonPostRequest,
         mayUpdate: Bo = false, mayOnlyInsertNotUpdate: Bo = false)
        : (UserInclDetails, Bo) = {

    import request.{siteId, dao}
    lazy val now = context.globals.now()

    require(mayUpdate != mayOnlyInsertNotUpdate, "TyE406MRMG")

    // Fix indentation later in a separate Git commit  [.reindent]

        throwForbiddenIf(!extUser.isEmailAddressVerified, "TyESSOEMLUNVERF", o"""s$siteId:
            The email address ${extUser.primaryEmailAddress} of external user 'ssoid:${extUser.ssoId}'
            hasn't been verified.""")

        val (user, isNew) = request.dao.readWriteTransaction { tx =>
          // Look up by Single Sign-On id. If found, login.
          // Look up by email. If found, reuse account, set SSO id, and login.
          // Else, create new user with specified external id and email.

          tx.loadUserInclDetailsBySsoId(extUser.ssoId).map({ user: UserInclDetails =>  // (7KAB2BA)
            dieIf(user.ssoId isNot extUser.ssoId, "TyE5KR02A")

            throwForbiddenIf(user.id < LowestTalkToMemberId,
                  "TyEUPDSYSUSR", "Cannot update or log in as built-in users like System")

            // During *login*, we typically don't want any email or username
            // collisions to happen — that'd prevent logging in.
            //
            // For example, if the ext email has been changed from aa@x.co to bb@x.co,
            // but in Ty's db there's already a bb@x.co address, then we
            // don't want an error *here* when logging in.
            //
            // Instead, to change email or username, one calls the
            // /-/v0/upsert-user endpoint directly when the email or username changes
            // in the external system (rather than waiting until pat logs in again).
            //
            if (mayOnlyInsertNotUpdate)
              return (user, false)

            // ----- Email address changed?

            // Update pat_email_adrs_t here, and pats_t further down.
            // Compare with  UserController.scala, addUserEmail()
            // and setPrimaryEmailAddresses().

            throwForbiddenIf(!extUser.isEmailAddressVerified, "TyE503RMG07",
                  o"""Ext user email not verified, ssoId: "${extUser.ssoId}"""")

            if (extUser.primaryEmailAddress != user.primaryEmailAddress) {
              // Update this Talkyard user's email address too, then.
              // Just make sure the new email isn't already in use by
              // another different Talkyard account that mirrors [*another*
              // external user with that email].
              val anyUser2: Opt[User] = tx.loadUserByPrimaryEmailOrUsername(
                    extUser.primaryEmailAddress)
              anyUser2 foreach { user2 =>
                throwForbiddenIf(user2.id != user.id,
                    "TyEUPSDUPEML_", o"""s$siteId: Cannot update the email address of
                    Talkyard user ${user.usernameHashId} with Sign-On id
                    '${extUser.ssoId}' to match the external user's new email address
                    ('${extUser.primaryEmailAddress}'): The new address is already used
                    by another Talkyard user: ${user2.usernameHashId}""")
                die("TyE6RMW40J", o"""Same user but two different primary emails?
                      soId —> ${user}, but hens new email addr —> ${user2},
                      with a *different* primary email, although same user id""")
              }

              // Or could there be an API parameter — delete old email, or not?
              // There's a foreign key from pats_t to pat_emails_t, so
              // need to defer constraints, before deleting from pat_emails_t.
              // Then, if keeping old addr, check MaxEmailsPerUser.
              tx.deferConstraints()
              tx.deleteUserEmailAddress(user.id, user.primaryEmailAddress)

              val emails: Seq[UserEmailAddress] = tx.loadUserEmailAddresses(user.id)
              emails.find(_.emailAddress == extUser.primaryEmailAddress) match {
                case None =>
                  ANNOYING // Also non-primary addresses must be unique, [many_emails]
                  // as of now, so this db insert might fail
                  // (not important to fix as of May 2021).
                  COULD // also check non-primary addrs. (5BK02A5)
                  dieIf(!extUser.isEmailAddressVerified, "TyE406MRFEP8")
                  tx.insertUserEmailAddress(
                        UserEmailAddress(userId = user.id,
                              emailAddress = extUser.primaryEmailAddress,
                              addedAt = now, verifiedAt = Some(now)))
                case Some(oldEmail) =>
                  // Apparently pat added this email address henself via Ty's UI, already.
                  if (oldEmail.isVerified) {
                    // ... And hen has verified it too.
                  }
                  else {
                    // ... But pat didn't verify it yet. However, the external
                    // software system calling the API, claims it has verified that
                    // the email address belongs to 'user'. So set it to verified.
                    dieIf(!extUser.isEmailAddressVerified, "TyE406MRFEP2")
                    tx.updateUserEmailAddress(oldEmail.copy(verifiedAt = Some(now)))
                  }
              }
            }


            // ----- Username changed?

            // Update usernames_t here, and pats_t further down.
            // Compare with:  UserDao.saveAboutMemberPrefs()  [ed_uname]

            val anyNewOkUsername: Opt[St] = extUser.username flatMap { un =>
              Participant.makeOkayUsername(un, allowDotDash = false,  // [CANONUN]
                    tx.isUsernameInUse, noneIfIsAlready = Some(user.username))
            }

            anyNewOkUsername foreach { newUsername =>
              dieIf(newUsername == user.username, "TyE4R06MES24")
              // Update this Talkyard user's username.
              // Participant.makeOkayUsername() above should have generated
              // a not-in-use username, but double check anyway that there's no
              // collision.
              val anyUser2: Opt[User] = tx.loadUserByPrimaryEmailOrUsername(newUsername)
              anyUser2 foreach { user2 =>
                dieIf(user2.id != user.id,
                      "TyE2ABK42", o"""s$siteId: Cannot update the username of
                      Talkyard user ${user.usernameHashId} with Sign-On id
                      '${extUser.ssoId}' to match the external user's new username
                      ('${extUser.username}' corrected to '$newUsername'):
                      The new username is already used
                      by another Talkyard user: ${user2.usernameHashId}""")
              }

              ANNOYING // Shouldn't need to *load* the *System* user.
              val systemUser = tx.loadTheUser(SystemUserId)

              dao.addUsernameUsageOrThrowClientError(
                    user.id, newUsername = newUsername, me = systemUser, tx)
            }

            // Wait with:
            // Demote/promote to mod or admin — see  UserDao:  editMember. [2BRUI8]
            // (Need some sanity checks so e.g. won't promote a suspended user.)

            val updatedUser = user.copyWithUpdatedExternalData(
                  extUser.copy(username = anyNewOkUsername), now, tryFixBadValues = true)

            if (updatedUser != user) {
              tx.updateUserInclDetails(updatedUser)
            }

            (updatedUser, false)
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

            // Could instead ask if proceed with linking or not, and show relevant info
            // about the old account, as is done with OpenID Connect, see: [act_fx_atk].
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

            val updatedUser = user.copy(ssoId = Some(extUser.ssoId))
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
                name = Validation.fixMaybeBadName(extUser.fullName),
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

    (user, isNew)
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