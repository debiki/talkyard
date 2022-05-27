
-- cats? SquashSiblingIndexLimit
-- or SummarizeNumRepliesVisibleLimit
-- Feature flag

-- orig post votes?
-- other votes

create domain i16_nz_d as smallint constraint i16gz_c_nz check (value <> 0);
create domain i32_nz_d as smallint constraint i32gz_c_nz check (value <> 0);
create domain i64_nz_d as bigint   constraint i64gz_c_nz check (value <> 0);

create domain comt_order_d i16_nz_d;
-- For now. Later, maybe almost anything will be allowed — a nibble-field,
-- where each nibble is the sort order of replies of a certain depth.
-- See: [ComtSortOrder], in client/types-and-const-enums.ts.
-- But ComtSortOrder.Default = 0 is never saved in the database.
alter  domain comt_order_d add
   constraint comt_order_d_c_in check (value in (1, 2, 3, 18, 50));

create domain max_nesting_d i16_d;
alter  domain max_nesting_d add
   constraint max_nesting_d_c_eq_m1_or_gtz check (value = -1 or value >= 1);
alter  domain max_nesting_d add
   constraint max_nesting_d_c_lte100 check (value <= 100);

-- Later, instead in: disc_view_t, see [disc_props_view_stats]
alter table pages3      add column comt_order_c   comt_order_d;
alter table pages3      add column comt_nesting_c max_nesting_d;

-- The defaut for the pages in a cat and its sub cats.
alter table categories3 add column comt_order_c   comt_order_d;
alter table categories3 add column comt_nesting_c max_nesting_d;


-- De-prioritizes this page (or sub thread) among the search results.
-- Say, a question or idea about something, before there were any docs
-- — and later on, docs are written, and the original question is no longer
-- that interesting (because the docs are shorter and better).

-- null = 0 = default.

-- 0b00__:  (not impl)
-- -0x01 – -0x03 = deprioritize this post only, not replies,
-- -1 = a bit ... -3 = most.
--
-- 0b__00  (not impl)
-- -4, -8, -12 = deprioritize replies (sub thread) but not this post.
--         Could be useful for docs pages if comments are usually less important?
--         So someone who searches for sth, primarily finds the orig posts = the docs,
--         not comments?
--
-- -4 + -1 deprioritize whole page and replies, or comment and sub thread.
-- -8 + -2 deprioritize medium much
-- = -10  — implemented?

-- 0x01-3 = boost post  = let's *not* implement for now
-- 0x04-6 = de-prio post,  5 = medium much, let's implement
-- 0x07   = don't index

-- 0b0000 0000  normal (stored as null)

-- 0b0000 0001  boost a bit
-- 0b0000 0010  boost medium much
-- 0b0000 0011  boost much
--
-- 0b0000 0101  de-prio a bit
-- 0b0000 0110  de-prio medium much
-- 0b0000 0111  de-prio much

-- 0b0000 1111  don't index at all

-- 0b0110 0110  de-prio page and comments medium much
--          = 102

create domain index_prio_d i16_nz_d;
alter  domain index_prio_d add
   constraint index_prio_d_c_eq102 check (value = 102);

alter table posts3 add column index_prio_c index_prio_d;
