-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.


-- Old mistakes
-------------------------------------------------

-- These will be in  pat_rels_t  instead, so can look up post ids directly
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
create domain post_pat_status_d i16_d;

create domain pseudonym_status_d i16_d; -- will add constraints later



-- Anonymous posts
-------------------------------------------------


-- Later, drop: category_id, page_id.
alter table settings3 add column enable_anon_posts_c bool;


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



-- Could do, but I think this is too error prone — I will or have already forgotten
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
--
-- alter table post_actions3    add column true_id_c             member_id_d;
-- alter table links_t          add column added_by_true_id_c    member_id_d;
-- alter table link_previews_t  add column first_linked_by_id_c  member_id_d;
-- alter table post_revisions3  add composed_by_true_id_c        member_id_d;
-- alter table posts3           add created_by_true_id_c         member_id_d;

-- But I've added  author_id_c  already!
-- Now removing. Instead:   pat_rels_t.rel_type_c = AuthorOf
--
-- alter table posts3           add author_id_c                  pat_id_d;
-- alter table posts3           add author_true_id_c             member_id_d;
-- alter table post_read_stats3 add true_id_c                    member_id_d;
-- alter table review_tasks3    add true_id_c
-- alter table upload_refs3     add added_by_true_id_c ?
--
-- user_stats3, hmm?
--
-- pages_t — no, instead, the orig post in posts_t?  Old:
-- alter table pages3           add author_true_id_c             member_id_d;
-- -- But leave last_reply_by_id as is — don't add any  last_reply_by_true_id,
-- -- not that interesting.
-- 
-- alter table upload_refs3     add  added_by_true_id_c          member_id_d;
-- 
-- alter table user_visit_stats3 add true_user_id_c              member_id_d;


-- Let's add a  pat_rels_t.rel_type_c = AuthorOf from the anon to the anon posts?
-- Whilst created_by_id_c would keep pointing to the true author.
-- Then, looking up all one's posts, that just works.
-- And anon posts can easily be filtered away, by checking anon_status_c (because
-- other)



-- Notification preferences
-------------------------------------------------

-- About new pages, replies, maybe edits to wiki pages.


alter table page_notf_prefs3  rename to page_notf_prefs_t;
alter table page_notf_prefs_t rename column people_id to pat_id_c;

alter table page_notf_prefs_t rename column pages_in_whole_site  to pages_in_whole_site_c;
alter table page_notf_prefs_t rename column pages_in_category_id to pages_in_cat_id_c;
alter table page_notf_prefs_t rename column incl_sub_categories  to incl_sub_cats_c;
alter table page_notf_prefs_t rename column pages_pat_created    to pages_pat_created_c;
alter table page_notf_prefs_t rename column pages_pat_replied_to to pages_pat_replied_to_c;

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



-- Later, create table cont_prefs_t, and move this to there? See db-wip.sql.
--
alter table categories3 add column  anon_ops_c               never_allow_recmd_always_d;
alter table categories3 add column  anon_comts_c             never_allow_recmd_always_d;
alter table categories3 add column  deanon_pages_aft_mins_c  i16_gz_d;
alter table categories3 add column  deanon_posts_aft_mins_c  i16_gz_d;
