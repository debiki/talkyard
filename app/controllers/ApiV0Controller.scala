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
import debiki.dao.RemoteRedisClientError


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


class ApiV0Controller @Inject()(cc: ControllerComponents, edContext: EdContext,
  backupController: talkyard.server.backup.SiteBackupController)
  extends EdController(cc, edContext) {

  import context.{security, globals}
  import play.api.Logger


  def getFromApi(apiEndpoint: String): Action[Unit] =
        GetActionRateLimited(RateLimits.NoRateLimits) { request: GetRequest =>

    import request.{siteId, queryString, dao, theRequester => requester}
    lazy val now = context.globals.now()

    val settings = dao.getWholeSiteSettings()

    def getOnly(queryParam: String): Option[String] =
      queryString.get(queryParam).flatMap(values =>
        if (values.length > 1) throwBadArgument("TyE6ABKP2", queryParam, "Too many values")
        else values.headOption)

    def getOnlyOrThrow(queryParam: String, errorCode: String): String =
      getOnly(queryParam) getOrThrowBadArgument(errorCode, queryParam)

    throwForbiddenIf(!settings.enableApi, "TyEAPIDSBLD", "API disabled")

    val EmbeddedCommentsFeedPath = "embedded-comments-feed"

    apiEndpoint match {

      // Move export-site-json to SiteBackupController, an ApiSecretPostJsonAction, instead.
      //
      // Typically, one saves the exported data in a file  site-name.tydump.json
      // or, with query params like:
      //    ?exportSiteMeta=false
      //    &categories=1,2,3   or  categories=extId:aaa,extId:bbb,extId:ccc
      // instead exports a *patch*: only the specified data, and no site name or id.
      // Then, one typically saves the file in  site-name.typatch.json.
      //
      // Dump = whole site. Can be imported to an empty server, to migrate from one server to another.
      // Patch = parts of a site. Can only be imported (added to) an already existing site —
      // to "patch" it.  E.g. Disqus comments converted to Talkyard json format, is in a patch
      // file: can be imported to an already existing Talkyard comments site only.
      //
      // There'll also be an  export-site-zip  endpoint, which, if one specifies
      // &includeUploads=true,  also includes uploaded files like images and attachments
      // and videos in the resulting zip.  — This zip is a totally complete export file,
      // whilst the .json is text only.  (Maybe could base64 encode binary data? and include
      // in the json? some time in the distant future. Or bson? or MessagePack? — not bson,
      // bson is apparently intended for fast lookup in the bson file, but for Talkyard,
      // keeping the dump file small is instead the goal.
      // """Compared to BSON, MessagePack is more space-efficient. ... designed for
      // efficient transmission over the wire"""  https://en.wikipedia.org/wiki/MessagePack
      // Or **Protobuf** ?  Yes, use protobuf, not messagepack.
      // Protocol buffers = seems nice :- )  apparently verifies the input is valid,
      // so Talkyard wouldn't need to do that (!). One instead declares the data structure,
      // and compiles a parser? Works with Rust? There's rust-protobuf.
      // Javascript? Yes, https://github.com/protocolbuffers/protobuf/tree/master/js.
      //
      case "export-site-json" =>
        throwForbiddenIf(!request.isViaApiSecret,
          "TyE0APIGET", "The API may be called only via Basic Auth and an API secret")
        backupController.exportSiteJsonImpl(request)

      // ex: http://localhost/-/v0/sso-login?oneTimeSecret=nnnnn&thenGoTo=/
      case "sso-login" | // deprecated name, remove (because login secrets are generated
           // in more ways than just sso. E.g. for one-time-login via email, [305KDDN24]).
           "login-with-secret" =>
        // [SSOBUGHACK] This endpoint should not be inside ApiV0Controller.
        // Instead, it needs to be in its own GetAction, with isLogin=true, so
        // one can reach it also if login required to read content. Otherwise,
        // if login required, then, SSO won'twork, because ... one would need to be
        // logged in already, to login  :- P
        // In a new controller: LoginWithSecretController ?

        // Dupl code? Use this API endpoint also from impersonateWithKey?   [7AKBRW02]

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
        val user = dao.getTheUser(userId)
        dao.pubSub.userIsActive(siteId, user, request.theBrowserIdData)
        val (_, _, sidAndXsrfCookies) = security.createSessionIdAndXsrfToken(siteId, user.id)

        // Remove server origin, so one cannot somehow get redirected to a phishing website
        // (if one follows a link with an "evil" go-next url param to the SSO login page,
        // which then redirects to this endpoint with that bad go-next url).
        val thenGoToUnsafe = getOnly("thenGoTo")

        val thenGoToSafe = thenGoToUnsafe.map(url => {
          TESTS_MISSING // 1) url path (already tested), 2) this server, 3) other server, forbidden,
          // 4) other server in the Allow Embedding From list = ok, 5) = 4 with url path.

          val isOk = LoginWithSecretController.isAllowedRedirectUrl(
            url, request.origin, request.siteSettings.allowEmbeddingFromBetter, globals.secure)

          // Later, but for now only in dev & test:
          throwForbiddenIf(!globals.isProd && !isOk,
            "TyEEXTREDIR", o"""Bad thenGoTo url: '$url' — it's to a different server
              not in the Allow-Embedding-From list ( /-/admin/settings/embedded-comments ).
              This could be a phishing attempt.""")
          // But for now, backw compat, but not programmer friendly: Remove this after
          // some week, after having searched for BAD_REDIR_URL in the logs:
          if (!isOk) {
            val onlyPath = Prelude.stripOrigin(url)
            Logger.warn(s"BAD_REDIR_URL: $url, changed to $onlyPath [TyE20549RKT4]")
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
            .withCookies(sidAndXsrfCookies: _*)

      // Later:
      // /-/v0/comments-feed —> lists all recent blog comments   [CMTSFEED]
      // /-/v0/comments-feed?forEmbeddingHost=www.myblog.com — if a multi-host blog
      // Or:
      // /-/v0/embedded-comments-feed ?  Probably better — "comment" can be interpreted
      // as StackOverflow style "comments" below a Q&A answer post.
      //
      // Whilst this (/-/v0/feed) is about the Talkyard site only and links to it:
      case "feed" | EmbeddedCommentsFeedPath =>
        val onlyEmbeddedComments = apiEndpoint == EmbeddedCommentsFeedPath
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
        val atomXml = dao.getAtomFeedXml(onlyEmbeddedComments = onlyEmbeddedComments)
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
      case "sso-upsert-user-generate-login-secret" |
        "upsert-external-user-generate-login-secret" =>  // deprecated name, remove
        val extUser = Try(ExternalUser(  // Typescript ExternalUser [7KBA24Y] no SingleSignOnUser
          externalId =  // RENAME to ssoId
            (body \ "ssoId").asOpt[String].getOrElse(  // [395KSH20]
                  (body \ "externalUserId") // DEPRECATED 2019-08-18 v0.6.43
                    .as[String]).trim,
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

        val (user, isNew) = request.dao.readWriteTransaction { tx =>
          // Look up by external id. If found, login.
          // Look up by email. If found, reuse account, set external id, and login.
          // Else, create new user with specified external id and email.

          tx.loadUserInclDetailsBySsoId(extUser.externalId).map({ user =>  // (7KAB2BA)
            dieIf(user.externalId isNot extUser.externalId, "TyE5KR02A")
            // TODO update fields, if different.
            if (extUser.primaryEmailAddress != user.primaryEmailAddress) {
              // TODO later: The external user's email address has been changed? Update this Talkyard
              // user's email address too, then.  —  However, would be weird,
              // if there already is another Talkyard account that mirrors [*another* external user
              // with that email]?
              val anyUser2 = tx.loadUserByPrimaryEmailOrUsername(extUser.primaryEmailAddress)
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
            (user, false)
          }) orElse
              // TODO what about looking up by secondary email addresses, or not?
              // Don't do that? They aren't supposed to be used for login. And do require
              // that there isn't any clash here: (5BK02A5)?
              tx.loadUserInclDetailsByEmailAddr(extUser.primaryEmailAddress).map({ user =>

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
            tx.updateUserInclDetails(updatedUser)
            (updatedUser, false)
          }) getOrElse {
            // Create a new Talkyard user account, for this external user.
            // (There's no mirror account with a matching external id or email address.)

            def makeName(): String = "unnamed_" + (nextRandomLong() % 1000)
            val usernameToTry = extUser.username.orElse(extUser.fullName).getOrElse(makeName())
            val okayUsername = Participant.makeOkayUsername(usernameToTry, allowDotDash = false,  // [CANONUN]
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
        dao.redisCache.saveOneTimeLoginSecret(secret, user.id)
        OkApiJson(Json.obj(
          "loginSecret" -> secret,
          "ssoLoginSecret" -> secret))  // REMOVE deprecated old name

      case _ =>
        throwForbidden("TyEAPIPST404", s"No such API endpoint: $apiEndpoint")
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