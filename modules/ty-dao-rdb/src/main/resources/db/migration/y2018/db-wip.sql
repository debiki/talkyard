-- Also see: docs/maybe-refactor.txt
--  — move some / most-of ?  this db-wip stuff to there instead?
--

-- I deleted constraint:
--  alter table users3 drop constraint dw1_users_emlntf__c;
-- later, change col type to Int, add 0 < ... < 1000 constraint?

-- add:  upload_refs3.is_approved  ?   [is_upl_ref_aprvd]

-- what's this:  logo_url_or_html

alter table settings3 add column media_in_posts int;
alter table settings3 add constraint settings_c_mediainposts check (
    media_in_posts between 0 and 100);

-- REMOVE:  embedded_comments_category_id
-- REMOVE:  users3.updated_at  and all other upd-at?

---------------
-- Add mixed case username index?
-- Currently there's only:  dw1_users_site_usernamelower__u

---------------
-- Prefix alt page ids with:  'diid:'  unless is http(s)://... or url path:  /...  [J402RKDT]
-- From edc:
> select distinct alt_page_id from alt_page_ids3 where alt_page_id like '%:%' and alt_page_id not like 'http:%'  and alt_page_id not like 'https:%';
 alt_page_id
-------------
(0 rows)

> select distinct alt_page_id from alt_page_ids3 where alt_page_id like '/%';
--  —> they all look like url paths

-- But in case somethign's wrong, copy to other table:
create table disc_keys_old as select * from alt_page_ids3;
rename table alt_page_ids3 to discussion_keys;
-- where a key is either:  'diid: ....'  (discussion id)
-- or  https?://...
-- or  //host/....
-- or an url path:   /....
---------------

-- RENAME page_html3 to  page_html_t  or  html_cache_t
-- RENAME pages3 to  page_meta_t?
-- RENAME  default_category_id  to def_sub_cat_id, no, def_descendant_cat_id
-- RENAME  users3.last_reply_at/by_id  to  last_appr_repl_at/by_id

-- change users3.email_notfs to int, remove _toFlag [7KABKF2]

alter table settings3 drop column embedded_comments_category_id;
  -- add per category embedding origins instead. And use extid 'embedded_comments' category.

drop table tag_notf_levels3;

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


-- Remove email "identities" from identities3?
-- Replace w separate email login-secrets table?  [EMLLGISCRT]

-- ?? delete page_id post_nr  from  post_actions ??

-- Add fk  posts3.parent_nr —> posts3.nr  ?? or no?  better w/o, so can hard delete / purge?

-- v376:  Next time, if all fine:
alter table users3 drop column email_for_every_new_post;  -- no, [REFACTORNOTFS] rename to mailing_list_mode and set to false everywhere?
alter page user_pages3 drop column notf_level;
alter page user_pages3 drop column notf_reason;
-- could use function  is_valid_notf_level  to page_notf_prefs.notf_level?
-- for this constraint:  pagenotfprefs_c_notf_level c
------------


pats_t
pat_groups_t
pat_email_adrs_t

#pat_sets_meta_t   — or maybe just reuse  pat_groups_t
#  pat_set_id_c
#  pat_set_name_c
#
#pat_sets_t
#  pat_set_id_c
#  pat_id_c

cont_sets_meta_t
  cont_set_id_c
  cont_set_name_c

cont_sets_t
  cont_set_id_c
  whole_site_c   bool
  page_types_c   i64
  cat_id_c
  page_id_c
  written_by_id_c   — can be a group

site_settings_t

cont_settings_t
  cont_set_id_c
  pats_id_c
  vote_types_enabled_c    i32   — can depent on both pat, cat



------------

-- It's empty anyway. But wait until re-impl tags.
-- drop table tag_notf_levels3;


-- why?
alter table page_users3 rename to user_pages3;

-- [page_members_t]
alter table page_users3 drop column notf_level;
alter table page_users3 drop column notf_reason; -- weird, why did I add it, and why here?

users3             —> pats_t
user_stats3        —> pat_dyn_data_t         -- frequently changes
user_visit_stats3  —> pat_visits_t
page_users3    __.——> pat_page_visits_t      --
                  `—> pat_page_dyn_data_t    --

post_read_stats3   —> posts_read_t
           user_id —> posts_read_t.read_by_id_c


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





-- Maybe, emails:

alter table emails_out3 add column is_auto_reply_2re2_id text;

alter table emails_out3 add constraint emailsout_autoreply2re2_r_id
    foreign key (site_id, is_auto_reply_2re2_id)
    references emails_out3 (site_id, id)
    on delete cascade
    deferrable;

create index emailsout_i_autoreply2re2 on emails_out3 (
    site_id, is_auto_reply_2re2_id)
    where is_auto_reply_2re2_id is not null;


-- Maybe later, an email_lax_d too (only if needed), which would allow e.g.
-- mixed case to the left of @?
create domain email_lax_d as text;  -- + more lax constraints than  email_d
