
-- Recreate so more_reasons_at and more_reasons_at_rev_nr gets placed next to each other.
-- Also: user_id = not null, rename caused_by_id to created_by_id.
-- Remove dw2_ from constaints and index names.
drop table review_tasks3;
create table review_tasks3 (
    site_id character varying not null,
    id integer not null,
    reasons bigint not null,
    created_by_id integer not null,
    created_at timestamp without time zone not null,
    created_at_rev_nr integer,
    more_reasons_at timestamp without time zone,
    more_reasons_at_rev_nr integer,
    completed_at timestamp without time zone,
    completed_at_rev_nr integer,
    completed_by_id integer,
    invalidated_at timestamp without time zone,
    resolution integer,
    user_id integer not null,
    page_id character varying,
    post_id integer,
    post_nr integer,
    constraint reviewtasks__p primary key (site_id, id),
    constraint reviewtasks__r__pages foreign key (site_id, page_id) references pages3(site_id, page_id),
    constraint reviewtasks__r__posts foreign key (site_id, post_id) references posts3(site_id, unique_post_id),
    constraint reviewtasks_causedbyid__r__users foreign key (site_id, created_by_id) references users3(site_id, user_id),
    constraint reviewtasks_complbyid__r__users foreign key (site_id, completed_by_id) references users3(site_id, user_id),
    constraint reviewtasks_userid__r__users foreign key (site_id, user_id) references users3(site_id, user_id),
    constraint reviewtasks_completed_or_invalidatedat_null__c check (((completed_at is null) or (invalidated_at is null))),
    constraint reviewtasks_completedat_atrevnr__c_nn check (((completed_at is not null) or (completed_at_rev_nr is null))),
    constraint reviewtasks_completedat_by__c_nn check (((completed_at is null) = (completed_by_id is null))),
    constraint reviewtasks_completedat_ge_createdat__c check ((completed_at >= created_at)),
    constraint reviewtasks_completedat_ge_morereasonsat__c check ((completed_at >= more_reasons_at)),
    constraint reviewtasks_invalidatedat_ge_createdat__c check ((invalidated_at >= created_at)),
    constraint reviewtasks_invalidatedat_ge_morereasonsat__c check ((invalidated_at >= more_reasons_at)),
    constraint reviewtasks_morereasonsat_ge_createdat__c check ((more_reasons_at >= created_at)),
    constraint reviewtasks_morereasonsatrevnr_ge_createdrevnr__c check ((more_reasons_at_rev_nr >= created_at_rev_nr)),
    constraint reviewtasks_morereasonsat_revnr__c_n check ((more_reasons_at is not null) or (more_reasons_at_rev_nr is null)),
    constraint reviewtasks_postid_nr__c_n check (((post_id is null) = (post_nr is null))),
    constraint reviewtasks_resolution__c_n check ((((completed_by_id is null) and (invalidated_at is null)) = (resolution is null))),
    constraint reviewtasks_thing__c_nn check (((post_id is not null) or (user_id is not null) or (page_id is not null)))
);

create index reviewtasks_createdat__i on review_tasks3 using btree (site_id, created_at desc);
create index reviewtasks_createdbyid__i on review_tasks3 using btree (site_id, created_by_id);
create index reviewtasks_completedbyid__i on review_tasks3 using btree (site_id, completed_by_id)
  where (completed_by_id is not null);

create index reviewtasks_open_createdat__i on review_tasks3 using btree (site_id, created_at desc)
  where (resolution is null);

create unique index reviewtasks_open_createdby_postid__u on review_tasks3 using btree (site_id, created_by_id, post_id)
  where ((post_id is not null) and (resolution is null));

create unique index reviewtasks_open_createdby_userid__u on review_tasks3 using btree (site_id, created_by_id, user_id)
  where ((post_id is null) and (resolution is null));

create index reviewtasks_pageid__i on review_tasks3 using btree (site_id, page_id) where (page_id is not null);
create index reviewtasks_postid__i on review_tasks3 using btree (site_id, post_id) where (post_id is not null);
create index reviewtasks_userid__i on review_tasks3 using btree (site_id, user_id) where (user_id is not null);

-----

alter table settings3 add column num_flags_to_hide_post int;
alter table settings3 add column cooldown_minutes_after_flagged_hidden int;

alter table settings3 add column num_flags_to_block_new_user int;
alter table settings3 add column num_flaggers_to_block_new_user int;
alter table settings3 add column notify_mods_if_user_blocked boolean;

alter table settings3 add column regular_member_flag_weight real;
alter table settings3 add column core_member_flag_weight real;


alter table settings3 drop constraint settings3_only_for_site__c;

alter table settings3 add constraint settings3_only_for_site__c check (
  category_id is null and
  page_id is null
  or
  user_must_be_auth is null and
  user_must_be_approved is null and
  allow_guest_login is null and
  num_first_posts_to_review is null and
  num_first_posts_to_approve is null and
  num_first_posts_to_allow is null and
  org_domain is null and
  org_full_name is null and
  org_short_name is null and
  contrib_agreement is null and
  content_license is null and
  google_analytics_id is null and
  experimental is null and
  many_sections is null and
  num_flags_to_hide_post is null and
  cooldown_minutes_after_flagged_hidden is null and
  num_flags_to_block_new_user is null and
  num_flaggers_to_block_new_user is null and
  notify_mods_if_user_blocked is null and
  regular_member_flag_weight is null and
  core_member_flag_weight is null);

alter table settings3 add constraint settings3_flags__c_gez check (
  num_flags_to_hide_post >= 0 and
  cooldown_minutes_after_flagged_hidden >= 0 and
  num_flags_to_block_new_user >= 0 and
  num_flaggers_to_block_new_user >= 0);

alter table settings3 add constraint settings3_flag_weight__c_ge check (
  regular_member_flag_weight >= 1.0 and
  core_member_flag_weight >= regular_member_flag_weight);

