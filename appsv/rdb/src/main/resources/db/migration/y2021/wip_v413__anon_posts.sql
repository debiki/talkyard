
-- unique? (per site) — so can just set author_id_c and created_by_id_c to null,
-- but still see which anon character created the post.
-- Maybe can add a pats_t.character_id_c field, so an anon character can optionally
-- get a name and bio (if the human controlling the anon character wants to give it a
-- description).
--create domain character_id_d i32_gz_d;


-- New domains
-------------------------------------------------

create domain site_id_d i32_d;
alter  domain site_id_d add
   constraint site_id_d_not_0 check (value <> 0);


create domain page_id_st_d text_nonempty_ste60_d;
alter  domain page_id_st_d add
   constraint page_id_st_d_c_chars check (value ~ '^[a-z0-9_]*$');

create domain page_id_d__later i32_gz_d;


create domain cat_id_d i32_gz_d;


-- Just a random value?
create domain anonym_id_d i32_gz_d;

-- For now, always 50 = anon char, per discussion.
create domain anon_level_d i16_d;
alter  domain anon_level_d add
   constraint anon_level_d_c_in check (value in (10, 50));


create domain pat_type_d i16_d;
alter  domain pat_type_d add
   constraint pat_type_d_c_in_1_4_9_12 check (value in (1, 4, 9, 12));

create domain pat_type_user_d pat_type_d;
alter  domain pat_type_user_d add
   constraint pat_type_user_d_c_9 check (value = 9);

create domain pat_type_group_d pat_type_d;
alter  domain pat_type_group_d add
   constraint pat_type_group_d_c_12 check (value = 12);

create domain pat_type_user_group_d pat_type_d;
alter  domain pat_type_user_group_d add
   constraint pat_type_user_group_d_c_in_9_12 check (value in (9, 12));



-- Privacy and participant type columns
-------------------------------------------------

alter table users3 rename column see_activity_min_trust_level to see_activity_min_tr_lv_c;
alter table users3 add column see_profile_min_tr_lv_c  trust_level_or_staff_d;


alter table users3 add column pat_type_c pat_type_d not null default 9;  -- user
update users3
    set pat_type_c = case
        when user_id < 0 then 1                 -- guest
        when user_id = 1 or user_id = 2 then 4  -- system accounts
        else 12                                 -- group
    end
    where user_id < 0 or is_group;
-- Ooops, need to insert on creation!

-- Doesn't need to be unique — there's already the primary key. But Postgres
-- wants it to be? So can foreign key link to it?
create unique index pats_u_id_type on users3 (site_id, user_id, pat_type_c);

alter table users3 add constraint pats_c_id_type check (
    (user_id < 0 and pat_type_c = 1) or
    (user_id in (1, 2) and pat_type_c = 4) or
    (not is_group and pat_type_c = 9) or
    (is_group and pat_type_c = 12));

-- alter table users3 add constraint pats_c_group_type check (
--   (is_group and pat_type_c = 12) or (not is_group and pat_type_c != 12));


-- Later: drop  is_group, use instead: pat_type_c = 12



-- Anonymous posts
-------------------------------------------------


-- Later, drop: category_id, page_id.
alter table settings3 add column enable_anon_posts_c bool;



alter table page_notf_prefs3 rename to disc_notf_prefs_t;
alter table disc_notf_prefs_t rename column people_id to pat_id_c;



create table disc_prefs_t(
  site_id_c                site_id_d not null,
  pat_id_c                 pat_id_d not null,
  pat_type_c               pat_type_user_group_d not null,
  discs_in_whole_site_c    bool,
  discs_in_cat_id_c        cat_id_d,
  page_id_st_c             page_id_st_d,
  page_id_nr_c             page_id_d__later,
  
  anon_level_c             anon_level_d,
  min_anon_level_c         anon_level_d, -- default 50. Per group, conf by adm
  max_anon_level_c         anon_level_d, -- default 50. Per group, conf by adm
  min_anon_mins_c          i32_gz_d,
  deanon_post_aft_mins_c   i32_gz_d,
  deanon_page_aft_mins_c   i32_gz_d,
  -- anonym_id_c           anonym_id_d,  -- per user and cat/site
  -- anonym_ttl_mins_c     i32_gz_d,
  -- min_anonym_ttl_mins_c i32_gz_d,  -- for admins

  -- ix: discprefs_i_pat_pattype
  constraint discprefs_r_pats foreign key (site_id_c, pat_id_c, pat_type_c)
      references users3 (site_id, user_id, pat_type_c) deferrable,

  -- ix: discprefs_i_pageid
  constraint discprefs_r_pages foreign key (site_id_c, page_id_st_c)
      references pages3 (site_id, page_id) deferrable,

  -- ix discprefs_i_cat
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

  -- Only users (type 9) can have an anonym id — groups are just for
  -- configuration, not for actually being anonymous.
  -- constraint discprefs_c_only_for_users check (pat_type_c = 9 or anonym_id_c is null),

  -- Max and min are for groups, type 12, configured by admins (or maybe group mods).
  constraint discprefs_c_only_for_groups check (pat_type_c = 12 or (
      min_anon_level_c is null and max_anon_level_c is null))
         -- and min_anonym_ttl_mins_c is null))
);



create index discprefs_i_pat_pattype on disc_prefs_t (site_id_c, pat_id_c, pat_type_c);
create index discprefs_i_pageid on disc_prefs_t (site_id_c, page_id_st_c);
create index discprefs_i_cat on disc_prefs_t (site_id_c, discs_in_cat_id_c);



create table anonym_ids_t(
  site_id_c    int not null,
  anonym_id_c  anonym_id_d not null,
  pat_id_c     pat_id_d not null,
  pat_type_c   pat_type_user_d not null,

  constraint anonymids_p_anonymid primary key (site_id_c, anonym_id_c),

  -- ix: anonymids_i_patid_pattype
  constraint anonymids_r_pats foreign key (site_id_c, pat_id_c, pat_type_c)
     references users3 (site_id, user_id, pat_type_c) deferrable
);

create index anonymids_i_patid_pattype on anonym_ids_t (site_id_c, pat_id_c, pat_type_c);



alter table posts3 add column anonym_id_c   anonym_id_d;
alter table posts3 add column anon_level_c  anon_level_d;

create index posts3_i_anonymid on posts3 (site_id, anonym_id_c);

-- ix:  posts3_i_anonymid  and  anonymids_p_anonymid
alter table posts3 add constraint posts_anonymid_r_anonymids
    foreign key (site_id, anonym_id_c)
    references anonym_ids_t (site_id_c, anonym_id_c) deferrable;

