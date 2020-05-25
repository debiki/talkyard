package com.debiki.core


case class OidcProvider(
  site_id_c: SiteId,
  id_c: Int, // IdentityProviderNr,
  alias_c: String,
  display_name_c: String,
  enabled_c: Boolean,
  trust_email_if_verified_c: Boolean,
  link_account_no_login_c: Boolean,
  gui_order_c: Option[Int],
  sync_mode_c: Int,  // for now, always 1 = ImportOnFirstLogin, later, also: SyncOnAllLogins
  op_authorization_url_c: String,
  op_access_token_url_c: String,
  op_user_info_url_c: String,
  op_logout_url_c: Option[String],
  op_client_id_c: String,
  op_client_secret_c: String,
  op_issuer_c: Option[String],
  op_scopes_c: Option[String],
  op_hosted_domain_c: Option[String],
  op_send_user_ip_c: Option[Boolean],
) {
}

///  def upsertOidcProvider(oidcProvider: OidcProvider): Unit
///def loadOidcProvider(alias: String): Option[OidcProvider]
///def loadAllOidcProviders(): Seq[OidcProvider]
