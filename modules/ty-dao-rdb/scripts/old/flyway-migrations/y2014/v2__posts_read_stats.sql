-- This evolution:
--  - Creates posts-read-stats table.
--  - Adds a unique index for votes and removes duplicates.


create table DW1_POSTS_READ_STATS(
  SITE_ID varchar(32) not null,
  PAGE_ID varchar(32) not null,
  POST_ID int not null,
  IP character varying(39),
  USER_ID varchar(32),
  -- The action that resulted in this post being considered read.
  READ_ACTION_ID int not null,
  READ_AT timestamp not null,
  -- Don't include the action id in the constraint because the action might be deleted,
  -- for example if it's a vote and someone undoes the vote.
  constraint DW1_PSTSRD_SITE_PAGE__R__PAGES foreign key (SITE_ID, PAGE_ID)
      references DW1_PAGES(TENANT, GUID)
);

-- Guest users may read a post only once per ip. Guest user ids start with '-', right now.
create unique index DW1_PSTSRD_GUEST_IP__U on DW1_POSTS_READ_STATS (SITE_ID, PAGE_ID, POST_ID, IP)
  where USER_ID is null or USER_ID like '-%';

-- Roles and guests can read a post once per user id (many roles from the same ip is okay).
create unique index DW1_PSTSRD_ROLE__U on DW1_POSTS_READ_STATS (SITE_ID, PAGE_ID, POST_ID, USER_ID);


-- Ignore duplicated inserts. If a post has been read, it has been read, doesn't matter
-- if the user reads it twice. (Trying to ignore unique key exceptions in the Scala
-- code results in the whole transaction failing.)
-- This rule doesn't always "work": if two sessions insert the same row at the exact same time
-- one of them will fail with a PK error. So we still need a try-catch in the Scala code.
create or replace rule DW1_PSTSRD_IGNORE_DUPL_INS as
  on insert to DW1_POSTS_READ_STATS
  where exists (
      select 1
      from DW1_POSTS_READ_STATS
      where SITE_ID = new.SITE_ID
        and PAGE_ID = new.PAGE_ID
        and POST_ID = new.POST_ID
        and (USER_ID = new.USER_ID or IP = new.IP))
   do instead nothing;



-- Only one vote per guest and role id, and, for guests, only one vote per ip.
-- First remove duplicates:

-- Remove duplicate guest votes, per ip.
delete from DW1_PAGE_ACTIONS a using DW1_PAGE_ACTIONS a2
  where a.TENANT = a2.TENANT
    and a.PAGE_ID = a2.PAGE_ID
    and a.POST_ID = a2.POST_ID
    and a.IP = a2.IP
    and a.TYPE = a2.TYPE
    and a.TYPE like 'Vote%'
    and a.time > a2.time
    and a.ROLE_ID is null;

-- Remove duplicate guest votes, per guest id.
delete from DW1_PAGE_ACTIONS a using DW1_PAGE_ACTIONS a2
  where a.TENANT = a2.TENANT
    and a.PAGE_ID = a2.PAGE_ID
    and a.POST_ID = a2.POST_ID
    and a.GUEST_ID = a2.GUEST_ID
    and a.TYPE = a2.TYPE
    and a.TYPE like 'Vote%'
    and a.time > a2.time;

-- Remove duplicate role votes, per role id.
delete from DW1_PAGE_ACTIONS a using DW1_PAGE_ACTIONS a2
  where a.TENANT = a2.TENANT
    and a.PAGE_ID = a2.PAGE_ID
    and a.POST_ID = a2.POST_ID
    and a.ROLE_ID = a2.ROLE_ID
    and a.TYPE = a2.TYPE
    and a.TYPE like 'Vote%'
    and a.time > a2.time;

-- Only one vote per ip, for guest users.
create unique index DW1_PGAS_GUEST_IP__U
  on DW1_PAGE_ACTIONS(TENANT, PAGE_ID, POST_ID, IP, TYPE)
  where TYPE like 'Vote%'
    and ROLE_ID is null;

-- Only one vote per guest id.
create unique index DW1_PGAS_GUEST_VOTES__U
  on DW1_PAGE_ACTIONS(TENANT, PAGE_ID, POST_ID, GUEST_ID, TYPE)
  where TYPE like 'Vote%';

-- Only one vote per role id.
create unique index DW1_PGAS_ROLE_VOTES__U
  on DW1_PAGE_ACTIONS(TENANT, PAGE_ID, POST_ID, ROLE_ID, TYPE)
  where TYPE like 'Vote%';


-- For each like, add an entry that marks the post as read.
insert into DW1_POSTS_READ_STATS(
    SITE_ID, PAGE_ID, POST_ID, IP, USER_ID, READ_ACTION_ID, READ_AT)
  select
    TENANT, PAGE_ID, POST_ID, IP,
    case
      when GUEST_ID is not null then '-' || GUEST_ID
      else ROLE_ID
    end,
    PAID, TIME
  from DW1_PAGE_ACTIONS
  where TYPE = 'VoteLike';

