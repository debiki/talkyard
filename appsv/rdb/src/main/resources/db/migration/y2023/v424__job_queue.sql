alter table  index_queue3  rename to  job_queue_t;

-- There was a bug:  ixq_page_or_post__c_xor  allowed both columns null
-- (it's deleted & replaced below).
delete from job_queue_t where page_id is null and post_id is null;


alter table  job_queue_t
    add column  cat_id_c   i32_nz_d,
    add column  pat_id_c   i32_nz_d,
    add column  type_id_c  i32_nz_d,

    add column  time_range_from_c     timestamp,
    add column  time_range_from_ofs_c i32_d,
    add column  time_range_to_c       timestamp,
    add column  time_range_to_ofs_c   i32_d,

    -- E.g. reindex orig post upovtes (Do-It votes), or regenerate html to
    -- update CDN links? Or reindex in the search engine = 1, ... or ... what more
    add column  do_what_c  i64_nz_d  not null default 1,

    add constraint  jobq_c_timerange_ofs_null  check (
      (time_range_from_c is null) = (time_range_from_ofs_c is null) and
      (time_range_from_c is null) = (time_range_to_c       is null) and
      (time_range_from_c is null) = (time_range_to_ofs_c   is null)),

    drop constraint  ixq_page_or_post__c_xor,
    add  constraint  jobq_c_one_thing  check (
      -- Either reindex a speific thing (optionally, in a time range),
      num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, type_id_c) = 1
      or (
        -- Or the whole site, in a time range.
        num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, type_id_c) = 0
        and (time_range_to_c is not null))),

    -- For now, [all_time_ranges_start_at_time_0] (1970); only time_range_to_c & to_ofs matter.
    add  constraint  jobq_c_timerange_from_0_for_now  check (
        extract(epoch from time_range_from_c) = 0 and time_range_from_ofs_c = 0),

    add  constraint  jobq_c_timerange_for_whole_site_for_now  check (
        time_range_to_c is null
        or (post_id is null
              and page_id   is null
              and cat_id_c  is null
              and pat_id_c  is null
              and type_id_c is null)),

    -- Doesn't make sense to combine a single post with a time range.
    add  constraint  jobq_c_0_post_w_timerange  check (
        (post_id is null) or (time_range_to_c is null)),

    drop constraint  ixq_site_page__u,
    drop constraint  ixq_site_post__u;


-- There's no point in having many entries for the same post.
-- (But, later, maybe have different & disjoint time range entries e.g. for a category?)
create unique index jobq_u_dowhat_post  on  job_queue_t (site_id, do_what_c, post_id) where post_id is not null;
create unique index jobq_u_dowhat_page  on  job_queue_t (site_id, do_what_c, page_id) where page_id is not null;
create unique index jobq_u_dowhat_cat   on  job_queue_t (site_id, do_what_c, cat_id_c) where cat_id_c is not null;
create unique index jobq_u_dowhat_pat   on  job_queue_t (site_id, do_what_c, pat_id_c) where pat_id_c is not null;
create unique index jobq_u_dowhat_type  on  job_queue_t (site_id, do_what_c, type_id_c) where type_id_c is not null;

-- For now, just one time range per whole site.
create unique index jobq_u_dowhat_site_timerange
    on job_queue_t (site_id, do_what_c)
    where time_range_to_c is not null
      and page_id   is null
      and post_id   is null
      and cat_id_c  is null
      and pat_id_c  is null
      and type_id_c is null;

-- And, for now, just one time range (per job type).
create unique index jobq_u_dowhat_timerange_for_now
    on job_queue_t (site_id, do_what_c) where time_range_to_c is not null;

-- The most recent comments or edits visible to others (to those who can see the category).
create index posts_i_lastapprovedat_0deld on posts3(
        site_id, greatest(approved_at, last_approved_edit_at))
    where approved_at is not null and deleted_status = 0;

-- For reindexing time ranges, bit by bit:
create index posts_i_createdat_id on posts3 (site_id, created_at desc, unique_post_id desc); 

drop index dw2_posts_createdby__i; -- was on only: (site_id, created_by_id)
create index posts_i_createdby_createdat_id on posts3 (
    site_id, created_by_id, created_at desc, unique_post_id desc); 
