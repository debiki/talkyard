-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.


-- New domains
-------------------------------------------------

create domain site_id_d i32_d;
alter  domain site_id_d add
   constraint site_id_d_c_not_0 check (value <> 0);

create domain pat_id_d i32_d;
alter  domain pat_id_d add
   constraint pat_id_d_c_not_0 check (value <> 0);

-- Higher absolute values are reserved, for now:
alter  domain pat_id_d add
   constraint pat_id_d_c_lt_2e9 check (value < 2000000000);
alter  domain pat_id_d add
   constraint pat_id_d_c_gt_min2e9 check (value > -2000000000);

create domain page_id_st_d text_nonempty_ste60_d;
alter  domain page_id_st_d add
   constraint page_id_st_d_c_chars check (value ~ '^[a-z0-9_]*$');

create domain page_id_d__later i32_gz_d;


create domain cat_id_d i32_gz_d;


create domain no_choose_yes_d i16_d;
alter  domain no_choose_yes_d add
   constraint no_choose_yes_d_c_in check (value in (1, 2, 3));

create domain pat_type_d i16_d;
alter  domain pat_type_d add
   constraint pat_type_d_c_in_1_4_9_12 check (value in (1, 2, 3, 4, 9, 12));

create domain pat_type_user_d pat_type_d;
alter  domain pat_type_user_d add
   constraint pat_type_user_d_c_eq_9 check (value = 9);

create domain pat_type_group_d pat_type_d;
alter  domain pat_type_group_d add
   constraint pat_type_group_d_c_eq_12 check (value = 12);

create domain pat_type_user_group_d pat_type_d;
alter  domain pat_type_user_group_d add
   constraint pat_type_user_group_d_c_in_9_12 check (value in (9, 12));



-- Privacy and participant type columns
-------------------------------------------------


alter table users3 rename column see_activity_min_trust_level to see_activity_min_tr_lv_c;
alter table users3 add column see_profile_min_tr_lv_c  trust_level_or_staff_d;

-- But by looking at last visit date-time, reading time, and comparing with
-- anonymous posts, it could be possible to, in a small forum, knwo who posted an
-- anonymous post.  So, sometimes the stats should be hidden
alter table users3 add column see_stats_min_tr_lv_c    trust_level_or_staff_d;
      -- or, but a bit long:  see_stats_and_dates_min_tr_lv_c


alter table users3 add column pat_type_c pat_type_d not null default 9;  -- user
update users3
    set pat_type_c = case
        when user_id = -3 then 3                -- unknown pat
        when user_id < 0 then 1                 -- guest
        when user_id = 1 or user_id = 2 then 4  -- system accounts
        else 12                                 -- group
    end
    where user_id <= 2 or is_group;
-- Ooops, need to insert on creation!

-- Doesn't need to be unique — there's already the primary key. But Postgres
-- wants it to be? So can foreign key link to it?
create unique index pats_u_id_type on users3 (site_id, user_id, pat_type_c);

alter table users3 add constraint pats_c_id_type_guest_anon check (
    user_id > -10 or pat_type_c in (1, 2));

alter table users3 add constraint pats_c_id_type_unknown check (
    user_id <> -3 or pat_type_c = 3);

alter table users3 add constraint pats_c_id_type_sys_sysbot check (
    user_id not in (1, 2) or pat_type_c = 4);

alter table users3 add constraint pats_c_id_type_user check (
    user_id <= 2 or is_group or pat_type_c = 9);

alter table users3 add constraint pats_c_id_type_group check (
    user_id <= 2 or not is_group or pat_type_c = 12);

-- Later: drop  is_group, use instead: pat_type_c = 12



-- Anonymous posts
-------------------------------------------------


alter table users3 add column anon_for_pat_id_c    pat_id_d;
alter table users3 add column anon_on_page_id_st_c page_id_st_d;
alter table users3 add column anon_on_page_id_c    page_id_d__later;
alter table users3 add column still_anon_c         bool;   -- undef if was never anon

alter table users3 add constraint pats_c_anon_cols check (
    (still_anon_c is null) = (anon_for_pat_id_c is null) and
    (still_anon_c is null) = (anon_on_page_id_st_c is null));

-- fk ix: pats_u_anonforpatid_anononpageid
alter table users3 add constraint pats_anonforpat_r_pats
    foreign key (site_id, anon_for_pat_id_c)
    references users3 (site_id, user_id) deferrable;

-- fk ix: pats_u_anononpageid
alter table users3 add constraint pats_anononpage_r_pages
    foreign key (site_id, anon_on_page_id_st_c)
    references pages3 (site_id, page_id) deferrable;

create index pats_u_anonforpatid_anononpageid on users3 (
    site_id, anon_for_pat_id_c, anon_on_page_id_st_c);

create index pats_u_anononpageid on users3 (
    site_id, anon_on_page_id_st_c);


-- Later, drop: category_id, page_id.
alter table settings3 add column enable_anon_posts_c bool;



-- Discussion preferences
-------------------------------------------------


alter table page_notf_prefs3 rename to disc_notf_prefs_t;
alter table disc_notf_prefs_t rename column people_id to pat_id_c;


create table disc_prefs_t(
  site_id_c                site_id_d not null,
  pat_id_c                 pat_id_d not null,
  pat_type_c               pat_type_user_group_d not null,

  discs_in_whole_site_c    bool,
  discs_in_cat_id_c        cat_id_d,  -- ren to just:  cat_id_c
  page_id_st_c             page_id_st_d,
  page_id_int_c            page_id_d__later,

  posts_start_anon_c       no_choose_yes_d,
  posts_stay_anon_c        no_choose_yes_d,
  min_anon_mins_c          i32_gz_d,
  deanon_pages_aft_mins_c  i32_gz_d,
  deanon_posts_aft_mins_c  i32_gz_d,

  -- ix: discprefs_i_patid_pattype
  constraint discprefs_r_pats foreign key (site_id_c, pat_id_c, pat_type_c)
      references users3 (site_id, user_id, pat_type_c) deferrable,

  -- ix: discprefs_i_pageid
  constraint discprefs_r_pages foreign key (site_id_c, page_id_st_c)
      references pages3 (site_id, page_id) deferrable,

  -- ix discprefs_i_catid
  constraint discprefs_r_cats foreign key (site_id_c, discs_in_cat_id_c)
      references categories3 (site_id, id) deferrable,

  constraint discprefs_u_pat_wholesite unique (site_id_c, pat_id_c, discs_in_whole_site_c),
  constraint discprefs_u_pat_incat     unique (site_id_c, pat_id_c, discs_in_cat_id_c),
  constraint discprefs_u_pat_pageid    unique (site_id_c, pat_id_c, page_id_st_c),

  -- The prefs must be for something.
  constraint discprefs_c_for_1_sth check(
    1 = num_nonnulls(
            discs_in_whole_site_c,
            discs_in_cat_id_c,
            page_id_st_c)),

  -- True or null.
  constraint discprefs_c_wholesite_true check (discs_in_whole_site_c),

  -- Only users (type 9) and groups (type 12) can configure discussion preferences.
  constraint discprefs_c_for_users_and_groups check (
        pat_type_c = 9 or pat_type_c = 12)
);



create index discprefs_i_patid_pattype on disc_prefs_t (site_id_c, pat_id_c, pat_type_c);
create index discprefs_i_pageid on disc_prefs_t (site_id_c, page_id_st_c);
create index discprefs_i_catid on disc_prefs_t (site_id_c, discs_in_cat_id_c);
