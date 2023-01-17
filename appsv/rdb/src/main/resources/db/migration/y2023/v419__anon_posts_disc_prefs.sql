-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.


-- Old mistakes
-------------------------------------------------

-- These will be in  pat_rels_t,  no,  pat_post_rels_t,  instead,
-- so can look up post ids directly
-- by pat id, relationship type and time.  Otherwise, if having many post authors,
-- by pointing  authors_id_c  to a pats_t user list group,  the database
-- would need to do one lookup, for each user list group one is a member of.
-- (These have never been used, ok to drop.)
--
alter table posts3 drop column  owners_id_c;
alter table posts3 drop column  authors_id_c;


-- New domains
-------------------------------------------------


create domain content_set_type_d int;
alter  domain content_set_type_d add
   constraint content_set_type_c_in_11 check (value in (11));
  -- 1 = whole site, 4 = mixed (opt cat + opt tags + opt page ids),
  -- 7 = tag(s) only, 11 = cat(s) only, 14 = page(s), 17 = replies?

create domain folder_path_d text_nonempty_ste60_d;
alter  domain folder_path_d add
   constraint folder_path_d_c_chars check (value ~ '^/([a-z0-9][a-z0-9_-]*/)+$');

create domain anon_or_guest_id_d pat_id_d;
alter  domain anon_or_guest_id_d add
   constraint anon_or_guest_id_d_c_ltm10 check (value <= -10);

create domain choose_yes_d i16_d;
alter  domain choose_yes_d add
   constraint choose_yes_d_c_in check (value in (2, 3));

create domain never_allow_recmd_always_d i16_d;
alter  domain never_allow_recmd_always_d add
   constraint never_allow_recmd_always_d_c_in check (value in (1, 2, 3, 4));

-- See AnonStatus in the Scala code.
create domain anonym_status_d i16_d;
alter  domain anonym_status_d add
   constraint anonym_status_d_c_in_5_37 check (value in (5, 37));

-- Says if the poster is still author and owner. And if others have been
-- added as authors or owners, or assigned to do this post — then, they'd
-- be looked up in pat_post_rels_t.
create domain creator_status_d i16_gz_lt1024_d;

-- Says if a page or post, and all descendants, are private. Bitfield.
create domain private_status_d i16_gz_lt1024_d;
--ter  domain private_status_d add
-- constraint private_status_d_c_null_123 check (
--          (value is null) or (value between 1 and 5));


-- For now, always null. Will drop that constr, and add other constraints later.
create domain pseudonym_status_d i16_d;
alter  domain pseudonym_status_d add
   constraint pseudonym_status_d_c_null check (value is null);

-- NO,  instead,  this'll be in  perms_on_pages3  = perms_on_cont_t ?
-- 0b0001 = Member / has-it-henself,
-- 0b0010 = Bouncer,  *no*,  Revoker, instead?
-- 0b0100 = Adder,    *no*,  Granter, instead?
-- 0b1000 = Manager,
create domain rel_perms_d i32_d;
alter  domain rel_perms_d add
   constraint rel_perms_d_c_bitfield check (value between 1 and 9);
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
--     Compare:
--           pat_cont_rels_t   pat_pat_rels_t
--         with:
--           participan_contents_relationships_t   participan_participants_relationships_t
--         I think the latter is too long! Takes 3 eye movements to read each of those
--         long table names Abbreviations are needed.  And, when abbreviating, why not
--         keep it really short? People need to look up the abbreviations once anyway
--         in any case (probably not more, since these words are "everywhere", hard to
--         forget, when getting reminded constantly). So let's go with "pat" for
--         "participant" (already done, in use)  and "cont" for "content".
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

create domain can_see_private_d i16_d;
alter  domain can_see_private_d add
   constraint can_see_private_d_c_null_123 check (
            (value is null) or (value between 1 and 5));

create domain can_see_assigned_d i16_d;
alter  domain can_see_assigned_d add
   constraint can_see_assigned_d_c_null_123 check (
            (value is null) or (value between 1 and 4));



-- New permissions
-------------------------------------------------

alter table perms_on_pages3 add column  can_see_private_c      can_see_private_d;
alter table perms_on_pages3 add column  can_see_priv_aft_c     timestamp;
alter table perms_on_pages3 add column  can_see_priv_from_nr_c post_nr_d;
alter table perms_on_pages3 add column  can_delete_own_c       bool;

alter table perms_on_pages3 add column  can_post_anon_c        can_see_private_d;
alter table perms_on_pages3 add column  can_post_hidden_c      can_see_private_d;


alter table perms_on_pages3 add column  can_alter_c            bool;  -- [alterPage]
alter table perms_on_pages3 add column  is_owner_c             bool;
alter table perms_on_pages3 add column  can_manage_pats_c      bool;
alter table perms_on_pages3 add column  can_invite_pats_c      bool;  -- instead of adder
alter table perms_on_pages3 add column  can_suspend_pats_c     bool;  -- instead of bouncer

alter table perms_on_pages3 add column  can_assign_pats_c      bool;
alter table perms_on_pages3 add column  can_see_assigned_c     can_see_assigned_d;




-- Private sub threads
-------------------------------------------------


-- There's already hidden_status_c.
alter table posts3 add column  private_status_c  private_status_d;

alter table posts3 add column  creator_status_c  creator_status_d;



-- Anonymous votes
-------------------------------------------------


alter table post_actions3 add column  show_pat_id_c  pat_id_d;
alter table post_actions3 add column  added_by_id_c  pat_id_d;

-- No:  alter table post_actions3 add column  rel_perms_c    rel_perms_d;
--
-- Instead: perms_on_contst  cont_id_c = _  pat_id_c = _ 
--                              .may_grant_c: bool for now, later: perms bitfield?
--                              .may_revoke_c: bool
--   — see below.


-- fk ix: patpostrels_i_showpatid
alter table post_actions3 add constraint patpostrels_showpatid_r_pats
    foreign key (site_id, show_pat_id_c)
    references users3 (site_id, user_id) deferrable;

create index patpostrels_i_showpatid on post_actions3 (site_id, show_pat_id_c);
    where show_pat_id_c is not null;  --   [fk_ix_where_not_null]

-- fk ix: patpostrels_i_addedbyid
alter table post_actions3 add constraint patpostrels_addedbyid_r_pats
    foreign key (site_id, show_pat_id_c)
    references users3 (site_id, user_id) deferrable;

create index patpostrels_i_addedbyid on post_actions3 (site_id, show_pat_id_c);
    where show_pat_id_c is not null;  --   [fk_ix_where_not_null]


-- Anonymous posts
-------------------------------------------------


-- Later, drop: category_id, page_id.
alter table settings3 add column enable_anon_posts_c bool;


-- Interessant!  Via ws: "discussion replies hidden for a while"
-- https://community.canvaslms.com/t5/Canvas-Question-Forum/Is-there-a-way-to-hide-threaded-replies-in-a-graded-discussion/td-p/222165
-- I am having the students reply to a graded discussion.  I am also having the students respond to two student discussion replies.  I would like the students to see the replies to the graded discussion post (so they can select two to reply) but not see the threaded replies.
-- & hide replies until a user posts a reply himself/herself
-- Idea docs:
-- https://community.canvaslms.com/t5/Community/How-do-idea-conversations-work-in-the-Instructure-Community/ta-p/2980

-- https://blog.lucidmeetings.com/blog/25-tools-for-online-brainstorming-and-decision-making-in-meetings

-- Later, create table cont_prefs_t, and move this to there? See db-wip.sql.
--
alter table categories3 add column  comts_hidden_anon_mins_c array[i32_gz_d];  -- ???

-- er table categories3 add column  hidden_comts_c               never_allow_recmd_always_d;
-- er table categories3 add column  show_comts_aft_mins_c        i16_gz_d;
-- er table categories3 add column  show_all_aft_mins_c          i16_gz_d;

alter table categories3 add column  comts_start_hidden_c         never_allow_recmd_always_d;
alter table categories3 add column  comts_shown_aft_mins_c       i32_gz_d;

alter table categories3 add column  op_starts_anon_c             never_allow_recmd_always_d;
alter table categories3 add column  comts_start_anon_c           never_allow_recmd_always_d;
alter table categories3 add column  deanon_aft_mins_c            i32_gz_d;
alter table categories3 add column  deanon_mins_aft_last_c       i32_gz_d;
alter table categories3 add column  deanon_page_aft_mins_c       i32_gz_d;
alter table categories3 add column  deanon_page_mins_aft_last_c  i32_gz_d;

-- er table categories3 add column  anons_deanond_aft_mins_c     i32_gz_d;
-- er table categories3 add column  anons_deanond_aft_mins_individually_c     i32_gz_d;
-- er table categories3 add column  whole_pages_deanond_aft_mins_c i32_gz_d;

--ter table categories3 add column  each_anon_shown_aft_mins_c  never_allow_recmd_always_d;
--ter table categories3 add column  all_anons_shown_aft_mins_c  never_allow_recmd_always_d;
--ter table categories3 add column  page_deanond_aft_mins_c  i16_gz_d;

-- er table categories3 add column  anon_ops_c               never_allow_recmd_always_d;
-- er table categories3 add column  anon_comts_c             never_allow_recmd_always_d;
-- er table categories3 add column  deanon_pages_aft_mins_c  i16_gz_d;
-- er table categories3 add column  deanon_anons_aft_mins_c  i16_gz_d;


-- Skip fks — no fks in this table.
alter table spam_check_queue3 rename column author_id to auhtor_true_id_c;
alter table spam_check_queue3    add column              auhtor_false_id_c  pat_id_d;


alter table drafts3 add column new_anon_status_c  anonym_status_d;
alter table drafts3 add column post_as_id_c       pat_id_d;

-- fk ix: drafts_i_postasid
alter table drafts3 add constraint drafts_postasid_r_pats
    foreign key (site_id, post_as_id_c)
    references users3 (site_id, user_id) deferrable;

create index drafts_i_postasid on drafts3 (site_id, post_as_id_c);
    -- where post_as_id_c is not null; ?   [fk_ix_where_not_null]
    -- and elsewhere in this file


alter table users3 add column true_id_c            member_id_d;
alter table users3 add column deanon_status_c      deanon_status_d;   -- ?
alter table users3 add column pseudonym_status_c   pseudonym_status_d;
alter table users3 add column anonym_status_c      anonym_status_d;
alter table users3 add column anon_on_page_id_st_c page_id_st_d;
alter table users3 add column anon_on_page_id_c    page_id_d__later;


-- fk ix: pats_u_anonofpatid_anononpageid
alter table users3 add constraint pats_trueid_r_pats
    foreign key (site_id, true_id_c)
    references users3 (site_id, user_id) deferrable;

-- fk ix: pats_u_anononpageid
alter table users3 add constraint pats_anononpage_r_pages
    foreign key (site_id, anon_on_page_id_st_c)
    references pages3 (site_id, page_id) deferrable;


create index pats_i_trueid_anononpageid on users3 (
    site_id, true_id_c, anon_on_page_id_st_c);

create index pats_i_anononpageid on users3 (
    site_id, anon_on_page_id_st_c);


alter table users3 add constraint pats_c_pseudonymid_gte100 check (
    pseudonym_status_c is null or user_id >= 100);

alter table users3 add constraint pats_c_anonid_ltem10 check (
    anonym_status_c is null or user_id <= -10);

alter table users3 add constraint pats_c_not_both_anon_pseudo check (
    num_nonnulls(pseudonym_status_c, anonym_status_c) <= 1);

alter table users3 add constraint pats_c_anon_null_same check (
    ((true_id_c is null) and
      (anonym_status_c is null) and
      (anon_on_page_id_st_c is null) and
      (pseudonym_status_c is null)
      )
    or ((true_id_c is not null)
      and (
        ((anonym_status_c is not null) and
         (anon_on_page_id_st_c is not null) and
         (pseudonym_status_c is null)
         )
        or
        ((anonym_status_c is null) and
         (anon_on_page_id_st_c is null) and
         (pseudonym_status_c is not null)
         )
        )));

-- But pseudonyms might need to get approved? Since can have custom name and bio.
-- Anons (and pseudonyms too) can get suspended, I think, so if someone behaves
-- via an anon account, then, suspending just that anon account, is a bit more
-- friendly than suspending the user's real account — like, a first small warning,
-- suitable in some cases (but sometimes better suspend the real account directly).
alter table users3 add constraint pats_c_anon_not_approved check (
    anonym_status_c is null
    or (created_at is not null and
        is_approved is null and
        approved_at is null and
        approved_by_id is null));

-- For now — since pseudonyms haven't been implemented.
alter table users3 add constraint pats_c_pseudonym_null check (
    pseudonym_status_c is null);

-- Maybe later it'll be possible for pseudonyms to configure a different
-- notifications email address — in case one wants discussions related to
-- the pseudonym, to get sent elsewhere. But is that a can of worms? Because
-- then it could also make sense with *per category* notification email adrs,
-- maybe better avoid.
--
alter table users3 add constraint pats_c_anon_no_email check (
    (anonym_status_c is null and
      pseudonym_status_c is null
      )
    or (guest_email_addr is null and
        primary_email_addr is null and
        email_notfs is null and
        email_verified_at is null and
        email_for_every_new_post is null and
        summary_email_interval_mins is null and
        summary_email_if_active is null));

-- These: is_approved, approved_at, approved_by_id
-- are not listed here, because anon users don't need to get approved.
-- Instead, if the real user is approved, the annon is approved too.
--
-- These: suspended_at, suspe/nded_till, suspended_by_id, suspended_reason
-- also aren't listed, because anons *can* get suspended. Can be
-- better than blocking the real account, and, if someone
-- misbehaves repeatedly, when being anon, then, after some of those
-- anon users have gotten suspended, the real user can automatically
-- get prevented from posting anonymously, *without* the mods knowing
-- who hen is (good for privacy & staying anon).
--
-- These: deactivated_at, deleted_at
-- also aren't included. Can make sense to delete an anon account?
--
alter table users3 add constraint pats_c_anon_nulls check (
    anonym_status_c is null
    or (guest_browser_id is null and
        sso_id is null and
        ext_id is null and
        username is null and
        password_hash is null and
        full_name is null and
        country is null and
        website is null and
        about is null and
        is_moderator is null and
        is_admin is null and
        is_superadmin is null and
        is_owner is null and
        is_group = false and
        ui_prefs is null and
        max_upload_bytes_c is null and
        allowed_upload_extensions_c is null and
        -- Maybe there should be an anon user group, where these are configured?:
        -- Or would that be the Everyone group?
        may_search_engines_index_me_c is null and
        may_see_my_activity_tr_lv_c is null and
        may_see_my_username_tr_lv_c is null and
        may_see_my_full_name_tr_lv_c is null and
        may_see_my_tiny_avatar_tr_lv_c is null and
        may_see_my_medium_avatar_tr_lv_c is null and
        may_see_my_brief_bio_tr_lv_c is null and
        may_see_my_full_bio_tr_lv_c is null and
        may_see_my_memberships_tr_lv_c is null and
        may_see_my_profile_tr_lv_c is null and
        may_see_me_in_lists_tr_lv_c is null and
        may_see_if_im_online_tr_lv_c is null and
        may_see_my_visit_stats_tr_lv_c is null and
        may_see_my_post_stats_tr_lv_c is null and
        may_see_my_approx_stats_tr_lv_c is null and
        may_see_my_exact_stats_tr_lv_c is null and
        may_find_me_by_email_tr_lv_c is null and
        may_follow_me_tr_lv_c is null and
        may_mention_me_tr_lv_c is null and
        may_mention_me_same_disc_tr_lv_c is null and
        may_dir_msg_me_tr_lv_c is null and
        why_may_not_mention_msg_me_html_c is null and
        may_see_my_account_email_adrs_tr_lv_c is null and
        may_see_my_contact_email_adrs_tr_lv_c is null and
        may_assign_me_tr_lv_c is null and
        may_see_my_assignments_tr_lv_c is null and
        email_threading_c is null and
        email_notf_details_c is null
        ));

-- Better lock the real user account's levels instead?
alter table users3 add constraint pats_c_anon_no_levels check (
    anonym_status_c is null
    or (trust_level is null and
        locked_trust_level is null and
        threat_level is null and
        locked_threat_level is null and
        tech_level_c is null
        ));

alter table users3 add constraint pats_c_anon_no_avatar check (
    anonym_status_c is null
    or (avatar_tiny_base_url is null and
        avatar_tiny_hash_path is null and
        avatar_small_base_url is null and
        avatar_small_hash_path is null and
        avatar_medium_base_url is null and
        avatar_medium_hash_path is null));


alter table users3 drop constraint pps_c_guest_not_nulls;
alter table users3 add constraint pats_c_guest_non_nulls check (
    -- Member or anonym?
    (user_id > 0 or anonym_status_c is not null)
    -- Else, is a guest (or the Unknown user) and then, add back the constr
    -- deleted above:  (guest email is '-' if absent, so, never null)
    or (created_at is not null and
        full_name is not null and
        guest_email_addr is not null));

alter table users3 drop constraint pps_c_guest_w_no_browserid_has_extid;
alter table users3 add constraint pats_c_guest_w_no_browserid_has_extid check (
    -- Member or anonym?
    (user_id > 0 or anonym_status_c is not null)
    -- Else, is guest (or the Unknown user); then needs a browser id or an ext id.
    or guest_browser_id is not null
    or ext_id is not null);


-- Or maybe:
alter table audit_log3  rename column doer_id             to doer_true_id_c;
alter table audit_log3  rename column target_user_id      to target_pat_true_id_c;
alter table audit_log3  add    column doer_false_id_c       pat_id_d;
alter table audit_log3  add    column target_pat_false_id_c pat_id_d;

alter table audit_log3  add column doer_sess_created_at_c timestamp;


-- Later, delete this fk? So old sessions can be deleted, without having to upd the audit log.
-- But keep it for a while, to discover bugs.
alter table audit_log3 add constraint auditlog_r_sessions
    foreign key (site_id, doer_true_id_c, doer_sess_created_at_c)
    references sessions_t (site_id_c, pat_id_c, created_at_c);

create index auditlog_i_doertrueid_session
    on audit_log3 (site_id, doer_true_id_c, doer_sess_created_at_c);



-- Notification preferences
-------------------------------------------------

-- About new pages, replies, maybe edits to wiki pages.


alter table page_notf_prefs3  rename to page_notf_prefs_t;  -- or node/content_notf_prefs_t?
alter table page_notf_prefs_t rename column people_id to pat_id_c;

alter table page_notf_prefs_t rename column pages_in_whole_site  to pages_in_whole_site_c;
alter table page_notf_prefs_t rename column pages_in_category_id to pages_in_cat_id_c;
alter table page_notf_prefs_t rename column incl_sub_categories  to incl_sub_cats_c;
alter table page_notf_prefs_t rename column pages_pat_created    to pages_pat_created_c;
alter table page_notf_prefs_t rename column pages_pat_replied_to to pages_pat_replied_to_c;

-- SKIP for now: ---------------------------------------
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
-- /SKIP -----------------------------------------------

