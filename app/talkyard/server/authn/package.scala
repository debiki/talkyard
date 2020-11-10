package talkyard.server

import com.debiki.core.Prelude.stringToRichString
import com.debiki.core.{ErrMsg, GetOrBadMap, IdentityProvider, OpenAuthDetails}
import debiki.JsonUtils._
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.JsValue
import talkyard.server.authn.OidcClaims.parseOidcClaims


package object authn {


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

    // For now:
    // userid: null, first_name, last_name, country, city, company, job_function: '',
    // job_title: '', email
    // Later, use mapping in:  oidc_user_info_fields_map_c

    if (isDevOrTest) {
      System.out.println(s"ZZQQ parseCustomUserInfo, idp: ${idp.protoAlias}: \n\n${
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
          lastName = lastName,
          fullName = firstSpaceLast.trimNoneIfEmpty,
          email = Some(email),
          isEmailVerifiedByIdp = Some(emailVerified && idp.trustVerifiedEmail),
          avatarUrl = None,
          userInfoJson = Some(jsObj)))
  }

}
