-- This evolution is for Like/Wrong/Off-Topic ratings.
-- - Adds VoteLike VoteWrong and VoteOffTopic DW1_PAGE_ACTIONS.TYPE:s
-- - Converts most old ratings to above-mentioned 3 types
-- - Deletes DW1_RATINGS


# --- !Ups


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'Rating',  -- <-- will be removed, after conversion of ratings interesting/funny to VoteLike.
  'VoteLike', 'VoteWrong', 'VoteOffTopic', -- <-- replaces 'Rating'
  'PinAtPos', 'PinVotes',
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'CloseTree', 'ReopenTree',
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo', 'VoteUp', 'VoteDown'));

update DW1_PAGE_ACTIONS a
    set TYPE = 'VoteLike'
    where TYPE = 'Rating'
      and exists(
        select * from DW1_PAGE_RATINGS r
        where r.TENANT = a.TENANT
          and r.PAGE_ID = a.PAGE_ID
          and r.PAID = a.PAID
          and r.TAG in ('funny', 'interesting'));

update DW1_PAGE_ACTIONS a
    set TYPE = 'VoteWrong'
    where TYPE = 'Rating'
      and exists(
        select * from DW1_PAGE_RATINGS r
        where r.TENANT = a.TENANT
          and r.PAGE_ID = a.PAGE_ID
          and r.PAID = a.PAID
          and r.TAG in ('faulty', 'stupid'));

update DW1_PAGE_ACTIONS a
    set TYPE = 'VoteOffTopic'
    where TYPE = 'Rating'
      and exists(
        select * from DW1_PAGE_RATINGS r
        where r.TENANT = a.TENANT
          and r.PAGE_ID = a.PAGE_ID
          and r.PAID = a.PAID
          and r.TAG in ('off-topic'));

drop table DW1_PAGE_RATINGS;
delete from DW1_PAGE_ACTIONS where TYPE = 'Rating';


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TYPE__C_IN;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE__C_IN check (TYPE in (
  'Post', 'Edit', 'EditApp',
  'Aprv', 'Rjct',
  'VoteLike', 'VoteWrong', 'VoteOffTopic', -- <-- replaces 'Rating'
  'PinAtPos', 'PinVotes',
  'MoveTree',
  'CollapsePost', 'CollapseTree',
  'CloseTree', 'ReopenTree',
  'DelPost', 'DelTree',
  'FlagSpam', 'FlagIllegal', 'FlagCopyVio', 'FlagOther',
  'Undo'));                                 -- <-- 'VoteUp', 'VoteDown' removed


# --- !Downs


-- Simply recreate DW1_PAGE_RATINGS, so the up scripts will work again.

create table DW1_PAGE_RATINGS(
  TENANT varchar(32) not null,
  PAGE_ID varchar(32) not null,
  PAGE varchar(32),
  PAID int,
  TAG varchar(30) not null,
  constraint DW1_ARTS__P primary key (TENANT, PAGE_ID, PAID, TAG),
  constraint DW1_ARTS__R__PGAS  -- ix primary key
      foreign key (TENANT, PAGE_ID, PAID)
      references DW1_PAGE_ACTIONS(TENANT, PAGE_ID, PAID) deferrable
);


