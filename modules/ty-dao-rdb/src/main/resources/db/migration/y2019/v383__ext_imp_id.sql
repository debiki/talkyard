
alter table users3 rename external_id to sso_id;
alter table users3 rename constraint users_c_extid_min_len to pps_c_ssoid_min_len;
alter table users3 rename constraint users_c_extid_max_len to pps_c_ssoid_max_len
alter table users3 rename constraint participants_c_group_no_external_id to pps_c_group_no_sso_id;

alter index users_externalid_u rename to pps_u_ssoid;

alter table users3 add column ext_id varchar default null;
alter table pages3 add column ext_id varchar default null;
alter table posts3 add column ext_id varchar default null;
alter table categories3 add column ext_id varchar default null;

create or replace function is_valid_ext_id(text character varying) returns boolean
  language plpgsql
  as $_$
begin
  -- No whitespace. Max 128 chars (SHA-512 in hex).
  return text ~ '^[^\s]+$' and length(text) between 1 and 128;
end;
$_$;

alter table users3 add constraint pps_c_extid_not_builtin check (
    ext_id is null or not user_id between -9 and 99);
alter table users3 add constraint pps_c_extid_len check (is_valid_ext_id(ext_id));
alter table pages3 add constraint pages_c_extid_len check (is_valid_ext_id(ext_id));
alter table posts3 add constraint posts_c_extid_len check (is_valid_ext_id(ext_id));
alter table categories3 add constraint categories_c_extid_len check (is_valid_ext_id(ext_id));

create unique index users_u_extid on users3 (site_id, ext_id);
create unique index pages_u_extid on pages3 (site_id, ext_id);
create unique index posts_u_extid on posts3 (site_id, ext_id);
create unique index categories_u_extid on categories3 (site_id, ext_id);


drop index users_site_guest_u;

create unique index pps_u_site_guest_no_browser_id on users3 (site_id, full_name, guest_email_addr)
  where guest_browser_id is null;

create unique index pps_u_site_guest_w_browser_id on users3 (
    site_id, full_name, guest_email_addr, guest_browser_id)
  where guest_browser_id is not null;


alter table users3 drop constraint users_c_guest_nn;

update users3 set primary_email_addr = null, password_hash = null
    where user_id < 0 and (primary_email_addr is not null or password_hash is not null);
alter table users3 add constraint pps_c_guest_no_email_pwd check (
    user_id > 0 or (
        primary_email_addr is null and
        password_hash is null));

update users3 set is_admin = null, is_moderator = null, is_owner = null, is_superadmin = null
    where user_id < 0 and (
      -- So won't accidentally insert temp import ids into the database,
-- without remapping to 1 .. 2e9 -1 numbers:

alter table api_secrets3 add constraint apisecrets_c_nr_not_for_imp check (secret_nr < 2000000000);
alter table audit_log3 add constraint auditlog_c_nr_not_for_imp check (audit_id < 2000000000);
alter table categories3 add constraint categories_c_id_not_for_imp check (id < 2000000000);  is_admin is not null or
        is_moderator is not null or
        is_owner is not null or
        is_superadmin is not null);
alter table users3 add constraint pps_c_guest_not_staff check (
    user_id > 0 or (
        is_admin is not true and
        is_moderator is not true and
        is_owner is not true and
        is_superadmin is not true));

alter table users3 rename constraint dw1_users_avatars__c to pps_c_guest_no_avatar;

update users3 set trust_level = null where user_id < 0 and trust_level is not null;
alter table users3 add constraint pps_c_guest_no_trust_level check (
    user_id > 0 or trust_level is null);

alter table users3 add constraint pps_c_guest_not_nulls check (
    user_id > 0 or (
        created_at is not null and
        full_name is not null and
        guest_email_addr is not null));



-- So won't accidentally insert temp import ids into the database,
-- without remapping to 1 .. 2e9 -1 numbers:

alter table api_secrets3 add constraint apisecrets_c_nr_not_for_imp check (secret_nr < 2000000000);
alter table audit_log3 add constraint auditlog_c_nr_not_for_imp check (audit_id < 2000000000);
alter table categories3 add constraint categories_c_id_not_for_imp check (id < 2000000000);
alter table drafts3 add constraint drafts_c_nr_not_for_imp check (draft_nr < 2000000000);
alter table identities3 add constraint identities_c_id_not_for_imp check (id < 2000000000);
alter table notifications3 add constraint notifications_c_id_not_for_imp check (notf_id < 2000000000);
alter table pages3 add constraint pages_c_id_not_for_imp check (page_id not like '200???????');
alter table perms_on_pages3 add constraint permsonpages_c_id_not_for_imp check (perm_id < 2000000000);
alter table post_actions3 add constraint postactions_c_actionid_not_for_imp check (action_id < 2000000000);
alter table post_actions3 add constraint postactions_c_subid_not_for_imp check (sub_id < 2000000000);
alter table post_actions3 add constraint postactions_c_postnr_not_for_imp check (post_nr < 2000000000);
alter table post_revisions3 add constraint postrevisions_c_revnr_not_for_imp check (revision_nr < 2000000000);
alter table posts3 add constraint posts_c_id_not_for_imp check (unique_post_id < 2000000000);
alter table posts3 add constraint posts_c_nr_not_for_imp check (post_nr < 2000000000);
alter table posts3 add constraint posts_c_parentnr_not_for_imp check (parent_nr < 2000000000);
alter table review_tasks3 add constraint reviewtasks_c_id_not_for_imp check (id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postid_not_for_imp check (post_id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postrevnr_not_for_imp check (post_rev_nr < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postnr_not_for_imp check (post_nr < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_authorid_not_for_imp check (author_id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_pageid_not_for_imp check (page_id not like '200???????');

alter table spam_check_queue3 add constraint spamcheckqueue_r_sites foreign key (site_id) references sites3 (id) deferrable;
alter table upload_refs3  add constraint uploadrefs_r_posts foreign key (site_id, post_id) references posts3 (site_id, unique_post_id) deferrable;

alter table users3 add constraint participants_c_member_id_not_for_imp check (user_id < 2000000000);
alter table users3 add constraint participants_c_guest_id_not_for_imp check (user_id > -2000000000);


