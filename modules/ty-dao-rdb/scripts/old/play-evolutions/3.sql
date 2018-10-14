# This evolution pins posts:
#
# 1. Adds DW1_PAGE_ACTIONS.LONG_VALUE
# 2. Supports types 'PinAtPos', and 'PinVotes', which pins a post
# at a certain position, and pins votes to a post, respectively.
# 3. Adds DW1_POSTS.PINNED_POSITION.



# --- !Ups


alter table DW1_PAGE_ACTIONS add column LONG_VALUE bigint;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE_LONGVAL__C check (
  (TYPE <> 'PinAtPos' and TYPE <> 'PinVotes') or (
    LONG_VALUE is not null and LONG_VALUE <> 0 and TEXT is null));


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'Rating',
  'PinAtPos', 'PinVotes',  --   <--- these two are new types
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'CloseTree', 'ReopenTree',
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo', 'VoteUp', 'VoteDown'));


alter table DW1_POSTS add column PINNED_POSITION int default null;



# --- !Downs


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE_LONGVAL__C;

alter table DW1_PAGE_ACTIONS drop column LONG_VALUE;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'Rating',
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'CloseTree', 'ReopenTree',
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo', 'VoteUp', 'VoteDown'));


alter table DW1_POSTS drop column PINNED_POSITION;

