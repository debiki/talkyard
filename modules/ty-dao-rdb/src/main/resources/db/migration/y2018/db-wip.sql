Don't use timestamp — Change all timestam to timestamptz, or maybe i64 integer? millis since 1970?
Compatible with client side time repr.

Don't use NOT IN
https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_NOT_IN

delete: categories3:
  updatedAt — who cares
  staff_only — use page perms instead
  only_staff_may_create_topics  — use page perms instead
  default_topic_type — keep. rename new_topic_types to allowed_topic_types?
page_path  cdati  canonical_dati
actions:  action_id (alw null), sub_id (always 1), updated_at, deleted_at, deleted_by_id
SiteInclDetails(  // [exp] ok use. delete: price_plan
NewPost(  // [exp] fine, del from db: delete:  page_id  action_type  action_sub_id
OpenAuthDetails(   // [exp] ok use, country, createdAt



-- v376:  Next time, if all fine:
alter table users3 drop column email_for_every_new_post;  -- no, [REFACTORNOTFS] rename to mailing_list_mode and set to false everywhere?
alter page user_pages3 drop column notf_level;
alter page user_pages3 drop column notf_reason;
-- could use function  is_valid_notf_level  to page_notf_prefs.notf_level?
-- for this constraint:  pagenotfprefs_c_notf_level c
------------


-- It's empty anyway. But wait until re-impl tags.
-- drop table tag_notf_levels3;
-- No longer in use. Should drop. But then the migrations failed :-/  on my laptop-2015 only, why.
-- drop table dw1_settings;

alter table page_users3 rename to user_pages3;


alter table users3 add column separate_email_for_every smallint;
update users3 set separate_email_for_every = 3 where email_for_every_new_post;  -- NO
alter table users3 drop column email_for_every_new_post;

alter table users3 add column watch_level_after_posted smallint;
alter table users3 add column notify_if_voted_up int;
alter table users3 add column notify_if_voted_other int;

alter table users3 add column group_auto_join_if_email_domain int;
alter table users3 add column group_default_prio int;
  -- auto_add_already_existing_members (only in create dialog)

-- page_notf_prefs could +=
--   post_id int,
--   incl_sub_categories boolean,
--   incl_sub_tags boolean,
--   incl_sub_threads boolean,

create table perms_on_groups3 (
  people_id int,
  group_id int,
  is_group_admin boolean,
  is_group_manager boolean,
  is_bouncer boolean,
  may_mention: boolean,
)

create table group_members3 (
  group_id int,
  member_id int,
  -- later:
  show_membership boolean,  -- if the group title should be shown next to the username
                            --  e.g.   "@pelle  Pelle Svanslös  staff" — if is a staff group memebr.
  membership_prio int,   -- group settings (e.g. page notf prefs) for higher prio groups,
                         -- override settings in lower prio groups.
  -- skip:
 -- is_group_true boolean, references people3(id, is_group)  + index  deferrable
 --  instead: is_group does a select from people3.
--  https://stackoverflow.com/a/10136019/694469 — if works, upvote
)

-- later:
alter table users3 add column default_group_prio int default 10;
alter table users3 add column show_group_membership boolean;  ?



create table group_notf_prefs3 (
  site_id int,
  people_id int,  -- typically  = group_id, i.e. configs group members
  group_id int,   -- null —> for the whole community
  notify_if_sb_joins boolean,
  notify_if_sb_leaves boolean,
  notify_of_staff_changes boolean,
  notify_of_sbs_first_posts smallint,
  notify_of_sbs_bad_posts boolean,
  notify_of_sbs_posts_if_trust_level_lte smallint,
  notify_of_sbs_posts_if_threat_level_gte smallint,
  notify_if_sbs_trust_level_gte smallint,
  notify_if_sbs_threat_level_lte smallint,
)


alter table user_categories3 add column
  notify_of_edits boolean;

alter table user_categories3 add column
  notify_if_topic_unanswered_hours int;   -- a question has been left unanswered for X time?

alter table user_categories3 add column
  notify_if_topic_no_progress_hours int;  -- a question/problem hasn't been solved, and no progress has been made the last X hours


  notify_of_new_posts boolean not null default false,
  notify_of_new_topics boolean not null default false,
  notify_of_topic_status_changes boolean not null default false,  -- no, use Watching instead



alter table users3 add column how_often_notify_about_others int;  -- references how_often3
create table how_often3(
  id, weekly_at_min, daily_at_min,
  immediately, immediately_if_by_talking_with,
  then_after_x_more, then_after_y_more, then_at_most_daily);


alter table page_users3 drop column notf_reason; -- weird, why did I add it, and why here?

