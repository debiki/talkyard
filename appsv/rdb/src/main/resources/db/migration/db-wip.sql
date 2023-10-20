
-- Bit manipulation in Postgres, e.g.:
--   select (12::bit(31) & (1::bit(31) << 3))::integer  ——>  8::int4
-- Also:
--   https://medium.com/developer-rants/bitwise-magic-in-postgresql-1a05284e4017


--=============================================================================
--  Misc new domains?
--=============================================================================

-- *_u: For unused columns, just sketching the future:
create domain i16_u smallint;
create domain i32_u int;
create domain i64_u bigint;
alter  domain i16_u add constraint i16_u_c_null check (value is null);
alter  domain i32_u add constraint i32_u_c_null check (value is null);
alter  domain i64_u add constraint i64_u_c_null check (value is null);

create domain text_nonempty_ste90_trimmed_d text_nonempty_ste90_d;
alter domain  text_nonempty_ste90_trimmed_d add
   constraint text_nonempty_ste90_trimmed_d_c_trimmed check (is_trimmed(value));

create domain folder_path_d text_nonempty_ste90_d;
alter  domain folder_path_d add
   constraint folder_path_d_c_chars check (value ~ '^/([a-z0-9][a-z0-9_-]*/)+$');

-- See if others are active / here, currently?  Can it ever make sense to
-- let that be per category or page (chat)?
create domain can_see_whos_here_d i16_d;
alter  domain can_see_whos_here_d add
   constraint can_see_whos_here_d_c_null check (value is null);


-- CDN and UGC per site domain?
create domain  scheme_domain_d text;
alter  domain  scheme_domain_d add
    constraint scheme_domain_d_minlen check (length(value) >= 4);
    constraint scheme_domain_d_maxlen check (length(value) <= 120);
    constraint scheme_domain_d_regex check (value ~ '^((https?:)\/\/)([a-z]\.)+[a-z]\.?$');
-- And:
alter table sites3 add column ugc_domain_c scheme_domain_d;
alter table sites3 add column smtp_conf_json_c jsonb_ste4000_d;  -- done, already
-- If shorter, it's invalid, right.
alter table sites3 add constraint sites_c_smtpconf_min_len check (
    length(smtp_conf_json_c) > 50);


-- See:  smtp_msg_ids_out_d  text[], has a fancy array constraint, ...
-- ... But this is better? Because of "| ".
create domain alnum_plusdashdot_arr_d text[];
alter domain  alnum_plusdashdot_arr_d add
   constraint alnum_plusdashdot_arr_d_c_nonempty check (
      length(array_to_string(value, '')) > 0);
alter domain  alnum_plusdashdot_arr_d add
   constraint alnum_plusdashdot_arr_d_c_chars check (
      (array_to_string(value, ' ') || ' ')  ~  '^(([a-zA-Z0-9_.+-]+ )*| )$');


--=============================================================================
--  More indexes, constraints?
--=============================================================================

-- Odd, last_approved_edit_at can be not null, also if  approved_at is null.
-- Harmless but maybe surprising in the future.


--=============================================================================
--  Upload refs
--=============================================================================

-- Also from drafts and users (their avatars).

alter table upload_refs3 rename column post_id to from_post_id_c;

alter table upload_refs3
    drop constraint dw2_uploadrefs__p,
    add column from_draft_nr_c i32_lt2e9_gt1000_d,
    add column from_pat_id_c   i32_d,
    add constraint uploadrefs_c_from_draft_or_post_or_avatar check (
        num_nonnulls(from_post_id_c, from_draft_nr_c, from_pat_id_c) = 1);

create unique index uploadrefs_u_postid_ref on upload_refs3 (
    site_id, post_id, base_url, hash_path) where post_id is not null;

create unique index uploadrefs_u_draftnr_ref on upload_refs3 (
    site_id, draft_nr_c, base_url, hash_path) where draft_nr_c is not null;

--=============================================================================
--  Job queue
--=============================================================================

-- Maybe:

alter table  job_queue_t
    -- To remember why sth got added to the index queue — what language, what ES version
    -- (in case indexing into a new index, before a major upgrade, in parallell with
    -- indexing in a current index?).  Maybe not actually needed, but nice for
    -- troubleshooting and developer / admin insight?
    add column  search_eng_vers_c  alnum_plusdashdot_arr_d,
    add column  lang_codes_c       alnum_plusdashdot_arr_d,
    add constraint jobq_c_searchengv_len check (pg_column_size(search_eng_vers_c) < 250),
    add constraint jobq_c_langcodes_len  check (pg_column_size(lang_codes_c) < 250);

--=============================================================================
--  Circles
--=============================================================================

-- User lists, so can assign many to something. Or have more than one author,
-- or owner. And for private comment sub threads — who can see them.
-- But should user lists have their own pat ids < 0?  Since they shouldn't be used
-- in the permission system (they're just lists). But currently only guest
-- (and anons, soon) ids have ids < 0.

-- New type of pat: Flavor of groups, pat circles:

alter table users3 add column is_circle_c    bool;

comment on column  users3.is_circle_c  is $_$
Circles are bottom-up constructed groups — anyone in a community can create
a circle, and let others join. Maybe they'll be able to @mention the
circle, and they can create private discussions for their circle only?
$_$; --'

alter table users3 add constraint  pats_c_circle_is_group check (
    (is_circle_c is not true) or (is_group is true));


-- Recreate this. WHy might guests (< 0) have no created_at? Don't remember.
alter table users3 add constraint pats_c_members_have_username check (
    (user_id < 0) or (created_at is not null));


--=============================================================================
--  Parent / child_tag types?  [nested_tags]
--=============================================================================
-- Also see Custom_types below.

-- UX: Probably, when child tags implemented, then, if adding a parent tag,
-- a dropdown should open where one can select one (or more) child tags too,
-- to save clicks, and to avoid people forgetting this,  and to not
-- have to search for the child tags in a long list of "all tags in the world".

-- UX: Some tag sets might have min-tags > 0 in some category, and then,
-- when posting a page in such a cat, one needs to choose > 0 tags from that
-- tag set, before posting. (Even if that tag set has no parent tag.)

------------
-- Alt 1, bad, because sometimes the same tags can appear as children of
-- two different parent tags?  Could this be an example:
-- Product tags, e.g. "bike", "shoes", "rollerskates".
-- And an "Inventory" tag, with product sub tags, for pages that
-- describe products for sale in a store.
-- But there'd also be users and "Wishlist" tags — also with product sub tags.
-- So, the product tags, can appear as children of both "Inventory" and "Wishlist"
-- tags.  — So, do not assume just one parent tag type.
alter table types_t add column parent_type_id_c references types_t; -- tagtypes_t = types_t

------------
-- Alt 2:  Parent to child tag types table. But here data like
-- `child_needed_c never_always_d` is duplicated, bad.
create table type_sets_t (
  parent_type_id_c,
  child_set_nr_c,
  child_needed_c never_always_d,
  child_type_id_c,
)

------------
-- Alt 3:  A types_t child-type row, plus rows in a type sets table:
create table type_sets_t (
  set_type_id_c,  -- references types_t: the type set
  elem_type_id_c);  -- references types_t: child tag types
-- And also:
alter table types_t
    add column is_type_set_c  bool, -- ??
     -- or --
      kind_id_c = ThingKindIds.TypeSet -- But then, could add the wrong thing kinds
      -- to a type set? However, if kind_id_c is part of the pimary key, and the same
      -- as any parent, then, maybe can prevent? Not that important.

    add column parent_type_id_c references types_t,  -- makes this a child type set
    add constraint check  (if parent_type_id_c not null) then (is_type_set_c is true),

    -- If you add a tag of the parent type, you might also need to add
    -- child tags, these many:
    -- **Or maybe this should be per category?** Sometimes, child tags might not
    -- be needed.  Maybe there should be a  type_node_rels_t,  just like
    -- there are  pat_node_rels_t (or  pat_post_rels_t)  etc?
    -- (If a child tag is always needed, in the whole site, then, set min >= 1
    -- for the site root category.)
    add column min_children_c i16_gez,
    add column max_children_c i16_gez,
    add constraint check min <= max,
    add constraint check (0 <= min or min is null) and (0 <= max or max is null),
    ;
-- types_t rows with parent_type_id_c set, is a type set consisting of the
-- types listed in type_sets_t:
--
--   [parent tag type in types_t]
--       ^————  [type set, also in types_t]
--                   ^––––––—  [type_sets_t]  —————> [parent tag type in  types_t]

------------
-- Alt 4:  Same as Alt 3, but  min_children / max are in another table:
create table  type_node_rels_t (  -- No! use  perms_on_pages3  instead (but renamed to what?)
  type_id_c,
  node_id_c,
  can_use_c,      -- if the type can be used as tags in category id node_id_c  ?
                  -- by default, Yes, iff the type is a ThingKind.Tag?
                  -- (Other types not allowed here?)
                  -- Unless set to False on some ancestor cat?

  wants_min_c,    -- If creating a page in category `node_id_c`, then, one needs to
                  -- add `wants_min_c` tags from type/type-set `type_id_c`.
  wants_max_c,    -- But can't add more than this many.

  -- ... Probably sth more, later?
);


-- Also, edit perms_on_pages3:
-- Rename  on_tag_id   to   on_type_id_c,
--
-- And look at these two permission rows:
--   row 1:
--       for_people_id  = Developers
--       on_category_id = Dev's Cat
--       on_type_id_c   = Pending-Review
--   row 2:
--       for_people_id  = Marketers
--       on_category_id = Marketer's Cat
--       on_type_id_c   = Pending-Review
--
-- That means there's a Pending-Review tag type, and the developers can use
-- that tag in therir *own* category, but the marketers can't add that tag,
-- in the developer's category. They (the marketers) can use it in their own
-- category instead.
--
-- How nice, Ty's table structure is already designed with that use case in mind
-- — just need to relax the constraint  permsonpages_c_on_one   so it lets you
-- specify both  on_category_id  and  on_type_id_c  (currently named on_tag_id).


--=============================================================================
--  Custom_types   Alt_5 below is best?
--=============================================================================

-- Types and values for plugins, in the future.

-- Built-in types have ids 1–999, or maybe < 0 if more than a thousand?
create domain cust_type_d  i32_lt2e9_gt1000_d;

alter table tagtypes_t rename to types_t; -- and let  types_t.id_c  be of type  cust_type_d?


----- Thing types and Sub types / Enums ... See Alt_5 below: Kinds, types and sub types

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
-- Update 2023-07:  Not good?  Stores built-in types in  types_t,  and custom types
-- on other rows also in types_t,  foreign-key link to the built-in types.
-- But it's misleading to keep built-in types in any table? Because that gives the
-- impression that they can be edited (by updating the table). But that's not
-- possible — the built-in types cannot be changed. (E.g. participants of type
-- User or Group, or content nodes of type Page and Comment — mostly doesn't make
-- sense to change or delete those types.)

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
-- Update 2023-07:  Also not good? Because also stores built-in types in
-- in types_t although can't be modified?
-- (Old comment below)
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

-- Alt_4: ------
-- Specify one built-in thing type or relationship type, for each type in types_t,
-- e.g. a custom type is of built-in thing type Vote or ContentTag or AssignedTo.
-- So, in e.g.  pat_node_rels_t,  rel_type_c  would be a built-in type e.g. VotedOn,
-- no foreign key.
--
-- The built-in type tells Talkyard where the custom type instance should appear
-- — e.g. as a vote, or in the assignees list somehow, or as a flag etc.
--
-- Nodes and relationships can have a   sub_type_c  too, and it would usually
-- be built-in too, e.g.  VoteType.Like,
-- but sometimes a custom type, let's say thing type Vote and:
--     sub type  VoteType.LooksGoodToMe
--       with id > 1000 (because it's a custom sub type)
--       and foreign-key referencing  types_t.
-- Or maybe "thing type" could be replaced with "Can use how",
-- e.g.  CanUseHow.AsVote or AsContentTag, and this'd be part of the primary key
-- in types_t? Hmm, no, thing type and sub type sounds simpler?
--
alter table types_t add column  thing_type_c  thing_type_d  not null  default ThingType.ContentTag;
alter table types_t rename column  id_c  to  sub_type_c  sub_type_d  not null;
-- **Maybe this (alt 4) is simplest? (No, Alt_5 instead) Then won't ever need to think
-- about what happens with existing usages of a type, if changing how the type can
-- be used — because a thing type would be part of the primary key, so couldn't
-- change where a type can be used. Instead, one would create a new type.
--
alter table types_t add constraint types_p_thingtype_subtype primary key (
    site_id_c, thing_type_c, sub_type_c);

-- Alt_5: ------

-- Kinds (ThingKind:s), types and subtypes:
-- What kind of thing is that? It's a node     ——> kind_id_c  = Kind.Node
--                          it's a participant     kind_id_c  = Kind.Pat
-- What type of node? It's a page.             ——> type_id_c  = NodeType.Page
--                  or ... a comment.                         = NodeType.Comment
--                     ... a flag, etc.                       = NodeType.Flag
-- What type of page? It's an Idea page.    ——> sub_type_id_c = PageType.Idea
--                     ... a Question.                        = PageType.Question
--          ... flag? It's a Spam flag.     ——> sub_type_id_c = FlagType.Spam
--                       ... Toxic flag.                      = FlagType.Toxic
-- What type of participant? A user.           ——> type_id_c  = PatType.User
--                           A group.                         = PatType.Group*
--                          An anonym, etc.                   = PatType.Anon*
--                                    (* Currently  Pat.isGroup instead of PatType though)

-- What kind of thing is that? A person-node-relationship  ——> kind_id_c = Kind.PatNodeRel
-- What type of relationship?  A voted-on relationship   ——> type_id_c = PatNodeRelType.VotedOn
-- What type of vote?  A Like vote.                   ——> sub_type_id_c = VoteType.Like

-- What kind of thing something is, determines in what table it gets saved.
-- E.g.  Kind.Node —>  saved in  nodes_t         (currently named posts3).
--       Kind.PatNodeRel —>  in  pat_node_rels_t  (currently post_actions3).
--       Kind.Pat        —>  in  pats_t          (currently users3).
--
-- What type of thing it is (more specific than kind), determines how it's used,
-- where it's shown,
-- for example, nodes:
--     NodeType.Category appears in the category list.
--     NodeType.Page    are listed in their parent category.
--     NodeType.Comment are listed on the page where they got posted.
--     NodeType.Flag    shown to moderators.
--
-- and pat-node-relationships:
--     PatNodeRelType.VotedOn: a vote icon and count appears below the post (eg 3 Likes).
--     PatNodeRelType.AssignedTo: the assignee appears in the Assiged To list above the post.
--
-- and the sub type suggests how to handle the thing? Eg:
--     PageType.Question — needs an answer
--     PageType.Idea   — discuss and maybe do
--     FlagType.Spam  — delete & ban
--     FlagType.Rude  — delete / rewrite, talk w the person about the guidelines
--
-- Only custom types are stored in types_t, and type & subtype ids should be > 1000
-- so as not to collide with built-in type ids. (Like in Alt_4)
--
alter table tagtypes_t rename to types_t;
alter table types_t
       rename column  id_c  to    type_id_c,
       add column  kind_id_c      kind_d  not null
                                      -- all currently existing types are for tags.
                                      default  Kind.Tag,
       add column  sub_type_id_c  sub_type_d  not null
                                      -- 0 means it's not a sub type (tags aren't sub types).
                                      default  0,

       drop constraint tagtypes_p_id,
       add constraint types_p_kind_type_subtype primary key (
              site_id_c, kind_id_c, type_id_c, sub_type_id_c);
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


-- upd triggers too!
alter table post_actions3 rename to pat_node_rels_t; -- not: pat_rels_t;

alter table post_actions3 drop column action_id; -- ?. Already noted below in "delete: ...".
alter table post_actions3 rename to created_at to added_at_c;
-- Audit log, instead:
alter table post_actions3 drop column updated_at;
alter table post_actions3 drop column deleted_at;  -- delete the row instead?
alter table post_actions3 drop column deleted_by_id;

-- Maybe not — instead reuse  rel_type_c and sub_type_c, if > 1000 they're custom types?
alter table post_actions3 add    column  cust_rel_type_c  cust_type_d;
alter table post_actions3 add    column  cust_sub_type_c   cust_type_d;

-- Yes:
alter table post_actions3 add    column  cust_json_c       jsonb_ste100_000_d;
alter table post_actions3 add    column  cust_i64_c        i64_d; -- ?

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

create table post_post_rels_t (  -- or:  node_node_rels_t?, see below
  site_id_c,
  from_post_id_c,

  to_post_id_c,
  to_...

  dormant_status_c,

  thing_type_c   thing_type_d, -- can be a custom type that references types_t
  sub_type_c     sub_type_d,   -- then, thing type id > 10 000? Otherwise built-in, no fk?

  cust_i32_c     i32_d,
  cust_json_c    jsonb_ste100_000_d,

  ...
);


-- For posts:

alter table posts3 add column  cust_type_c  cust_type_d;  -- + sub_type_c
alter table posts3 add column  cust_json_c  jsonb_ste100_000_d;

-- Add ix and fks [pg_15]


--=============================================================================
-- / Custom types
--=============================================================================


--=============================================================================
--  post_rels_t  or  node_node_rels_t  ?
--=============================================================================

------------------------------------------------------------------------
comment on table  node_node_rels_t  is $_$   -- not:  post_rels_t
Relationships from one post to another post, e.g. AnswerTo, FlagOf.
$_$;
------------------------------------------------------------------------




-- Later:
-- alter table pages3 add column closed_status_c closed_status_d;
-- — by default, the same as the orig post's status.

-- Replace all pages_t.answered_by_id_c, published_by_id_c,
--     postponed_by_id_c, planned_by_id_c, started_by_id_c,
--     paused_by_id_c, done_by_id_c, closed_by_id_c, locked_by_id_c,
--     frozen_by_id_c, unwanted_by_id_c, hidden_by_id_c, deleted_by_id_c
-- with:
--        answered_status_c (added already)
--        review_status_c
--                needs review / sbd assigned / review started / done looks bad / looks good
--        publish_status_c  or publish_at_c  ?
--                not needed?:
--                   null = published (the default)
--                   1 = not yet published
--                   2 = scheduled
--                   3 = published
--        unwanted_status_c
--        hidden_status_c,
--        deleted_status_c ?   And details (who did what, when) in post_pats_t?
--
-- Then, lots of columns, fk:s, indexes — gone. Instead, pat_rels_t reused.


-- Also see: docs/maybe-refactor.txt
--  — move some / most-of ?  this db-wip stuff to there instead?
--

-- Sidebar menu:
--
-- Maybe there should be another page setting: pinInWatchbar? (as opposed to topic list)
-- Or should that be stored in a sidebar menu data structure?  [bookmarks] [MenuTree]
-- can also form a tree structure, just like future pages and cats in the watchbar.
-- maybe pointless? Can instead always be a tree_t.reminder_at_c?
-- create table reminders_t (
--   site_id_c,
--   remind_pat_id_c,
--   created_by_id_c,
--   about_tree_node_id_c,
--   about_post_id_c,
--   about_tag_id_c,
-- )



-- Split settings3 and pages3 into:
--   pages_t,
--   sect_props_t, sect_views_t, sect_stats_t,
--   disc_props_t, disc_views_t, disc_stats_t,
-- see: y2999/wip_sect_disc_props_views_stats.sql

-- Later, drop: category_id, page_id.

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

-- No, this should be a per category setting instead. — Fine, will automatically be,
-- once  nodes_t  is in use.
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

-- RENAME posts3 to  nodes_t
-- MERGE categories3, pages3 into nodes_t (formerly posts3).
--        And, parts of settings3 into nodes_t too, namely all settings
--        that can vary from category to category (& page).
--    RENAME  default_category_id  to  def_descendant_cat_id_c
-- RENAME pages3 to  node_stats_t  and make it useful for all of cat, page, posts stats.
-- RENAME page_users3 into node_pat_stats_t, ... no, pat_page_visits_t (see below)?
--    MOVE column  joined_by_id  to:  perms_on_nodes_t
--    MOVE column  incl_in_summary_email_at_mins  to new table:  pat_node_prefs_t ?
-- REMOVE column  post_read_stats3.ip,  store in audit_log_t instead on login/if-changes, or elsewhere.
-- RENAME  users3.last_reply_at/by_id  to  last_appr_repl_at/by_id

-- RENAME settings3.many_sections  —> enable_sub_sites_c?
--           DROP:  category_id,  page_id  — will be only in  nodes_t  instead.
-- RENAME users3 -> pats_t
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

Rename: categories3
    def_sort_order_c   —> page_sort_order_c
    def_score_alg_c    —> page_...
    def_score_period_c —> page_...

Add?:
   Maybe not now, but later, more cat settings?:
   cats? SquashSiblingIndexLimit
   or SummarizeNumRepliesVisibleLimit
   Feature flags for now.

   orig post votes?   (if can vote on OP or not. Sometimes, for blog comments, not desireable.)
   other votes


page_html_cache_t   —  restrict col lengths


-- Remove email "identities" from identities3?
-- Replace w separate email login-secrets table?  [EMLLGISCRT]

-- ?? delete page_id post_nr  from  post_actions ??
-- And move flags to posts_t, since they can include editable text. [flags_as_posts]

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

alter table users3             rename to pats_t;
alter table user_stats3        rename to pat_dyn_data_t;    -- frequently changes
alter table user_visit_stats3  rename to pat_visits_t;
alter table page_users3        rename to pat_page_visits_t;
--                                    or `pat_page_dyn_data_t  ?
-- 
alter table post_read_stats3   rename to posts_read_t;
alter table posts_read_t rename user_id to read_by_id_c;  -- ?


alter table users3 add column separate_email_for_every smallint;
update users3 set separate_email_for_every = 3 where email_for_every_new_post;  -- NO
alter table users3 drop column email_for_every_new_post;

alter table users3 add column notf_level_after_posted smallint;
alter table users3 add column notf_level_after_do_it_voted smallint;
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
-- *** No, don't, let's not store CanSeePrivate in pat_rels_t. NO, see below. ***
update posts_t set nr_c = -nr_c, private_status_c = ...   -- sth like this, because
    where page_type is private-message;      -- private comments have negative post nrs.
    [edit] NO, using posts_t.private_pats_id_c instead, done  [/edit]
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
  may_see_username_c,
  may_see_full_name_c,
  may_see_bio_c,
  may_see_activity_c,
  may_see_tiny_avatar_c,
  may_see_medium_avatar_c,
  ...
  ... same as in pats_t, the ..._tr_lv_c coulmns
);


alter perms_on_pages3 (
  for_pat_id
  on_category_id
  ...
  may_moderate       -- can approve and reject comments. Category moderator, [cat_mods]. Hmm?
  may_administrate?  -- Can give & revoke category access & edit permissions,
      or  _manage?   -- to groups, and ... also to individuals? Or should perms always
                     -- be configured on groups, and user access by adding user to group?
                     -- The former is more orderly? The later more flexible & chaotic?
)

create table perms_on_groups3 (   -- already created:   group_participants3

    -- ACTUALLY maybe CHANGE  group_participants3
    --                    to  perms_on_pats_t,
    --
    -- and if it's a group, then is_member/manager/adder/bouncer
    -- has effect, otherwise ignored.
    --
    -- And all  pats_t.may_mention_me_tr_lv_c, may_see_my_...
    -- would be here too. If configured on a group, then,
    -- inherited, and can be overridden by individual users.
    --
    -- *This also lets users block each other*
    -- (which can be needed for big public communities)
    -- by configuring:
    --   perms_on_pats_t.for_pat_id         = oneself
    --   perms_on_pats_t.on_pat_id          = annoying person
    --   perms_on_pats_t.may_dir_msg_me_c          = false
    --   perms_on_pats_t.may_see_my_profile_page_c = false
    --   perms_on_pats_t.may ...                   = false
    --
    -- and once could always edit others' perms on oneself,
    -- unless they're admins, or site wide mods?
    -- Or category mods in a category one is in.

    -- (This'd be similar to:  page_notf_prefs3  and  perms_on_pages3
    -- in which one inherits settings from one's groups, and can override oneself.)
    --
    -- By default, when creating a group, maybe add this  perms_on_pats_t  entry:
    --   perms_on_pats_t.for_pat_id = the group
    --   perms_on_pats_t.on_pat_id  = the group itself
    --   perms_on_pats_t.may_see_ ...  = true
    --   perms_on_pats_t.may_mention.. = true
    --   ...
    -- so that, by default, group members can see each other? Even if this is disabled
    -- site wide?  Or, that's a pretty rare situation. So maybe "power admins"
    -- had better do manually.

    -- And to disable a mentions-misbehaving user from @mentioning others:
    --   perms_on_pats_t.for_pat_id = the misbehaving user
    --   perms_on_pats_t.on_pat_id  = everyone
    --   perms_on_pats_t.may_mention_c = false  -- or could even be a per-day number 0-9, hmm,
                                                -- so it's a softer limit rather than
                                                -- never never never.

    -- Hmm, that softer limit mentioned just above could be made a forum default, for newbies?
    --   perms_on_pats_t.for_pat_id = new_members
    --   perms_on_pats_t.on_pat_id  = everyone
    --   perms_on_pats_t.may_mention_per_day_c = 5   -- or week
    -- Could start with supporting only 0 or unset (no limit).
    -- Or should rate limits be in pats_t, and inherited?
    --   pats_t
    --        pat_id_c = ...   mentions_per_day_c = ...


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


alter table group_participants3 (
  group_id int,
  pat_id int,
  -- later:
  show_membership boolean,  -- if the group title should be shown next to the username
                            --  e.g.   "@pelle  Pelle Svanslös  staff" — if is a staff group memebr.
  membership_prio int,   -- group settings (e.g. page notf prefs) for higher prio groups,
                         -- override settings in lower prio groups.
  -- skip:
 -- is_group_true boolean, references people3(id, is_group)  + index  deferrable
 --  instead: is_group does a select from people3.
--  https://stackoverflow.com/a/10136019/694469 — if works, upvote


  notify_pat_prio_c
      -- if the group is @mentioned or DM:d, then, should pat get notified?:
      -- by making this configurable, workload can be distributed between
      -- support staff. Or would it be better to use some bot for this?
      -- which knows about people's schedules.
      -- Let's say there's a Support team with 20 members. If someone writes
      -- "Help, @support, do you know ..." it's unnecessary to notify all 20 people.
      -- Better start with maybe 3, and then, if no one replies, 3 others a bit later.
      -- Some thoughts:
      always, directly
      always, batched
      always, if pat is online/working
      round-robin
      round-robin, if pat is online/working
      later if no one else replies
      later if no one else replies, and pat is online/working
      much later  -''-
      much later  -''-
      never
)

-- later?:
alter table pats_t add column default_group_prio int default 10;  -- for groups




create table pat_notf_prefs3 (
  site_id int,
  for_pat_id_c int,  -- typically  = group_id, i.e. configs group members
  on_pat_id_c int,   -- null —> for the whole community. What, why? Instead, the Everyone group?
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
alter table page_popularity_scores3 add column  dormant_status_c  dormant_status_d;

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



--======================================================================
--======================================================================
--======================================================================
--  cont_prefs_t
--======================================================================
--======================================================================


create domain content_set_type_d int;
alter  domain content_set_type_d add
   constraint content_set_type_c_in_11 check (value in (11));
  -- 1 = whole site, 4 = mixed (opt cat + opt tags + opt page ids),
  -- 7 = tag(s) only, 11 = cat(s) only, 14 = page(s), 17 = replies?


-- Content settings/preferences
-------------------------------------------------

-- For categories and tags. Can sometimes be overridden by groups or individual users.


-- create table cont_prefs_mixed_t(
--   site_id_c                        site_id_d,    -- pk
--   for_pat_id_c                     member_id_d,  -- pk
--   cont_prefs_pat_id_c
--   cont_prefs_nr_c
--   cat_id_c
--   tagtype_id_c
--   page_id_c

-- Scala +=
delete from cont_prefs_t  ;
delete from cont_prefs_t where site_id_c = ?  ;

-- Wait with this. Instead, add categories3 (cats_t) cols for now,
-- see:  ./y2023/v419__anon_posts_disc_prefs.sql
--
create table cont_prefs_t(
  site_id_c                        site_id_d, -- pk
  pat_id_c                         member_id_d,  -- pk
  prefs_nr_c                       i16_gz_d,  -- pk

  content_set_type_c               content_set_type_d not null,

-- ren to  anon_ops_c
  ops_start_anon_c                 never_alowd_recd_always_d,
-- ren to  anon_comts_c
  cmts_start_anon_c                never_alowd_recd_always_d,
  -- posts_stay_anon__unimpl_c        never_alowd_recd_always_d,
  -- min_anon_mins__unimpl_c          i32_gz_d,
  -- deanon_pages_aft_mins__unimpl_c  i32_gz_d,
  -- deanon_posts_aft_mins__unimpl_c  i32_gz_d,

  -- sect_page_id__unimpl_c           page_id_st_d,
  -- sect_page_id_int__unimpl_c       page_id_d__later,

  -- pin_in_linksbar__unimpl_c        show_in_linksbar_d,
  -- pin_in_linksbar_order__unimpl_c  i32_gz_d,
  -- pin_in_cat_order__unimpl_c       i32_gz_d,
  -- pin_in_globally__unimpl_c        i32_gz_d,

  -- base_folder__unimpl_c            folder_path_d,
  -- show_page_ids__unimpl_c          i16_gz_d,
  -- ops_start_wiki__unimpl_c         never_always_d,
  -- cmts_start_wiki__unimpl_c        never_always_d,
  -- show_op_author__unimpl_c         i16_gz_d,
  -- allow_cmts__unimpl_c             i16_gz_d, -- yes / no-but-may-reply-to-old / no-but-keep-old / no-and-hide-old  ?

  constraint contprefs_p_prefsid primary key (site_id_c, pat_id_c, prefs_nr_c),

  -- fk ix: pk
  constraint contprefs_r_pats foreign key (site_id_c, pat_id_c)
      references users3 (site_id, user_id) deferrable,

  --  -- For specific users, id must be < 0 — so that there can be a > 0 constraint,
  --  -- in cats_t and tagtypes_t, for the default prefs, to catch bugs (don't want the
  --  -- default prefs to accidentally reference a specific user's/group's prefs).
  --  constraint contprefs_c_id_gtz_iff_everyone check ((memb_id_c is null) = (prefs_id_c > 0)),

  -- Guests and anon users cannot configure discussion preferences — only groups
  -- and real users can.
  constraint contprefs_c_for_users_and_groups check (pat_id_c >= 10)

  -- -- Should use  memb_id_c = null, not 10, for everyone's prefs, otherwise
  -- -- I think foreign keys won't work (Postgres wouldn't know the rows were unique?).
  -- constraint contprefs_c_null_not_everyone check (memb_id_c <> 10)
);


-- Default prefs, for Everyone, id 10, per category.
alter table categories3 add column cont_prefs_nr_c  i32_gz_d;
alter table categories3 add column cont_pat_id_10_c i32_gz_d default 10;
alter table categories3 add constraint cont_patid10_c_eq10 check (cont_pat_id_10_c = 10);

-- fk ix: cats_i_patid10_contprefsid
-- unique ix: 
alter table categories3 add constraint cats_contprefsid_r_contprefs
    foreign key (site_id, cont_pat_id_10_c, cont_prefs_nr_c)
    references cont_prefs_t (site_id_c, pat_id_c, prefs_nr_c) deferrable;

create index cats_i_patid10_contprefsid on categories3 (site_id, cont_pat_id_10_c, cont_prefs_nr_c);



--======================================================================
--  cont_prefs_t
--======================================================================

------------------------------------------------------------------------
comment on table  cont_prefs_t  is $_$

Settings and preferences that make sense for all of categories, tags
and specific pages. Usually they're default, for everyone in the forum;
then, memb_id_c is 10 (Everyone) and prefs_id_c is > 0.

But some preferences can be overridden by user groups or individual users
themselves — then, prefs_id_c is < 0 and memb_id_c is the user/group id.
Let's say you want to always post anonymously in a specific
category. Then, you can (not impl though) set ops_start_anon_c and cmts_start_anon_c
to true, for yourself only, in that category. And thereafter you cannot
forget to be anonyomus, there. Whilst others are unaffected.
Or maybe you're the teacher, and don't care about being anonymous in one
specific category — whilst the default (for all students) is to be anonymous. 

Maybe later, there'll be a table cont_mixed_prefs_t for specifying
content preferences for many categories, optionally combined with tags,
in one single row. But currently there's one cont_prefs_t per category,
maybe "soon" per tag too.

Wikis: cont_prefs_t lets you implement wikis by making a forum
category a wiki category: set ops_start_wiki_c to true, and set
base_folder_c to e.g. '/wiki/' and show_page_ids_c to false.
Alternatively, you can create a *tag* named 'wiki', and configure the
same settings for that tag (instaed of a category).
Then wiki pages can be placed in the categories where it makes the most sense
whilst still being part of a wiki — just tag them with the wiki tag.
So, a wiki via a category, or a tag. What makes sense, is community
specific I suppose.

Docs: In a documentation / articles category, you might want to set
show_op_author_c = false and allow_cmts_c = false,
and maybe base_folder_c = '/docs/'.
Or you can use a 'docs' tag, and have docs in different categories,
whilst still appearing below the '/docs/' URL path'
$_$;  -- '

-- comment on column  cont_prefs_t.anon_by_def_c  is $_$
-- 
-- If posts in this category, are anonymous, by default.
-- $_$;
-- ---------------------------------------------------------------------
-- comment on column  cont_prefs_t.def_anon_level_c  is $_$
-- 
-- Default anonymity level, in this category.
-- $_$; -- '
------------------------------------------------------------------------
