package com.debiki.core


case class IdentityProvider(
  site_id_c: SiteId,
  id_c: Int, // IdentityProviderNr,
  protocol_c: String,
  alias_c: String,
  display_name_c: Option[String],
  description_c: Option[String],
  enabled_c: Boolean,
  trust_verified_email_c: Boolean,
  link_account_no_login_c: Boolean,
  gui_order_c: Option[Int],
  sync_mode_c: Int,  // for now, always 1 = ImportOnFirstLogin, later, also: SyncOnAllLogins
  idp_authorization_url_c: String,
  idp_access_token_url_c: String,
  idp_user_info_url_c: String,
  idp_logout_url_c: Option[String],
  idp_client_id_c: String,
  idp_client_secret_c: String,
  idp_issuer_c: Option[String],
  idp_scopes_c: Option[String],
  idp_hosted_domain_c: Option[String],  // e.g. Google Gsuite hosted domains
  idp_send_user_ip_c: Option[Boolean],  // so Google throttles based on the browser's ip instead
) {
}

///  def upsertOidcProvider(oidcProvider: OidcProvider): Unit
///def loadOidcProvider(alias: String): Option[OidcProvider]
///def loadAllOidcProviders(): Seq[OidcProvider]
