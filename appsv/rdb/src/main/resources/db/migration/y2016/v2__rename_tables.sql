drop trigger if exists dw1_emails_summary on dw1_emails_out;
drop trigger if exists dw1_identities_summary on dw1_identities;
drop trigger if exists dw1_notfs_summary on dw1_notifications;
drop trigger if exists dw1_pages_summary on dw1_pages;
drop trigger if exists dw1_posts_read_summary on dw1_posts_read_stats;
drop trigger if exists dw1_role_page_settings_summary on dw1_role_page_settings;
drop trigger if exists dw1_roles_summary on dw1_users;
drop trigger if exists dw2_actions_summary on dw2_post_actions;
drop trigger if exists dw2_posts_summary on dw2_posts;
drop trigger if exists sum_post_revs_quota_3 on dw2_post_revisions;

drop function if exists dw1_emails_summary() cascade;
drop function if exists dw1_guests_summary() cascade;
drop function if exists dw1_identities_summary() cascade;
drop function if exists dw1_notfs_summary() cascade;
drop function if exists dw1_pages_summary() cascade;
drop function if exists dw1_posts_read_summary() cascade;
drop function if exists dw1_role_page_settings_summary() cascade;
drop function if exists dw1_roles_summary() cascade;
drop function if exists dw2_post_actions_summary() cascade;
drop function if exists dw2_posts_summary() cascade;
drop function if exists sum_post_revs_quota_3() cascade;


alter table dw1_emails_out rename to emails_out3;
alter table dw1_guest_prefs rename to guest_prefs3;
alter table dw1_identities rename to identities3;
alter table dw1_notifications rename to notifications3;
alter table dw1_page_paths rename to page_paths3;
alter table dw1_pages rename to pages3;
alter table dw1_posts_read_stats rename to post_read_stats3;
alter table dw1_role_page_settings rename to member_page_settings3;
alter table dw1_tenant_hosts rename to hosts3;
alter table dw1_tenants rename to sites3;
alter table dw1_users rename to users3;
alter table dw2_audit_log rename to audit_log3;
alter table dw2_blocks rename to blocks3;
alter table dw2_categories rename to categories3;
alter table dw2_invites rename to invites3;
alter table dw2_page_html rename to page_html3;
alter table dw2_post_actions rename to post_actions3;
alter table dw2_post_revisions rename to post_revisions3;
alter table dw2_posts rename to posts3;
alter table dw2_review_tasks rename to review_tasks3;
alter table dw2_upload_refs rename to upload_refs3;
alter table dw2_uploads rename to uploads3;
alter table message_members_3 rename to page_members3;
alter table settings_3 rename to settings3;


-- Oops. Delete duplicates:

delete from settings3
  where page_id is null and category_id is null and ctid not in (
    select max(s.ctid)
    from settings3 s where s.page_id is null and s.category_id is null
    group by s.site_id);

create unique index settings3_siteid__u on settings3 (site_id)
  where page_id is null and category_id is null;


-- Add temporary simple staff-only permission (& rename column).

alter table categories3 add column staff_only bool not null default false;
alter table categories3 add column only_staff_may_create_topics bool not null default false;
alter table categories3 rename column hide_in_forum to unlisted;


-- Add trust and threat levels.

alter table users3 add column trust_level smallint not null default 1;
alter table users3 add column locked_trust_level smallint;
alter table users3 add column threat_level smallint not null default 3;
alter table users3 add column locked_threat_level smallint;

alter table users3 add constraint users3_trustlevel__c_betw check (trust_level between 1 and 5);
alter table users3 add constraint users3_lockedtrustlevel__c_betw check (locked_trust_level between 1 and 5);
alter table users3 add constraint users3_threatlevel__c_betw check (threat_level between 1 and 6);
alter table users3 add constraint users3_lockedthreatlevel__c_betw check (locked_threat_level between 1 and 6);


-- Save threat level in blocks table, and always save browser id cookie.

alter table blocks3 alter column block_type set data type smallint using 6; -- 6 = totally blocked
alter table blocks3 rename column block_type to threat_level;
alter table blocks3 alter column browser_id_cookie set not null;

drop index dw2_blocks_browseridcookie__u;
create unique index dw2_blocks_browseridcookie__u on blocks3 (site_id, browser_id_cookie)
  where browser_id_cookie is not null and ip is null;


-- Review task resolution.

update review_tasks3 set resolution = 1 where resolution = 100;

