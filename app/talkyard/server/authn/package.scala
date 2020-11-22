package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ErrMsg, GetOrBadMap, IdentityProvider, OpenAuthDetails}
import debiki.JsonUtils._
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.JsValue
import talkyard.server.authn.OidcClaims.parseOidcClaims


// A Bo is not enough.
sealed abstract class AddOrRemove
case object Add extends AddOrRemove
case object KeepIfMaySee extends AddOrRemove
case object Remove extends AddOrRemove


package object authn {

  // Aliases for better readability.
  type JoinOrLeave = AddOrRemove
  val Join: Add.type = Add
  val StayIfMaySee: KeepIfMaySee.type = KeepIfMaySee
  val Leave: Remove.type = Remove

  object ServerDefIdpAliases {
    import com.mohiva.play.silhouette.impl.providers.{oauth2 => si_oauth2}

    val Facebook = "facebook"
    val GitHub = "github"
    val Google = "google"
    val LinkedIn = "linkedin"
    //val Twitter = "twitter"

    // Should be same ids as Silhouette, so migration to ScribeJava will be simpler:
    assert(si_oauth2.GoogleProvider.ID == Google)
    assert(si_oauth2.GitHubProvider.ID == GitHub)
    assert(si_oauth2.FacebookProvider.ID == Facebook)
    //assert(si_oauth2.TwitterProvider.ID == Twitter)  not OAuth2 yet?
    assert(si_oauth2.LinkedInProvider.ID == LinkedIn)

  }


  def parseOidcUserInfo(jsVal: JsValue, idp: IdentityProvider)
        : OpenAuthDetails Or ErrMsg = {

    val jsObj = asJsObject(jsVal, what = "OIDC user info")

    val claims = parseOidcClaims(jsObj) getOrIfBad { errMsg =>
      return Bad(errMsg)
    }

    val anyName = claims.name
          .orElse(Seq(
              claims.given_name,
              claims.middle_name,
              claims.family_name).flatten.mkString(" ").trimNoneIfEmpty)
          .orElse(claims.nickname)
          .orElse(claims.preferred_username)

    Good(OpenAuthDetails(
          confFileIdpId = idp.confFileIdpId,
          idpId = idp.idpId,
          idpUserId = claims.sub,
          username = claims.preferred_username,
          firstName = claims.given_name,
          lastName = claims.family_name,
          fullName = anyName,
          email = claims.email,
          isEmailVerifiedByIdp = Some(claims.email_verified &&
              // Or do this check elsewhere instead? But then easy to forget?
              idp.trustVerifiedEmail),
          avatarUrl = claims.picture,
          userInfoJson = Some(jsObj)))
  }


  def parseCustomUserInfo(jsVal: JsValue, idp: IdentityProvider)
        : OpenAuthDetails Or ErrMsg = tryParseGoodBad {
    idp.wellKnownIdpImpl match {
      case None =>
        // For now.
        parseCustomUserInfoFieldsMap(jsVal, idp)
      case Some(idpImpl: WellKnownIdpImpl) =>
        // Hardcoded parsing of JSON from Facebook, LinkedIn and other
        // well-known OAuth2 providres.
        parseWellKnownIdpUserJson(jsVal, idp)
    }
  }


  def parseCustomUserInfoFieldsMap(jsVal: JsValue, idp: IdentityProvider)
        : OpenAuthDetails Or ErrMsg = tryParseGoodBad {

    // For now:
    // userid: null, first_name, last_name, country, city, company, job_function: '',
    // job_title: '', email
    // Later, use mapping in:  oidc_user_info_fields_map_c

    if (talkyard.server.isDevOrTest) {
      System.out.println(s"parseCustomUserInfo, idp: ${idp.protoAlias}: \n\n${
              play.api.libs.json.Json.prettyPrint(jsVal)}\n\n")
    }

    val jsObj = asJsObject(jsVal, what = "IDP user info")

    val email = parseSt(jsObj, "email")
    val emailVerified = false // for now
    val userIdAtProvider = email  // for now
    // Might become empty, if the email is empty or invalid, say, just "@ex.co".
    val username = email.takeWhile(_ != '@').trimNoneIfEmpty
    val firstName = parseOptSt(jsObj, "first_name")
    val lastName = parseOptSt(jsObj, "last_name")
    val firstSpaceLast = s"${firstName.getOrElse("")} ${lastName.getOrElse("")}"

    Good(OpenAuthDetails(
          confFileIdpId = idp.confFileIdpId,
          idpId = idp.idpId,
          idpUserId = userIdAtProvider,
          username = username,
          firstName = firstName,
          middleName = None,
          lastName = lastName,
          fullName = firstSpaceLast.trimNoneIfEmpty,
          email = Some(email),
          isEmailVerifiedByIdp = Some(emailVerified && idp.trustVerifiedEmail),
          avatarUrl = None,
          userInfoJson = Some(jsObj)))
  }


  def parseWellKnownIdpUserJson(jsVal: JsValue, idp: IdentityProvider)
          : OpenAuthDetails Or ErrMsg = tryParseGoodBad {

    val wellKnownImpl = idp.wellKnownIdpImpl getOrDie "TyE4D96MAKT2"
    val jsObj = asJsObject(jsVal, what = "IDP user info")

    val id = parseSt(jsObj, "id")
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

      case WellKnownIdpImpl.Google =>
        // Google uses OIDC user info fields, and we'll use the OIDC  [goog_oidc]
        // parser for Google. So this should be dead code.
        return Bad("Error: Google stopped being an OIDC provider? [TyEGOOG0OIDC]")

      case WellKnownIdpImpl.LinkedIn =>

      case WellKnownIdpImpl.Twitter =>

      case bad =>
        die(s"Unknown 'well-known' IDP impl: $bad  [TyEUNKIDPIMPL]")
    }

    Good(result)
  }

}
