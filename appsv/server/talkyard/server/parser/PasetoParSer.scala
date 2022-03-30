package talkyard.server.parser

import com.debiki.core._
import com.debiki.core.Prelude._
import dev.paseto.jpaseto.{Paseto => pas_Paseto, Claims => pas_Claims}
import org.scalactic.{Good, Or, Bad}



object PasetoParSer {


  def apiV0_parseExternalUser(token: pas_Paseto): ExternalUser Or ErrMsg = {
    try Good(apiV0_parseExternalUserImpl(token))
    catch {
      case ex: BadInpDataEx => Bad(ex.getMessage)
    }
  }

  private def apiV0_parseExternalUserImpl(token: pas_Paseto): ExternalUser = {
    // See https://paseto.io/rfc/ for standard claims.
    val claims: pas_Claims = token.getClaims
    if (claims eq null)
      throwBadInpData("TyE40MGE3", "PASETO token with no claims: getClaims() says null")

    // The claims are of type java.util.Map[String, Object].
    import MapParSer._, ScalarsParSer._

    val dataMap = parseNestedMap(claims, "data")
    val userMap = parseNestedMap(dataMap, "user")

    // The external software system might use weird user ids starting or ending with
    // spaces. So maybe we shouldn't trim the ssoId nor the extId.
    // However, the username and full name are intended for using within Talkyard only,
    // (but not for SSO user account lookup) so these strings we can trim.
    // Otherwise, external software sometimes includes empty or non-trimmed strings.
    // A bit dupl code — this is for parsing PASETO, the other for JSON. [dupl_parse_ext_user]
    val ssoIdMaybe: St = parseSt(userMap, "ssoId")
    val ssoId: SignOnId = parseSignOnId(ssoIdMaybe) // don't trim
    val extId: Opt[St] = parseOptSt(userMap, "extId").noneIfBlank // don't trim
    val username: Opt[St] = parseOptSt(userMap, "username").trimNoneIfBlank
    val fullName: Opt[St] = parseOptSt(userMap, "fullName").trimNoneIfBlank

    val primaryEmailAddressMaybe: St = parseSt(userMap, "primaryEmailAddress").trim

    val primaryEmailAddress: ParsedEmail = Validation.checkEmail(
          primaryEmailAddressMaybe) getOrIfBad (problem =>
            throwBadInpData("TyE4MS6W2RI",
                  s"Bad email: '$primaryEmailAddressMaybe', problem: $problem"))

    val isEmailAddressVerified: Opt[Bo] = parseOptBo(userMap, "isEmailAddressVerified")

    ExternalUser(
          ssoId = ssoId,
          extId = extId,
          primaryEmailAddress = primaryEmailAddress,
          isEmailAddressVerified = isEmailAddressVerified.is(true),
          username = username,
          fullName = fullName,
          avatarUrl = None,
          // BIO
          aboutUser = None,
          // Change to None (undefined) so won't accidentally demote an admin
          isAdmin = false,
          isModerator = false)(IfBadAbortReq)
  }

}
