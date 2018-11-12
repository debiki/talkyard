# This evolution:
#
# 1. Adds a full text search status column to DW1_PAGE_ACTIONS, for
# TYPE = 'Post' rows. It keeps track of into which ElasticSearch index each
# post has been indexed. And it's indexed itself, so the server can quickly
# find all unindexed posts.
#
# 2. Makes it possible to close and reopen threads (trees), by adding
# action types Close/ReopenTree, and caching a tree's closed status in DW1_POSTS.


# --- !Ups

---- Full text search.

alter table DW1_PAGE_ACTIONS add column INDEX_VERSION int;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_INDEXVER_TYPE__C check (
  INDEX_VERSION is null or TYPE = 'Post');


-- Include site id so in the future it'll be possible to efficiently find
-- 100 posts from site A, then 100 from site B, then site C, etcetera,
-- so each site gets a fair time slot (avoid starvation).
create index DW1_PGAS_INDEXVERSION on DW1_PAGE_ACTIONS(INDEX_VERSION, TENANT)
  where TYPE = 'Post';

update DW1_PAGE_ACTIONS set INDEX_VERSION = 0 where type = 'Post';


---- Close/reopen trees.

alter table DW1_POSTS add column TREE_CLOSED_AT timestamp;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'Rating',
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'CloseTree', 'ReopenTree',  --   <--- these two are new types
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo', 'VoteUp', 'VoteDown'));



# --- !Downs
-- (not tested!)

---- Full text search.

drop index DW1_PGAS_INDEXVERSION;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_INDEXVER_TYPE__C;

alter table DW1_PAGE_ACTIONS drop column INDEX_VERSION;
-- alter table DW1_PAGE_ACTIONS drop column VERSION;


---- Close/reopen trees.

alter table DW1_POSTS drop column TREE_CLOSED_AT;

update DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
update DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'Rating',
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo', 'VoteUp', 'VoteDown'));

