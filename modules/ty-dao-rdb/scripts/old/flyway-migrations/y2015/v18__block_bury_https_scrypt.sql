
create table dw2_blocks(
  site_id varchar not null,
  block_type varchar,
  blocked_at timestamp not null,
  blocked_till timestamp,
  blocked_by_id int not null,
  ip inet,
  browser_id_cookie varchar,
  constraint dw2_blocks_blockedby__r__users foreign key(site_id, blocked_by_id) references dw1_users(site_id, user_id),
  constraint dw2_blocks_blockedat_till__c check(blocked_at <= blocked_till),
  constraint dw2_blocks__c_something_blocked check(
    browser_id_cookie is not null or ip is not null)
);

create index dw2_blocks_blockedby__i on dw2_blocks(site_id, blocked_by_id);

create unique index dw2_blocks_ip__u on dw2_blocks(site_id, ip)
  where ip is not null;

create unique index dw2_blocks_browseridcookie__u on dw2_blocks(site_id, browser_id_cookie)
  where browser_id_cookie is not null;


create table dw2_audit_log(
  site_id varchar not null,
  audit_id bigint not null,
  doer_id int not null,
  done_at timestamp not null,
  did_what varchar not null,
  details varchar,
  ip inet,
  browser_id_cookie varchar,
  browser_fingerprint int,
  anonymity_network varchar,
  country varchar,
  region varchar,
  city varchar,
  page_id varchar,
  page_role varchar,
  post_id int,
  post_nr int,
  post_action_type int,
  post_action_sub_id int,
  target_page_id varchar,
  target_post_id int,
  target_post_nr int,
  target_user_id int,
  constraint dw2_auditlog__p primary key (site_id, audit_id),
  constraint dw2_auditlog_doer__r__users foreign key (site_id, doer_id) references dw1_users(site_id, user_id),
  constraint dw2_auditlog_targetuser__r__users foreign key (site_id, target_user_id) references dw1_users(site_id, user_id),
  constraint dw2_auditlog__r__posts foreign key (site_id, post_id) references dw2_posts(site_id, unique_post_id),
  constraint dw2_auditlog__r__pages foreign key (site_id, page_id) references dw1_pages(site_id, page_id),
  constraint dw2_auditlog_pagerole_pageid__c check (page_role is null or page_id is not null),
  constraint dw2_auditlog_page_post__c check (post_nr is null or page_id is not null),
  constraint dw2_auditlog_post__c check (post_nr is null = post_id is null),
  constraint dw2_auditlog_postaction__c check (post_action_type is null = post_action_sub_id is null),
  constraint dw2_auditlog_postaction__c2 check (post_action_type is null or post_id is not null),
  constraint dw2_auditlog_tgtpost__c check (target_post_nr is null = target_post_id is null),
  constraint dw2_auditlog_tgtpost_tgtuser__c check (target_post_nr is null or target_user_id is not null),
  constraint dw2_auditlog_tgtpage_tgtuser__c check (target_page_id is null or target_user_id is not null)
);

create index dw2_auditlog_doneat__i on dw2_audit_log(site_id, done_at);
create index dw2_auditlog_doer_doneat__i on dw2_audit_log(site_id, doer_id, done_at);
create index dw2_auditlog_post_doneat__i on dw2_audit_log(site_id, post_id, done_at) where post_id is not null;
create index dw2_auditlog_page_doneat__i on dw2_audit_log(site_id, page_id, done_at) where page_id is not null;
create index dw2_auditlog_ip_doneat__i on dw2_audit_log(site_id, ip, done_at);
create index dw2_auditlog_idcookie_doneat__i on dw2_audit_log(site_id, browser_id_cookie, done_at);
create index dw2_auditlog_fingerprint_doneat__i on dw2_audit_log(site_id, browser_fingerprint, done_at);


-- Fix users table bug.
alter table dw1_users alter email_for_every_new_post set default null;


-- Add Bury and Unwanted vote columns.

alter table dw2_posts add column num_bury_votes int not null default 0;
alter table dw2_posts add column num_unwanted_votes int not null default 0;
alter table dw2_posts drop constraint dw2_posts__c_counts_gez;
alter table dw2_posts add constraint dw2_posts__c_counts_gez check(
  num_distinct_editors >= 0 and
  num_edit_suggestions >= 0 and
  num_pending_flags >= 0 and
  num_handled_flags >= 0 and
  num_like_votes >= 0 and
  num_wrong_votes >= 0 and
  num_bury_votes >= 0 and
  num_unwanted_votes >= 0 and
  num_times_read >= 0);

alter table dw1_pages alter column num_likes set default 0;  -- instead of -1
alter table dw1_pages alter column num_wrongs set default 0; -- instead of -1
alter table dw1_pages add column num_bury_votes int not null default 0;
alter table dw1_pages add column num_unwanted_votes int not null default 0;
alter table dw1_pages add constraint dw1_pages__c_votes_gez check(
  num_likes >= 0 and
  num_wrongs >= 0 and
  num_bury_votes >= 0 and
  num_unwanted_votes >= 0);


-- Remove HTTPS column. All sites will have to either use HTTPS, or none of them.

alter table dw1_tenant_hosts drop column https;


-- Let's use scrypt not bcrypt: delete all bcrypt passwords.

update dw1_users set password_hash = null;

