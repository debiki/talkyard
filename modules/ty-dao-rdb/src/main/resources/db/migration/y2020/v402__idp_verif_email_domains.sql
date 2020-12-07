
alter table idps_t add column email_verified_domains_c varchar;
alter table idps_t add constraint idps_c_emailverifieddomains_len check (
    length(email_verified_domains_c) between 1 and 11000);


alter table idps_t drop constraint idps_c_oauauthreqclaims_len;
alter table idps_t add constraint idps_c_oauauthreqclaims_len check (
    pg_column_size(oau_auth_req_claims) between 1 and 5000);


alter table idps_t rename oau_auth_req_claims
                       to oau_auth_req_claims_c;
alter table idps_t rename oau_auth_req_claims_locales
                       to oau_auth_req_claims_locales_c;
alter table idps_t rename oau_auth_req_ui_locales
                       to oau_auth_req_ui_locales_c;
alter table idps_t rename oau_auth_req_display
                       to oau_auth_req_display_c;
alter table idps_t rename oau_auth_req_prompt
                       to oau_auth_req_prompt_c;
alter table idps_t rename oau_auth_req_max_age
                       to oau_auth_req_max_age_c;
alter table idps_t rename oau_auth_req_access_type
                       to oau_auth_req_access_type_c;
alter table idps_t rename oau_auth_req_include_granted_scopes
                       to oau_auth_req_include_granted_scopes_c;



alter table identities3 add column idp_realm_id_c varchar;
alter table identities3 add constraint idtys_c_idprealmid_len
    check (length(idp_realm_id_c) between 1 and 500);

alter table identities3 add column idp_realm_user_id_c varchar;
alter table identities3 add constraint idtys_c_idprealmuserid_len
    check (length(idp_realm_user_id_c) between 1 and 500);

create unique index idtys_u_idprealmid_idprealmuserid on identities3 (
    site_id, idp_realm_id_c, idp_realm_user_id_c) where idp_realm_id_c is not null;

alter table identities3 add constraint idtys_c_idprealmid_realmuserid_null
    check ((idp_realm_id_c is not null) or (idp_realm_user_id_c is null));



alter table identities3 drop column auth_method;

alter table identities3 rename constraint dw1_ids_ssproviderid__c_len to idtys_c_conffileidpid_len;

alter table identities3 rename constraint idtys_c_brokenidpsth to idtys_c_brokenidpsth_len;

alter table identities3 rename idp_username_c to pref_username_c;
alter table identities3 rename constraint idtys_c_idpusername to idtys_c_prefusername_len;

-- There's idtys_c_idpuserid_len.
alter table identities3 drop constraint dw1_ids_ssuserid__c_len;



alter table identities3 add column issuer_c varchar;
alter table identities3 add constraint idtys_c_issuer_len
    check (length(issuer_c) between 1 and 500);


update identities3 set first_name = null where length(first_name) = 0;
alter table identities3 alter first_name type varchar;
alter table identities3 rename first_name to first_name_c;
alter table identities3 add constraint idtys_c_firstname_len
    check (length(first_name_c) between 1 and 250);

update identities3 set email = null where length(email) = 0;
alter table identities3 alter email type varchar;
alter table identities3 rename email to email_adr_c;
alter table identities3 drop constraint dw1_ids_email__c_len;
alter table identities3 add constraint idtys_c_email_len
    check (length(email_adr_c) between 1 and 250);

update identities3 set country = null where length(country) = 0;
alter table identities3 alter country type varchar;
alter table identities3 rename country to country_c;
alter table identities3 add constraint idtys_c_country_len
    check (length(country_c) between 1 and 250);

alter table identities3 rename cdati to inserted_at_c;

update identities3 set last_name = null where length(last_name) = 0;
alter table identities3 rename last_name to last_name_c;
alter table identities3 drop constraint dw1_ids_lastname__c_len;
alter table identities3 add constraint idtys_c_lastname_len
    check (length(last_name_c) between 1 and 250);

update identities3 set full_name = null where length(full_name) = 0;
alter table identities3 rename full_name to full_name_c;
alter table identities3 drop constraint dw1_ids_fullname__c_len;
alter table identities3 add constraint idtys_c_fullname_len
    check (length(full_name_c) between 1 and 250);

alter table identities3 rename avatar_url to picture_url_c;
alter table identities3 rename constraint identities_c_avatarurl_len
    to idtys_c_pictureurl_len;


alter table identities3 rename oidc_id_token_str to oidc_id_token_str_c;
alter table identities3 rename oidc_id_token_json to oidc_id_token_json_c;


alter table identities3 add column is_email_verified_by_idp_c bool;
alter table identities3 add constraint idtys_c_emailadr_emailverified_null
    check ((email_adr_c is not null) or (is_email_verified_by_idp_c is null));

alter table identities3 add column nickname_c varchar;
alter table identities3 add constraint idtys_c_nickname_len
    check (length(nickname_c) between 1 and 250);

alter table identities3 add column middle_name_c varchar;
alter table identities3 add constraint idtys_c_middlename_len
    check (length(middle_name_c) between 1 and 250);

alter table identities3 add column phone_nr_c varchar;
alter table identities3 add constraint idtys_c_phonenr_len
    check (length(phone_nr_c) between 1 and 250);

alter table identities3 add column is_phone_nr_verified_by_idp_c bool;
alter table identities3 add constraint idtys_c_phonenr_phonenrverified_null
    check ((phone_nr_c is not null) or (is_phone_nr_verified_by_idp_c is null));

alter table identities3 add column profile_url_c varchar;
alter table identities3 add constraint idtys_c_profileurl_len
    check (length(profile_url_c) between 1 and 500);

alter table identities3 add column website_url_c varchar;
alter table identities3 add constraint idtys_c_websiteurl_len
    check (length(website_url_c) between 1 and 500);

alter table identities3 add column gender_c varchar;
alter table identities3 add constraint idtys_c_gender_len
    check (length(gender_c) between 1 and 100);

alter table identities3 add column birthdate_c varchar;
alter table identities3 add constraint idtys_c_birthdate_len
    check (length(birthdate_c) between 1 and 100);

alter table identities3 add column time_zone_info_c varchar;
alter table identities3 add constraint idtys_c_timezoneinfo_len
    check (length(time_zone_info_c) between 1 and 250);

alter table identities3 add column locale_c varchar;
alter table identities3 add constraint idtys_c_locale_len
    check (length(locale_c) between 1 and 250);

alter table identities3 add column is_realm_guest_c bool;


alter table identities3 add column last_updated_at_idp_at_sec_c bigint;
alter table identities3 add constraint idtys_c_lastupdatedatidpatsec_len
    check (last_updated_at_idp_at_sec_c >= 0);


