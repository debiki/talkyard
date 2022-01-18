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

  // Sync w ts: LoginReason (but no need to repeat all enum values.)
  sealed abstract class LoginReason(val IntVal: i32) { def toInt: i32 = IntVal }
  object LoginReason {
    case object LoginBecauseNotFound extends LoginReason(21)
    case object AuthnRequiredToRead extends LoginReason(22)
    case object LoginToAdministrate extends LoginReason(24)
  }

  sealed abstract class MinAuthnStrength(val IntVal: i32, val fullSidRequired: Bo = true) {
    def toInt: i32 = IntVal
  }


  // RENAME to AuthnStrength? And a *param* name can be minAuthnStrength instead?
  // Then, AuthnStrength.[InternalJob] makes sense, otherwise not.
  //
  object MinAuthnStrength {

    // No session id needed — instead, we check an e2e test secret, for each request.
    case object E2eTestPassword extends MinAuthnStrength(10, fullSidRequired = false)

    // No session id needed — instead, we check an API secret, for each request.
    case object ApiSecret extends MinAuthnStrength(15, fullSidRequired = false)

    /// Parts 1 and 2 of old embedded sessions might have been cached in localStorage
    /// in the embedding website, and if the embedding website has security vulnerabilities,
    /// an attacker might have gained access to those parts of the session.
    /// Therefore, those parts of the session should give access only to
    /// embedded comments — like, posting comments, editing one's comments,
    /// or (for mods) moderating embedded comments [mod_emb_coms_sid],
    /// but nothing else. Then, if a blog has security vulnerabilities, only
    /// the blog comments would be affected — but not any Talkyard forum on its own
    /// sub domain (for organizations with both a forum and blog comments),
    /// or any user accounts or email addresses.
    ///
    /// This could also be configurable, so the site admins could choose to always
    /// require session part 3, or even require people to interact with the comments
    /// iframe, trying to make iOS Safari ITP understand that the comments aren't
    /// a tracker, and allow cookies — then, the server would get the HttpOnly
    /// cookies. [ios_itp]
    ///
    case object EmbeddingStorageSid12 extends MinAuthnStrength(20, fullSidRequired = false)

    /// The embedded sid can be refreshed by popping up a window directly
    /// against the Talkyard server — then, the session id part 3, in a cookie, would
    /// be accessible to the javascript in the popup, which could send it to the iframes.
    /// Or the app server could reply and include parts 1, 2, 3 in the response.
    /// But only sids part 1+2 (without part 3), would get rejected (since they're
    /// less safe, see EmbeddingStorageSid12 above). Part 3 would be temporarily
    /// remembered only in the iframes, never accessible to the embedd*ing* website,
    //case object EmbeddedIframeSid123 extends MinAuthnStrength(30, part3Required = true)

    //case object EmbeddedIframeSid123Recent extends MinAuthnStrength(35, part3Required = true)

    /// Apart from requiring HttpOnly cookies (session id part 4), what Normal
    /// authentication is, would be community specific. Some communities might be ok
    /// with password authn — whilst others might want 2 or 3 factor authn,
    /// and/or SameSite Strict cookies.
    case object Normal extends MinAuthnStrength(40)

    /// Like Normal, but must have authenticated recently. Could protect against
    /// someone grabbing another person's laptop, running away, and then 5 minutes later
    /// trying to change the other person's email address to hens own — this wouldn't work,
    /// since hen would need to authenticate again first (so has authenticated just recently).
    //case object NormalRecent extends MinAuthnStrength(45)

    /// A community can optionally require stronger authentication, for some endpoints
    /// (or maybe even some specific parts of a community?), or custom groups, mods or admins.
    /// By default, Strong is the same as Normal — the site admins would need to
    /// specify somehow what Strong means, in their community's case. Maybe
    /// OTP + 2FA could be a default? Or should WebAuthn be the default Strong method?
    /// (Unlike 2FA in general, WebAuthn works against phishing.)
    //case object Strong extends MinAuthnStrength(50)

    /// Like Strong, but must have authenticated recently — say, within the last X minutes
    /// (and X is community specific).
    /// For things like changing one's email address or deleting one's account.
    //case object StrongRecent extends MinAuthnStrength(55)

    /// Maybe useful if min-auth-strength fn gets called by an internal background job?
    // case object [InternalJob] extends MinAuthnStrength(99)
  }


  // Aliases for better readability.
  type JoinOrLeave = AddOrRemove
  val Join: Add.type = Add
  val StayIfMaySee: KeepIfMaySee.type = KeepIfMaySee
  val Leave: Remove.type = Remove

  object ServerDefIdpAliases {
    //import com.mohiva.play.silhouette.impl.providers.{oauth2 => si_oauth2}

    val Facebook = "facebook"
    val GitHub = "github"
    val Google = "google"
    val LinkedIn = "linkedin"
    //val Twitter = "twitter"

    /*
    // Should be same ids as Silhouette, so migration to ScribeJava will be simpler:
    assert(si_oauth2.GoogleProvider.ID == Google)
    assert(si_oauth2.GitHubProvider.ID == GitHub)
    assert(si_oauth2.FacebookProvider.ID == Facebook)
    //assert(si_oauth2.TwitterProvider.ID == Twitter)  not OAuth2 yet?
    assert(si_oauth2.LinkedInProvider.ID == LinkedIn)
    */

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

    val email = parseJwtClaimAsSt(jwt, "email")
    val emailVerifiedClaim = parseJwtClaimAsBo(jwt, "email_verified")
    val isEmailVerified = isEmailAddrVerified(
          email, idpSaysEmailVerified = emailVerifiedClaim, idp)

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
          email = email,
          isEmailVerifiedByIdp = Some(isEmailVerified),
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

    // Sync the different maxLength = ... with the database constraints,
    // see:  \d identities3.  Could log a warning, if some field too long?
    // But show in which log file? Anyone really cares about this?
    // For now, just setting to None, rather than letting the db constraints
    // fail, which would prevent people with "impossibly" long fields, from signing in.
    val sub = parseSt(jsob, "sub")
    val preferredUsername = parseOptSt(jsob, "preferred_username", cutAt = 200)
    val nickname = parseOptSt(jsob, "nickname", cutAt = 250)
    val firstName = parseOptSt(jsob, "given_name", cutAt = 250)
    val middleName = parseOptSt(jsob, "middle_name", cutAt = 250)
    val lastName = parseOptSt(jsob, "family_name", cutAt = 250)
    val name = parseOptSt(jsob, "name", cutAt = 250)
    val email = parseOptSt(jsob, "email", noneIfLongerThan = 250)
    val email_verified = parseOptBo(jsob, "email_verified")
    val phoneNumber = parseOptSt(jsob, "phone_number", noneIfLongerThan = 250)
    val phoneNrVerified = parseOptBo(jsob, "phone_number_verified")

    CLEAN_UP // move this to the place where a User gets constructed,
    // and just remember the name as-is, in IdpUserInfo,
    // like  parseOidcIdToken()  does.
    val fullName = name.orElse(Seq(
              firstName, middleName, lastName
              ).flatten.mkString(" ").trimNoneIfEmpty)
          .orElse(nickname)
          .orElse(preferredUsername)
          .map(_.take(250))

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
          fullName = fullName,
          email = email,
          isEmailVerifiedByIdp = Some(isEmailVerified),
          phoneNumber = phoneNumber,
          isPhoneNumberVerifiedByIdp = phoneNrVerified,
          profileUrl = parseOptSt(jsob, "profile", noneIfLongerThan = 500),
          websiteUrl = parseOptSt(jsob, "website", noneIfLongerThan = 500),
          avatarUrl = parseOptSt(jsob, "picture", noneIfLongerThan = 2100),
          gender = parseOptSt(jsob, "gender", cutAt = 100),
          birthdate = parseOptSt(jsob, "birthdate", cutAt = 100),
          timeZoneInfo = parseOptSt(jsob, "zoneinfo", cutAt = 250),
          // country: Opt[St]  cutAt = 250
          locale = parseOptSt(jsob, "locale", cutAt = 250),
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
      val isVerified = idpSaysEmailVerified.get
      dieIf(!idp.trustVerifiedEmail && isVerified, "TyE4TG03MA24")
      return isVerified
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
