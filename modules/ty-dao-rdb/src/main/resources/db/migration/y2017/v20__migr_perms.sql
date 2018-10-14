-- Don't require email_for_every_new_post to be not-null for members.
alter table users3 drop constraint users_member__c_nn;
alter table users3 add constraint people_member_c_nn check (
  user_id < 0 or created_at is not null and username is not null);

-- Groups don't have any auto-adjusting trust level.
alter table users3 alter trust_level drop default;
alter table users3 alter trust_level drop not null;
alter table users3 alter threat_level drop default;
alter table users3 alter threat_level drop not null;

-- Use the permission system instead.
alter table users3 drop column is_editor;

-- Convert users3 is_admin and is_owner 'T' to true:
-- First, drop 'T' constraints.
alter table users3 drop constraint dw1_users_isowner__c_b;
alter table users3 drop constraint dw1_users_superadm__c;
-- Then converst.
alter table users3 alter column is_admin type boolean using (
  case is_admin
    when 'T' then true
    else null
  end);
alter table users3 alter column is_owner type boolean using (
  case is_owner
    when 'T' then true
    else null
  end);

-- Cannot be both moderator and admin.
alter table users3 add constraint people_c_not_both_admin_mod check (
  not is_admin or not is_moderator);


-- This trigger might 1) not exist, or 2) exist and still use site-id = varchar, not integer,
-- and if so, we need to get rid of it. Otherwise there'll be errors below,
-- when deleting site-1 if its empty, + also when adding default groups.
-- It's recreated later, in the r__triggers.sql script.
-- The num-uses-quota count in sites3 might be a tiny bit incorrect after this migration
-- — but doesn't matter much. Will fix in some later migration, or a make-db-consistent
-- background job.
drop trigger if exists users3_sum_quota on users3;


-- All System users should be admins.
update users3 set is_admin = true where user_id = 1;  -- 1 = the system user


-- Delete site 1, if it's empty. Will create in Scala code instead, lazily.
-- If there's no user/group except for System, then it's empty. Users/groups have id >= 10.

delete from page_users3
where site_id = 1 -- FirstSiteId
  and not exists (
    select * from users3
    where site_id = 1
      and user_id >= 10 limit 1);

delete from user_stats3
where site_id = 1 -- FirstSiteId
  and not exists (
    select * from users3
    where site_id = 1
      and user_id >= 10 limit 1);

delete from usernames3
where site_id = 1 -- FirstSiteId
  and not exists (
    select * from users3
    where site_id = 1
      and user_id >= 10 limit 1);

delete from users3
where site_id = 1 -- FirstSiteId
  and not exists (
    select * from users3
    where site_id = 1
      and user_id >= 10 limit 1);

delete from sites3
where id = 1 -- FirstSiteId
  and not exists (
    select * from users3
    where site_id = 1
      and user_id >= 10 limit 1);


-- Create groups for all trust levels, and staff, mods and admins. For existing sites.

insert into users3 (site_id, user_id, full_name, username, created_at)
  select
    s.id as site_id,
    10 as user_id,
    'Everyone' full_name,
    'everyone' as username,
    now_utc() as created_at
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    11 as user_id,
    'New Members' full_name,
    'new_members' as username,
    now_utc() as created_at,
    1 as locked_trust_level,
    3 as locked_threat_level
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    12 as user_id,
    'Basic Members' full_name,
    'basic_members' as username,
    now_utc() as created_at,
    2 as locked_trust_level,
    3 as locked_threat_level
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    13 as user_id,
    'Full Members' full_name,
    'full_members' as username,
    now_utc() as created_at,
    3 as locked_trust_level,
    3 as locked_threat_level
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    14 as user_id,
    'Trusted Members' full_name,
    'trusted_members' as username,
    now_utc() as created_at,
    4 as locked_trust_level,
    2 as locked_threat_level
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    15 as user_id,
    'Regular Members' full_name,
    'regular_members' as username,
    now_utc() as created_at,
    5 as locked_trust_level,
    2 as locked_threat_level
  from sites3 s;


insert into users3 (
  site_id, user_id, full_name, username, created_at, locked_trust_level, locked_threat_level)
  select
    s.id as site_id,
    16 as user_id,
    'Core Members' full_name,
    'core_members' as username,
    now_utc() as created_at,
    6 as locked_trust_level,
    1 as locked_threat_level
  from sites3 s;


insert into users3 (site_id, user_id, full_name, username, created_at)
  select
    s.id as site_id,
    17 as user_id,
    'Staff' full_name,
    'staff' as username,
    now_utc() as created_at
  from sites3 s;


insert into users3 (site_id, user_id, full_name, username, created_at, is_moderator)
  select
    s.id as site_id,
    18 as user_id,
    'Moderators' full_name,
    'moderators' as username,
    now_utc() as created_at,
    true as is_moderator
  from sites3 s;


insert into users3 (site_id, user_id, full_name, username, created_at, is_admin)
  select
    s.id as site_id,
    19 as user_id,
    'Admins' full_name,
    'admins' as username,
    now_utc() as created_at,
    true as is_admin
  from sites3 s;


-- Insert default permissions for Everyone and Staff, on all categories.

-- Permissions for everyone to see, post topics and comments: (only on not-staff-only categories)
insert into perms_on_pages3(
  site_id,
  perm_id,
  for_people_id,
  on_category_id,
  may_edit_own,
  may_create_page,
  may_post_comment,
  may_see,
  may_see_own)
  select
    cats.site_id,
    (10 * cats.id + 0) as perm_id,  -- 10 x + 0 = for everyone
    10 as for_people_id,  -- everyone
    cats.id as on_category_id,
    true as may_edit_own,
    not cats.only_staff_may_create_topics and not cats.unlisted as may_create_page,
    true as may_post_comment,
    true as may_see,
    true as may_see_own
  from categories3 cats
  where cats.staff_only = false
    -- Exclude root categories.
    and cats.parent_id is not null;


-- Permissions for staff to do everything:
insert into perms_on_pages3(
  site_id,
  perm_id,
  for_people_id,
  on_category_id,
  may_edit_page,
  may_edit_comment,
  may_edit_wiki,
  may_edit_own,
  may_delete_page,
  may_delete_comment,
  may_create_page,
  may_post_comment,
  may_see,
  may_see_own)
  select
    cats.site_id,
    (10 * cats.id + 7) as perm_id,  -- 10 x + 7 = for staff
    17 as for_people_id,  -- staff
    cats.id as on_category_id,
    true as may_edit_page,
    true as may_edit_comment,
    true as may_edit_wiki,
    true as may_edit_own,
    true as may_delete_page,
    true as may_delete_comment,
    true as may_create_page,
    true as may_post_comment,
    true as may_see,
    true as may_see_own
  from categories3 cats
  where
    -- Exclude root categories.
    cats.parent_id is not null;

