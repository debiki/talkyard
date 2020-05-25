create table oidc_providers_t(
  site_id_c int not null,
  id_c int not null,
  alias_c varchar not null,   -- —>   /-/auth/oidc/op_alias  +  /-/auth/oidc/op_alias/callback?code=....
  display_name_c varchar,
  enabled_c bool not null,
  trust_email_if_verified_c bool not null,
  link_account_no_login_c bool not null,
  gui_order_c int,
  sync_mode_c int not null,  -- ImportOnFirstLogin  or  SyncOnAllLogins
  op_hosted_domain_c varchar,      -- e.g. Google Gsuite hosted domains
  op_send_user_ip bool,         -- so Google throttles based on the browser's ip instead
  op_authorization_url_c varchar not null,
  op_access_token_url_c varchar not null,
  op_user_info_url_c varchar not null,
  op_logout_url_c varchar,
  op_client_id_c varchar not null,
  op_client_secret_c varchar not null,
  op_issuer_c varchar,
  op_scopes_c varchar,

  constraint oidcproviders_p_id primary key (site_id_c, id_c),
TyE77GJ2
  constraint oidcproviders_r_sites foreign key (site_id_c) references sites3 (id) deferrable,

  constraint oidcproviders_c_id_gtz check (id_c > 0),
  constraint oidcproviders_c_syncmode check (sync_mode_c between 1 and 10),
  constraint oidcproviders_c_alias_len check (length(alias_c) between 1 and 50),
  constraint oidcproviders_c_displayname_len check (length(display_name_c) between 1 and 200),
  constraint oidcproviders_c_ophosteddomain_len check (length(op_hosted_domain_c) between 1 and 200),
  constraint oidcproviders_c_opauthorizationurl_len check (length(op_authorization_url_c) between 1 and 200),
  constraint oidcproviders_c_opaccesstokenurl_len check (length(op_access_token_url_c) between 1 and 200),
  constraint oidcproviders_c_opuserinfourl_len check (length(op_user_info_url_c) between 1 and 200),
  constraint oidcproviders_c_oplogouturl_len check (length(op_logout_url_c) between 1 and 200),
  constraint oidcproviders_c_opclientid_len check (length(op_client_id_c) between 1 and 200),
  constraint oidcproviders_c_opclientsecret_len check (length(op_client_secret_c) between 1 and 200),
  constraint oidcproviders_c_opissuer_len check (length(op_issuer_c) between 1 and 200),
  constraint oidcproviders_c_opscopes_len check (length(op_scopes_c) between 1 and 200)
);


drop table oidc_providers_t;
