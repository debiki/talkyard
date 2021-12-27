-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.


-- New domains
-------------------------------------------------

create domain i32_lt2e9_d i32_d;
alter  domain i32_lt2e9_d add
   constraint i32_lt2e9_d_c_lt_2e9 check (value < 2000000000);

create domain i32_abs_lt2e9_d i32_lt2e9_d;
alter  domain i32_abs_lt2e9_d add
   constraint i32_abs_lt2e9_d_c_gt_m2e9 check (value > -2000000000);

create domain i32_abs_lt2e9_nz_d i32_abs_lt2e9_d;
alter  domain i32_abs_lt2e9_nz_d add
   constraint i32_abs_lt2e9_nz_d_c_nz check (value <> 0);

create domain i32_lt2e9_gz_d i32_lt2e9_d;
alter  domain i32_lt2e9_gz_d add
   constraint i32_lt2e9_gz_d_c_gz check (value > 0);

create domain i32_lt2e9_gt1000_d i32_lt2e9_d;
alter  domain i32_lt2e9_gt1000_d add
   constraint i32_lt2e9_gt1000_d_c_gt1000 check (value > 1000);


create domain page_id_st_d text_nonempty_ste60_d;
alter  domain page_id_st_d add
   constraint page_id_st_d_c_chars check (value ~ '^[a-zA-Z0-9_]*$');

create domain page_id_d__later  i64_gz_d;

create domain site_id_d     i32_abs_lt2e9_nz_d;
create domain cat_id_d      i32_lt2e9_gz_d;
create domain tagtype_id_d  i32_lt2e9_gt1000_d;

create domain pat_id_d      i32_abs_lt2e9_nz_d;

create domain member_id_d   pat_id_d;
alter  domain member_id_d add
   constraint member_id_d_c_gtz check (value > 0);

create domain anon_or_guest_id_d pat_id_d;
alter  domain anon_or_guest_id_d add
   constraint anon_or_guest_id_d_c_ltm10 check (value <= -10);

create domain no_choose_yes_d i16_d;
alter  domain no_choose_yes_d add
   constraint no_choose_yes_d_c_in check (value in (1, 2, 3));

-- See AnonStatus in the Scala code.
create domain anon_status_d i16_d;
alter  domain anon_status_d add
   constraint anon_status_d_c_in_5_37 check (value in (5, 37));



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
alter table spam_check_queue3 add column true_auhtor_id_c member_id_d;


alter table drafts3 add column new_anon_status_c  anon_status_d;
alter table drafts3 add column post_as_id_c       pat_id_d;

-- fk ix: drafts_i_postasid
alter table drafts3 add constraint drafts_postasid_r_pats
    foreign key (site_id, post_as_id_c)
    references users3 (site_id, user_id) deferrable;

create index drafts_i_postasid on drafts3 (site_id, post_as_id_c);
    -- where post_as_id_c is not null; ?   [fk_ix_where_not_null]
    -- and elsewhere in this file


alter table users3 add column true_id_c            member_id_d;
alter table users3 add column pseudonym_status_c   i32_d; -- later
alter table users3 add column anonym_status_c      anon_status_d;
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


create index pats_u_trueid_anononpageid on users3 (
    site_id, true_id_c, anon_on_page_id_st_c);

create index pats_u_anononpageid on users3 (
    site_id, anon_on_page_id_st_c);


alter table users3 add constraint pats_c_pseudonymid_gte10 check (
    pseudonym_status_c is null or user_id >= 10);

alter table users3 add constraint pats_c_anonid_ltem10 check (
    anonym_status_c is null or user_id <= -10);

alter table users3 add constraint pats_c_not_both_anon_pseudo check (
    num_nonnulls(pseudonym_status_c, anonym_status_c) <= 1);

-- ! what if pseudonym_status_c is set, then true_id_c not null
alter table users3 add constraint pats_c_anon_null_same check (
    num_nonnulls(anonym_status_c, true_id_c, anon_on_page_id_st_c) in (0, 3));

-- But pseudonyms might need to get approved? Since can have custom name and bio.
alter table users3 add constraint pats_c_anon_not_approved check (
    anonym_status_c is null
    or (created_at is not null and
        is_approved is null and
        approved_at is null and
        approved_by_id is null));

-- For now.
alter table users3 add constraint pats_c_pseudonym_null check (
    pseudonym_status_c is null);

alter table users3 add constraint pats_c_anon_nulls check (
    anonym_status_c is null
    or (guest_browser_id is null and
        guest_email_addr is null and
        sso_id is null and
        ext_id is null and
        full_name is null and
        country is null and
        website is null and
        about is null and
        ui_prefs is null and
        see_activity_min_tr_lv_c is null and
        email_notfs is null and
        email_verified_at is null and
        email_for_every_new_post is null and
        summary_email_interval_mins is null and
        summary_email_if_active is null and
        max_upload_bytes_c is null and
        allowed_upload_extensions_c is null and
        see_profile_min_tr_lv_c is null and
        see_approx_stats_min_tr_lv_c is null and
        see_exact_stats_min_tr_lv_c is null));

alter table users3 drop constraint pps_c_guest_not_nulls;
alter table users3 add constraint pats_c_guest_non_nulls check (
    -- Member or anonym?
    (user_id > 0 or anonym_status_c is not null)
    -- Else, is a guest (or the Unknown user) and then:
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



-- Discussion preferences
-------------------------------------------------


alter table page_notf_prefs3  rename to disc_notf_prefs_t;
alter table disc_notf_prefs_t rename column people_id to pat_id_c;

alter table disc_notf_prefs_t rename column pages_in_whole_site  to discs_in_whole_site_c;
alter table disc_notf_prefs_t rename column pages_in_category_id to discs_in_cat_id_c;
alter table disc_notf_prefs_t rename column incl_sub_categories  to incl_sub_cats_c;
alter table disc_notf_prefs_t rename column pages_pat_created    to discs_pat_created_c;
alter table disc_notf_prefs_t rename column pages_pat_replied_to to discs_pat_replied_to;

-- Denormalized tags?
alter table disc_notf_prefs_t add column discs_with_tag_a_id_c tagtype_id_d;
alter table disc_notf_prefs_t add column discs_with_tag_b_id_c tagtype_id_d;
alter table disc_notf_prefs_t add column discs_with_tag_c_id_c tagtype_id_d;

-- ix discnotfprefs_i_tagaid
alter table disc_notf_prefs_t add constraint discnotfprefs_withtaga_r_tags
    foreign key (site_id, discs_with_tag_a_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

-- ix discnotfprefs_i_tagbid
alter table disc_notf_prefs_t add constraint discnotfprefs_withtagb_r_tags
    foreign key (site_id, discs_with_tag_b_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

  -- ix discnotfprefs_i_tagcid
alter table disc_notf_prefs_t add constraint discnotfprefs_withtagc_r_tags
    foreign key (site_id, discs_with_tag_c_id_c)
    references tagtypes_t (site_id_c, id_c) deferrable;

create index discnotfprefs_i_tagaid on disc_notf_prefs_t (site_id, discs_with_tag_a_id_c);
create index discnotfprefs_i_tagbid on disc_notf_prefs_t (site_id, discs_with_tag_b_id_c);
create index discnotfprefs_i_tagcid on disc_notf_prefs_t (site_id, discs_with_tag_c_id_c);


-- And simple expressions? Wait, NO. Use ES instead:
--   https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-range-query.html
-- e.g. tag_a.as_int > 7   or  tag_a.as_int between 5 and 8  ? hmm
-- alter table disc_notf_prefs_t add column only_if_expr_c jsonb;  -- nope!


create table disc_prefs_t(
  site_id_c                site_id_d not null,
  memb_id_c                member_id_d not null,

  discs_in_whole_site_c    bool,
  discs_in_cat_id_c        cat_id_d,  -- ren to just:  cat_id_c
  -- Denormalized AND tag list:
  discs_with_tag_a_id_c    tagtype_id_d,
  discs_with_tag_b_id_c    tagtype_id_d,
  discs_with_tag_c_id_c    tagtype_id_d,
  page_id_st_c             page_id_st_d,
  page_id_int_c            page_id_d__later,

  posts_start_anon_c       no_choose_yes_d,
  posts_stay_anon_c        no_choose_yes_d,
  min_anon_mins_c          i32_gz_d,
  deanon_pages_aft_mins_c  i32_gz_d,
  deanon_posts_aft_mins_c  i32_gz_d,

  -- ix: discprefs_i_membid
  constraint discprefs_r_pats foreign key (site_id_c, memb_id_c)
      references users3 (site_id, user_id) deferrable,

  -- ix discprefs_i_catid
  constraint discprefs_r_cats foreign key (site_id_c, discs_in_cat_id_c)
      references categories3 (site_id, id) deferrable,

  -- ix discprefs_i_tagaid
  constraint discprefs_withtaga_r_tags foreign key (site_id_c, discs_with_tag_a_id_c)
      references tagtypes_t (site_id_c, id_c) deferrable,

  -- ix discprefs_i_tagbid
  constraint discprefs_withtagb_r_tags foreign key (site_id_c, discs_with_tag_b_id_c)
      references tagtypes_t (site_id_c, id_c) deferrable,

  -- ix discprefs_i_tagcid
  constraint discprefs_withtagc_r_tags foreign key (site_id_c, discs_with_tag_c_id_c)
      references tagtypes_t (site_id_c, id_c) deferrable,

  -- ix: discprefs_i_pageid
  constraint discprefs_r_pages foreign key (site_id_c, page_id_st_c)
      references pages3 (site_id, page_id) deferrable,

  constraint discprefs_u_memb_wholesite unique (site_id_c, memb_id_c, discs_in_whole_site_c),
  constraint discprefs_u_memb_incat     unique (site_id_c, memb_id_c, discs_in_cat_id_c),
  constraint discprefs_u_memb_pageid    unique (site_id_c, memb_id_c, page_id_st_c),

  -- The prefs must be for something.
  constraint discprefs_c_for_1_sth check(
    1 = num_nonnulls(
            discs_in_whole_site_c,
            discs_in_cat_id_c,
            page_id_st_c)),

  -- True or null.
  constraint discprefs_c_wholesite_true check (discs_in_whole_site_c),

  -- Guests and anon users cannot configure discussion preferences — only groups
  -- and real users can.
  constraint discprefs_c_for_users_and_groups check (memb_id_c >= 10)
);



create index discprefs_i_membid on disc_prefs_t (site_id_c, memb_id_c);
create index discprefs_i_catid  on disc_prefs_t (site_id_c, discs_in_cat_id_c);
create index discprefs_i_tagaid on disc_prefs_t (site_id_c, discs_with_tag_a_id_c);
create index discprefs_i_tagbid on disc_prefs_t (site_id_c, discs_with_tag_b_id_c);
create index discprefs_i_tagcid on disc_prefs_t (site_id_c, discs_with_tag_c_id_c);
create index discprefs_i_pageid on disc_prefs_t (site_id_c, page_id_st_c);
