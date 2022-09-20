
--==== Circles and User Lists =================================================

-- User lists, so can assign many to something. Or have more than one author,
-- or owner. And for private comment sub threads — who can see them.
-- But should user lists have their own pat ids < 0?  Since they shouldn't be used
-- in the permission system (they're just lists). But currently only guest
-- (and anons, soon) ids have ids < 0.

-- New types of pats — flavors of groups: pat lists, and circles. Here:

create domain how_private_d      i16_gz_lt128_d;
alter table users3 add column how_private_c  how_private_d; -- or  can_add_more_c ?
comment on column  users3.how_private_c  is $_$
If non-null, this should be a list (is_pat_list_c true), and the how_private_c
value says if it's ok to add more people to this list, and if someone added,
can see already existing private comments in private sub threads by pats
in this list:
1) May add more people to the private page (make it less private)
and they get to see the alreday existing comments, or
2) Can add more people to a private page, but they don't get to see any
already existing comments; only new comments (posted after hen got added).
(Maybe a  perms_on_pats_t.cannot_see_post_nrs_below_c, or how else remember this?)
Or 3) If adding more people, a new private page gets created, with the
original people and the ones added.
$_$;


alter table users3 add column is_pat_list_c  bool;
comment on column  users3.is_pat_list_c  is $_$
If non-null, this pats_t row is not a real group, but a help construction
that lists users or groups, and wherever this list-of-pats appear, the pats
are to be listed. For example, if  posts_t.author_id_c  is a list,
and Alice and Bob are in the list, then Alice's and Bob's usernames are shown
instead of the lists username (it has none), e.g.:
"By Alice and Bob on 2022-03-04: ....", if authors_id_c points to
that list with Alice and Bob. But if authors_id_c is a non-list group,
e.g. Support Team, then the text would read "By Support Team", instead
of listing all members.
$_$;

alter table users3 add column is_circle_c    bool;
comment on column  users3.is_circle_c  is $_$
Circles are bottom-up constructed groups — anyone in a community can create
a circle, and let others join. Maybe they'll be able to @mention the
circle, and they can create private discussions for their circle only?
$_$; --'

alter table users3 add constraint  pats_c_patlist_is_group check (
    (is_pat_list_c is not true) or (is_group is true));

alter table users3 add constraint  pats_c_circle_is_group check (
    (is_circle_c is not true) or (is_group is true));

alter table users3 add constraint  pats_c_not_patlist_circle check (
    (is_pat_list_c is not true) or (is_circle_c is not true));

alter table users3 add constraint  pats_c_private_is_patlist check (
    (how_private_c is null) or (is_pat_list_c is true));

-- Lists don't have any username, so need to drop this constraint, was:
--    check (user_id < 0 or created_at is not null and username is not null)
-- OR let lists have ids < 0, is that better?
alter table users3 drop constraint people_member_c_nn;
alter table users3 add constraint pats_c_members_have_username check (
    (user_id < 0) or is_pat_list_c or (username is not null));

-- Recreate this. WHy might guests (< 0) have no created_at? Don't remember.
alter table users3 add constraint pats_c_members_have_username check (
    (user_id < 0) or (created_at is not null));


--==== Custom types ===========================================================

-- Types and values for plugins, in the future.

-- Built-in types have ids 1–999, or maybe < 0 if more than a thousand?
create domain cust_type_d  i32_lt2e9_gt1000_d;

alter table tagtypes_t rename to types_t; -- and let  types_t.id_c  be of type  cust_type_d?


----- Thing types and Sub types / Enums

-- Custom tag types, pat and post relationship types, is nice. Enumerations seem
-- common, supported by all (?) programming languages, and turns up often in Ty —
-- so maybe nice to support enum types, so plugins can use?
-- In Ty:
--   A vote (thing type) and what vote (e.g. Like, Disagree — the subtype).
--   A flag, and what flag (spam, inappropriate, etc)
--   Assigned-To, and to do what, e.g. to carry out the work.
--   A bird, and what species of bird (own, swan, exclamatory paradise whydah, etc).
-- Future plugins are likely to want types and sub types, too?

-- Maybe content tags & user badges could be a thing type named Content/DescriptionAbout Tag?
-- E.g. a tag with label  Review  on a page Carrots for Rabbits  would have type ContentTag
-- indicating that it reviews carrots as food for one's rabbits.
-- Whilst theer can also be a type VotedOn.Review which could mean e.g. someon did
-- code review. — Now, these two Review get their own "namespaces" and Talkyard
-- understand when to show which one (when adding a vote, list
-- custom types from  types_t   where thing type = Vote, which would include sub type Review,
-- whilst if adding tags to a page, show types with thing type ContentTag instead.
-- Maybe all thing types would be built-in, unless a plugin is doing something
-- unexpected.


-- Alt 1: ------
-- To reuse a built-in thing type,
alter table types_t add column thing_type_c  thing_type_d;
-- fk ix: types_i_thingtypeid_id
alter table types_t add constraint types_thingtypeid_r_types_id
    foreign key (site_id_c, thingtype_id_c)
    references types_t (site_id_c, id_c) deferrable;
-- (No need to incl id_c — it's in the primary key already.)
create index types_i_thingtypeid_id on types_t (site_id_c, thingtype_id_c);

alter table types_t add column thing_type_built_in_id_c   i32_gz_d;
-- But is the above the right way to do it? — Alternatively, change the primary key:

-- Alt 2: ------
-- Seems better! [alwys_sub_type]. But then, what's then name of the thing type?
-- How verify that there's always a row with sub_id_c = 0 with the thing type name?
-- Maybe if missing, could just be "Type 1234" and some admin problem message.
-- Add a types_t enum sub id. Defaults to 0 for a thing type with no sub type?
alter table types_t add column  sub_id_c  cust_type_d  not null  default 0;
alter table types_t drop constraint old-prim-key;
alter table types_t add constraint types_p_id_subid primary key (
    site_id_c, id_c, sub_id_c);

-- Alt 3: ------
-- Don't have any thing type at all? Instead, types with flags:
--    can_use_as_vote_c        bool,
--    can_use_as_content_tag_c bool,
--    can_use_as_assigned_to_c bool,
--    ...
-- Problematic, in that if a type gets used as a tag, and then an admin changes
-- the flag so the type becomes something completely different?

-- Alt 4: ------
-- Have exactly one built-in thing type, for each type in types_t,
-- e.g. a custom type is of thing type Vote, or thing type ContentTag or AssignedTo.
-- So, in e.g.  pat_rels_t,  rel_type_c  would be a built-in type e.g. VotedOn,
-- no foreign key.
-- whilst  sub_type_c  would usually be built-in, e.g.  VoteType.Like,
-- and sometimes a custom type, let's say thing type Vote and:
--     sub type  VoteType.LooksGoodToMe
--       with id > 1000 (because it's a custom sub type)
--       and foreign-key referencing  types_t.
-- Or maybe "thing type" could be replaced with "Can use how",
-- e.g.  CanUseHow.AsVote or AsContentTag, and this'd be part of the primary key
-- in types_t? Hmm, no, thing type and sub type sounds simpler?
--
alter table types_t add column  thing_type_c  thing_type_d  not null  default Content-tags-type;
alter table types_t rename column  id_c  to  sub_type_c  sub_type_d  not null;
-- **Maybe this (alt 4) is simplest?  Then won't ever need to think about what
-- happens with existing usages of a type, if changing how the type can be used
-- — because a thing type would be part of the primary key, so couldn't
-- change where a type can be used. Instead, one would create a new type.

----------------



-- Sub type indexes:

-- Allow sub types with the same name — it's ok, since scoped in their base type.
-- There're indexes on types_t (
--    site_id_c, coalesce(scoped_to_pat_id_c, 0), url_slug_c)
-- and  ...abbr_name,  ...disp_name,  ...long_name.
-- Can drop and recreate, with base type included in the unique ix:
drop index tagtypes_u_anypat_urlslug;
create unique index types_u_anypat_anybasetype_urlslug on types_t (
    site_id_c, coalesce(scoped_to_pat_id_c, 0), coalesce(base_type_id_c, 0), url_slug_c);
-- or [alwys_sub_type]:
create unique index types_u_anypat_basetype_urlslug on types_t (
    site_id_c, coalesce(scoped_to_pat_id_c, 0), url_slug_c) where sub_id_c = 0;
create unique index types_u_anypat_basetype_subtype_urlslug on types_t (
    site_id_c, coalesce(scoped_to_pat_id_c, 0), id_c, url_slug_c) where sub_id_c != 0;



-- For pat rels:


alter table post_actions3 rename to pat_rels_t;  -- upd triggers too!

alter table post_actions3 drop column action_id; -- ?. Already noted below in "delete: ...".
alter table post_actions3 rename column created_at to at_c:  -- or "added_at_c" or drop it?
-- Audit log, instead:
alter table post_actions3 drop column updated_at;
alter table post_actions3 drop column deleted_at;
alter table post_actions3 drop column deleted_by_id;

-- Maybe not — instead reuse  rel_type_c and sub_type_c, if > 1000 they're custom types?
alter table post_actions3 add    column  cust_rel_type_c  cust_type_d;
alter table post_actions3 add    column  cust_sub_type_c   cust_type_d;

-- Yes:
alter table post_actions3 add    column  cust_json_c       jsonb_ste100_000_d;

--------------- But so many foregin keys, 3 --------------
-- fk ix: patrels_i_custreltype
alter table post_actions3 add constraint patrels_custtype_r_types
    foreign key (site_id, cust_rel_type_c) references tag_types_t (site_id_c, id_c) deferrable;

create index patrels_i_custreltype on post_actions3 (site_id, cust_rel_type_c)
    where cust_rel_type_c is not null;

-- fk ix: patrels_i_custsubtype
alter table post_actions3 add constraint patrels_custsubtype_r_types
    foreign key (site_id, cust_sub_type_c)
    references tag_types_t (site_id_c, id_c) deferrable;

create index patrels_i_custsubtype
    on post_actions3 (site_id, cust_sub_type_c)
    where cust_sub_type_c is not null;

-- Verify that the sub type is indeed a sub type of the base type:
-- fk ix: patrels_i_custreltype_custsubtype
alter table post_actions3 add constraint patrels_custreltype_custsubtype_r_types
    foreign key (site_id, cust_rel_type_c, cust_sub_type_c)
    references tag_types_t (site_id_c, base_type_id_c, id_c) deferrable;

create index patrels_i_custreltype_custsubtype
    on post_actions3 (site_id, cust_rel_type_c, cust_sub_type_c)
    where cust_rel_type_c is not null and cust_sub_type_c is not null;

--------------- If instead  [alwys_sub_type] -------------
alter table post_actions3 add constraint patrels_custtype_r_types
    foreign key (site_id, rel_type_c, sub_type_c)
    references types_t (site_id_c, thing_type_c, sub_type_c) deferrable;
create index patrels_i_reltype on post_actions3 (site_id, rel_type_c, sub_type_c);
----------------------------------------------------------





-- For post rels:

create table post_rels_t (
  site_id_c,
  from_post_id_c,

  to_post_id_c,
  to_...

  dormant_status_c,

  thing_type_c   thing_type_d, -- these are custom types that references types_t
  sub_type_c     sub_type_d,   -- iff ids > 1000. Otherwise built-in, not fks.

  cust_i32_c     i32_d,
  cust_json_c    jsonb_ste100_000_d,

  ...
);


-- For posts:

alter table posts3 add column  cust_type_c  cust_type_d;  -- + sub_type_c
alter table posts3 add column  cust_json_c  jsonb_ste100_000_d;

-- Add ix and fks [pg_15]


--== / Custom types ===========================================================


--======================================================================
--  post_rels_t
--======================================================================

------------------------------------------------------------------------
comment on table  post_rels_t  is $_$
Store simple relationships from posts to whatever, e.g. AnswerTo, FlagOf.
$_$;
------------------------------------------------------------------------




-- Later:
-- alter table pages3 add column closed_status_c closed_status_d;
-- — what would that be? The same as the OrigPost's closed_status_c?

-- Replace all pages_t.answered_by_id_c, published_by_id_c,
--     postponed_by_id_c, planned_by_id_c, started_by_id_c,
--     paused_by_id_c, done_by_id_c, closed_by_id_c, locked_by_id_c,
--     frozen_by_id_c, unwanted_by_id_c, hidden_by_id_c, deleted_by_id_c
-- with:  private_status_c
--   [edit] No, using private_pats_id_c instead. And the following might be
--   a user list/group setting instead: [/edit]
--            null or 0 = not private,
--            1 = yes, can make public,
--            2 = yes, can*not* make public, but can add more who can see it,
--            3 = yes but cannot add more pats who can see it (only indirectly via groups?)
--        assigned_status_c  — maybe should be a bool?
--            over complicated:
--                1 = assigned to one
--                2 = assigned to many
--                3 = assigned to one or many, but they're all absent (e.g. resigned & quit) ?
--        doing_status_c
--                planned / started / paused / done
--        review_status_c
--                needs review / sbd assigned / review started / done looks bad / looks good
--        publish_status_c  or publish_at_c  ?
--                not needed?:
--                   null = published (the default)
--                   1 = not yet published
--                   2 = scheduled
--                   3 = published
--        closed_status_c,
--        unwanted_status_c
--        hidden_status_c,
--        deleted_status_c ?   And details (who did what, when) in post_pats_t?
--
-- Then, lots of columns, fk:s, indexes — gone. Instead, pat_rels_t reused.


-- Also see: docs/maybe-refactor.txt
--  — move some / most-of ?  this db-wip stuff to there instead?
--

-- Maybe there should be another page setting: pinInWatchbar? (as opposed to topic list)
-- Or should that be a separate table. Maybe the same as a bookmarks table? Bookmarks
-- can also form a tree structure, just like future pages and cats in the watchbar.

-- Don't!?
create table trees_t (  --  NO, instead, use posts_t for bookmarks?
                        --  A page and comments is already a tree structure,
                        --  with all we need!? almost precisely what we neeed
      --
      -- Such an odd, & good!?, idea.
      -- Posts & bookmarks, the same table?
      -- Just like persons and groups, same table? (Which worked out great.)
      --
      -- A new page & post type:  PageType.Linkbar / Bookmarks?
      -- And type Linkbar, for Everyone, appears in the linkbar,
      -- and post_t.visible_only_to_id can hide some links.
      --
      -- And  posts_t.doing_status_c then automatically works
      -- for bookmarks too! And one can create a bookmark,
      -- and transfer it to someone else's personal bookmarks page,
      -- maybe continue seeing it, via visible_only_to_c?
      -- and have it linked from one's own bookmarks page?


  -- Pk: (these 4 cols)
  site_id_c,
  for_pat_id_c,   -- Everyone + TreeType.Linkbar => appears in the linkbar (watchbar)
  tree_type_c,    -- TreeType.Linkbar or Bookmarks
  node_id_c,

  parent_id_c,    -- Null unless nested? FK to:
                  --    (site_id_c, for_pat_id_c, tree_type_c, node_id_c).
  created_by_id_c, -- An admin might give a bookmark "task" to sbd else?
  owner_id_c,     -- Who may edit this tree, if different from for_pat_id_c.
  visible_to_id_c, --- gah gets complicated

  node_title_c,   -- To override title of page or category or tag below.
  node_descr_c,   -- Optional personal comment about an assignment?
  node_order_c,
  -- A node can be collapsed by default.
  -- And a pat can collapse or hide a default node: (site_id, pat_id, node_id, hide = true)
  node_collapsed_c,
  node_hidden_c

  -- At most one of these:
  node_page_id_c,  -- shows assignees, doing status
  node_post_id_c,  --       —""—
  node_cat_id_c,
  node_tag_id_c,
  node_pat_id_c,
  node_url_c,

  -- To insert another tree node into one's own bookmarks?
  -- (It cannot link back, because parent_id_c must be to the same tree.)
  other_tree_for_pat_id_c,
  other_tree_type_c,
  other_tree_node_id_c,

  -- Optional:
  children_order_c,
  children_what_c,  -- e.g. top 3 pages in cat, if this is a cat

  created_at_c,   -- If sorting children by date
  archived_c,      -- then not loaded by default
  reminder_at_c,
  reminder_interval_c,
  my_doing_status_c, -- if someone wants hens own task related to a post,
                     -- not visible to others (assuming TreeType is Bookmarks).
);


-- maybe pointless? Can instead always be a tree_t.reminder_at_c?
-- create table reminders_t (
--   site_id_c,
--   remind_pat_id_c,
--   created_by_id_c,
--   about_tree_node_id_c,
--   about_post_id_c,
--   about_tag_id_c,
-- )

alter table post_actions3 drop column action_id; -- already noted below in "delete: ...".

alter table post_actions3 rename to post_pats_t; -- no, post_act(ion)s_t?
alter table post_actions3 rename column created_by_id to pat_id_c;
alter table post_actions3 rename column created_at to at_c:  -- or added_at_c;
alter table post_actions3 rename column type to how_c;
alter table post_actions3 rename column sub_id to sub_how_c;

-- Audit log, instead:
alter table post_actions3 drop column updated_at;
alter table post_actions3 drop column deleted_at;
alter table post_actions3 drop column deleted_by_id;



--   pages_t.pin_in_linkbar_order_c 

alter table perms_on_pages_t add columns:
  can_see_assigned_groups_c     bool,
  can_see_assigned_persons_c    bool,
  can_assign_self_c             bool,
  can_assign_others_c           bool,


-- Split settings3 and pages3 into:
--   pages_t,
--   sect_props_t, sect_views_t, sect_stats_t,
--   disc_props_t, disc_views_t, disc_stats_t,
-- see: y2999/wip_sect_disc_props_views_stats.sql


-- Tags:
create domain show_tag_how_d as i16_d;
alter domain show_tag_how_d add constraint show_tag_how_d_c_vals_in check (
    value in (0, 16));

-- Skip, old:
-- create table prop_defs_t(
--   allowed_value_types_c  prop_type_d[],   -- extra table = overkill
--   allowed_value_prop_set_c  —> prop_defs_t,  ?? what ?? not  prop_def_sets_t ?
--                                              or did I mean:  prop_defs_t[]  but then fks won't work?
--   allow_multi_vals_c,
--   show_where_c,
--   sort_order_c,
-- );



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


-- Discussion id / page id  domain?:
create domain page_id_st_d text_oneline_57_d;
alter domain page_id_st_d add constraint url_slug_d_c_regex check (
    value ~ '^[[:alnum:]_-]*$');
comment on domain page_id_st_d is
    'Currently, page ids are strings — later, those will become aliases, '
    'and there''l be numeric ids instead?';
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
alter table users3 add column watch_level_after_do_it_voted smallint;
-- What's this?
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


-- or maybe:   others_see_..._min_tr_lv ?  so clarifies it's reuqirements on *others*
-- to see this pat.

-- About user dialog maybe will be empty, just say: "Private user",
-- and a Close button, if cannot see name, username, send DMs or anything ?
-- And likewise, user profile page would say "Private user"
-- Web scrapers blocked.
-- Not listed in user directory (or listed as Private user? No why)


-- New groups: Web scrapers? Anonymity network strangers? (e.g. Tor)
-- See Git revision  b907273f7391e8a3,
-- "websearch_prefs" — no webindex? webscrapers_prefs_d?
create domain web_scraping_prefs_d i16_gz_d;  -- ?
alter table pats_t add column web_scraping_prefs_c  web_scraping_prefs_d;


-- Use  private comments  for implementing private messages  [priv_comts],
-- so can reuse the same code for both things. And thereafter:
-- *** No, don't, let's not store CanSeePrivate in pat_rels_t ***
update posts_t set nr_c = -nr_c, private_status_c = ...   -- sth like this, because
    where page_type is private-message;      -- private comments have negative post nrs.
    [edit] NO, using posts_t.private_pats_id_c instead [/edit]
insert into pat_rels_t (from_pat_id_c, rel_type_c, ...)
    select user_id, PatRelType.CanSeePrivate, ... from page_users3
    where joined_by_id is not null and kicked_by_id is null;
-- *** Instead *** create a new user list group, and have  posts_t.private_pats_id_c
-- point to that list, for each post on a private page?
alter table page_users3 drop column joined_by_id;
alter table page_users3 drop column kicked_by_id;


-- ** Maybe later **

-- Grants extra may-see-pat-details perms to for_pat_id_c:
-- (So, group for_pat_id_c could see someone's bio, even though may_see_bio_min_tr_lv
-- was higher)
-- (This is for built-in perms. Perms on tgs has another table -- see perms_on_types_t
--  in docs/design-docs/tags.dd.adoc )
create table perms_on_pats_t (    -- can be a group or a person
      -- BUT THIS IS group_participants3,  just change-rename it to  perms_on_pats_t  ?
  site_id_c,
  perm_id_c,
  for_pat_id_c,
  on_pat_id_c,
  on_pat_is_many_c bool,  -- so can add constraints applicable only to groups and circles.

  -- For groups and circles: (already in group_participants3)
  is_member_c  bool, -- change not null constraint: incl only for groups & circles
  is_manager_c bool, --
  is_adder_c   bool, --
  is_bouncer_c bool, --

  -- For all types of accounts (individuals, groups etc):
  may_see_ssoid_extid,  -- default: only admins & system users
  may_see_email,        -- default: only admins & system users
  -- default: all, for the below:
  may_see_my_username_c,
  may_see_my_full_name_c,
  may_see_my_bio_c,
  see_activity_min_trust_level,  -- ?  not  may_see_activity_c  ?
  may_see_my_tiny_avatar_c,
  may_see_my_medium_avatar_c,
  ...
  ... same as in pats_t, the ..._tr_lv_c coulmns
);


create table perms_on_groups3 (   -- already created:   group_participants3
  site_id,
  people_id int,
  group_id int,
  is_member/manager/adder/bouncer — already created
  -- ? Group admins can addd managers. And managers can add/remove bouncers and members.
  -- Bouncers can remove members (but not add). Addders can add but not remove.
  -- (Different use cases.)
  is_group_admin boolean,    -- a group admin and a group manager etc, needn't
  is_group_manager boolean,  -- be group members. so they're in a different table.
  is_bouncer boolean,        -- (E.g. to manage a group "Misbehaving Members" there's
                             -- no need to have been added to that group oneself.)
   -- oh, already done. Next:
   comment on table group_participants3 is '... sth like the comment above';


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

-- later?:
alter table pats_t add column default_group_prio int default 10;  -- for groups



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



-- Maybe later, PEM values:
-- Public and private assymetric keys, in PEM format.
create domain key_pem_d text;
-- PEM is Base64 encoded. Let's allow both the non-url safe, and the url safe version.
-- Also, there's newlines, blanks and "--- title ---" headers. So this should do:
alter domain key_pem_d add constraint key_pem_d_c_regex check (
    value ~ '^[\sa-zA-Z0-9=+/_-]*$');
alter domain key_pem_d add constraint key_pem_d_c_minlen check (length(value) >= 1);
-- DER format is 540 hex chars I think, with 2024 bits. Lets mult w 4 so longer
-- keys will work, and add a bit more —> 2000. But sometimes there're many
-- keys in the same file, so let's mult by, say, 5?
alter domain key_pem_d add constraint key_pem_d_c_maxlen check (
    length(value) <= 10000);
-- Min len? Maybe domain text_ne_d for non-empty?



-- ?
alter table page_popularity_scores3 add column two_weeks_score f64_d;
alter table page_popularity_scores3 add column two_days_score f64_d;
-- + custom time, maybe two arrays:  AlgorithmParams[], score[], last_calculated_at[] ?



-----------------------------------------------------------------------
-- Remember mentions in posts_t:
-- (Mentions are a bit expensive to find; need to render
-- CommonMark — because some @mentions might in fact be sth else, in a code block)

create or replace function contains_bad_link_char(txt text) returns boolean
language plpgsql as $_$
begin
    return txt ~ '.*\s.*' || txt !~ '^[[:graph:]]+$';   -- ?
end;
$_$;

create domain link_arr_d text[];
alter domain  link_arr_d add
   constraint link_arr_d_c_chars check (
     not contains_bad_link_char(array_to_string(value, ' ', ' ')));



create or replace function contains_bad_username_char(txt text) returns boolean
language plpgsql as $_$
begin
    return txt ~ '.*[\s\n\r\t@#,!?/\\=%\&].*' || txt !~ '^[[:graph:]]+$';   -- ?
end;
$_$;

create domain username_arr_d text[];
alter domain  username_arr_d add
   constraint username_arr_d_c_chars check (
     not contains_bad_username_char(array_to_string(value, ' ', ' ')));


alter table posts3 add column approved_mentions_ok_c     username_arr_d;
alter table posts3 add column approved_mentions_bad_c    username_arr_d;
alter table posts3 add column approved_links_ok_bad_c    link_arr_d;
alter table posts3 add column current_mentions_ok_c      username_arr_d;
alter table posts3 add column current_mentions_bad_c     username_arr_d;
alter table posts3 add column current_links_ok_bad_c     link_arr_d;
-----------------------------------------------------------------------



--==== Timers + the Do API ====================================================
--
-- Timers: Publish at a future time? Invite users at a certain time? Etc.
--
-- HMMM But isn't this Do API HTTP request json instructions, just stored in
-- tables instead, to be done later?
--
-- Maybe instead store Do-API json?  Or at least use the same table
-- structure as the json?
-- Tables can be better — if merging two Ty sites, foreign keys can partly help out
-- with ensuring no ids point to the wrong things.
--
-- But for a start, this could be all that's needed:
--
create table timers_t (
  site_id_c     site_id_d,
  timer_id_c    timer_id_d,
  do_what_c     jsonb_ste100_000_d,  -- Do API json
  do_as_id_c    pat_id_d,   -- or is this in the json already? ...
  added_by_id_c pat_id_d,   -- <—— ... if so, maybe beeter?
);

-- More complicated, could be better if merging 2 sites into one, but let's waaaiiit with that?:
create table timers_t (
  site_id_c,
  timer_id_c,
  do_at_c,
  do_what_c,

   -- e.g. AssignToPost (if don't want to do during the weekend, postpone til Monday morning?)
   -- or AddToGroup, RemoveFromGroup?
  pat_id_c,
  pat_2_id_c,  -- could be a group

   -- e.g. PublishPost, DeletePost
  post_id_c,
  post_2_id_c,  -- e.g. move post_id_c to below post_2_id_c

   -- e.g. PublishPage, DeletePage
  page_id_c,

   -- e.g. MovePage to a new category
  cat_id_c,

  -- e.g. AddTag or RemoveTag
  tag_id_c,
);




------------------------------------------------------------------------
create domain  draft_status_d   i16_gz_lt128_d;
-- draft_status_c  draft_status_d — later, see db-wip.sql [drafts_as_posts].

-- Or why not use  private_pats_id_c + just  is_draft_c: bool ?
-- No need to add yet another foreign key to  pats_t?
comment on domain  draft_status_d  is $_$
1 = personal draft, only visible to oneself? 2 = shared draft,
only visible to others explicitly added via PatRelType.CanSeeDraft?
3 = shared draft, visible to everyone who can see the category it's in?
This can be nice, if having a Drafts category, and publishing and
moving to another category once finished.
4 = pending review? — no, that'll be in review_status_d.
null = default, published (not a draft).
$_$;
-- Move drafts to posts_t?  [drafts_as_posts]  But then, where store edit drafts?
-- I suppose they'd be in posts_t too, with a < 0 post nr, and referencing the id of
-- the post they're editing.  Then it'd be nice with posts with *no* page id —
-- since if the post being edited is moved elsewhere, it's pointless to have to
-- update all edit drafts page ids?  Or is it nice to be able to load all
-- one's drafts on a page, by looking up by page and pat id? And comments are
-- rarely moved elsewhere, so maybe including a page id is better.
--
-- And SQL-copy drafts to posts_t from drafts3, lastly, drop drafts3.
--
alter table posts3 add column draft_status_c                 draft_status_d;
alter table posts3 add column draft_edit_post_id_c           post_id_d;
-- But can't there be a page with is_draft_c = true, then all these PageType, cat id,
-- message-to-pat fields aren't needed?
alter table posts3 add column draft_new_page_type_c          page_type_d;
alter table posts3 add column draft_new_sub_type_c           sub_type_d;
alter table posts3 add column draft_new_page_cat_id_c        cat_id_d;
alter table posts3 add column draft_new_message_to_pat_id_c  pat_id_d;

alter table posts3 add constraint posts_c_draft_or_cat_null check (
    (draft_status_c is not null) or (draft_cat_id_c is null));

alter table posts3 add constraint posts_c_draft_where_eq_pagetype_null check (
    ((draft_cat_id_c is null) or (draft_to_pat_id_c is null) = (draft_page_type_c is null));

-- & either  cat  or  to pat
-- & no cat or pat,  if is edits.
-- & ... ?

