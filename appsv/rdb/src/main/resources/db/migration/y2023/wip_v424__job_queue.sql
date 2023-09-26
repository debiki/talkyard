-- It'd be nice with a place to remember what posts to rerender, if
-- e.g. the CDN address has changed, so links to user generated contents
-- need to get updated, or some other renderer settings or whatever.
-- So, job queue is a better name than index queue.
--
-- And to be able to reindex everything, without adding everything to
-- the queue — so, lets add date range "selectors".

alter table  index_queue3  add column  cat_id_c   i32_nz_d;

alter table  index_queue3  add column  pat_id_c   i32_nz_d;

alter table  index_queue3  add column  type_id_c  i32_nz_d;

-- For (re)indexing everything in a huge database, without adding one entry per
-- post to the index queue and possibly runnign out disk — instead, add a
-- date range (from genesis to now), then, add the first 100 posts in that range
-- to the queue, and bump the range's lower bound, index those 100, pick the
-- next range and so on. — Reindexing can be needed, when upgrading to
-- new versions of ElasticSearch, or if switching to some other search engine
-- (if we'll support other search engines too).
alter table  index_queue3  add column  date_range_c      tsrange;

-- To convert to tsrange:
--    select tsrange(
--             to_timestamp(start_in_seconds_double), 
-- )
-- SELECT tsrange(
--     to_timestamp(start_unix_timestamp / 1000.0, start_unix_timestamp % 1000 * 1.0),
--     to_timestamp(end_unix_timestamp / 1000.0, end_unix_timestamp % 1000 * 1.0)
-- );


-- If lots of posts were imported simultaneously, they might all have the
-- same timestamp — then, in such (extremely unlikely) cases, iterating over
-- the ids of [the page or post with the exact same time stamp], can make sense?
alter table  index_queue3  add column  date_range_id_ofs_c  i64_d;
alter table  index_queue3  add constraint  ixq_c_daterange_ofs_null  check (
    (date_range_id_ofs_c is null) or (date_range_c is not null));

-- See:  smtp_msg_ids_out_d  text[], has a fancy array constraint.
alter table  index_queue3  add column  search_eng_vers_c  text[];
alter table  index_queue3  add column  lang_codes_c       text[];
alter table  index_queue3  add constraint ixq_c_searchengv_len check (pg_column_size(search_eng_vers_c) < 250);
alter table  index_queue3  add constraint ixq_c_langcodes_len check (pg_column_size(lang_codes_c) < 250);

-- E.g. reindex orig post upovtes (Do-It votes), or regenerate html to
-- update CDN links? or reindex in ElasticSearch, ... or ... what more
alter table  index_queue3  add column  do_what_c  i64_nz_d  not null default 1;


alter table  index_queue3  drop constraint  ixq_page_or_post__c_xor;
alter table  index_queue3  add  constraint  ixq_c_one_thing  check (
    num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, type_id_c, date_range_c) = 1);

alter table  index_queue3  drop constraint  ixq_site_page__u;
alter table  index_queue3  drop constraint  ixq_site_post__u;

create unique index jobqueue_u_dowhat_post  on  index_queue3 (site_id, do_what_c, post_id);
create unique index jobqueue_u_dowhat_page  on  index_queue3 (site_id, do_what_c, page_id);
create unique index jobqueue_u_dowhat_cat   on  index_queue3 (site_id, do_what_c, cat_id_c);
create unique index jobqueue_u_dowhat_pat   on  index_queue3 (site_id, do_what_c, pat_id_c);
create unique index jobqueue_u_dowhat_type  on  index_queue3 (site_id, do_what_c, type_id_c);


-- alter table  index_queue3  rename to  job_queue_t;


create index posts_i_lastapprovedat_0deld on posts3(
                                  site_id, greatest(approved_at, last_approved_edit_at))
    where approved_at is not null and deleted_at is null;

create index posts_gi_lastapprovedat_0deld on posts3(
                                           greatest(approved_at, last_approved_edit_at))
    where approved_at is not null and deleted_at is null;


create unique index jobq_u_dowhat_fromtime0
    on index_queue3 (site_id, do_what_c)
    where extract(epoch from lower(date_range_c)) = 0
      and page_id_c is null
      and post_id_c is null
      and cat_id_c  is null
      and pat_id_c  is null
      and type_id_c is null;


create index posts_i_createdat on posts3 (site_id, created_at desc); 
create index posts_gi_createdat on posts3 (created_at desc);
