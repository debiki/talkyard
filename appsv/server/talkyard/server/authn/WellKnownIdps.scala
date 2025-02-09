package talkyard.server.authn

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ErrMsg, IdentityProvider, OpenAuthDetails}
import com.github.scribejava.core.oauth.{OAuth20Service => sj_OAuth20Service}
import com.github.scribejava.core.model.{OAuth2AccessToken => sj_OAuth2AccessToken, OAuthRequest => sj_OAuthRequest, Verb => sj_Verb}
import controllers.ExternalEmailAddr
import debiki.JsonUtils._
import debiki.EdHttp._
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.JsValue
import play.api.http.{HeaderNames => p_HeaderNames}
import talkyard.server.p_Result



/** Can parse custom user info json from non-standard IDPs (i.e. not OIDC)
  * and can fetch any missing user info via extra requests — e.g. to GitHub
  * to get someone's verified email addr (if any).
  */
object WellKnownIdps extends talkyard.server.TyLogging {


  def parseUserJson(jsVal: JsValue, idp: IdentityProvider)
          : OpenAuthDetails Or ErrMsg = tryParseGoodBad {

    import debiki.EdHttp._ // asOptStringNoneIfBlank etc

    val wellKnownImpl = idp.wellKnownIdpImpl getOrDie "TyE4D96MAKT2"
    val jsObj = asJsObject(jsVal, what = "IDP user info")

    // GitHub uses numeric ids (JsNumber), others use strings.
    val id: St = parseStOrNrAsSt(jsObj, "id")
    val anyUsername = parseOptSt(jsObj, "username")
    val anyEmailAddr = parseOptSt(jsObj, "email")
    val anyFirstName = parseOptSt(jsObj, "given_name", altName = "first_name")
    val anyMiddleName = parseOptSt(jsObj, "middle_name")
    val anyLastName = parseOptSt(jsObj, "family_name", altName = "last_name")
    val anyFullName = parseOptSt(jsObj, "name")

    val idpSaysEmailIsVerifed = None // IDP specific
    val emailVerified = Some(false)
    // Later: idpSaysEmailIsVerifed.is(true) && idp.trustVerifiedEmail

    val genericIdty = OpenAuthDetails(
          confFileIdpId = idp.confFileIdpId,
          idpId = idp.idpId,
          idpUserId = id,
          username = anyUsername,
          firstName = anyFirstName,
          middleName = anyMiddleName,
          lastName = anyLastName,
          fullName = anyFullName,  // firstSpaceLast.trimNoneIfEmpty,
          email = anyEmailAddr,
          isEmailVerifiedByIdp = emailVerified,
          avatarUrl = None,
          userInfoJson = Some(jsObj))

    var result = genericIdty

    wellKnownImpl match {
      case WellKnownIdpImpl.Facebook =>
        // FB Graph API, user info requests:
        // https://developers.facebook.com/docs/graph-api/reference/user
        // and here we specify the fields Ty wants: [fb_oauth_user_fields].
        // Email verified or not? Probably @tfbnw.net email addresses can be
        // trusted? But let's assume not, for now.
        // Example response, FB's Graph API v9.0, November 2020:
        //   {
        //     "id": "111222333444555",
        //     "email": "facebook_aabbccdd_user@tfbnw.net",
        //     "name": "Firstname Lastname",
        //     "first_name": "Firstname",
        //     "last_name": "Lastname",
        //     "picture": {
        //       "data": {
        //         "height": 50,
        //         "is_silhouette": true,
        //         "url": "https://scontent-arn2-1.xx.fbcdn.net/../../../p50x50/...",
        //         "width": 50  }}}
        val pictureUrl = (jsObj \ "picture" \ "data" \ "url").asOpt[St]
        result = result.copy(avatarUrl = pictureUrl)

      case WellKnownIdpImpl.GitHub =>
        // Docs: (but which API version is this?)
        // https://docs.github.com/en/free-pro-team@latest/rest/reference/users#get-a-user
        // Fieldes "id" and "name" already handled above.
        val username = (jsObj \ "login").asOptStringNoneIfBlank
        val avatarUrl = (jsObj \ "avatar_url").asOptStringNoneIfBlank
        // val publicEmail = anyPublAddr.map(_.emailAddr)
        // publicEmailIsVerified = anyPublAddr.map(_.isVerified),
        // primaryEmail = anyPrimAddr.map(_.emailAddr),
        // primaryEmailIsVerified = anyPrimAddr.map(_.isVerified),
        val company = (jsObj \ "company").asOptStringNoneIfBlank
        val location = (jsObj \ "location").asOptStringNoneIfBlank
        val aboutUser = (jsObj \ "bio").asOptStringNoneIfBlank
         // api url, for loading user json: (json \ "url"), but we
        // want the html profile page url, and that's 'html_url'.
        val githubUrl = (jsObj \ "html_url").asOptStringNoneIfBlank
        val numPublicRepos = (jsObj \ "public_repos").asOpt[i32]
        val numPublicGists = (jsObj \ "public_gists").asOpt[i32]
        val numFollowers = (jsObj \ "followers").asOpt[i32]
        val numFollowing = (jsObj \ "following").asOpt[i32]
        val createdAtSt = (jsObj \ "created_at").asOptStringNoneIfBlank
        val updatedAtSt = (jsObj \ "updated_at").asOptStringNoneIfBlank

        result = result.copy(
          username = username,
          avatarUrl = avatarUrl)

      case WellKnownIdpImpl.Google =>
        // Google uses OIDC user info fields, and we'll use the OIDC  [goog_oidc]
        // parser for Google. So this should be dead code.
        return Bad("Error: Google stopped being an OIDC provider? [TyEGOOG0OIDC]")

      case WellKnownIdpImpl.LinkedIn =>
        // LinkedIn's custom json:
        // (A 2nd req needed to fetch the email addr. [oauth2_extra_req])
        //
        // { "localizedLastName":"Lastname",
        //   "lastName": { "localized":{"en_US":"Lastname"},
        //                 "preferredLocale":{"country":"US", "language":"en" }},
        //   "firstName": { "localized":{"en_US":"Firstname"},
        //                 "preferredLocale":{"country":"US", "language":"en" }},
        //   "id":"aabb1234cc",
        //   "localizedFirstName":"Firstname"  }

        result = result.copy(
              firstName = (jsObj \ "localizedFirstName").asOpt[St],
              lastName = (jsObj \ "localizedLastName").asOpt[St])

      case WellKnownIdpImpl.Twitter =>
        die("TyEAUT0TWTR", "Twitter not impl with ScribeJava — Ty + OAuth1 not yet")

      case bad =>
        die(s"Unknown 'well-known' IDP impl: $bad  [TyEUNKIDPIMPL]")
    }

    Good(result)
  }


  def fetchAnyMissingUserInfo(
        oauthDetails: OpenAuthDetails,
        idp: IdentityProvider,
        siteId: SiteId,
        authnService: sj_OAuth20Service,
        accessToken: sj_OAuth2AccessToken,
        onError: p_Result => U,
        onOk: OpenAuthDetails => U): U = {

    idp.wellKnownIdpImpl.getOrDie("TyE502<AG67") match {
      case WellKnownIdpImpl.GitHub =>

        // GitHub doesn't implement OIDC, need to fetch email separately. [gmail_verifd]
        // List user email addresses docs:
        //   https://docs.github.com/en/free-pro-team@latest/rest/reference/users#get-a-user
        val url = idp.oidcUserInfoUrl + "/emails"
        // Becomes: "https://api.github.com/user/email" if using GitHub
        // (but another origin and base url path, if GitHub Enterprise).
        val getEmailReq = new sj_OAuthRequest(sj_Verb.GET, url)
        // Use version 3 of the API, it's the most recent one (as of 2019-03).
        // https://developer.github.com/v3/#current-version
        getEmailReq.addHeader(p_HeaderNames.ACCEPT, "application/vnd.github.v3+json")
        authnService.signRequest(accessToken, getEmailReq)
        doAuthnServiceRequest("GitHub account email", idp, siteId,
              authnService, getEmailReq, onError, onOk = (json: JsValue) => {
          // Copied from [old_github_code].
          //
          // GitHub's response is (as of 2018-10-13) like: [gmail_verifd]
          // https://docs.github.com/en/free-pro-team@latest/rest/reference/users#list-email-addresses-for-the-authenticated-user
          // [{ email: "a@b.c", verified: true, primary: true,
          //      visibility: "public" | "private" | null }]
          val anyPrimaryAddr: Opt[ExternalEmailAddr] = try {
            val emailObjs: Seq[JsValue] = asJsArray(json, "GitHub user emails")
            val emails: Seq[ExternalEmailAddr] = emailObjs.map({ emVal: JsValue =>
              val emailObj = asJsObject(emVal, "GitHub email")
              ExternalEmailAddr(
                    emailAddr = parseSt(emailObj, "email"),
                    isVerified = parseOptBo(emailObj, "verified").is(true),
                    isPrimary = parseOptBo(emailObj, "primary").is(true),
                    isPublic = parseOptSt(emailObj, "visibility").is("public"))
            })

            val anyPublAddr =
              emails.find(e => e.isPublic && e.isVerified) orElse
                emails.find(_.isPublic)

            val anyPrimaryAddr =  // [7KRBGQ20]
              emails.find(e => e.isPrimary && e.isVerified) orElse
                emails.find(e => e.isPublic && e.isVerified) orElse
                emails.find(_.isVerified)

            anyPrimaryAddr
          }
          catch {
            case ex: Ex =>
              logger.warn("Error parsing GitHub email addr JSON [TyEGTHBEMJSN]", ex)
              None
          }
          val oauthDetailsWithEmail = oauthDetails.copy(
                email = anyPrimaryAddr.map(_.emailAddr),
                isEmailVerifiedByIdp = anyPrimaryAddr.map(_.isVerified))
          onOk(oauthDetailsWithEmail)
        })


      case WellKnownIdpImpl.LinkedIn =>

        val url = "https://api.linkedin.com/v2/emailAddress" +
              "?q=members&projection=(elements*(handle~))"
        val getEmailReq = new sj_OAuthRequest(sj_Verb.GET, url)
        authnService.signRequest(accessToken, getEmailReq)
        doAuthnServiceRequest("LinkedIn account email", idp, siteId,
              authnService, getEmailReq, onError, onOk = (jsVal: JsValue) => {
          // Copied from [old_linkedin_code].
          // LinkedIn's response is (as of 2019-04 and 2020-11) like:
          // { "elements": [
          //   { "handle": "urn:li:emailAddress:1234567890",
          //      "handle~": { "emailAddress": "someone@example.com"  }} ]}
          val anyAddr = try {
            val respObj = asJsObject(jsVal, what = "LinkedIn email response")
            val items = parseJsArray(respObj, "elements")
            val itemOne = asJsObject(items.headOption getOrElse {
             throwUnprocessableEntity("TyEJSN2AKB05", "No email elem")
            }, "LinkedIn email")

            val handleObj = parseJsObject(itemOne, "handle~")
            val addr = parseSt(handleObj, "emailAddress")
            Some(addr)
          }
          catch {
            case ex: Ex =>
              logger.warn("Error parsing LinkedIn email address JSON [TyE7UABKT32]", ex)
              None
          }
          val oauthDetailsWEmail = oauthDetails.copy(email = anyAddr)
          onOk(oauthDetailsWEmail)
        })

      case _ =>
        // No more data needed.
        onOk(oauthDetails)
    }
  }
}
