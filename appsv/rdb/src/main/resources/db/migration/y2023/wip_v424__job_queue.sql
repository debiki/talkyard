-- It'd be nice with a place to remember what posts to rerender, if
-- e.g. the CDN address has changed, so links to user generated contents
-- need to get updated, or some other renderer settings or whatever.
-- So, job queue is a better name than index queue.
--
-- And to be able to reindex everything, without adding everything to
-- the queue — so, lets add date range "selectors".

alter table  index_queue3  add column  cat_id_c   i32_nz_d;

alter table  index_queue3  add column  pat_id_c   i32_nz_d;

-- For (re)indexing everything in a huge database, without adding one entry per
-- post to the index queue and possibly runnign out disk — instead, add a
-- date range (from genesis to now), then, add the first 100 posts in that range
-- to the queue, and bump the range's lower bound, index those 100, pick the
-- next range and so on. — Reindexing can be needed, when upgrading to
-- new versions of ElasticSearch, or if switching to some other search engine
-- (if we'll support other search engines too).
alter table  index_queue3  add column  date_range_c      tsrange;
-- If lots of posts were imported simultaneously, they might all have the
-- same timestamp — then, in such (extremely unlikely) cases, iterating over
-- the ids of [the page or post with the exact same time stamp], can make sense?
alter table  index_queue3  add column  date_range_id_ofs_c  i64_d;
alter table  index_queue3  add constraint  ixq_c_daterange_ofs_null  check (
    (date_range_id_ofs_c is null) or (date_range_c is not null));

alter table  index_queue3  add column  search_eng_vers_c  text_oneline_120_d[];
alter table  index_queue3  add column  lang_codes_c       text_oneline_60_d[];

alter table  index_queue3  add column  do_what_c  i64_nz_d  not null default 1;


alter table  index_queue3  drop constraint  ixq_page_or_post__c_xor;
alter table  index_queue3  drop constraint  ixq_c_page_post_cat_pat_daterange  check (
    num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, date_range_c) = 1);

drop index ixq_site_page__u;
drop index ixq_site_post__u;

create unique index jobqueue_u_dowhat_post  on  index_queue3 (site_id, do_what_c, post_id);
create unique index jobqueue_u_dowhat_page  on  index_queue3 (site_id, do_what_c, page_id);
create unique index jobqueue_u_dowhat_cat   on  index_queue3 (site_id, do_what_c, cat_id_c);
create unique index jobqueue_u_dowhat_pat   on  index_queue3 (site_id, do_what_c, pat_id_c);


alter table  index_queue3  rename to  job_queue_t;

