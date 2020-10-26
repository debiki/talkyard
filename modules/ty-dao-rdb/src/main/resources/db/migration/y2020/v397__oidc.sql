alter table settings3 add column enable_custom_idps bool;
alter table settings3 add column use_only_custom_idps bool;

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
  oidc_config_json_c jsonb,
  oau_authorization_url_c varchar not null,
  oau_auth_req_scope_c varchar,
  oau_auth_req_claims jsonb,
  oau_auth_req_claims_locales varchar,
  oau_auth_req_ui_locales varchar,
  oau_auth_req_display varchar,
  oau_auth_req_prompt varchar,
  oau_auth_req_max_age int,
  -- oau_auth_req_id_token_hint: Opt[St],  — no.
  oau_auth_req_hosted_domain_c varchar,
  -- See https://developers.google.com/identity/protocols/oauth2/openid-connect
  oau_auth_req_access_type varchar, -- 'online' or 'offline'
  oau_auth_req_include_granted_scopes bool,
  oau_access_token_url_c varchar not null,
  oau_access_token_auth_method_c varchar,
  oau_client_id_c varchar not null,
  oau_client_secret_c varchar not null,
  oau_issuer_c varchar,
  oidc_user_info_url_c varchar not null,
  oidc_user_info_fields_map_c jsonb,
  oidc_userinfo_req_send_user_ip_c bool,
  oidc_logout_url_c varchar,

  constraint idps_p_id primary key (site_id_c, idp_id_c),

  -- fk ix: primary key index
  constraint idps_r_sites foreign key (site_id_c)
      references sites3 (id) deferrable,

  constraint idps_c_id_gtz check (idp_id_c > 0),
  constraint idps_c_protocol check (protocol_c in ('oidc', 'oauth2')),
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

  constraint idps_c_oidcconfigjson_len check (
      pg_column_size(oidc_config_json_c) between 1 and 11000),

  constraint idps_c_oauauthorizationurl_len check (
      length(oau_authorization_url_c) between 1 and 500),

  constraint idps_c_oauauthreqscope_len check (
      length(oau_auth_req_scope_c) between 1 and 200),

  constraint idps_c_oauauthreqclaims_len check (
      pg_column_size(oau_auth_req_claims) between 1 and 200),

  constraint idps_c_oauauthreqclaimslocales_len check (
      length(oau_auth_req_claims_locales) between 1 and 200),

  constraint idps_c_oauauthrequilocales_len check (
      length(oau_auth_req_ui_locales) between 1 and 200),

  constraint idps_c_oauauthreqdisplay_in check (
      oau_auth_req_display in ('page', 'popup', 'touch', 'wap')),

  constraint idps_c_oauauthreqprompt_in check (
      oau_auth_req_prompt in ('none', 'login', 'consent', 'select_account')),

  constraint idps_c_oauauthreqmaxage_gtz check (
      oau_auth_req_max_age > 0),

  constraint idps_c_oauauthreqhosteddomain_len check (
      length(oau_auth_req_hosted_domain_c) between 1 and 200),

  constraint idps_c_oauauthreqaccesstype_in check (
      oau_auth_req_access_type in ('online', 'offline')),

  constraint idps_c_oauaccesstokenurl_len check (
      length(oau_access_token_url_c) between 1 and 500),

  constraint idps_c_oauaccesstokenauthmethod_in check (
      oau_access_token_auth_method_c in (
          'client_secret_basic', 'client_secret_post')),

  constraint idps_c_oauclientid_len check (
      length(oau_client_id_c) between 1 and 200),

  constraint idps_c_oauclientsecret_len check (
      length(oau_client_secret_c) between 1 and 200),

  constraint idps_c_oauissuer_len check (
      length(oau_issuer_c) between 1 and 200),

  constraint idps_c_oidcuserinfourl_len check (
      length(oidc_user_info_url_c) between 1 and 500),

  constraint idps_c_oidcuserinfofieldsmap_len check (
      pg_column_size(oidc_user_info_fields_map_c) between 1 and 3000),

  constraint idps_c_oidclogouturl_len check (
      length(oidc_logout_url_c) between 1 and 500)
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
alter table identities3 add column idp_id_c int;
alter table identities3 add column oidc_id_token_str varchar;
alter table identities3 add column oidc_id_token_json jsonb;
alter table identities3 add column idp_user_json_c jsonb;
alter table identities3 add column idp_username_c varchar;


-- fk ix: idtys_u_idpid_idpuserid
alter table identities3 add constraint idtys_r_idps
    foreign key (site_id, idp_id_c)
    references idps_t (site_id_c, idp_id_c) deferrable;


alter table identities3 add constraint idtys_c_brokenidpsth check (
    length(broken_idp_sth_c) between 1 and 1000);

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


-- Not needed; will match 0 rows. Do anyway, so num_nonnulls(..) = 1 below
-- is guaranteed to work, in case of any old broken row anywhere.
update identities3
    set oid_claimed_id = null
    where
      oid_claimed_id is not null and
      conf_file_idp_id_c is not null;


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



create unique index idtys_u_idpid_idpuserid
    on identities3 (site_id, idp_id_c, idp_user_id_c)
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



-- New notf prefs

alter table page_notf_prefs3 add column pages_pat_created bool;
alter table page_notf_prefs3 add column pages_pat_replied_to bool;

alter table page_notf_prefs3 add constraint
    pagenotfprefs_c_pagespatcreated_true check (pages_pat_created);

alter table page_notf_prefs3 add constraint
    pagenotfprefs_c_pagespatrepliedto_true check (pages_pat_replied_to);

create unique index pagenotfprefs_u_pagespatcreated_patid
    on page_notf_prefs3 (site_id, pages_pat_created, people_id);

create unique index pagenotfprefs_u_pagespatrepliedto_patid
    on page_notf_prefs3 (site_id, pages_pat_replied_to, people_id);

alter table page_notf_prefs3 drop constraint pagenotfprefs_c_for_sth;
alter table page_notf_prefs3 add constraint pagenotfprefs_c_for_sth check(
    num_nonnulls(
            page_id,
            pages_pat_created,
            pages_pat_replied_to,
            pages_in_category_id,
            pages_in_whole_site)
        = 1);

