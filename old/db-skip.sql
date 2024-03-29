alter table post_actions3
-- Private comments, don't do like this:
-- [ EDIT:  ... Actually, yes — for private comments but *not* assigned-to.
--   Because they're different: for private comments, there's just one list of people,
--   namely those who can see the private comments. So a single posts_t field pointing
--   to a group, is enough.
--   But people can be assigned to do different things — and for each thing, there's
--   one group of people assigned to do that. Now, a single posts_t field pointing
--   to a group isn't enough. Instead, one-to-many-to-many is needed.
--   And then,  AssignedTo.Something relationships pointing from a group to a post,
--   is needed (or sth like that — I mean, 2 lists-of-things tables joined together:
--   a list of different types of assignments, and for each, a list of people).
-- / EDIT]
-- private_to_id_c and assigned_to_id_c shall point to a pat id — which might be
-- a group of type GroupType.PatList, meaning, an ad hoc group, used maybe just
-- once, to assign a particular task to two people. The group wouldn't have
-- a name, wouldn't be listed in any groups list. It's a "virtual" group, could
-- alternatively have been in a different table (but that'd be more work, pointless).
--
-- If one only assigns to 1 person or group, then, should a new group be created?
-- It could be unnecessary, at the same time, if not, then, can't customize
-- that assignment / visible-only-to. Hmm

-- HMM:  simply want the way Basecamp does it [Internal-Only Comments]
-- https://community.monday.com/t/internal-only-comments/4575/11
-- Read: https://community.monday.com/t/feature-request-private-notes-hide-from-guests/2298/9
--
-- or maybe:  is_private_c, and change page_members to post_pats? where post 1 means the page?
-- ... No, because, explanation:
-- Why not a post_memebrs_t(post_id, pat_id)? Because then, for each post,
-- new post_memebrs_t rows would be needed  — edit: No, instead, if a post is private, all descendants will be, too, same people can see them (others can't).
-- But if each private post on a page instead points to group_members_t, then,
-- the same group can be reused for all relevant posts on that page
--      — edit: But isn't that bad? If you edit the list at one place, say, add another may-see-private person, this'd affect the other places, which isn't always what one wants.
-- (because typically the same people continue talking privately with each other
-- throughout a page, unlikely to change in the middle).
--ter table posts3 add column visible_only_to_id_c  pat_id_d; -- No. Instead, either a tr_lv, or 999 which means there're entries in a new table, post_pats_t, listing the users and groups who can see this post?

-- no:
-- -- or: made_private_by_id_c  bool
-- alter table posts3 add column visible_to_id_c  pat_id_or_many_d; tr_lv_or_pat_list_d;  -- [10, 29] = trust level, and -1 means custom pat list?
-- instead:


-- Don't:  (using posts_t.owners_id_c, authors_id_c, private_pats_id_c instead)
  /** If a comment is private, only pats with a CanSeePrivate relationship to
    * that comment, can see it and its descendants (sub thread).
    */
  case object CanSeePrivate extends PatRelType_later(-1)

  -- (Probably also not a good idea for drafts?:)
  /** If a few people are working on a private draft together. Drafts are different
    * from private comments, in that draft can and are supposed to be made public,
    * later. But private comments stay private.
    */
  case object CanSeeDraft extends PatRelType_later(-1)
  ;


  /** Higher value could mean primary author. E.g. Bo 2, Ed 1, means Bo is
    * the primary author, Ed secondary.
    */
  case object AuthorOf extends PatRelType_later(-1)

  case object OwnerOf extends PatRelType_later(-1)


-- Don't do like this:
--     instead,  this'll be in  perms_on_pages3  = perms_on_nodes_t ?
-- 0b0001 = Member / has-it-henself,
-- 0b0010 = Bouncer,  *no*,  Revoker, instead?
-- 0b0100 = Adder,    *no*,  Granter, instead?
-- 0b1000 = Manager,
-- create domain rel_perms_d i32_d;
-- alter  domain rel_perms_d add
--    constraint rel_perms_d_c_bitfield check (value between 1 and 9);
      --   1,   -- member / has rel henself
      --   2,   -- bouncer  (can remove members)
      --   3,   -- bouncer and member
      --   4,   -- adder  (can add members)
      --   5,   -- adder and member
      --   6,   -- adder and bouncer
      --   7,   -- adder, bouncer and member
      --   8,   -- manager  (can add & remove members)
      --   9);  -- manager and member

      --   ?    -- group mod? Can moderate comments by others in the group
      --   ?    -- group admin? That is, can change group settigns

      --   ?    -- see relationship, e.g. see group members?
      --   ?    -- see anons? No, cat perm instead?

-- Pat-post-rels ex
--   Can see private.
--     Is private = posts_t (!) status flag.
--     Adder/remover = adds private comments thread participants.
--
--   VotedOn
--     Cat perms and page perms determines who can vote?
--
--   AssignedTo
--     Cat perms determines who may assign?
--
--   AuthorOf
--     Adder/remover N/A, instead,  OwnerOf  decides?
--
--   OwnerOf  *No*. Instead in:  perms_on_pages3 (later renamed to: perms_on_nodes_t)
--     No,  perms_on_conts_t — for "content".  Content? Too long. Let's use "cont"
--                           short enough, and is a standard abbreviation for content.
--         No, "cont" is so hard to read, I get confused.
--         Instead, "node" directly makes me think of a node in the tree structure
--         formed by the categories, pages and discussins. Good name. I think. As of now.
--         So,  nodes_t.
--     Compare:
--           pat_node_rels_t   pat_pat_rels_t
--         with:
--           participant_node_relationships_t   participant_participant_relationships_t
--         I think the latter is too long! Takes 3 eye movements to read each of those
--         long table names Abbreviations are needed.  And, when abbreviating, why not
--         keep it really short? People need to look up the abbreviations once anyway
--         in any case (probably not more, since these words are "everywhere", hard to
--         forget, when getting reminded constantly). So let's go with "pat" for
--         "participant" (already done, in use)  and "node" is short already.
--         Now, just 1 eye movement needed :- ) (for you too?)
--         (I mean, you see the whole table name, if glancing just once in the middle.
--         of the table name.)
--     Can change author, close, delete, change post type, edit, etc.
--     Or should this be in  perms_on_pages3? No, is *per post* always,
--     not cat or page or whole site?
--     Or, hmm, actually makes sense for those others too? Yes.
--     E.g. a package maintainer, being the owner of a cat about that package?
--     and free to grant permissions in that cat?
--     Or a project page, with sub pages representing tasks — the page
--     owners could be the project owners.
--
--



-- skip:
-- alter table notifications3 rename column page_id to init_page_id_st_c;
-- alter table notifications3 add column init_page_id_int_c int;  -- later
-- alter table notifications3 add column init_post_nr_c int;
-- create index notfs_i_aboutpage_topat on notifications3 (
--         site_id, about_page_id_str_c, to_user_id) where about_page_id_str_c is not null;
-- alter table notifications3 add constraint notfs_c_postnr_pageid_null check (
--   (init_post_nr_c is null) or (init_page_id_st_c is not null));

-- no, emails_out_t
-- create index notfs_i_page_pat on notifications3 (
--         site_id, init_page_id_st_c, to_user_id, init_post_nr_c)
--     where init_post_nr_c is not null;

-- alter table notifications3 add constraint notfs_c_postnr_pageid_null check (
--   (init_post_nr_c is null) or (init_page_id_st_c is not null));

-- no?
-- create index notfs_i_page_pat on notifications3 (
--         site_id, init_page_id_st_c, to_user_id, init_post_nr_c)
--     where init_post_nr_c is not null;



-- Skip, won't be so many posts to load at once anyway? Not that many visible on screen,
-- at the same time. (E.g. sending 30 or 100 exact post ids is like nothing,
-- db performance wise.)
alter table users3 add column  has_links_c  i32_gz_d; 
alter table posts3 add column  has_links_c  i32_gz_d;

-- Skip this too, for the same reason: (as just above)
-- If this post has any rows other than votes and flags in pats_t. E.g.
-- assigned-to. Or authors or onwers (if changed from the post creator to other people).
alter table posts3 add column has_more_pats_c bool;
-- Yes? Bitfield:
-- Or maybe not needed, can do an inner join instead, ok fast?
alter table posts3 add column has_what_links i32_gz_d;

-- Or maybe a column has_pats_c —> look up authors, owners, assigneds, can-see-private
-- Nice, then won't need to add more something-status_c just because adding more
-- features. Instead, just a new enum, and set has_pats_c = true, and look up that enum. ?
alter table posts3 add column owner_status_c  ;  -- null = the creator, 2 = others, 3 = others and the creator

-- Skip this too, for the same reasons as above:
-- use  has_pats_c  instead?
--  -- If is assigned, then look up in post_links_t who may see it — entries of type
--  -- PostPatHow.AssignedTo?
alter table posts3 add column is_assigned_c  bool;

-- SKIP, too much details, not worth the time:
-- Can look up who's planning or doing this, or did it, in post_links_t?

-- Skip:
alter table posts3 add column has_answers_c;  -- ?  or has_links_c and then look up all links,
-- just like  posts_t.has_pats_c and look up all pats in post_pats_t? Seems simpler, hmm?

-- Skip, instead use:  post_links_t.link_type_c = PostLinkType.SolutionTo.
-- For questions, tells if they've been been answered.
alter table posts3 add column main_answer_post_id_c  post_id_d;


-- no:
-- -- or skip, just use assigned_by_id_c, and   post_pats_t?
-- alter table posts3 add column assigned_to_id_c      pat_id_d;  -- pat_list_d?
-- -- er table posts3 add column assigned_pub_id_c     pat_id_d;  -- maybe not the same?

-- Wait, use the audit log + permission system instead:
-- alter table posts3 add column assigned_by_id_c      pat_id_d;

-- Skip. Too complicated. Instead, add a new comment, make it private, and assign it?
-- er table posts3 add column assignment_visible_only_to_id_c pat_id_d;  -- hmm, maybe better create an assignment group and make it private instead?

-- Move all pages_t planned/started/doing/closed fields to posts_t instead!
-- Or, no, instead, to post_pats_t?  And add an  has_pats_c bool column,
-- so we'll know if there's anything to fetch from post_pats_t?
-- No:
-- alter table posts3 add column started_by_id_c       pat_id_d;  -- ?  if a comment is assigned
-- alter table posts3 add column done_by_id_c          pat_id_d;
-- alter table posts3 add column closed_by_id_c        pat_id_d;
-- Instead, just:  doing_status_c  ?
-- and details in  pat_rels_t  and  the audit log?


-- Skip: (use pat_rels_t instead, to connect pats with posts)
alter table posts3 add constraint posts_privateto_r_pats
    foreign key (site_id, private_to_id_c) references users3 (site_id, user_id) deferrable;

alter table posts3 add constraint posts_assignedto_r_pats
    foreign key (site_id, assigned_to_id_c) references users3 (site_id, user_id) deferrable;

alter table posts3 add constraint posts_assignedby_r_pats
    foreign key (site_id, assigned_by_id_c) references users3 (site_id, user_id) deferrable;

alter table posts3 add constraint posts_c_assignedto_by_null check (
    (assigned_to_id_c is null) = (assigned_by_id_c is null));





-- or is just unwanted vote count, enough? Hmm but weighted by pats' influences,
-- then can be nice to cache:?
-- Instead, have "effective num votes" columns? where votes have been weighted
-- by influence. ?
-- alter table posts3 add column unwanted_status_c unwanted_status_d;


-- Skip — do use posts for flags, but use a star table, flags_t, instead. see db-wip.sql,
--   no, use  post_rels_t instead, no need to create any separate flags_t table.
-- -- Flags are actually better represented as private posts, visible to oneself and mods,
-- -- of type Flag. If a flagged post gets moved, the flag should follow along, and
-- -- hence need to refer to the flagged post's *id* (which never changes (except for if
-- -- merging two sites, and ids collide, but then referenc*ing* ids like this parent_id_c,
-- -- are changed too)) not *nr* (which changes if moved to another page).
-- don't:
alter table posts3 add column parent_id_c post_id_d;


-- Skip — use the audit log intsead?
-- If someone (added_by_other_id_c) e.g. assigns a page to someone else (pat_id).
alter table post_actions3 add column  added_by_other_id_c  pat_id_d;  -- + fk & ix


-- No:
alter table post_actions3 add column  rel_perms_c    rel_perms_d;
--
-- Instead: perms_on_nodes_t  node_id_c = _  pat_id_c = _
--                              .may_grant_c: bool for now, later: perms bitfield?
--                              .may_revoke_c: bool



-- Don't, we're using  pat_rels_t  instead:
create table post_pats_t (
  site_id_c,
  post_id_c,
  pat_id_c,

  -- Don't, because one can e.g. flag a post many times.
  -- Or one might have revieweg revision 10, but not the current revision say 13.
  -- And then, when one reviews rev. 13, there might be 2 have-reviewed?
  -- Or, alternatively, store only the last review revision? And flags
  -- could be a list of dates, rev nrs, reasons and texts. But then,
  -- the current post_actions_t, with each thing on its own row, is almost simpler, hmm?
  can_see_c          bool,
  written_by_c       i16_gez_d,
  show_as_author_c   i16_gez_d,
  assigned_to_c      i16_gez_d,
  planned_by_c       i16_gez_d,
  started_by_c       i16_gez_d,
  done_by_c          i16_gez_d,
  reviewed_by_c      i16_gez_d,
  closed_by_c        i16_gez_d,

  like_voted_c       i16_gez_d,
  bury_voted_c       i16_gez_d,
  ...
  flagged_text_id_c  post_id_d,

  custom_c  jsonb_ste8000_d,

  constraint postpats_p_postid_patid_how_subhow primary key (
      site_id_c, post_id_c, pat_id_c, pat_how_c, sub_how_c),

  -- Better place this _says_id info in the audit log?
  -- can_see_says_id_c        pat_id_d,
  -- written_by_real_says_id  pat_id_d,
  -- written_by_pub_says_id   pat_id_d,
  -- assigned_to_says_id_c    pat_id_d,
  -- planned_by_says_id_c     pat_id_d,
  -- started_by_says_id_c     pat_id_d,
  -- done_by_says_id_c        pat_id_d,
  -- closed_by_says_id_c      pat_id_d,
);

create index postpats_i_postid_how_subhow_patid on post_pats_t (
      site_id_c, post_id_c, pat_how_c, sub_how_c, pat_id_c);

create index postpats_i_patid_postid_how_subhow on post_pats_t (
      site_id_c, pat_id_c, pat_how_c, sub_how_c, post_id_c);



----- perms_on_pages_t


-- No, I think this is instead be a proprety of the private threads
--  — it's risky if this can be overridden by category permissions!?:
-- alter table perms_on_pages3 add column  can_make_less_private_c  bool; 
-- alter table perms_on_pages3 add column  can_new_see_history_c    bool;

-- So can have categories with stricter requirements?  DON'T DO NOW!
alter table perms_on_pages3 add column  num_first_posts_to_review   i16_gz_d;
alter table perms_on_pages3 add column  num_first_posts_to_approve  i16_gz_d;
alter table perms_on_pages3 add column  max_posts_pend_appr_before  i16_gz_lt100_d;

alter table perms_on_pages3 add column  appr_before_if_trust_lte    trust_level;
alter table perms_on_pages3 add column  review_after_if_trust_lte   trust_level;
alter table perms_on_pages3 add column  max_posts_pend_revw_aftr    i16_gz_lt128_d;



----- post_rels_t

-- Slowly change links_t to post_rels_t, to store simple links from posts to whatever:

--   or  DON'T ? Instead CREATE a NEW table?  Seems these are in fact 2 too different things?
--                                            Different primary keys.


alter table links_t add column  from_rev_nr_c  rev_nr_d;
alter table links_t add column  to_rev_nr_c    rev_nr_d;
alter table links_t add column  down_status_c  down_status_d;
alter table links_t add column  link_type_c    post_link_type_d;
alter table links_t add column  sub_type_c     sub_type_d;
alter table links_t add column  value_c        i32_d;

alter table links_t alter column link_url_c drop not null;

-- For now, either an <a href=...> text link in the post text — then
-- there's a link_url_c — or some other type of link as clarified by link_type_c.
alter table links_t add constraint postlinks_c_type_xor_url check (
    (link_url_c is not null) != (link_type_c is not null));

-- sub_type_c = 0 means no subtype, but works better together with constraints and
-- unique keys.
alter table links_t add constraint postlinks_c_type_has_subtype check (
    (link_type_c is not null) = (sub_type_c is not nulL));

-- Replace the primary key with unique keys, since not all links will include any url
-- but there should be just one link of each type, between two things:

alter table links_t drop constraint links_p_postid_url;

create unique index postlinks_u_frompostid_url   -- same as the pk deleted above
    on links_t (site_id_c, from_post_id_c, link_url_c)
    where link_url_c is not null;

create unique index postlinks_u_topage_type_frompost_subtype
    on links_t (site_id_c, to_page_id_c, link_type_c, from_post_id_c, sub_type_c)
    where link_url_c is null;

create index postlinks_i_topage_isurl
    on links_t (site_id_c, to_page_id_c) where link_url_c is not null;

create unique index postlinks_u_topost_type_frompost_subtype
    on links_t (site_id_c, to_post_id_c, link_type_c, from_post_id_c, sub_type_c)
    where link_url_c is null;

create index postlinks_i_topost_isurl
    on links_t (site_id_c, to_post_id_c) where link_url_c is not null;

create unique index postlinks_u_topat_type_frompost_subtype
    on links_t (site_id_c, to_pp_id_c, link_type_c, from_post_id_c, sub_type_c)
    where link_url_c is null;

create index postlinks_i_topat_isurl
    on links_t (site_id_c, to_pp_id_c) where link_url_c is not null;

create unique index postlinks_u_totag_type_frompost_subtype
    on links_t (site_id_c, to_tag_id_c, link_type_c, from_post_id_c, sub_type_c)
    where link_url_c is null;

create index postlinks_i_totag_isurl
    on links_t (site_id_c, to_tag_id_c) where link_url_c is not null;

create unique index postlinks_u_tocat_type_frompost_subtype
    on links_t (site_id_c, to_category_id_c, link_type_c, from_post_id_c, sub_type_c)
    where link_url_c is null;

create index postlinks_i_tocat_isurl
    on links_t (site_id_c, to_category_id_c) where link_url_c is not null;


-- fk ix, since pk gone. Could include type too and endpoint, but not important?
create index postlinks_i_frompost on links_t (site_id_c, from_post_id_c);


-- Not needed? Only for pat_links_t, created above?
-- create index postlinks_i_frompost_linktype on links_t (
--     site_id, post_id_c, link_type_c, created_at);
-- 
-- -- For looking up links from-to posts of which none has been deleted. But is this needed?
-- create index postlinks_i_frompost_linktype_isup on links_t (
--     site_id, post_id_c, link_type_c, created_at) where down_bits_c is null;



-- Skip, too complicated. Use pseudonyms insetad, if one wants to reuse the same
-- "anonymous" account accross different pages and categories.
--
comment on domain  anon_level_d  is $_$

10: Not anon, even if would have been by default. For example, a moderator
or maybe a school teacher who wants to say something more officially.

(20, not impl: Anon post, by an a bit traceable "virtual anon account":
The poster would use the same account accross different categories and pages,
during anon_incarnation_ttl_mins_c minutes. Then hen gets a new anon acct.
Except for when posting more on the same page — then hen will reuse hen's
last annon acct on that page.)

(30, not impl: Anon account, less traceable: The same in the same category only;
it cannot follow accross categories. After anon_incarnation_ttl_mins_c,
the poster will get a new virtual annon acct. Except for when posting more on
the same page; see above.  — Maybe skip forever? Things get complicated,
if moving a page to a different category, and continuing posting there.)

(40, not impl: Anon account, less traceable: The same in the same category,
excl sub categories.)

50: Anon account: Same on the same page only.

(60: Anon account, even less less traceable: Same on the same page only,
and only during anon_incarnation_ttl_mins_c.)

(70: Anon account, unique per post / same-for-all-users-and-posts.)
$_$;  -- '


-- Never needed? Instead, pats_t.anon_status_c and a value < -N
-- check: pats_c_anonid_ltem10
create domain anon_or_guest_id_d pat_id_d;
alter  domain anon_or_guest_id_d add
   constraint anon_or_guest_id_d_c_ltm10 check (value <= -10);


---------------------------------------------------------------
-- Skip, instead will use  perms_on_pages3.{may_post_comment, may_see},
-- so can look up posts directly by  pat id, perm type (e.g. added to priv comt tree)
-- and sort by time.
-- Rather than having to do this once per pat lis one is in.
--
alter table users3 add column  is_pat_list_c  bool;  -- no.
alter table users3 add constraint  pats_c_patlist_is_group check (
    (is_pat_list_c is not true) or (is_group is true));
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
---------------------------------------------------------------


-- Skip:  New  anon_id_c  or true_id_c  everywhere.
-- Instead:
-- Let's add a  pat_rels_t.rel_type_c = AuthorOf from the anon to the anon posts?
-- Whilst created_by_id_c would keep pointing to the true author.
-- Then, looking up all one's posts, that just works.
-- And anon posts can easily be filtered away, by checking anon_status_c (because
-- other)
--
-- But skip the below:
-------------------------------------------------------------------------
-- I think this is too error prone — I will or have already forgotten
-- some columns below, or will forget to always update all columns when needed.
-- Also, importing patches gets more complicated. Instead of the below,
-- the anon/pseudo user account's id will be stored. And one would use the
-- event / audit log to ... audit what the real people behind the anon/pseudonyms,
-- have done. (Or lookup the true id in the users table, pats_t, but the audit log
-- should be enough.)
--
-- Actually, can be better to add  post_actions3 [pat_rels_t]  rows of type:
--    AuhtorOf, with val_i32_c being a type-of-author bitfield? (anon, pseudonym, co-author),
-- linking to one's anon & pseudonym posts,
-- when and only when  posts_t.created_by_id  doesn't point directly to one's
-- true id (but instead points to an anon/pseudonym/user-list-pats_t row).
-- No! Skip. Instead, let  created_by_id  be the real id.
--                 and "just" add a   pat_rels_t.rel_type_c = AuthorOf for the anon?
--                 and excl such posts everywhere, as long as the anon is anon.
--      Also, can have a
--         pat_rels_t.show_pats_id  to show an anonym as voter,
--                                     instead of the real user account.

alter table post_actions3    add column true_id_c             member_id_d;
alter table links_t          add column added_by_true_id_c    member_id_d;
alter table link_previews_t  add column first_linked_by_id_c  member_id_d;
alter table post_revisions3  add composed_by_true_id_c        member_id_d;
alter table posts3           add created_by_true_id_c         member_id_d;

-- But I've added  author_id_c  already!
-- Now removing. Instead:   pat_rels_t.rel_type_c = AuthorOf

alter table posts3           add author_id_c                  pat_id_d;
alter table posts3           add author_true_id_c             member_id_d;
alter table post_read_stats3 add true_id_c                    member_id_d;
alter table review_tasks3    add true_id_c
alter table upload_refs3     add added_by_true_id_c ?

user_stats3, hmm?

pages_t — no, instead, the orig post in posts_t?  Old:
alter table pages3           add author_true_id_c             member_id_d;
-- But leave last_reply_by_id as is — don't add any  last_reply_by_true_id,
-- not that interesting.

alter table upload_refs3     add  added_by_true_id_c          member_id_d;

alter table user_visit_stats3 add true_user_id_c              member_id_d;
-------------------------------------------------------------------------



---------------------------------------------------------------
-- Skip: Bookmarks table
--
-- Don't create a separate bookmarks or menu or tree table,  [bookmarks]
-- like below. Instead,  posts in posts3 already for a tree, and include
-- almost all that's needed for bookmarks — just a links field, or
-- entries in node_node_rels_t needed too?
-- (It'll all will be in [add_nodes_t] instead?)
--
create table trees_t (
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



-- Maybe later: ----------------------------------------
-- But unlikely? So better keep here in db-skip.sql not -wip.
-- Denormalized tags?
alter table page_notf_prefs_t add column pages_with_tag_a_id_c tagtype_id_d;
alter table page_notf_prefs_t add column pages_with_tag_b_id_c tagtype_id_d;
alter table page_notf_prefs_t add column pages_with_tag_c_id_c tagtype_id_d;

-- ix pagenotfprefs_i_tagaid
alter table page_notf_prefs_t add constraint pagenotfprefs_withtaga_r_tags
    foreign key (site_id, pages_with_tag_a_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

-- ix pagenotfprefs_i_tagbid
alter table page_notf_prefs_t add constraint pagenotfprefs_withtagb_r_tags
    foreign key (site_id, pages_with_tag_b_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

  -- ix pagenotfprefs_i_tagcid
alter table page_notf_prefs_t add constraint pagenotfprefs_withtagc_r_tags
    foreign key (site_id, pages_with_tag_c_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

create index pagenotfprefs_i_tagaid on page_notf_prefs_t (site_id, pages_with_tag_a_id_c);
create index pagenotfprefs_i_tagbid on page_notf_prefs_t (site_id, pages_with_tag_b_id_c);
create index pagenotfprefs_i_tagcid on page_notf_prefs_t (site_id, pages_with_tag_c_id_c);
-- / Maybe later ---------------------------------------


-- Skip, instead there'll be a table, triggers_t, with conditions, [add_triggers_t]
-- e.g. a date-time, or everyone-in-a-group-has-replied, or 90%-has-replied,
-- which makes things like reveal-the-replies or deanon-comments happen.
alter table posts3 & categories3
    add column  auto_show_replies_how_c            i32_gz_d,  -- e.g when everyone in a group has replied
                                                              -- or at YYMMDD HH:MM
    add column  auto_show_replies_mins_c           i32_gz_d,

    add column  auto_show_replies_mins_aft_publ_c  i32_gz_d,
    add column  auto_show_replies_at_c             timestamp,

    add column  auto_deanon_mins_aft_first_c       i32_gz_d,
    add column  auto_deanon_mins_aft_last_c        i32_gz_d,
    add column  auto_deanon_tree_mins_aft_first_c  i32_gz_d,
    add column  auto_deanon_tree_mins_aft_last_c   i32_gz_d,
    add column  auto_deanon_only_score_gte_c       f32_d,

    add column  auto_deanon_tree_at_c              timestamp;


create index nodes_i_autoshowrepliesat on posts3 (site_id, auto_show_replies_at_c)
    where auto_show_replies_at_c is not null;

create index nodes_i_autodeanontreeat on posts3 (site_id, auto_deanon_tree_at_c)
    where auto_deanon_tree_at_c is not null;


alter table users3
    add column auto_deanon_at_c          timestamp,
create index pats_i_autodeanonat on users3 (site_id, auto_deanon_at_c)
    where auto_deanon_at_c is not null;
