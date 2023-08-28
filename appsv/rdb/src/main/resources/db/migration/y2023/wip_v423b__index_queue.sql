
alter table  index_queue3  add column  search_eng_ver_c  text_oneline_120_d[];
alter table  index_queue3  add column  lang_code_c       text_oneline_60_d[];

-- For (re)indexing everything in a huge database, without adding one entry per
-- post to the index queue and possibly runnign out disk — instead, add a
-- date range (from Genesis to now), then, add the first 100 posts in that range
-- to the queue, and bump the range's lower bound, index those 100, pick the
-- next range and so on. — Reindexing can be needed, when upgrading to
-- new versions of ElasticSearch, or if switching to some other search engine
-- (if we'll support other search engines too).
alter table  index_queue3  add column  date_range_c      tsrange;
-- If lots of posts were imported simultaneously, they might all have the
-- same timestamp — then, in such (extremely unlikely) cases, iterating over
-- the ids of [the page or post with the exact same time stamp], can make sense?
alter table  index_queue3  add column  date_range_ofs_c  i64_d;
alter table  index_queue3  add constraint  ixq_c_daterange_ofs_null  check (
    (date_range_ofs_c is null) or (date_range_c is not null));

alter table  index_queue3  drop constraint  ixq_page_or_post__c_xor;
alter table  index_queue3  drop constraint  ixq_c_page_or_post_or_daterange  check (
    num_nonnulls(page_id, post_id, date_range_c) = 1);


-- drop index ixq_site_page__u;
-- drop index ixq_site_post__u;
-- 
-- create unique index ixq_u_post_0lang  on index_queue3 (site_id, post_id)
--     where lang_code_c is null;
-- 
-- create unique index ixq_u_post_lang  on index_queue3 (site_id, post_id, lang_code_c)
--     where lang_code_c is not null;
-- 
-- create unique index ixq_u_page_0lang  on index_queue3 (site_id, page_id)
--     where lang_code_c is null;
-- 
-- create unique index ixq_u_page_lang  on index_queue3 (site_id, page_id, lang_code_c)
--     where lang_code_c is not null;


--                           Table "public.index_queue3"
--     Column    |            Type             | Collation | Nullable |  Default  
-- --------------+-----------------------------+-----------+----------+-----------
--  inserted_at  | timestamp without time zone |           | not null | now_utc()
--  action_at    | timestamp without time zone |           | not null | 
--  site_id      | integer                     |           | not null | 
--  site_version | integer                     |           | not null | 
--  page_id      | character varying           |           |          | 
--  page_version | integer                     |           |          | 
--  post_id      | integer                     |           |          | 
--  post_rev_nr  | integer                     |           |          | 
-- Indexes:
--     "ixq_site_page__u" UNIQUE CONSTRAINT, btree (site_id, page_id)
--     "ixq_site_post__u" UNIQUE CONSTRAINT, btree (site_id, post_id)
--     "ixq_actionat__i" btree (action_at DESC)
-- Check constraints:
--     "ixq_page_or_post__c_xor" CHECK (page_id IS NULL OR post_id IS NULL)
--     "ixq_page_pageversion__c_nl_eq" CHECK ((page_id IS NULL) = (page_version IS NULL))
--     "ixq_post_postrevnr__c_nl_eq" CHECK ((post_id IS NULL) = (post_rev_nr IS NULL))
