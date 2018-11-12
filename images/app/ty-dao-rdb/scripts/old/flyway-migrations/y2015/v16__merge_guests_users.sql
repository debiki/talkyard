
alter table dw1_ids_openid drop constraint dw1_idsoid_usr_tnt__r__users;
alter table dw1_emails_out drop constraint dw1_emlot__r__roles;
alter table dw1_emails_out drop constraint dw1_emlot__r__guests;
alter table dw1_role_page_settings drop constraint dw1_ropgst_site_role__r__roles;

alter table dw1_emails_out add column to_user_id int;
update dw1_emails_out set to_user_id = to_role_id::int;
update dw1_emails_out set to_user_id = -to_guest_id::int where to_user_id is null;
update dw1_emails_out set to_user_id = to_user_id + 90 where to_user_id >= 0;
alter table dw1_emails_out drop column to_guest_id;
alter table dw1_emails_out drop column to_role_id;

alter table dw1_guests alter column id type int using (-id::int);

alter table dw1_ids_openid rename column usr to user_id;
alter table dw1_ids_openid alter column user_id type int using (user_id::int);
update dw1_ids_openid set user_id = user_id + 90 where user_id >= 0;

alter table dw1_ids_openid rename column usr_orig to user_id_orig;
alter table dw1_ids_openid alter column user_id_orig type int using (user_id_orig::int);
update dw1_ids_openid set user_id_orig = user_id_orig + 90 where user_id_orig >= 0;

alter table dw1_notifications alter column by_user_id type int using (by_user_id::int);
update dw1_notifications set by_user_id = by_user_id + 90 where by_user_id >= 0;

alter table dw1_notifications alter column to_user_id type int using (to_user_id::int);
update dw1_notifications set to_user_id = to_user_id + 90 where to_user_id >= 0;

update dw1_pages set author_id = author_id + 90 where author_id >= 0;
alter table dw1_pages alter column deleted_by_id type int using (deleted_by_id::int);
update dw1_pages set deleted_by_id = deleted_by_id + 90 where deleted_by_id >= 0;

drop rule dw1_pstsrd_ignore_dupl_ins on dw1_posts_read_stats;
alter table dw1_posts_read_stats alter column user_id type int using (user_id::int);
update dw1_posts_read_stats set user_id = user_id + 90 where user_id >= 0;
create or replace rule dw1_pstsrd_ignore_dupl_ins as
  on insert to dw1_posts_read_stats
  where exists (
      select 1 from dw1_posts_read_stats
      where site_id = new.site_id
        and page_id = new.page_id
        and post_id = new.post_id
        and (user_id = new.user_id or ip = new.ip))
   do instead nothing;

alter table dw1_role_page_settings alter column role_id type int using (role_id::int);
update dw1_role_page_settings set role_id = role_id + 90 where role_id >= 0;

alter table dw1_users rename column sno to user_id;
alter table dw1_users alter column user_id type int using (user_id::int);
update dw1_users set user_id = user_id + 90 where user_id >= 0;

update dw2_post_actions set created_by_id = created_by_id + 90 where created_by_id >= 0;
update dw2_post_actions set deleted_by_id = deleted_by_id + 90 where deleted_by_id >= 0;

update dw2_posts set created_by_id = created_by_id + 90 where created_by_id >= 0;
update dw2_posts set last_edited_by_id = last_edited_by_id + 90 where last_edited_by_id >= 0;
update dw2_posts set last_approved_edit_by_id = last_approved_edit_by_id + 90 where last_approved_edit_by_id >= 0;
update dw2_posts set approved_by_id = approved_by_id + 90 where approved_by_id >= 0;
update dw2_posts set collapsed_by_id = collapsed_by_id + 90 where collapsed_by_id >= 0;
update dw2_posts set closed_by_id = closed_by_id + 90 where closed_by_id >= 0;
update dw2_posts set hidden_by_id = hidden_by_id + 90 where hidden_by_id >= 0;
update dw2_posts set deleted_by_id = deleted_by_id + 90 where deleted_by_id >= 0;
update dw2_posts set pinned_by_id = pinned_by_id + 90 where pinned_by_id >= 0;


-- Copy from dw1_guests to dw1_users:

-- user id >= 100 = authenticated user, -1 = system, -2 = totally anonymous, -3 = unknown,
-- <= -10 = a guest.

alter table dw1_users add column guest_cookie varchar;
alter table dw1_users add constraint dw1_users_guestcookie__c_len check (
    length(guest_cookie) < 30);

alter table dw1_users alter column created_at drop not null;

alter table dw1_users drop constraint dw1_users_email__c;
alter table dw1_users add constraint dw1_users_email__c check (email ~~ '%@%.%' or user_id < -1);

-- Forbid id 0. Reserve 1..99 for hard coded group ids, in case I include groups in this table
-- in the future.
alter table dw1_users add constraint dw1_users_id__c check (user_id < 0 or 100 <= user_id);

drop index dw1_users_site_email__u;
create unique index dw1_users_site_email__u on dw1_users(site_id, email) where user_id >= -1;

create unique index dw1_user_guest__u on dw1_users(site_id, display_name, email, guest_cookie)
    where user_id < -1;

create index dw1_user_guestcookie__i on dw1_users(site_id, guest_cookie) where user_id < -1;
create index dw1_user_guestemail__i on dw1_users(site_id, email) where user_id < -1;

create sequence temp_guest_cookie_seq start with 1001;
insert into dw1_users(site_id, user_id, display_name, email, guest_cookie)
    select site_id, id::int, name, email_addr, 'G' || nextval('temp_guest_cookie_seq') from dw1_guests;
drop sequence temp_guest_cookie_seq;

-- The unknown user shouldn't have any authenticated-user-data.
update dw1_users set email = '-', guest_cookie = 'UU',
    username = null, created_at = null
    where user_id = -3;

alter table dw1_users drop constraint dw1_users_sno_not_0__c;
alter table dw1_users alter column email_for_every_new_post drop not null;

update dw1_users set email_for_every_new_post = null
    where user_id < -1;


-- Add foreign keys.

-- ix index dw2_emlot_touser__i
alter table dw1_emails_out add constraint dw1_emlot__r__users foreign key (
    site_id, to_user_id) references dw1_users(site_id, user_id);

create index dw2_emlot_touser__i on dw1_emails_out(site_id, to_user_id);


-- ix dw1_idsoid_tnt_usr
alter table dw1_ids_openid add constraint dw1_ids_userid__r__users foreign key (
    site_id, user_id) references dw1_users(site_id, user_id);
-- skip index
alter table dw1_ids_openid add constraint dw1_ids_useridorig__r__users foreign key (
    site_id, user_id_orig) references dw1_users(site_id, user_id);


-- ix: dw2_ntfs_byuserid__i
alter table dw1_notifications add constraint dw1_ntfs_byuserid__r__users foreign key (
    site_id, by_user_id) references dw1_users(site_id, user_id);
-- ix: dw2_ntfs_touserid__i
alter table dw1_notifications add constraint dw1_ntfs_touserid__r__users foreign key (
    site_id, to_user_id) references dw1_users(site_id, user_id);

-- create index dw2_ntfs_byuserid__i on dw1_notifications(site_id, by_user_id);
create index dw2_ntfs_touserid__i on dw1_notifications(site_id, to_user_id);


-- ix: dw2_pages_createdby__i
alter table dw1_pages add constraint dw1_pages_createdbyid__r__users foreign key (
    site_id, author_id) references dw1_users(site_id, user_id);
-- ix: dw2_pages_deletedby__i
alter table dw1_pages add constraint dw1_pages_deletedbyid__r__users foreign key (
    site_id, deleted_by_id) references dw1_users(site_id, user_id);

create index dw2_pages_createdby__i on dw1_pages(site_id, author_id);
create index dw2_pages_deletedby__i on dw1_pages(site_id, deleted_by_id) where deleted_by_id is not null;


-- ix: dw1_pstsrd_user__i
alter table dw1_posts_read_stats add constraint dw1_pstsrd__r__users foreign key (
    site_id, user_id) references dw1_users(site_id, user_id);
-- Skip index.
-- create index dw1_pstsrd_user__i on dw1_posts_read_stats(site_id, user_id);


-- ix dw1_ropgst_site_role_page__p
alter table dw1_role_page_settings add constraint dw1_ropgst__r__users foreign key (
    site_id, role_id) references dw1_users(site_id, user_id);


alter table dw2_post_actions add constraint dw2_postacs_createdbyid__r__users foreign key (
    site_id, created_by_id) references dw1_users(site_id, user_id);
alter table dw2_post_actions add constraint dw2_postacs_deletedbyid__r__users foreign key (
    site_id, deleted_by_id) references dw1_users(site_id, user_id);

create index dw2_postacs_createdby__i on dw2_post_actions(site_id, created_by_id);
create index dw2_postacs_deletedby__i on dw2_post_actions(site_id, deleted_by_id) where deleted_by_id is not null;


alter table dw2_posts add constraint dw2_posts_createdbyid__r__users foreign key (
    site_id, created_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_lasteditedbyid__r__users foreign key (
    site_id, last_edited_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_lastapprovededitbyid__r__users foreign key (
    site_id, last_approved_edit_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_approvedbyid__r__users foreign key (
    site_id, approved_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_collapsedbyid__r__users foreign key (
    site_id, collapsed_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_closedbyid__r__users foreign key (
    site_id, closed_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_hiddenbyid__r__users foreign key (
    site_id, hidden_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_deletedbyid__r__users foreign key (
    site_id, deleted_by_id) references dw1_users(site_id, user_id);
alter table dw2_posts add constraint dw2_posts_pinnedbyid__r__users foreign key (
    site_id, pinned_by_id) references dw1_users(site_id, user_id);

create index dw2_posts_createdby__i on dw2_posts(site_id, created_by_id);
create index dw2_posts_lasteditedbyid__i on dw2_posts(site_id, last_edited_by_id) where last_edited_by_id is not null;
create index dw2_posts_lastapprovededitbyid__i on dw2_posts(site_id, last_approved_edit_by_id) where last_approved_edit_by_id is not null;
create index dw2_posts_approvedbyid__i on dw2_posts(site_id, approved_by_id) where approved_by_id is not null;
create index dw2_posts_collapsedbyid__i on dw2_posts(site_id, collapsed_by_id) where collapsed_by_id is not null;
create index dw2_posts_closedbyid__i on dw2_posts(site_id, closed_by_id) where closed_by_id is not null;
create index dw2_posts_hiddenbyid__i on dw2_posts(site_id, hidden_by_id) where hidden_by_id is not null;
create index dw2_posts_deletedbyid__i on dw2_posts(site_id, deleted_by_id) where deleted_by_id is not null;
create index dw2_posts_pinnedbyid__i on dw2_posts(site_id, pinned_by_id) where pinned_by_id is not null;


-- Change identity id from text to int, but in one table only right now
-- (because using text email ids).

alter table dw1_ids_openid rename sno to id;
alter table dw1_ids_openid alter id type int using (id::int);


-- Rename some stuff.

alter table dw1_ids_simple_email rename to dw1_guest_prefs;
alter table dw1_ids_openid rename to dw1_identities;


-- No longer needed.

drop sequence dw1_ids_sno;
drop sequence dw1_users_sno;
drop table dw1_guests;
drop table dw0_version;


-- Usernames to all authenticated users

update dw1_users set username = 'user_' || user_id
  where username is null and user_id >= -1;


-- Approved and suspended columns.

alter table dw1_users add column is_approved boolean;
alter table dw1_users add column approved_at timestamp;
alter table dw1_users add column approved_by_id int;
alter table dw1_users add column suspended_at timestamp;
alter table dw1_users add column suspended_till timestamp;
alter table dw1_users add column suspended_by_id int;
alter table dw1_users add column suspended_reason varchar;
alter table dw1_users add column updated_at timestamp;

alter table dw1_users add constraint dw1_users_approvedbyid__r__users foreign key (
    site_id, approved_by_id) references dw1_users(site_id, user_id);

create index dw1_users_approvedbyid__i on dw1_users(site_id, approved_by_id)
    where approved_by_id is not null;

alter table dw1_users add constraint dw1_users_approved__c_null check(
    approved_by_id is null = approved_at is null and (
        is_approved is null or approved_by_id is not null));

alter table dw1_users add constraint dw1_users_suspendebyid__r__users foreign key (
    site_id, suspended_by_id) references dw1_users(site_id, user_id);

create index dw1_users_suspendebyid__i on dw1_users(site_id, suspended_by_id)
    where suspended_by_id is not null;

alter table dw1_users add constraint dw1_users_suspended__c_null check(
    suspended_by_id is null = suspended_at is null and
    suspended_by_id is null = suspended_till is null and
    suspended_by_id is null = suspended_reason is null);

alter table dw1_users add constraint dw1_users_suspreason__c_len check(
    length(suspended_reason) <= 255);


-- Is-admin and is-moderator columns.

alter table dw1_users rename superadmin to is_admin;
alter table dw1_users add is_moderator boolean default null;
alter table dw1_users add is_editor boolean default null;

update dw1_users set created_at = now_utc() where created_at is null;


-- Guset and non-guest checks.

alter table dw1_users add constraint dw1_users_guest__c_nn check (
    user_id >= -1 or (
        created_at is not null and
        display_name is not null and
        email is not null and
        guest_cookie is not null));

alter table dw1_users add constraint dw1_users_guest__c_nulls check (
    user_id >= -1 or (
        is_approved is null and
        approved_at is null and
        approved_by_id is null and
        suspended_at is null and
        suspended_till is null and
        suspended_by_id is null and
        country is null and
        website is null and
        is_owner is null and
        is_admin is null and
        is_moderator is null and
        is_editor is null and
        username is null and
        email_notfs is null and
        email_verified_at is null and
        password_hash is null and
        email_for_every_new_post is null));

alter table dw1_users add constraint dw1_users_auth__c_nulls check (
    user_id < -1 or (
        guest_cookie is null));

alter table dw1_users add constraint dw1_users_auth__c_notnulls check (
    user_id < -1 or (
        created_at is not null and
        username is not null and
        email_for_every_new_post is not null));

drop index dw1_users_site_username__u;
create unique index dw1_users_site_usernamelower__u on dw1_users(site_id, lower(username));
