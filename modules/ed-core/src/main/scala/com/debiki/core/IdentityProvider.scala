package com.debiki.core

import com.debiki.core.IdentityProvider._
import com.debiki.core.Prelude._
import play.api.libs.json.JsObject



object IdentityProvider {
  // Lowercase, so works in url paths (typically lowercase)
  val ProtoNameOidc = "oidc"
  val ProtoNameOAuth2 = "oauth2"

  def prettyId(confFileIdpId: Opt[ConfFileIdpId], idpSiteId: Opt[SiteId],
          idpId: Opt[IdpId]): St = {
    confFileIdpId.map(s"confFileIdpId: " + _).getOrElse(
          s"idpSiteId: ${idpSiteId getOrDie "TyE3056MDKR4"
              }, idpId: ${idpId getOrDie "TyE306WK245"}")
  }
}


/**
  * @param confFileIdpId — if loaded from the old Silhouette config.
  * @param idpSiteId — typically the current site (the one the end user wants to
  *   login to and join the discussion) but can also be a server global
  *   authn site, with e.g. shared Gmail or Facebook OIDC or OAuth2 config.
  * @param idpId — the IDP at idpSiteId. Then, confFileIdpId.isEmpty.
  * @param protocol_c
  * @param alias_c
  * @param enabled_c
  * @param display_name_c
  * @param description_c
  * @param admin_comments_c
  * @param trust_verified_email_c
  * @param link_account_no_login_c
  * @param gui_order_c
  * @param sync_mode_c — for now, always 1 = ImportOnFirstLogin,
  *  later, also: 2 = SyncOnAllLogins, 3 = ... can get complicated!, see:
  *  https://www.keycloak.org/docs/latest/server_admin/#_identity_broker_first_login
  * @param idp_authorization_url_c
  *  Space separated list of BCP47 [RFC5646] language tag values.
  * @param idp_access_token_url_c
  * @param idp_access_token_auth_method_c — default: Basic Auth
  * @param idp_user_info_url_c
  * @param idp_user_info_fields_map_c
  * @param idp_logout_url_c
  * @param idp_client_id_c
  * @param idp_client_secret_c
  * @param idp_issuer_c
  * @param auth_req_scope_c
  * @param auth_req_claims — asks the IDP to return some specific claims.
  * @param auth_req_claims_locales — preferred language in returned OIDC claims.
  * @param auth_req_hosted_domain_c — for Google: any Google GSuite hosted domain(s).
  * @param userinfo_req_send_user_ip_c — so Google throttles based on the browser's ip instead
  */
case class IdentityProvider(
  confFileIdpId: Opt[ConfFileIdpId] = None,
  idpSiteId: Opt[SiteId] = None,
  idpId: Opt[IdpId] = None,
  protocol_c: St,
  alias_c: St,
  enabled_c: Bo,
  display_name_c: Opt[St],
  description_c: Opt[St],
  admin_comments_c: Opt[St],
  trust_verified_email_c: Bo,
  link_account_no_login_c: Bo,
  gui_order_c: Opt[i32],
  sync_mode_c: i32,
  idp_authorization_url_c: St,
  idp_access_token_url_c: St,
  idp_access_token_auth_method_c: Opt[St] = None,
  idp_user_info_url_c: St,
  idp_user_info_fields_map_c: Opt[JsObject] = None,
  idp_logout_url_c: Opt[St],
  idp_client_id_c: St,
  idp_client_secret_c: St,
  idp_issuer_c: Opt[St],
  auth_req_scope_c: Opt[St],
  // auth_req_claims: Opt[JsObject],
  // auth_req_claims_locales: Opt[St],
  // auth_req_ui_locales: Opt[St],  // preferred language when logging in at the IDP
  // auth_req_display: Opt[St]  // login in popup, full page, touch somehow etc.
  // auth_req_prompt: Opt[St]
  // auth_req_max_age: Opt[i32],
  // auth_req_id_token_hint: Opt[St],  — no.
  auth_req_hosted_domain_c: Opt[St],
  // auth_req_access_type: Opt[St],  — online / offline
  // auth_req_include_granted_scopes: Opt[Bo]  // tells the IDP to incl prev auth grants
  userinfo_req_send_user_ip_c: Opt[Bo],
) {

  require(confFileIdpId.forall(_.trim.nonEmpty), "TyE395RK40M")
  require(idpId.forall(_ >= 1), "TyE395R39W3")
  require(idpId.isDefined != confFileIdpId.isDefined, "TyE602MRDJ2M")
  require(idpId.isDefined == idpSiteId.isDefined, "TyE602MRDJ22")

  // OIDC requires 'openid' scope, which we'll include by default — but if the site
  // admins have explicitly specified the scope, it must include 'openid'.
  // (Could match on word boundaries, but, oh well.)
  require(isOAuth2NotOidc || auth_req_scope_c.isEmpty ||
        auth_req_scope_c.get.contains("openid"),
        s"OIDC scope w/o 'openid': '${auth_req_scope_c.get}' [TyEOIDCSCOPE]")

  require(Seq(ProtoNameOidc, ProtoNameOAuth2).contains(protocol_c), "TyE306RKT")

  require(idp_access_token_auth_method_c.isEmpty ||
        idp_access_token_auth_method_c.is("client_secret_basic") ||
        idp_access_token_auth_method_c.is("client_secret_post"), "TyE305RKT2A3")

  // For now:
  require(idp_user_info_fields_map_c.isEmpty, "TyE295RKTP")
  // Later, require is obj with St -> St key-values? Maybe use a Map[St, St] instead?

  def protoAlias: St = s"$protocol_c/$alias_c"
  def nameOrAlias: St = display_name_c getOrElse protoAlias
  def prettyId: St = IdentityProvider.prettyId(
        confFileIdpId, idpSiteId = idpSiteId, idpId = idpId)


  def isOAuth2NotOidc: Bo = protocol_c == ProtoNameOAuth2
  def isOpenIdConnect: Bo = protocol_c == ProtoNameOidc

  def isPerSite: Bo = idpId.isDefined
  def isFromConfFile: Bo = confFileIdpId.isDefined

}

