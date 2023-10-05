-- CR missing y
-- It'd be nice with a place to remember what posts to rerender, if
-- e.g. the CDN address has changed, so links to user generated contents
-- need to get updated, or some other renderer settings or whatever.
-- So, job queue is a better name than index queue.
--
-- And to be able to reindex everything, without adding everything to
-- the queue — so, lets add date range "selectors".

alter table  index_queue3  rename to  job_queue_t;

alter table  job_queue_t
    add column  cat_id_c   i32_nz_d,
    add column  pat_id_c   i32_nz_d,
    add column  type_id_c  i32_nz_d,

    -- For (re)indexing everything in a huge database, without adding one entry per
    -- post to the index queue and possibly runnign out disk — instead, add a
    -- time range, then, add the most recent say 100 posts in that range
    -- to the queue, and decrease the range's upper bound, index those 100, pick the
    -- next range and so on. — Reindexing everything can be needed, when upgrading to
    -- new versions of ElasticSearch, or if switching to some other search engine
    -- (if we'll support other search engines too), or indexing more fields.
    --
    -- If lots of posts were imported simultaneously, they might all have the
    -- same externally generated timestamp. Or if two posts are created at the
    -- exact same time (e.g. page title and body). Then, to remember where to
    -- continue indexing, a date isn't enough — we also need a post id offset
    -- (combined with a date).
    --
    -- (Can't use just a tsrange, because we need that above-mentioned post id offset
    -- too, if different posts have the exact same timestamp.)
    --
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

    -- For now, [all_time_ranges_start_at_time_0] (1970) and only time_range_to_c matters.
    add  constraint  jobq_c_timerange_from_0_for_now  check (
        extract(epoch from time_range_from_c) = 0 and time_range_from_ofs_c = 0),

    -- Not now but later, it'll be possible to combine e.g. a category id and time range,
    -- to say that "Pages in this category should be reindexed if they're from between
    -- this and that date" — then, if a sub category is moved to another parent category,
    -- the pages in the sub category can get reindexed bit by bit (small parts of the
    -- time range, at a time, until all done).
    add  constraint  jobq_c_timerange_for_whole_site_for_now  check (
        time_range_to_c is null
            or (page_id is null
            and post_id is null
            and cat_id_c  is null
            and pat_id_c  is null
            and type_id_c is null)),

    -- But doesn't make sense to combine a specific post in a time range.
    add  constraint  jobq_c_0_post_timerange  check (
        (post_id is null) or (time_range_to_c is null)),

    drop constraint  ixq_site_page__u,
    drop constraint  ixq_site_post__u;


-- There's no point in having many entries for the same post.
-- But, later, *could* have different & disjoint time range entries e.g. for a category.
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

-- And, for now, just one time range.
create unique index jobq_u_dowhat_timerange_for_now
    on job_queue_t (site_id, do_what_c) where time_range_to_c is not null;


create index posts_i_lastapprovedat_0deld on posts3(
                                  site_id, greatest(approved_at, last_approved_edit_at))
    -- Or approved_rev_nr is not null?
    where approved_at is not null and deleted_status = 0;

create index posts_gi_lastapprovedat_0deld on posts3(
                                           greatest(approved_at, last_approved_edit_at))
    where approved_at is not null and deleted_status = 0;


create index posts_i_createdat_id on posts3 (site_id, created_at desc, unique_post_id desc); 
create index posts_gi_createdat on posts3 (created_at desc);
