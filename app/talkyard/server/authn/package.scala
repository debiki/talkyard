package talkyard.server

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ErrMsg, GetOrBadMap, IdentityProvider, OpenAuthDetails}
import com.github.scribejava.core.oauth.{OAuthService => sj_OAuthService}
import com.github.scribejava.core.model.{OAuthAsyncRequestCallback => sj_OAuthAsyncReqCallback, OAuthRequest => sj_OAuthRequest, Response => sj_Response}
import debiki.EdHttp.{InternalErrorResult, BadGatewayResult}
import debiki.JsonUtils._
import java.io.{IOException => j_IOException}
import java.util.concurrent.{ExecutionException => j_ExecutionException}
import org.scalactic.{Bad, Good, Or}
import play.api.libs.json.{Json, JsValue}
import talkyard.server.authn.OidcClaims.parseOidcClaims



// A Bo is not enough.
sealed abstract class AddOrRemove
case object Add extends AddOrRemove
case object KeepIfMaySee extends AddOrRemove
case object Remove extends AddOrRemove


package object authn extends TyLogging {

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



  def doAuthnServiceRequest(forWhat: St, idp: IdentityProvider, siteId: SiteId,
          authnService: sj_OAuthService, request: sj_OAuthRequest,
          onError: p_Result => U, onOk: JsValue => U): U = {

    authnService.execute(request, new sj_OAuthAsyncReqCallback[sj_Response] {
      override def onThrowable(t: Throwable): U = {
        val errorResponse: p_Result = t match {
          case ex@(_: InterruptedException | _: j_ExecutionException | _: j_IOException) =>
            InternalErrorResult(
                  "TyEAUTSVCREQ", s"Error fetching $forWhat: ${ex.toString}")
          case ex =>
            InternalErrorResult(
                  "TyEAUTSVCUNK", s"Unknown error fetching $forWhat: ${ex.toString}")
        }
        onError(errorResponse)
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
          return
        }

        // db max len: idtys_c_idpuserjson_len <= 7000 [sync_app_rdb_constrs]
        val maxUserRespLen = 6*1000
        if (body.length > maxUserRespLen) {
          // This is a weird IDP!?
          onError(BadGatewayResult(
                "TyEAUTSVC2LONG", o"""Too much JSON from IDP: ${body.length
                      } chars, max is: $maxUserRespLen"""))
          return
        }

        // LinkedIn sends back just nothing, unless there's a 'x-li-format: json' header.
        if (body.isEmpty) {
          onError(BadGatewayResult(
                "TyEAUTSVC0JSON", s"Empty response body from IDP"))
          return
        }

        val jsValue =
              try Json.parse(body)
              catch {
                case _: Exception =>
                  onError(BadGatewayResult("TyEAUTSVCJSONPARSE",
                        s"Malformed JSON from IDP"))
                  return
              }

        onOk(jsValue)
      }
    })
  }

}
