-- This evolution:
-- - Replaces FlagCopyVio and Illegal with FlagInapt
-- - Adds hidden/deleted-at/-by columns, and Undelete actions
-- - Adds ClearFlag action
-- - Adds RejectKeepEdits, RejectDeleteEdits actions
-- - Updates DW1_POSTS indexes to take into account that posts can be hidden and deleted
-- - Changes Reject ('Rjct') to Delete-Post ('DelPost')
-- - Adds DW1_POSTS.LAST_MANUALLY_APPROVED_BY_ID


# --- !Ups


alter table DW1_PAGES add column DELETED_AT timestamp;
alter table DW1_PAGES add column DELETED_BY_ID varchar(32);

alter table DW1_POSTS add column POST_HIDDEN_AT timestamp;
alter table DW1_POSTS add column POST_HIDDEN_BY_ID varchar(32);
alter table DW1_POSTS add column POST_DELETED_BY_ID varchar(32);
alter table DW1_POSTS add column TREE_DELETED_BY_ID varchar(32);
alter table DW1_POSTS add column LAST_MANUALLY_APPROVED_BY_ID varchar(32);


-- Set my user as the one that approved the comments (it is).
update DW1_POSTS set LAST_MANUALLY_APPROVED_BY_ID = '55'
  where LAST_MANUALLY_APPROVED_AT is not null and SITE_ID = '3';

-- Mark rejected posts as deleted. I will replace 'Reject' with 'Delete'.
update DW1_POSTS set
  POST_DELETED_AT = LAST_REVIEWED_AT,
  POST_DELETED_BY_ID = '55' -- that's me, KajMagnus, at site '3'
  where LAST_AUTHLY_REVIEWED_AT is not null and LAST_APPROVAL_TYPE is null and SITE_ID = '3';
  -- (Fortunately, there are no rejected posts at any other site, right now.)


alter table DW1_PAGE_ACTIONS add column DELETED_AT timestamp;
alter table DW1_PAGE_ACTIONS add column DELETED_BY_ID varchar(32);


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;

update DW1_PAGE_ACTIONS set TYPE = 'FlagInapt' where TYPE in ('FlagIllegal', 'FlagCopyVio');
update DW1_PAGE_ACTIONS set TYPE = 'DelPost' where TYPE = 'Rjct';
-- (The author of the Rjct:s is already no. 55, that is, me, KajMagnus.)

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv',                                -- <-- Delete 'Rjct', use 'DelPost' instead
  'VoteLike', 'VoteWrong', 'VoteOffTopic',
  'PinAtPos', 'PinVotes',
  'MoveTree',
  'CollapsePost', 'CollapseTree', 'CloseTree', 'Reopen', -- <-- Rename 'ReopenTree' to 'Reopen'
  'HidePostClearFlags', 'Unhide',                  -- <-- Add 'HidePostClearFlags' and 'Unhide'.
  'DelPost', 'DelPostClearFlags', 'DelTree', 'Undelete', -- <-- add 'DelPostClearFlags and 'Undelete'
  'RejectKeepEdits', 'RejectDeleteEdits', -- <-- new
  'FlagSpam', 'FlagInapt', 'FlagOther',  -- <-- replace 'FlagIllegal' and 'CopyVio' with 'Inapt'
  'ClearFlags'));                        -- <-- add 'ClearFlags'
                                         -- <-- remove 'Undo'

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE_APPROVAL__C;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE_APPROVAL__C check(
  case TYPE
    when 'Aprv' then (APPROVAL is not null)
    else true
  end);


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_APPROVAL__C_IN;
update DW1_PAGE_ACTIONS set APPROVAL = 'A' where APPROVAL = 'M';
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_APPROVAL__C_IN
  check (APPROVAL in ('P', 'W', 'A'));


alter table DW1_POSTS drop constraint DW1_POSTS_APPROVAL__C_IN;
update DW1_POSTS set LAST_APPROVAL_TYPE = 'A' where LAST_APPROVAL_TYPE = 'M';
alter table DW1_POSTS add constraint DW1_POSTS_APPROVAL__C_IN
  check (LAST_APPROVAL_TYPE in ('P', 'W', 'A'));


-- DW1_POSTS

-- Flags are important — we first show all non-deleted posts with unhandled flags...
-- (NOTE: If you edit this index, update the corresponding `where` test
-- in RelDbTenantDao.loadPostStatesPendingFlags, or there'll be full table scans!)
drop index if exists DW1_POSTS_PENDING_FLAGS;
create index DW1_POSTS_PENDING_FLAGS on DW1_POSTS (SITE_ID, NUM_PENDING_FLAGS)
  where
    POST_DELETED_AT is null and
    TREE_DELETED_AT is null and
    NUM_PENDING_FLAGS > 0;

-- ...Then unapproved posts, or posts with changes in need of review (that is,
-- edits not yet reviewed, or edits preliminarily approved by the computer)...
-- (NOTE: If you edit this index, update the corresponding `where` test
-- in RelDbTenantDao.loadPostStatesPendingApproval.)
drop index if exists DW1_POSTS_PENDING_STH;
create index DW1_POSTS_PENDING_STH on DW1_POSTS (SITE_ID, LAST_ACTED_UPON_AT)
  where
    POST_DELETED_AT is null and
    TREE_DELETED_AT is null and
    NUM_PENDING_FLAGS = 0 and (
      (LAST_APPROVAL_TYPE is null or LAST_APPROVAL_TYPE = 'P') or
      NUM_EDITS_TO_REVIEW > 0 or
      NUM_COLLAPSES_TO_REVIEW > 0 or
      NUM_UNCOLLAPSES_TO_REVIEW > 0 or
      NUM_DELETES_TO_REVIEW > 0 or
      NUM_UNDELETES_TO_REVIEW > 0);

-- ...Then things with pending suggestions...
-- (NOTE: If you edit this index, update the corresponding `where` test
-- in RelDbTenantDao.loadPostStatesWithSuggestions.)
drop index if exists DW1_POSTS_PENDING_EDIT_SUGGS;
create index DW1_POSTS_PENDING_EDIT_SUGGS on DW1_POSTS (SITE_ID, LAST_ACTED_UPON_AT)
  where
    POST_DELETED_AT is null and
    TREE_DELETED_AT is null and
    NUM_PENDING_FLAGS = 0 and
    LAST_APPROVAL_TYPE in ('W', 'A', 'M') and
    NUM_EDITS_TO_REVIEW = 0 and
    NUM_COLLAPSES_TO_REVIEW = 0 and
    NUM_UNCOLLAPSES_TO_REVIEW = 0 and
    NUM_DELETES_TO_REVIEW = 0 and
    NUM_UNDELETES_TO_REVIEW = 0 and (
      NUM_EDIT_SUGGESTIONS > 0 or
      (NUM_COLLAPSE_POST_VOTES_PRO > 0   and POST_COLLAPSED_AT is null) or
      (NUM_UNCOLLAPSE_POST_VOTES_PRO > 0 and POST_COLLAPSED_AT is not null) or
      (NUM_COLLAPSE_TREE_VOTES_PRO > 0   and TREE_COLLAPSED_AT is null) or
      (NUM_UNCOLLAPSE_TREE_VOTES_PRO > 0 and TREE_COLLAPSED_AT is not null) or
      (NUM_DELETE_POST_VOTES_PRO > 0     and POST_DELETED_AT is null) or
      (NUM_UNDELETE_POST_VOTES_PRO > 0   and POST_DELETED_AT is not null) or
      (NUM_DELETE_TREE_VOTES_PRO > 0     and TREE_DELETED_AT is null) or
      (NUM_UNDELETE_TREE_VOTES_PRO > 0   and TREE_DELETED_AT is not null));

-- And last of all, posts with nothing to review, and no pending suggestions.
-- (Including new auto approved posts by well behaved users.)
-- (NOTE: If you edit this index, update the corresponding `where` test
-- in RelDbTenantDao.loadPostStatesHandled.)
drop index if exists DW1_POSTS_PENDING_NOTHING;
create index DW1_POSTS_PENDING_NOTHING on DW1_POSTS (SITE_ID, LAST_ACTED_UPON_AT)
  where (
    POST_DELETED_AT is not null or
    TREE_DELETED_AT is not null
  ) or (
    NUM_PENDING_FLAGS = 0 and
    LAST_APPROVAL_TYPE in ('W', 'A', 'M') and
    NUM_EDITS_TO_REVIEW = 0 and
    NUM_COLLAPSES_TO_REVIEW = 0 and
    NUM_UNCOLLAPSES_TO_REVIEW = 0 and
    NUM_DELETES_TO_REVIEW = 0 and
    NUM_UNDELETES_TO_REVIEW = 0 and
    NUM_EDIT_SUGGESTIONS = 0 and not (
      NUM_EDIT_SUGGESTIONS > 0 or
      (NUM_COLLAPSE_POST_VOTES_PRO > 0   and POST_COLLAPSED_AT is null) or
      (NUM_UNCOLLAPSE_POST_VOTES_PRO > 0 and POST_COLLAPSED_AT is not null) or
      (NUM_COLLAPSE_TREE_VOTES_PRO > 0   and TREE_COLLAPSED_AT is null) or
      (NUM_UNCOLLAPSE_TREE_VOTES_PRO > 0 and TREE_COLLAPSED_AT is not null) or
      (NUM_DELETE_POST_VOTES_PRO > 0     and POST_DELETED_AT is null) or
      (NUM_UNDELETE_POST_VOTES_PRO > 0   and POST_DELETED_AT is not null) or
      (NUM_DELETE_TREE_VOTES_PRO > 0     and TREE_DELETED_AT is null) or
      (NUM_UNDELETE_TREE_VOTES_PRO > 0   and TREE_DELETED_AT is not null))
  );


-- Change from 100 to 250. A Facebook URL was 124 chars.
alter table DW1_IDS_OPENID drop constraint DW1_IDS_AVATARURL__C_LEN;
alter table DW1_IDS_OPENID add constraint DW1_IDS_AVATARURL__C_LEN CHECK (length(AVATAR_URL) < 250);



# --- !Downs


alter table DW1_PAGES drop column DELETED_AT;
alter table DW1_PAGES drop column DELETED_BY_ID;

alter table DW1_POSTS drop column POST_HIDDEN_AT;
alter table DW1_POSTS drop column POST_HIDDEN_BY_ID;
alter table DW1_POSTS drop column POST_DELETED_BY_ID;
alter table DW1_POSTS drop column TREE_DELETED_BY_ID;
alter table DW1_POSTS drop column LAST_MANUALLY_APPROVED_BY_ID;

alter table DW1_PAGE_ACTIONS drop column DELETED_AT;
alter table DW1_PAGE_ACTIONS drop column DELETED_BY_ID;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;

-- Cannot go back after having inserted new action types, so simply:
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (true);

-- Leave DW1_POSTS indexes as is.
-- Leave constraint DW1_PGAS_TYPE_APPROVAL__C as is.
-- Leave constraint DW1_PGAS_APPROVAL__C_IN as is.
-- Leave constraint DW1_IDS_AVATARURL__C_LEN as is.
