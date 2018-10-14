-- Change site_id from varchar to integer
----------------------------------------------------

drop table member_page_settings3;
drop table page_members3;

-- Drop all foreign keys
alter table audit_log3 drop constraint dw2_auditlog__r__pages;
alter table audit_log3 drop constraint dw2_auditlog__r__posts;
alter table audit_log3 drop constraint dw2_auditlog_doer__r__users;
alter table audit_log3 drop constraint dw2_auditlog_targetuser__r__users;
alter table blocks3 drop constraint dw2_blocks_blockedby__r__users;
alter table categories3 drop constraint cats_defaultcat__r__cats;
alter table categories3 drop constraint dw2_cats__r__cats;
alter table categories3 drop constraint dw2_cats_page__r__pages;
alter table category_notf_levels3 drop constraint catnotflvl__r__users;
alter table dw1_settings drop constraint dw1_stngs_pageid__r__pages;
alter table emails_out3 drop constraint dw1_emlot__r__users;
alter table hosts3 drop constraint dw1_tnthsts__r__tenants;
alter table identities3 drop constraint dw1_ids_userid__r__users;
alter table identities3 drop constraint dw1_ids_useridorig__r__users;
alter table invites3 drop constraint dw2_invites_inviter__r__users;
alter table invites3 drop constraint dw2_invites_user__r__users;
alter table notifications3 drop constraint dw1_ntfs__r__emails;
alter table notifications3 drop constraint dw1_ntfs__r__pages;
alter table notifications3 drop constraint dw1_ntfs__r__postacs;
alter table notifications3 drop constraint dw1_ntfs__r__sites;
alter table notifications3 drop constraint dw1_ntfs_byuserid__r__users;
alter table notifications3 drop constraint dw1_ntfs_postid__r__posts;
alter table notifications3 drop constraint dw1_ntfs_touserid__r__users;
alter table page_html3 drop constraint dw2_pagehtml__r__pages;
alter table page_paths3 drop constraint dw1_pgpths_tnt_pgid__r__pages;
alter table page_users3 drop constraint pageusers_joinedby_r_users;
alter table page_users3 drop constraint pageusers_kickedby_r_users;
alter table page_users3 drop constraint pageusers_page_r_pages;
alter table page_users3 drop constraint pageusers_user_r_users;
alter table pages3 drop constraint dw1_pages__r__tenant;
alter table pages3 drop constraint dw1_pages_category__r__categories;
alter table pages3 drop constraint dw1_pages_createdbyid__r__users;
alter table pages3 drop constraint dw1_pages_frequentposter1id__r__users;
alter table pages3 drop constraint dw1_pages_frequentposter2id__r__users;
alter table pages3 drop constraint dw1_pages_frequentposter3id__r__users;
alter table pages3 drop constraint dw1_pages_frequentposter4id__r__users;
alter table pages3 drop constraint dw1_pages_lastreplybyid__r__users;
alter table post_actions3 drop constraint dw2_postacs__r__posts;
alter table post_actions3 drop constraint dw2_postacs_createdbyid__r__users;
alter table post_actions3 drop constraint dw2_postacs_deletedbyid__r__users;
alter table post_read_stats3 drop constraint dw1_pstsrd__r__posts;
alter table post_read_stats3 drop constraint dw1_pstsrd__r__users;
alter table post_revisions3 drop constraint dw2_postrevs_approvedby__r__users;
alter table post_revisions3 drop constraint dw2_postrevs_composedby__r__users;
alter table post_revisions3 drop constraint dw2_postrevs_hiddenby__r__users;
alter table post_revisions3 drop constraint dw2_postrevs_postid__r__posts;
alter table post_revisions3 drop constraint dw2_postrevs_prevnr_r__postrevs;
alter table post_tags3 drop constraint posttags__r__posts;
alter table posts3 drop constraint dw2_posts__r__pages;
alter table posts3 drop constraint dw2_posts_approvedbyid__r__users;
alter table posts3 drop constraint dw2_posts_closedbyid__r__users;
alter table posts3 drop constraint dw2_posts_collapsedbyid__r__users;
alter table posts3 drop constraint dw2_posts_createdbyid__r__users;
alter table posts3 drop constraint dw2_posts_deletedbyid__r__users;
alter table posts3 drop constraint dw2_posts_hiddenbyid__r__users;
alter table posts3 drop constraint dw2_posts_lastapprovededitbyid__r__users;
alter table posts3 drop constraint dw2_posts_lasteditedbyid__r__users;
alter table posts3 drop constraint dw2_posts_pinnedbyid__r__users;
alter table review_tasks3 drop constraint reviewtasks__r__pages;
alter table review_tasks3 drop constraint reviewtasks__r__posts;
alter table review_tasks3 drop constraint reviewtasks_causedbyid__r__users;
alter table review_tasks3 drop constraint reviewtasks_complbyid__r__users;
alter table review_tasks3 drop constraint reviewtasks_userid__r__users;
alter table settings3 drop constraint settings3_cat__r__cats;
alter table settings3 drop constraint settings3_page__r__pages;
alter table settings3 drop constraint settings3_site__r__sites;
alter table tag_notf_levels3 drop constraint tagnotflvl__r__users;
alter table upload_refs3 drop constraint dw2_uploadrefs__r__users;
alter table user_stats3 drop constraint userstats_r_people;
alter table user_visit_stats3 drop constraint uservisitstats_r_people;
alter table usernames3 drop constraint usernames_r_users;
alter table users3 drop constraint dw1_users__r__tenant;
alter table users3 drop constraint dw1_users_approvedbyid__r__users;
alter table users3 drop constraint dw1_users_suspendebyid__r__users;

-- Delete all text ids (cannot be converted to int). There's just one: 'test_...'.
delete from audit_log3 where site_id like 'test_%';
delete from audit_log3 where target_site_id like 'test_%';
delete from blocks3 where site_id like 'test_%';
delete from categories3 where site_id like 'test_%';
delete from category_notf_levels3 where site_id like 'test_%';
delete from dw1_settings where site_id like 'test_%';
delete from emails_out3 where site_id like 'test_%';
delete from guest_prefs3 where site_id like 'test_%';
delete from hosts3 where site_id like 'test_%';
delete from identities3 where site_id like 'test_%';
delete from index_queue3 where site_id like 'test_%';
delete from invites3 where site_id like 'test_%';
delete from notifications3 where site_id like 'test_%';
delete from page_html3 where site_id like 'test_%';
delete from page_paths3 where site_id like 'test_%';
delete from page_users3 where site_id like 'test_%';
delete from pages3 where site_id like 'test_%';
delete from post_actions3 where site_id like 'test_%';
delete from post_read_stats3 where site_id like 'test_%';
delete from post_revisions3 where site_id like 'test_%';
delete from post_tags3 where site_id like 'test_%';
delete from posts3 where site_id like 'test_%';
delete from review_tasks3 where site_id like 'test_%';
delete from settings3 where site_id like 'test_%';
delete from sites3 where id like 'test_%';
delete from spam_check_queue3 where site_id like 'test_%';
delete from tag_notf_levels3 where site_id like 'test_%';
delete from upload_refs3 where site_id like 'test_%';
delete from user_stats3 where site_id like 'test_%';
delete from user_visit_stats3 where site_id like 'test_%';
delete from usernames3 where site_id like 'test_%';
delete from users3 where site_id like 'test_%';

-- There's just this one and only rule. Will use 'on update do ...' instead.
drop rule dw1_pstsrd_ignore_dupl_ins on post_read_stats3;

-- Convert to integer.
alter table audit_log3 alter column site_id type int using (site_id::int);
alter table audit_log3 alter column target_site_id type int using (target_site_id::int);
alter table blocks3 alter column site_id type int using (site_id::int);
alter table categories3 alter column site_id type int using (site_id::int);
alter table category_notf_levels3 alter column site_id type int using (site_id::int);
alter table emails_out3 alter column site_id type int using (site_id::int);
alter table guest_prefs3 alter column site_id type int using (site_id::int);
alter table hosts3 alter column site_id type int using (site_id::int);
alter table identities3 alter column site_id type int using (site_id::int);
alter table index_queue3 alter column site_id type int using (site_id::int);
alter table invites3 alter column site_id type int using (site_id::int);
alter table notifications3 alter column site_id type int using (site_id::int);
alter table page_html3 alter column site_id type int using (site_id::int);
alter table page_paths3 alter column site_id type int using (site_id::int);
alter table page_users3 alter column site_id type int using (site_id::int);
alter table pages3 alter column site_id type int using (site_id::int);
alter table post_actions3 alter column site_id type int using (site_id::int);
alter table post_read_stats3 alter column site_id type int using (site_id::int);
alter table post_revisions3 alter column site_id type int using (site_id::int);
alter table post_tags3 alter column site_id type int using (site_id::int);
alter table posts3 alter column site_id type int using (site_id::int);
alter table review_tasks3 alter column site_id type int using (site_id::int);
alter table settings3 alter column site_id type int using (site_id::int);
alter table sites3 alter column id type int using (id::int);
alter table spam_check_queue3 alter column site_id type int using (site_id::int);
alter table tag_notf_levels3 alter column site_id type int using (site_id::int);
alter table upload_refs3 alter column site_id type int using (site_id::int);
-- uploads3 doesn't have a site_id column.
alter table user_stats3 alter column site_id type int using (site_id::int);
alter table user_visit_stats3 alter column site_id type int using (site_id::int);
alter table usernames3 alter column site_id type int using (site_id::int);
alter table users3 alter column site_id type int using (site_id::int);

-- Add back foreign keys.
alter table audit_log3 add constraint auditlog_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table audit_log3 add constraint auditlog_r_posts foreign key (site_id, post_id) references posts3(site_id, unique_post_id) deferrable;
alter table audit_log3 add constraint auditlog_doer_r_people foreign key (site_id, doer_id) references users3(site_id, user_id) deferrable;
alter table audit_log3 add constraint auditlog_targetuser_r_people foreign key (site_id, target_user_id) references users3(site_id, user_id) deferrable;
alter table blocks3 add constraint blocks_blockedby_r_people foreign key (site_id, blocked_by_id) references users3(site_id, user_id) deferrable;
alter table categories3 add constraint cats_defaultcat_r_cats foreign key (site_id, default_category_id) references categories3(site_id, id) on update cascade on delete cascade deferrable;
alter table categories3 add constraint cats_r_cats foreign key (site_id, parent_id) references categories3(site_id, id) deferrable;
alter table categories3 add constraint cats_page_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table category_notf_levels3 add constraint catnotflvl_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table emails_out3 add constraint emlot_r_people foreign key (site_id, to_user_id) references users3(site_id, user_id) deferrable;
alter table hosts3 add constraint hosts_r_sites foreign key (site_id) references sites3(id) deferrable;
alter table identities3 add constraint ids_user_users foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table identities3 add constraint ids_useridorig_r_people foreign key (site_id, user_id_orig) references users3(site_id, user_id) deferrable;
alter table invites3 add constraint invites_inviter_r_people foreign key (site_id, created_by_id) references users3(site_id, user_id) deferrable;
alter table invites3 add constraint invites_user_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table notifications3 add constraint ntfs_r_emails foreign key (site_id, email_id) references emails_out3(site_id, id) deferrable;
alter table notifications3 add constraint ntfs_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table notifications3 add constraint ntfs_r_postacs foreign key (site_id, unique_post_id, action_type, by_user_id, action_sub_id) references post_actions3(site_id, unique_post_id, type, created_by_id, sub_id) deferrable;
alter table notifications3 add constraint ntfs_r_sites foreign key (site_id) references sites3(id) deferrable;
alter table notifications3 add constraint ntfs_byuser_r_people foreign key (site_id, by_user_id) references users3(site_id, user_id) deferrable;
alter table notifications3 add constraint ntfs_post_r_posts foreign key (site_id, unique_post_id) references posts3(site_id, unique_post_id) deferrable;
alter table notifications3 add constraint ntfs_touser_r_people foreign key (site_id, to_user_id) references users3(site_id, user_id) deferrable;
alter table page_html3 add constraint pagehtml_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table page_paths3 add constraint pgpths_page_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table page_users3 add constraint pageusers_joinedby_r_people foreign key (site_id, joined_by_id) references users3(site_id, user_id) deferrable;
alter table page_users3 add constraint pageusers_kickedby_r_people foreign key (site_id, kicked_by_id) references users3(site_id, user_id) deferrable;
alter table page_users3 add constraint pageusers_page_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table page_users3 add constraint pageusers_user_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_r_sites foreign key (site_id) references sites3(id) deferrable;
alter table pages3 add constraint pages_category_r_categories foreign key (site_id, category_id) references categories3(site_id, id) deferrable;
alter table pages3 add constraint pages_createdby_r_people foreign key (site_id, author_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_frequentposter1_r_people foreign key (site_id, frequent_poster_1_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_frequentposter2_r_people foreign key (site_id, frequent_poster_2_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_frequentposter3_r_people foreign key (site_id, frequent_poster_3_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_frequentposter4_r_people foreign key (site_id, frequent_poster_4_id) references users3(site_id, user_id) deferrable;
alter table pages3 add constraint pages_lastreplyby_r_people foreign key (site_id, last_reply_by_id) references users3(site_id, user_id) deferrable;
alter table post_actions3 add constraint postacs_r_posts foreign key (site_id, unique_post_id) references posts3(site_id, unique_post_id) deferrable;
alter table post_actions3 add constraint postacs_createdby_r_people foreign key (site_id, created_by_id) references users3(site_id, user_id) deferrable;
alter table post_actions3 add constraint postacs_deletedby_r_people foreign key (site_id, deleted_by_id) references users3(site_id, user_id) deferrable;
alter table post_read_stats3 add constraint pstsrd_r_posts foreign key (site_id, page_id, post_nr) references posts3(site_id, page_id, post_nr) deferrable;
alter table post_read_stats3 add constraint pstsrd_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table post_revisions3 add constraint postrevs_approvedby_r_people foreign key (site_id, approved_by_id) references users3(site_id, user_id) deferrable;
alter table post_revisions3 add constraint postrevs_composedby_r_people foreign key (site_id, composed_by_id) references users3(site_id, user_id) deferrable;
alter table post_revisions3 add constraint postrevs_hiddenby_r_people foreign key (site_id, hidden_by_id) references users3(site_id, user_id) deferrable;
alter table post_revisions3 add constraint postrevs_post_r_posts foreign key (site_id, post_id) references posts3(site_id, unique_post_id) deferrable;
alter table post_revisions3 add constraint postrevs_prevnr_r__postrevs foreign key (site_id, post_id, previous_nr) references post_revisions3(site_id, post_id, revision_nr) deferrable;
alter table post_tags3 add constraint posttags_r_posts foreign key (site_id, post_id) references posts3(site_id, unique_post_id) deferrable;
alter table posts3 add constraint posts_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table posts3 add constraint posts_approvedby_r_people foreign key (site_id, approved_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_closedby_r_people foreign key (site_id, closed_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_collapsedby_r_people foreign key (site_id, collapsed_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_createdby_r_people foreign key (site_id, created_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_deletedby_r_people foreign key (site_id, deleted_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_hiddenby_r_people foreign key (site_id, hidden_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_lastapprovededitby_r_people foreign key (site_id, last_approved_edit_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_lasteditedby_r_people foreign key (site_id, curr_rev_by_id) references users3(site_id, user_id) deferrable;
alter table posts3 add constraint posts_pinnedby_r_people foreign key (site_id, pinned_by_id) references users3(site_id, user_id) deferrable;
alter table review_tasks3 add constraint reviewtasks_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table review_tasks3 add constraint reviewtasks_r_posts foreign key (site_id, post_id) references posts3(site_id, unique_post_id) deferrable;
alter table review_tasks3 add constraint reviewtasks_causedby_r_people foreign key (site_id, created_by_id) references users3(site_id, user_id) deferrable;
alter table review_tasks3 add constraint reviewtasks_complby_r_people foreign key (site_id, completed_by_id) references users3(site_id, user_id) deferrable;
alter table review_tasks3 add constraint reviewtasks_user_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table settings3 add constraint settings_cat_r_cats foreign key (site_id, category_id) references categories3(site_id, id) deferrable;
alter table settings3 add constraint settings_page_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable;
alter table settings3 add constraint settings_site_r_sites foreign key (site_id) references sites3(id) deferrable;
alter table tag_notf_levels3 add constraint tagnotflvl_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table upload_refs3 add constraint uploadrefs_r_people foreign key (site_id, added_by_id) references users3(site_id, user_id) deferrable;
alter table user_stats3 add constraint userstats_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table user_visit_stats3 add constraint uservisitstats_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table usernames3 add constraint usernames_r_people foreign key (site_id, user_id) references users3(site_id, user_id) deferrable;
alter table users3 add constraint users_r_sites foreign key (site_id) references sites3(id) deferrable;
alter table users3 add constraint users_approvedby_r_people foreign key (site_id, approved_by_id) references users3(site_id, user_id) deferrable;
alter table users3 add constraint users_suspendeby_r_people foreign key (site_id, suspended_by_id) references users3(site_id, user_id) deferrable;


-- Create permissions table
----------------------------------------------------

create or replace function one_unless_null(anyValue int) returns integer
language plpgsql immutable strict
as $$
begin
  if anyValue is null then
    return 0;
  end if;
  return 1;
end;
$$;


create or replace function one_unless_null(anyBool boolean) returns integer
language plpgsql immutable strict
as $$
begin
  if anyBool is null then
    return 0;
  end if;
  return 1;
end;
$$;


create or replace function one_unless_null(anyVarchar varchar) returns integer
language plpgsql immutable strict
as $$
begin
  if anyVarchar is null then
    return 0;
  end if;
  return 1;
end;
$$;


create table perms_on_pages3(
  site_id int not null,
  perm_id int not null,
  for_people_id int not null,
  on_whole_site boolean,
  on_category_id int,
  on_page_id varchar,
  on_post_id int,
  on_tag_id int,
  may_edit_page boolean,
  may_edit_comment boolean,
  may_edit_wiki boolean,
  may_edit_own boolean,
  may_delete_page boolean,
  may_delete_comment boolean,
  may_create_page boolean,
  may_post_comment boolean,
  may_see boolean,
  may_see_own boolean,
  may_see_private_flagged boolean,
  constraint permsonpages_p primary key (site_id, perm_id),
  constraint permsonpages_r_people foreign key (site_id, for_people_id)
    references users3 (site_id, user_id),
  constraint permsonpages_r_cats foreign key (site_id, on_category_id)
    references categories3 (site_id, id),
  constraint permsonpages_r_pages foreign key (site_id, on_page_id)
    references pages3 (site_id, page_id),
  constraint permsonpages_r_posts foreign key (site_id, on_post_id)
    references posts3 (site_id, unique_post_id),
  constraint permsonpages_c_on_one check (1 =
    one_unless_null(on_whole_site) +
    one_unless_null(on_category_id) +
    one_unless_null(on_page_id) +
    one_unless_null(on_post_id) +
    one_unless_null(on_tag_id)),
  constraint permsonpages_c_not_meaningless check (
    may_edit_page is not null
    or may_edit_comment is not null
    or may_edit_wiki is not null
    or may_edit_own is not null
    or may_delete_page is not null
    or may_delete_comment is not null
    or may_create_page is not null
    or may_post_comment is not null
    or may_see is not null
    or may_see_own is not null
    or may_see_private_flagged is not null)
);

-- Foreign key index:
create index permsonpages_people_i on perms_on_pages3 (site_id, for_people_id);

-- More foreign key indexes + avoids dupl permissions:
create unique index permsonpages_on_site_u on perms_on_pages3 (
  site_id, for_people_id)
  where on_whole_site is not null;
create unique index permsonpages_on_cat_u on perms_on_pages3 (
  site_id, on_category_id, for_people_id)
  where on_category_id is not null;
create unique index permsonpages_on_page_u on perms_on_pages3 (
  site_id, on_page_id, for_people_id)
  where on_page_id is not null;
create unique index permsonpages_on_post_u on perms_on_pages3 (
  site_id, on_post_id, for_people_id)
  where on_post_id is not null;

-- later:  perms_on_people3, perms_on_cats3, perms_on_tags3 ?


-- No longer needed
drop function if exists string_id_to_int(varchar);

