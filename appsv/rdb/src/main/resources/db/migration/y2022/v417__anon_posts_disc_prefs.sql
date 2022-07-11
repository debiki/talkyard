-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.


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

create domain no_choose_yes_d i16_d;
alter  domain no_choose_yes_d add
   constraint no_choose_yes_d_c_in check (value in (1, 2, 3));

-- See AnonStatus in the Scala code.
create domain anonym_status_d i16_d;
alter  domain anonym_status_d add
   constraint anonym_status_d_c_in_5_37 check (value in (5, 37));

create domain pseudonym_status_d i16_d; -- will add constraints later


-- Privacy columns
-------------------------------------------------


alter table users3 rename column see_activity_min_trust_level to see_activity_min_tr_lv_c;
alter table users3 add column see_profile_min_tr_lv_c  trust_level_or_staff_d;

-- But by looking at last visit date-time, reading time, and comparing with
-- anonymous posts, it could be possible to, in a small forum, knwo who posted an
-- anonymous post.  So, sometimes the stats should be hidden
alter table users3 add column see_approx_stats_min_tr_lv_c   trust_level_or_staff_d;
alter table users3 add column see_exact_stats_min_tr_lv_c    trust_level_or_staff_d;



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


alter table users3 add constraint pats_c_pseudonymid_gte10 check (
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

-- For now.
alter table users3 add constraint pats_c_pseudonym_null check (
    pseudonym_status_c is null);

alter table users3 add constraint pats_c_anon_no_email check (
    anonym_status_c is null
    or (guest_email_addr is null and
        primary_email_addr is null and
        email_notfs is null and
        email_verified_at is null and
        email_for_every_new_post is null and
        summary_email_interval_mins is null and
        summary_email_if_active is null));

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
        see_activity_min_tr_lv_c is null and
        max_upload_bytes_c is null and
        allowed_upload_extensions_c is null and
        -- Maybe there should be an anon user group, where these are configured?:
        -- Or would that be the Everyone group?
        see_activity_min_trust_level is null and
        see_profile_min_tr_lv_c is null and
        see_approx_stats_min_tr_lv_c is null and
        see_exact_stats_min_tr_lv_c is null));

-- Better lock the real user account's levels instead?
alter table users3 add constraint pats_c_anon_no_levels check (
    anonym_status_c is null
    or (trust_level is null and
        locked_trust_level is null and
        threat_level is null and
        locked_threat_level is null));

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
-- alter table post_actions3    add column true_id_c             member_id_d;
-- alter table links_t          add column added_by_true_id_c    member_id_d;
-- alter table link_previews_t  add column first_linked_by_id_c  member_id_d;
-- alter table post_revisions3  add composed_by_true_id_c        member_id_d;
-- alter table posts3           add created_by_true_id_c         member_id_d;
-- alter table posts3           add author_id_c                  pat_id_d;
-- alter table posts3           add author_true_id_c             member_id_d;
-- 
-- alter table pages3           add author_true_id_c             member_id_d;
-- -- But leave last_reply_by_id as is — don't add any  last_reply_by_true_id,
-- -- not that interesting.
-- 
-- alter table upload_refs3     add  added_by_true_id_c          member_id_d;
-- 
-- alter table user_visit_stats3 add true_user_id_c              member_id_d;


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


create table cont_prefs_t(
  site_id_c                        site_id_d, -- pk
  pat_id_c                         member_id_d,  -- pk
  prefs_nr_c                       i16_gz_d,  -- pk

  cont_set_type_c                  content_set_type_d not null,

  ops_start_anon_c                 no_choose_yes_d,
  cmts_start_anon_c                no_choose_yes_d,
  -- posts_stay_anon__unimpl_c        no_choose_yes_d,
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
  -- ops_start_wiki__unimpl_c         choose_yes_d,
  -- cmts_start_wiki__unimpl_c        choose_yes_d,
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



alter table categories3 add column cont_prefs_nr_c  i32_gz_d;
alter table categories3 add column cont_pat_id_10_c i32_gz_d default 10;
alter table categories3 add constraint cont_patid10_c_eq10 check (cont_pat_id_10_c = 10);

-- fk ix: cats_i_patid10_contprefsid
-- unique ix: 
alter table categories3 add constraint cats_contprefsid_r_contprefs
    foreign key (site_id, cont_pat_id_10_c, cont_prefs_nr_c)
    references cont_prefs_t (site_id_c, pat_id_c, prefs_nr_c) deferrable;

create index cats_i_patid10_contprefsid on categories3 (site_id, cont_pat_id_10_c, cont_prefs_nr_c);
