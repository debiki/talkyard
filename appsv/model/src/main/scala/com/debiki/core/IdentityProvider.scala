package com.debiki.core

import com.debiki.core.IdentityProvider._
import com.debiki.core.Prelude._
import play.api.libs.json.JsObject



sealed abstract class WellKnownIdpImpl(val Name: St) { def name: St = Name }
object WellKnownIdpImpl {
  case object Azure extends WellKnownIdpImpl("azure")
  case object Facebook extends WellKnownIdpImpl("facebook")
  case object GitHub extends WellKnownIdpImpl("github")
  case object Google extends WellKnownIdpImpl("google")
  case object LinkedIn extends WellKnownIdpImpl("linkedin")
  case object Twitter extends WellKnownIdpImpl("twitter")

  def fromName(protocol: St, name: St): Opt[WellKnownIdpImpl] = {
    // Twitter won't work, unless using OAuth10a. [0_twitter_aun]
    unimplIf(name != Twitter.name && protocol != ProtoNameOAuth2, "TyE8B05MRKJT")
    if (name == Twitter.name && protocol != ProtoNameOAuth10a)
      return None  // was: throw "TyE5X02RSMD4"

    Some(name match {
      case Facebook.Name => Facebook
      case GitHub.Name => GitHub
      case Google.Name => Google
      case LinkedIn.Name => LinkedIn
      case Twitter.Name => Twitter
      case _ => return None
    })
  }
}


object IdentityProvider {
  // Lowercase, so works in url paths (typically lowercase)
  val ProtoNameOidc = "oidc"
  val ProtoNameOAuth2 = "oauth2"
  val ProtoNameOAuth10a = "oauth10a"

  def prettyId(confFileIdpId: Opt[ConfFileIdpId], idpId: Opt[IdpId]): St = {
    confFileIdpId.map(s"confFileIdpId: " + _).getOrElse(
          s"idpId: ${idpId getOrDie "TyE306WK245"}")
  }
}


/**
  * @param confFileIdpId — if loaded from the old Silhouette config.
  * @param idpId — a per site IDP kept in idps_t. Then, confFileIdpId.isEmpty.
  * @param protocol
  * @param alias
  * @param wellKnownIdpImpl — which built-in ScribeJava provider impl to use.
  * @param enabled
  * @param displayName
  * @param description
  * @param adminComments
  * @param trustVerifiedEmail
  * @param emailVerifiedDomains — An optional list of email domains whose email
  *  addresses are known to have been verified — e.g. employee-name@company.com,
  *  only for the company's employees. Background: Azure AD doesn't send
  *  'email_verified: true' (as of 2020-12), so, need another way to know if
  *  an email addr has been verified or not.
  * @param linkAccountNoLogin
  * @param guiOrder
  * @param syncMode — for now, always 1 = ImportOnFirstLogin,
  *  later, also: 2 = SyncOnAllLogins, 3 = ... can get complicated!, see:
  *  https://www.keycloak.org/docs/latest/server_admin/#_identity_broker_first_login
  * @param oauAuthorizationUrl
  * @param oauAuthReqScope
  * @param oauAuthReqClaims — asks the IDP to return some specific claims.
  * @param oauAuthReqClaimsLocales — preferred language in returned OIDC claims.
  *  Space separated list of BCP47 [RFC5646] language tag values.
  * @param oauAuthReqHostedDomain — for Google: any Google GSuite hosted domain(s).
  * @param oauAccessTokenUrl
  * @param oauAccessTokenAuthMethod — default: Basic Auth
  * @param oauClientId
  * @param oauClientSecret
  * @param oauIssuer
  * @param oidcUserInfoUrl
  * @param oidcUserInfoFieldsMap
  * @param oidcUserinfoReqSendUserIp — so Google throttles based on the browser's ip instead
  * @param oidcLogoutUrl
  */
case class IdentityProvider(
  confFileIdpId: Opt[ConfFileIdpId] = None,
  idpId: Opt[IdpId] = None,
  protocol: St,
  alias: St,
  wellKnownIdpImpl: Opt[WellKnownIdpImpl] = None,
  enabled: Bo,
  displayName: Opt[St],
  description: Opt[St],
  adminComments: Opt[St],
  trustVerifiedEmail: Bo,
  emailVerifiedDomains: Opt[St],
  linkAccountNoLogin: Bo,
  guiOrder: Opt[i32],
  syncMode: i32,
  oauAuthorizationUrl: St,
  oauAuthReqScope: Opt[St],
  oauAuthReqClaims: Opt[JsObject] = None,
  oauAuthReqClaimsLocales: Opt[St] = None,
  // oau_auth_req_ui_locales: Opt[St],  // preferred language when logging in at the IDP
  // oau_auth_req_display: Opt[St]  // login in popup, full page, touch somehow etc.
  // oau_auth_req_prompt: Opt[St]
  // oau_auth_req_max_age: Opt[i32],
  // oau_auth_req_id_token_hint: Opt[St],  — no.
  // oau_auth_req_access_type: Opt[St],  — online / offline
  // oau_auth_req_include_granted_scopes: Opt[Bo]  // tells the IDP to incl prev auth grants
  oauAuthReqHostedDomain: Opt[St],
  oauAccessTokenUrl: St,
  oauAccessTokenAuthMethod: Opt[St] = None,
  oauClientId: St,
  oauClientSecret: St,
  oauIssuer: Opt[St],
  oidcUserInfoUrl: St,
  oidcUserInfoFieldsMap: Opt[JsObject] = None,
  oidcUserinfoReqSendUserIp: Opt[Bo],
  oidcLogoutUrl: Opt[St],
) {

  require(confFileIdpId.forall(_.trim.nonEmpty), "TyE395RK40M")
  require(idpId.forall(_ >= 1), "TyE395R39W3")
  require(idpId.isDefined != confFileIdpId.isDefined, "TyE602MRDJ2M")

  // OIDC requires 'openid' scope, which we'll include by default — but if the site
  // admins have explicitly specified the scope, it must include 'openid'.
  // (Could match on word boundaries, but, oh well.)
  require(isOAuth2NotOidc || oauAuthReqScope.isEmpty ||
        oauAuthReqScope.get.contains("openid"),
        s"OIDC scope w/o 'openid': '${oauAuthReqScope.get}' [TyEOIDCSCOPE]")

  require(Seq(ProtoNameOidc, ProtoNameOAuth2).contains(protocol), "TyE306RKT")

  require(oauAccessTokenAuthMethod.isEmpty ||
        oauAccessTokenAuthMethod.is("client_secret_basic") ||
        oauAccessTokenAuthMethod.is("client_secret_post"), "TyE305RKT2A3")

  // One cannot add custom fields mapping for well known OAuth2 providers,
  // e.g. Facebook — there's nothing to customize, already decided by that IDP.
  require(wellKnownIdpImpl.isEmpty || oidcUserInfoFieldsMap.isEmpty, "yE6503MARKTD4")

  // For now:
  require(oidcUserInfoFieldsMap.isEmpty, "TyE295RKTP")
  // Later, require is obj with St -> St key-values? Maybe use a Map[St, St] instead?

  def protoAlias: St = s"$protocol/$alias"
  def nameOrAlias: St = displayName getOrElse protoAlias
  def prettyId: St = IdentityProvider.prettyId(confFileIdpId, idpId = idpId)

  val theId: St = idpId.map(_.toString).orElse(confFileIdpId).getOrDie("TyE0ATMTD36")

  def isOAuth2NotOidc: Bo = protocol == ProtoNameOAuth2
  def isOpenIdConnect: Bo = protocol == ProtoNameOidc

  def isSiteCustom: Bo = idpId.isDefined
  def isServerGlobal: Bo = confFileIdpId.isDefined

}

