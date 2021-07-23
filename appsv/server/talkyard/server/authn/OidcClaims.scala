package talkyard.server.authn

import com.debiki.core.{Bo, ErrMsg, Opt, St, i64}
import debiki.JsonUtils._
import org.scalactic.{Good, Or}
import play.api.libs.json.{JsObject, JsValue}


/** Maybe not really needed? Could store the claims directly in
  * class IdpUserInfo instead?
  *
  * OIDC standard fields:
  * https://openid.net/specs/openid-connect-core-1_0.html#Claims
  *
  * @param sub — End user id at the provider
  * @param name — Full name, all name parts, and possibly titles and suffixes
  * @param given_name — (aka first name) Some people have many given names.
  * @param family_name — Surname(s) or last name(s), there can be one, many or none
  * @param middle_name — There can be one, many or none
  * @param nickname
  * @param preferred_username — Might incl weird chars like @ or whitespace.
     Don't assume it's unique in any way.
  * @param profile — URL to the user's profile web page (at the IDP, right?)
  * @param picture — URL to profile photo of user, must be an image file.
  * @param website — URL to user's web page or blog.
  * @param email — Preferred email address. Might not be unique.
  * @param email_verified — If the IDP some time in the past somehow has verified
      that the user controlled the email address. Some IDPs won't include
      this claim, e.g. Azure AD.
  * @param gender — "female" or "male" or something else.
  * @param birthdate — YYYY (date omitted) or YYYY-MM-DD.
     Year 0000 means the year was omitted.
  * @param zoneinfo — Time zone, e.g. "Europe/Paris" or "America/Los_Angeles".
  * @param locale — BCP47 [RFC5646] language tag, typically like
     en-US or en_US, that is,
     first an ISO 639-1 Alpha-2 [ISO639‑1] language code, lowercase,
     a dash (or sometimes an underscore)
     then an ISO 3166-1 Alpha-2 [ISO3166‑1] country code, uppercase.
  * @param phone_number — The recommended format is called E.164, looks like:
     +1 (425) 555-1212 or +56 (2) 687 2400.
     If phone_number_verified, then, MUST be E.164 format.
  * @param phone_number_verified — Like email_verified.
  * @param address — Preferred postal address, JSON [RFC4627]
  * @param updated_at  — Unix time seconds since user info last updated.
  */
case class OidcClaims(   // REMOVE  no longer needed. But keep the docs, above — where?
  sub: St,
  name: Opt[St],
  given_name: Opt[St],
  family_name: Opt[St],
  middle_name: Opt[St],
  nickname: Opt[St],
  preferred_username: Opt[St],
  profile: Opt[St],
  picture: Opt[St],
  website: Opt[St],
  email: Opt[St],
  email_verified: Opt[Bo],
  gender: Opt[St],
  birthdate: Opt[St],
  zoneinfo: Opt[St],
  locale: Opt[St],
  phone_number: Opt[St],
  phone_number_verified: Opt[Bo],
  address: Opt[JsObject],
  updated_at: Opt[i64])



object OidcClaims {   // REMOVE  no longer needed

  def parseOidcClaims(json: JsValue): OidcClaims Or ErrMsg = tryParseGoodBad {
    Good(OidcClaims(
          sub = parseSt(json, "sub"),
          name = parseOptSt(json, "name"),
          given_name = parseOptSt(json, "given_name"),
          family_name = parseOptSt(json, "family_name"),
          middle_name = parseOptSt(json, "middle_name"),
          nickname = parseOptSt(json, "nickname"),
          preferred_username = parseOptSt(json, "preferred_username"),
          profile = parseOptSt(json, "profile"),
          picture = parseOptSt(json, "picture"),
          website = parseOptSt(json, "website"),
          email = parseOptSt(json, "email"),
          email_verified = parseOptBo(json, "email_verified"),
          gender = parseOptSt(json, "gender"),
          birthdate = parseOptSt(json, "birthdate"),
          zoneinfo = parseOptSt(json, "zoneinfo"),
          locale = parseOptSt(json, "locale"),
          phone_number = parseOptSt(json, "phone_number"),
          phone_number_verified = parseOptBo(json, "phone_number_verified"),
          address = parseOptJsObject(json, "address"),
          updated_at = parseOptLong(json, "updated_at")))
  }

}
