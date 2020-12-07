package talkyard.server

import com.auth0.jwt.interfaces.{Claim => a0_Claim, DecodedJWT => a0_DecodedJWT}
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ErrMsg, GetOrBadMap, IdentityProvider, OpenAuthDetails}
import com.github.scribejava.core.oauth.{OAuthService => sj_OAuthService}
import com.github.scribejava.core.model.{OAuthAsyncRequestCallback => sj_OAuthAsyncReqCallback, OAuthRequest => sj_OAuthRequest, Response => sj_Response}
import debiki.EdHttp.{InternalErrorResult, BadGatewayResult}
import debiki.JsonUtils._
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.{Json, JsValue}
import talkyard.server.authn.OidcClaims.parseOidcClaims



// A Bo is not enough.
sealed abstract class AddOrRemove
case object Add extends AddOrRemove
case object KeepIfMaySee extends AddOrRemove
case object Remove extends AddOrRemove


package object authn {   REFACTOR; MOVE // most of this to an object UserInfoParser ?

  private val logger: p_Logger = TyLogger("talkyard.server.authn")

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


  def parseOidcIdToken(decodedJwt: a0_DecodedJWT, idp: IdentityProvider)
        : OpenAuthDetails Or ErrMsg = {

    // Decode an id_token online:  (only if it's a test suite dummy token!)
    // https://jwt.ms/#id_token=...
    // (Found linked from:
    //     https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens )

    // Azure standard claims docs:
    // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens
    // about "claims that are in most id_tokens by default".  [azure_claims_docs]
    //
    // Azure has a special 'oid' field which is the same for a given Azure
    // tenant user, for all OIDC clients — unlike 'sub' which varies per client.
    // The docs:
    // > If you need to share data across services, oid+tid is best
    // > as all apps get the same oid and tid claims for a given user
    // And, when describing a 'upn' claim:
    // > Instead, use the user object ID (oid) as a database key
    // We store this 'oid' Azure tenant user id in IdpUserInfo.idpRealmUserId,
    // and the tenant id in IdpUserInfo.idpRealmId.
    //
    // There're also Optional claims in Azure AD, which Azure excludes by default,
    // to improve performance by making the id_token smaller:
    // https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-optional-claims#v10-and-v20-optional-claims-set
    // > One of the goals of the v2.0 Microsoft identity platform endpoint is
    // > smaller token sizes to ensure optimal performance by clients.
    // > As a result, several claims formerly included in the access and ID tokens
    // > are no longer present in v2.0 tokens and must be asked for specifically
    // > on a per-application basis
    //
    // Does Azure AD verify email addresses?  1, 2, 3:
    //
    // 1) There's a  "verified_primary_email", and the docs says:
    // "Sourced from the user's PrimaryAuthoritativeEmail" — what does that mean?
    // Has it really been verified?  Seems an Azure tenant admin can just type
    // whatever in the  Contact Info: Email  field, on the Azure page at:
    // Home > [Tenant name] > Users > [User name]   (in Azure)
    // So, don't trust  verified_primary_email  on its own, right now?
    //
    // 2) Azure doesn't return any 'email_verified' claim — apparently they did for
    // a short while but that was a mistake — search for "Email_verified" [sic] here:
    // https://github.com/MicrosoftDocs/azure-docs/issues/28317
    //
    // 3) Maybe better to use Talkyard's  IdentityProvider.emailVerifiedDomains
    // conf val to know if an OIDC email from Azure has been verified or not.
    // Or possibly require both  emailVerifiedDomains  *and*  verified_primary_email
    // and that they match?

    // Sample id_token, from Azure AD, 2020-12-06:
    /*
    {
      "aud": "01234567-abcd-abcd-abcd-01234567abcd",
      "iss": "https://login.microsoftonline.com/33445566-2233-3344-aabb-112233aabbcc/v2.0",
      "iat": 1607253096,
      "nbf": 1607253096,
      "exp": 1607256996,
      "acct": 0,
      "auth_time": 1607142918,
      "email": "testemail@sometest.onmicrosoft.com.example.com",
      "family_name": "Lastname",
      "given_name": "Firstname",
      "ipaddr": "111.112.113.114",
      "name": "Fullname",
      "nonce": "112233445566778899",  // created by Talkyard, getOrCreateAuthnNonce()
      "oid": "12345abc-12ab-12ab-12ab-123456abcdef",
      "platf": "14",
      "preferred_username": "testemail@sometest.onmicrosoft.com",
      "rh": "0.zzzzzzzzzzzz--Base64--Something--zzzzzzzzzzzzzzzzzz.",
      "sid": "2345abcd-abcd-abed-ab7d-12345abc12ab",
      "sub": "zzzzzzz--Base64-Sth-Else--zzzzzzzzzzzzzzzzz",
      "tenant_ctry": "SE",
      "tenant_region_scope": "EU",
      "tid": "33445566-2233-3344-aabb-112233aabbcc",
      "upn": "testemail@sometest.onmicrosoft.com",
      "uti": "zzzz--Base64-3rd-sth--",
      "ver": "2.0",
      "verified_secondary_email": [
        "testemail+email@sometest.onmicrosoft.com",
        "testemail@sometest.onmicrosoft.com"
      ],
      "xms_tpl": "en"
    } */

    val jwt = decodedJwt

    val subSt = Option(jwt.getSubject) getOrElse {
      return Bad("'sub' claim missing")
    }

    val issuer = Option(jwt.getIssuer)

    // Theoretically an IDP could pretend to be Azure, but site admins
    // should only use IDPs they trust — typically the company's own Single Sign-On
    // something.  Read here about when an id_token must be verified: [when_chk_id_tkn]
    val seemsLikeAzure = issuer.exists(_ startsWith Oidc.AzureIssuerPrefix)
    val slAz = seemsLikeAzure

    Good(OpenAuthDetails(
          confFileIdpId = idp.confFileIdpId,
          idpId = idp.idpId,
          idpUserId = subSt,
          idpRealmId = if (slAz) parseJwtClaimAsSt(jwt, "tid") else None,
          idpRealmUserId = if (slAz) parseJwtClaimAsSt(jwt, "oid") else None,
          issuer = issuer,
          username = parseJwtClaimAsSt(jwt, "preferred_username"),
          nickname = parseJwtClaimAsSt(jwt, "nickname"),
          firstName = parseJwtClaimAsSt(jwt, "given_name"),
          middleName = parseJwtClaimAsSt(jwt, "middle_name"),
          lastName = parseJwtClaimAsSt(jwt, "family_name"),
          fullName = parseJwtClaimAsSt(jwt, "name"),
          email = parseJwtClaimAsSt(jwt, "email"),
          isEmailVerifiedByIdp = parseJwtClaimAsBo(jwt, "email_verified"),
          phoneNumber = parseJwtClaimAsSt(jwt, "phone_number"),
          isPhoneNumberVerifiedByIdp = parseJwtClaimAsBo(jwt, "phone_number_verified"),
          profileUrl = parseJwtClaimAsSt(jwt, "profile"),
          websiteUrl = parseJwtClaimAsSt(jwt, "website"),
          avatarUrl = parseJwtClaimAsSt(jwt, "picture"),
          gender = parseJwtClaimAsSt(jwt, "gender"),
          birthdate = parseJwtClaimAsSt(jwt, "birthdate"),
          timeZoneInfo = parseJwtClaimAsSt(jwt, "zoneinfo"),
          country = if (slAz) parseJwtClaimAsSt(jwt, "tenant_ctry") else None,
          locale = parseJwtClaimAsSt(jwt, "locale"),
          //roles: Seq[St] = Nil, — later. Azure.
          isRealmGuest =
                if (!slAz) None
                else parseJwtClaimAsI32(jwt, "acct")
                        .map(_ == Oidc.AzureTenantGuestAccountType),
          lastUpdatedAtIdpAtSec = parseJwtClaimAsI64(jwt, "updated_at"),
          idToken = Some(jwt.getToken),
          userInfoJson = None))
  }


  private def parseJwtClaimAsSt(decodedJwt: a0_DecodedJWT, claimName: St): Opt[St] = {
    val maybeNullClaim: a0_Claim = decodedJwt.getClaim(claimName)
    if (maybeNullClaim.isNull) None
    else Option(maybeNullClaim.asString)
  }


  private def parseJwtClaimAsBo(decodedJwt: a0_DecodedJWT, claimName: St): Opt[Bo] = {
    val maybeNullClaim: a0_Claim = decodedJwt.getClaim(claimName)
    if (maybeNullClaim.isNull) None
    else Option(maybeNullClaim.asBoolean)
  }


  private def parseJwtClaimAsI32(decodedJwt: a0_DecodedJWT, claimName: St): Opt[i32] = {
    val maybeNullClaim: a0_Claim = decodedJwt.getClaim(claimName)
    if (maybeNullClaim.isNull) None
    else Option(maybeNullClaim.asInt)
  }


  private def parseJwtClaimAsI64(decodedJwt: a0_DecodedJWT, claimName: St): Opt[i64] = {
    val maybeNullClaim: a0_Claim = decodedJwt.getClaim(claimName)
    if (maybeNullClaim.isNull) None
    else Option(maybeNullClaim.asLong)
  }


  def parseOidcUserInfo(jsVal: JsValue, idp: IdentityProvider)
        : OpenAuthDetails Or ErrMsg = {

    val jsob = asJsObject(jsVal, what = "OIDC user info")

    val sub = parseSt(jsob, "sub")
    val preferredUsername = parseOptSt(jsob, "preferred_username")
    val nickname = parseOptSt(jsob, "nickname")
    val firstName = parseOptSt(jsob, "given_name")
    val middleName = parseOptSt(jsob, "middle_name")
    val lastName = parseOptSt(jsob, "family_name")
    val name = parseOptSt(jsob, "name")
    val email = parseOptSt(jsob, "email")
    val email_verified = parseOptBo(jsob, "email_verified")
    val phoneNumber = parseOptSt(jsob, "phone_number")
    val phoneNrVerified = parseOptBo(jsob, "phone_number_verified")

    CLEAN_UP // move this to the place where a User gets constructed,
    // and just remember the name as-is, in IdpUserInfo,
    // like  parseOidcIdToken()  does.
    val anyName = name.orElse(Seq(
              firstName, middleName, lastName
              ).flatten.mkString(" ").trimNoneIfEmpty)
          .orElse(nickname)
          .orElse(preferredUsername)

    val isEmailVerified = isEmailAddrVerified(
          email, idpSaysEmailVerified = email_verified, idp)

    Good(OpenAuthDetails(
          confFileIdpId = idp.confFileIdpId,
          idpId = idp.idpId,
          idpUserId = sub,
          // idpRealmId: Opt[St]
          // idpRealmUserId: Opt[St]
          // issuer: Opt[St]
          username = preferredUsername,
          nickname = nickname,
          firstName = firstName,
          middleName = middleName,
          lastName = lastName,
          fullName = anyName,
          email = email,
          isEmailVerifiedByIdp = Some(isEmailVerified),
          phoneNumber = phoneNumber,
          isPhoneNumberVerifiedByIdp = phoneNrVerified,
          profileUrl = parseOptSt(jsob, "profile"),
          websiteUrl = parseOptSt(jsob, "website"),
          avatarUrl = parseOptSt(jsob, "picture"),
          gender = parseOptSt(jsob, "gender"),
          birthdate = parseOptSt(jsob, "birthdate"),
          timeZoneInfo = parseOptSt(jsob, "zoneinfo"),
          // country: Opt[St]
          locale = parseOptSt(jsob, "locale"),
          //address = parseOptJsObject(jsob, "address")
          //roles: Seq[St]
          // isRealmGuest: Opt[Bo]
          lastUpdatedAtIdpAtSec = parseOptLong(jsob, "updated_at"),
          userInfoJson = Some(jsob)))
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
        WellKnownIdps.parseUserJson(jsVal, idp)
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
    val emailVerified = isEmailAddrVerified(Some(email), idpSaysEmailVerified = None, idp)
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



  private def isEmailAddrVerified(emailAdr: Opt[St], idpSaysEmailVerified: Opt[Bo],
          idp: IdentityProvider): Bo = {
    // Or do this check elsewhere instead? But then easy to forget?
    if (!idp.trustVerifiedEmail)
      return false

    if (emailAdr.isEmpty || Check.isObviouslyBadEmail(emailAdr.get))
      return false

    if (idpSaysEmailVerified.isDefined) {
      dieIf(!idp.trustVerifiedEmail, "TyE4TG03MA24")
      return idpSaysEmailVerified.get
    }

    debiki.EffectiveSettings.isEmailAddressAllowed(  // RENAME this fn to what?
            emailAdr.get,
            allowListText = idp.emailVerifiedDomains.getOrElse(""),
            blockListText = "",
            allowByDefault = false)
  }



  def doAuthnServiceRequest(forWhat: St, idp: IdentityProvider, siteId: SiteId,
          authnService: sj_OAuthService, request: sj_OAuthRequest,
          onError: p_Result => U, onOk: JsValue => U): U = {

    authnService.execute(request, new sj_OAuthAsyncReqCallback[sj_Response] {
      override def onThrowable(t: Throwable): U = {
        val (errCode, logThrowable, briefMsg) = t match {
          case ex: j_NoRouteToHostException =>
            ("TyEAUTSVCCON", false, s"Cannot fetch $forWhat: ${ex.toString}")
          case ex@(_: InterruptedException | _: j_ExecutionException | _: j_IOException) =>
            ("TyEAUTSVCREQ", true, s"Error fetching $forWhat: ${ex.toString}")
          case ex =>
            ("TyEAUTSVCUNK", true, s"Unknown error fetching $forWhat: ${ex.toString}")
        }

        val randVal = nextRandomString()
        val randValSt = s". Rand val: '$randVal'"
        val detailedMsg = i"""s$siteId: $briefMsg [$errCode],
              |Log message random id: '$randVal'
              |IDP: ${idp.protoAlias}, id: ${idp.prettyId}
              |Request URL: ${request.getCompleteUrl}
              |Request headers: ${request.getHeaders}
              |"""
        if (logThrowable) logger.warn(detailedMsg, t)
        else logger.warn(detailedMsg)

        onError(InternalErrorResult(errCode, briefMsg + randValSt))
      }

      override def onCompleted(response: sj_Response): U = {
        val httpStatusCode = response.getCode
        val body = response.getBody
        lazy val randVal = nextRandomString()

        ADMIN_LOG // could log  more consistently below, & so admins can see?

        if (httpStatusCode < 200 || 299 < httpStatusCode) {
          val errCode = "TyEAUTSVCRSP"
          logger.warn(i"""s$siteId: Bad OIDC/OAuth2 authn service response [$errCode],
              |when fetching $forWhat:
              |Log message random id: '$randVal'
              |IDP: ${idp.protoAlias}, id: ${idp.prettyId}
              |Request URL: ${request.getCompleteUrl}
              |Request headers: ${request.getHeaders}
              |Response status code: $httpStatusCode  (bad, not 2XX)
              |Response body: -----------------------
              |$body
              |--------------------------------------
              |""")
          val errMsg = s"Error response from IDP when fetching $forWhat, status code: ${
                httpStatusCode}, details in the server logs, search for '$randVal'"
          val upstreamError = 500 <= httpStatusCode && httpStatusCode <= 599
          onError(
                if (upstreamError) BadGatewayResult(errCode, errMsg)
                else InternalErrorResult(errCode, errMsg))
          return ()
        }

        // db max len: idtys_c_idpuserjson_len <= 7000 [sync_app_rdb_constrs]
        val maxUserRespLen = 6*1000
        if (body.length > maxUserRespLen) {
          // This is a weird IDP!?
          onError(BadGatewayResult(
                "TyEAUTSVC2LONG", o"""Too much JSON from IDP: ${body.length
                      } chars, max is: $maxUserRespLen"""))
          return ()
        }

        // LinkedIn sends back just nothing, unless there's a 'x-li-format: json' header.
        if (body.isEmpty) {
          onError(BadGatewayResult(
                "TyEAUTSVC0JSON", s"Empty response body from IDP"))
          return ()
        }

        val jsValue =
              try Json.parse(body)
              catch {
                case _: Exception =>
                  onError(BadGatewayResult("TyEAUTSVCJSONPARSE",
                        s"Malformed JSON from IDP"))
                  return ()
              }

        onOk(jsValue)
      }
    })
  }

}
