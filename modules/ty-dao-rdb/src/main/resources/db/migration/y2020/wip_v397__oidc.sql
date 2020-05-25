alter table settings3 add column enable_custom_idps boolean;
alter table settings3 add column use_only_custom_idps boolean;

-- If using only per site custom idps, then, custom idps must be enabled.
alter table settings3 add constraint settings_c_enable_use_only_custom_idps check (
    (enable_custom_idps is not null and enable_custom_idps)
    or not use_only_custom_idps);

alter table settings3 add constraint settings_c_custom_idps_xor_sso check (
    not enable_custom_idps or not enable_sso);


-- Trims not just spaces, but all whitespace.
create or replace function trim_all(text varchar) returns varchar
    language plpgsql
    as $_$
begin
    -- There's: Related Unicode characters without White_Space property,
    -- but that doesn't make sense at the very the beginning or end of some text.
    -- see:
    --   https://en.wikipedia.org/wiki/Whitespace_character:
    --   https://stackoverflow.com/a/22701212/694469.
    -- E.g. Mongolian vowel separator, zero width space, word joiner.
    -- So, \s to trim all whitespace, plus \u... to trim those extra chars.
    return regexp_replace(text,
            '^[\s\u180e\u200b\u200c\u200d\u2060\ufeff]+' ||
            '|' ||
            '[\s\u180e\u200b\u200c\u200d\u2060\ufeff]+$', '', 'g');
end;
$_$;



-- Identity providers


create table idps_t(
  site_id_c int not null,
  idp_id_c int not null,
  protocol_c varchar not null,
  alias_c varchar not null,
  enabled_c bool not null,
  display_name_c varchar,
  description_c varchar,
  admin_comments_c varchar,
  trust_verified_email_c bool not null,
  link_account_no_login_c bool not null,
  gui_order_c int,
  sync_mode_c int not null,
  oidc_config_url varchar,
  oidc_config_fetched_at timestamp,
  idp_config_edited_at timestamp,
  idp_config_json_c jsonb,
  idp_authorization_url_c varchar not null,
  idp_access_token_url_c varchar not null,
  idp_access_token_auth_method_c varchar,
  idp_user_info_url_c varchar not null,
  idp_user_info_fields_map_c jsonb,
  idp_logout_url_c varchar,
  idp_client_id_c varchar not null,
  idp_client_secret_c varchar not null,
  idp_issuer_c varchar,
  auth_req_scope_c varchar,
  auth_req_claims jsonb,
  auth_req_claims_locales varchar,
  auth_req_ui_locales varchar,
  auth_req_display varchar,
  auth_req_prompt varchar,
  auth_req_max_age int,
  -- auth_req_id_token_hint: Opt[St],  — no.
  auth_req_hosted_domain_c varchar,
  -- See https://developers.google.com/identity/protocols/oauth2/openid-connect
  auth_req_access_type varchar, -- 'online' or 'offline'
  auth_req_include_granted_scopes bool,
  userinfo_req_send_user_ip_c bool,

  constraint idps_p_id primary key (site_id_c, idp_id_c),

  -- fk ix: primary key index
  constraint idps_r_sites foreign key (site_id_c)
      references sites3 (id) deferrable,

  constraint idps_c_id_gtz check (idp_id_c > 0),
  constraint idps_c_protocol check (protocol_c in ('oidc', 'oauth1', 'oauth2')),
  constraint idps_c_syncmode check (sync_mode_c between 1 and 10),
  constraint idps_c_alias_chars check (alias_c ~ '^[a-z0-9_-]+$'),
  constraint idps_c_alias_len check (length(alias_c) between 1 and 50),

  constraint idps_c_displayname_len check (
      length(display_name_c) between 1 and 200),

  constraint idps_c_displayname_trim check (
      trim_all(display_name_c) = display_name_c),

  constraint idps_c_description_len check (
      length(description_c) between 1 and 1000),

  constraint idps_c_admincomments_len check (
      length(admin_comments_c) between 1 and 5000),

  constraint idps_c_oidcconfigurl_len check (
      length(oidc_config_url) between 1 and 500),

  constraint idps_c_idpconfigjson_len check (
      pg_column_size(idp_config_json_c) between 1 and 11000),

  constraint idps_c_idpauthorizationurl_len check (
      length(idp_authorization_url_c) between 1 and 500),

  constraint idps_c_idpaccesstokenurl_len check (
      length(idp_access_token_url_c) between 1 and 500),

  constraint idps_c_idpaccesstokenauthmethod_in check (
      idp_access_token_auth_method_c in (
          'client_secret_basic', 'client_secret_post')),

  constraint idps_c_idpuserinfourl_len check (
      length(idp_user_info_url_c) between 1 and 500),

  constraint idps_c_idpuserinfofieldsmap_len check (
      pg_column_size(idp_user_info_fields_map_c) between 1 and 3000),

  constraint idps_c_idplogouturl_len check (
      length(idp_logout_url_c) between 1 and 500),

  constraint idps_c_idpclientid_len check (
      length(idp_client_id_c) between 1 and 200),

  constraint idps_c_idpclientsecret_len check (
      length(idp_client_secret_c) between 1 and 200),

  constraint idps_c_idpissuer_len check (
      length(idp_issuer_c) between 1 and 200),

  constraint idps_c_authreqscope_len check (
      length(auth_req_scope_c) between 1 and 200),

  constraint idps_c_authreqclaims_len check (
      pg_column_size(auth_req_claims) between 1 and 200),

  constraint idps_c_authreqclaimslocales_len check (
      length(auth_req_claims_locales) between 1 and 200),

  constraint idps_c_authrequilocales_len check (
      length(auth_req_ui_locales) between 1 and 200),

  constraint idps_c_authreqdisplay_in check (
      auth_req_display in ('page', 'popup', 'touch', 'wap')),

  constraint idps_c_authreqprompt_in check (
      auth_req_prompt in ('none', 'login', 'consent', 'select_account')),

  constraint idps_c_authreqmaxage_len check (
      auth_req_max_age >= 1),

  constraint idps_c_authreqhosteddomain_len check (
      length(auth_req_hosted_domain_c) between 1 and 200),

  constraint idps_c_authreqaccesstype_in check (
      auth_req_access_type in ('online', 'offline'))
);


create unique index idps_u_protocol_alias on idps_t (site_id_c, protocol_c, alias_c);
create unique index idps_u_displayname on idps_t (site_id_c, display_name_c)
    where enabled_c;




-- Identities


alter table identities3 rename column user_id to user_id_c;
alter table identities3 rename column user_id_orig to user_id_orig_c;
alter table identities3 rename column id to idty_id_c;
alter table identities3 rename column securesocial_provider_id to conf_file_idp_id_c;
alter table identities3 rename column securesocial_user_id to idp_user_id_c;

alter table identities3 add column broken_idp_sth_c varchar;
alter table identities3 add column idp_site_id_c int;
alter table identities3 add column idp_id_c int;
alter table identities3 add column oidc_id_token_str varchar;
alter table identities3 add column oidc_id_token_json jsonb;
alter table identities3 add column idp_user_json_c jsonb;
alter table identities3 add column idp_username_c varchar;


-- fk ix: idtys_i_g_idpsiteid_idpid
alter table identities3 add constraint idtys_r_idps
    foreign key (idp_site_id_c, idp_id_c)
    references idps_t (site_id_c, idp_id_c) deferrable;

alter table identities3 add constraint idtys_c_idpsite_and_idpid check (
    (idp_site_id_c is null) = (idp_id_c is null));

-- For now: All idps are site local. Will drop this later.
alter table identities3 add constraint idtys_c_idpsiteid_eq_siteid check (
    idp_site_id_c = site_id);


alter table identities3 add constraint idtys_c_brokenidpsth check (
    length(broken_idp_sth_c) between 1 and 500);

alter table identities3 add constraint idtys_c_oidcidtokenstr check (
    length(oidc_id_token_str) between 1 and 7000);

alter table identities3 add constraint idtys_c_oidcidtokenjson check (
    pg_column_size(oidc_id_token_json) between 1 and 7000);

alter table identities3 add constraint idtys_c_idpuserid_len check (
    length(idp_user_id_c) between 1 and 500);

alter table identities3 add constraint idtys_c_idpuserjson_len check (
    pg_column_size(idp_user_json_c) between 1 and 7000);

alter table identities3 add constraint idtys_c_idpusername check (
    length(idp_username_c) between 1 and 200);


update identities3
    set broken_idp_sth_c = '_old_unknown_'
    where num_nonnulls(
            oid_claimed_id,
            idp_id_c,
            conf_file_idp_id_c,
            broken_idp_sth_c)
        = 0;

alter table identities3 add constraint idtys_c_one_type check (
    num_nonnulls(
            oid_claimed_id,
            idp_id_c,
            conf_file_idp_id_c,
            broken_idp_sth_c)
        = 1);



create index idtys_i_g_idpsiteid_idpid on identities3 (idp_site_id_c, idp_id_c)
    where idp_id_c is not null;

create unique index idtys_u_idpsiteid_idpid_idpuserid
    on identities3 (site_id, idp_site_id_c, idp_id_c, idp_user_id_c)
    where idp_id_c is not null;

drop index dw1_ids_securesocial;
create unique index idtys_u_conffileidpid_idpusrid
    on identities3 (site_id, conf_file_idp_id_c, idp_user_id_c)
    where conf_file_idp_id_c is not null;


-- Old names
alter index dw1_ids_siteid_id__p rename to idtys_p_idtyid;
alter index dw1_idsoid_tnt_usr rename to idtys_i_patid;
alter index dw1_idsoid_email rename to idtys_i_g_email;

-- OpenID 1.0 gone since long
drop index dw1_idsoid_tnt_email__u;
