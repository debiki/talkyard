# This evolution changes title and body post indexes to 0 and 1,
# for compatibility with Discourse, which starts counting post ids at 1,
# rather than letting the first reply have id 1.


# --- !Ups

begin;
set constraints all deferred;

alter table DW1_POSTS drop constraint DW1_POSTS_SITE_PAGE_POST__P;
alter table DW1_POSTS drop constraint DW1_POSTS__C_POST_NOT_ITS_PARENT;
update DW1_POSTS set POST_ID = POST_ID + 1;
update DW1_POSTS set POST_ID = 0 where POST_ID = (65501 + 1);
update DW1_POSTS set POST_ID = 1 where POST_ID = (65502 + 1);
update DW1_POSTS set POST_ID = 65503 where POST_ID = (65503 + 1);
update DW1_POSTS set PARENT_POST_ID = PARENT_POST_ID + 1;
update DW1_POSTS set PARENT_POST_ID = 0 where PARENT_POST_ID = (65501 + 1);
update DW1_POSTS set PARENT_POST_ID = 1 where PARENT_POST_ID = (65502 + 1);
update DW1_POSTS set PARENT_POST_ID = 65503 where PARENT_POST_ID = (65503 + 1);
alter table DW1_POSTS add constraint DW1_POSTS_SITE_PAGE_POST__P primary key (SITE_ID, PAGE_ID, POST_ID);
alter table DW1_POSTS add constraint DW1_POSTS__C_POST_NOT_ITS_PARENT check (PARENT_POST_ID is null or POST_ID <> PARENT_POST_ID);

commit;
begin;
set constraints all deferred;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS__R__PGAS;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_TNT_PGID_ID__P;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PACTIONS_PAID_NOT_0__C;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS__C_POST_NOT_ITS_PARENT;
update DW1_PAGE_ACTIONS set PAID = PAID + 1;
update DW1_PAGE_ACTIONS set PAID = 0 where PAID = (65501 + 1);
update DW1_PAGE_ACTIONS set PAID = 1 where PAID = (65502 + 1);
update DW1_PAGE_ACTIONS set PAID = 65503 where PAID = (65503 + 1);
update DW1_PAGE_ACTIONS set RELPA = RELPA + 1;
update DW1_PAGE_ACTIONS set RELPA = 0 where RELPA = (65501 + 1);
update DW1_PAGE_ACTIONS set RELPA = 1 where RELPA = (65502 + 1);
update DW1_PAGE_ACTIONS set RELPA = 65503 where RELPA = (65503 + 1);
update DW1_PAGE_ACTIONS set POST_ID = POST_ID + 1;
update DW1_PAGE_ACTIONS set POST_ID = 0 where POST_ID = (65501 + 1);
update DW1_PAGE_ACTIONS set POST_ID = 1 where POST_ID = (65502 + 1);
update DW1_PAGE_ACTIONS set POST_ID = 65503 where POST_ID = (65503 + 1);

-- Trigger reindexation of all posts since their ids has changed.
update DW1_PAGE_ACTIONS set INDEX_VERSION = 0 where TYPE = 'Post';

commit;
begin;

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_SITE_PAGE_ID__P primary key (TENANT, PAGE_ID, PAID);
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS__R__PGAS foreign key (TENANT, PAGE_ID, RELPA) references DW1_PAGE_ACTIONS(TENANT, PAGE_ID, PAID) deferrable;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS__C_POST_NOT_ITS_PARENT check (
    case TYPE
        when 'Post' then RELPA is null or RELPA <> PAID
        else null::boolean
    end);

commit;
begin;

alter table DW1_NOTFS_PAGE_ACTIONS drop constraint DW1_NTFPGA_T_PG_EVT_RCPT__P;
drop index DW1_NTFPGA_T_IDSMPL_PG_EVT__U;
drop index DW1_NTFPGA_TNT_RL_PG_EVT__U;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = EVENT_PGA + 1;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 0 where EVENT_PGA = (65501 + 1);
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 1 where EVENT_PGA = (65502 + 1);
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 65503 where EVENT_PGA = (65503 + 1);
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = TARGET_PGA + 1;
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 0 where TARGET_PGA = (65501 + 1);
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 1 where TARGET_PGA = (65502 + 1);
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 65503 where TARGET_PGA = (65503 + 1);
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = RCPT_PGA + 1;
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 0 where RCPT_PGA = (65501 + 1);
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 1 where RCPT_PGA = (65502 + 1);
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 65503 where RCPT_PGA = (65503 + 1);

commit;

alter table DW1_NOTFS_PAGE_ACTIONS add constraint DW1_NTFPGA_T_PG_EVT_RCPT__P
    primary key (TENANT, PAGE_ID, EVENT_PGA, RCPT_PGA);

create unique index DW1_NTFPGA_T_IDSMPL_PG_EVT__U on DW1_NOTFS_PAGE_ACTIONS (
    TENANT, RCPT_ID_SIMPLE, PAGE_ID, EVENT_PGA) where RCPT_ID_SIMPLE is not null;

create unique index DW1_NTFPGA_TNT_RL_PG_EVT__U on DW1_NOTFS_PAGE_ACTIONS (
    TENANT, RCPT_ROLE_ID, PAGE_ID, EVENT_PGA) where RCPT_ROLE_ID is not null;

update DW1_PAGES set NEXT_REPLY_ID = NEXT_REPLY_ID + 1;
alter table DW1_PAGES alter column NEXT_REPLY_ID set default 2;



# --- !Downs

begin;
set constraints all deferred;


alter table DW1_POSTS drop constraint DW1_POSTS_SITE_PAGE_POST__P;
alter table DW1_POSTS drop constraint DW1_POSTS__C_POST_NOT_ITS_PARENT;
update DW1_POSTS set POST_ID = 65503 + 1 where POST_ID = 65503;
update DW1_POSTS set POST_ID = 65501 + 1 where POST_ID = 0;
update DW1_POSTS set POST_ID = 65502 + 1 where POST_ID = 1;
update DW1_POSTS set POST_ID = POST_ID - 1;
update DW1_POSTS set PARENT_POST_ID = 65503 + 1 where PARENT_POST_ID = 65503;
update DW1_POSTS set PARENT_POST_ID = 65501 + 1 where PARENT_POST_ID = 0;
update DW1_POSTS set PARENT_POST_ID = 65502 + 1 where PARENT_POST_ID = 1;
update DW1_POSTS set PARENT_POST_ID = PARENT_POST_ID - 1;
alter table DW1_POSTS add constraint DW1_POSTS_SITE_PAGE_POST__P primary key (SITE_ID, PAGE_ID, POST_ID);
alter table DW1_POSTS add constraint DW1_POSTS__C_POST_NOT_ITS_PARENT check (PARENT_POST_ID is null or POST_ID <> PARENT_POST_ID);

commit;
begin;
set constraints all deferred;

create table dw1_page_ratings(dummy int);

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS__R__PGAS;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_SITE_PAGE_ID__P;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS__C_POST_NOT_ITS_PARENT;
update DW1_PAGE_ACTIONS set PAID = 65503 + 1 where PAID = 65503;
update DW1_PAGE_ACTIONS set PAID = 65501 + 1 where PAID = 0;
update DW1_PAGE_ACTIONS set PAID = 65502 + 1 where PAID = 1;
update DW1_PAGE_ACTIONS set PAID = PAID - 1;
update DW1_PAGE_ACTIONS set RELPA = 65503 + 1 where RELPA = 65503;
update DW1_PAGE_ACTIONS set RELPA = 65501 + 1 where RELPA = 0;
update DW1_PAGE_ACTIONS set RELPA = 65502 + 1 where RELPA = 1;
update DW1_PAGE_ACTIONS set RELPA = RELPA - 1;
update DW1_PAGE_ACTIONS set POST_ID = 65503 + 1 where POST_ID = 65503;
update DW1_PAGE_ACTIONS set POST_ID = 65501 + 1 where POST_ID = 0;
update DW1_PAGE_ACTIONS set POST_ID = 65502 + 1 where POST_ID = 1;
update DW1_PAGE_ACTIONS set POST_ID = POST_ID - 1;

commit;
begin;

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TNT_PGID_ID__P primary key (TENANT, PAGE_ID, PAID);
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS__R__PGAS foreign key (TENANT, PAGE_ID, RELPA) references DW1_PAGE_ACTIONS(TENANT, PAGE_ID, PAID) deferrable;
alter table DW1_PAGE_ACTIONS add constraint DW1_PACTIONS_PAID_NOT_0__C check(true); -- who cares what it did
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS__C_POST_NOT_ITS_PARENT check (
    case TYPE
        when 'Post' then RELPA is null or RELPA <> PAID
        else null::boolean
    end);

commit;
begin;
set constraints all deferred;

alter table DW1_NOTFS_PAGE_ACTIONS drop constraint DW1_NTFPGA_T_PG_EVT_RCPT__P;
drop index DW1_NTFPGA_T_IDSMPL_PG_EVT__U;
drop index DW1_NTFPGA_TNT_RL_PG_EVT__U;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 65503 + 1 where EVENT_PGA = 65503;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 65501 + 1 where EVENT_PGA = 0;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = 65502 + 1 where EVENT_PGA = 1;
update DW1_NOTFS_PAGE_ACTIONS set EVENT_PGA = EVENT_PGA - 1;
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 65503 + 1 where TARGET_PGA = 65503;
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 65501 + 1 where TARGET_PGA = 0;
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = 65502 + 1 where TARGET_PGA = 1;
update DW1_NOTFS_PAGE_ACTIONS set TARGET_PGA = TARGET_PGA - 1;
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 65503 + 1 where RCPT_PGA = 65503;
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 65501 + 1 where RCPT_PGA = 0;
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = 65502 + 1 where RCPT_PGA = 1;
update DW1_NOTFS_PAGE_ACTIONS set RCPT_PGA = RCPT_PGA - 1;

commit;

alter table DW1_NOTFS_PAGE_ACTIONS add constraint DW1_NTFPGA_T_PG_EVT_RCPT__P
    primary key (TENANT, PAGE_ID, EVENT_PGA, RCPT_PGA);

create unique index DW1_NTFPGA_T_IDSMPL_PG_EVT__U on DW1_NOTFS_PAGE_ACTIONS (
    TENANT, RCPT_ID_SIMPLE, PAGE_ID, EVENT_PGA) where RCPT_ID_SIMPLE is not null;

create unique index DW1_NTFPGA_TNT_RL_PG_EVT__U on DW1_NOTFS_PAGE_ACTIONS (
    TENANT, RCPT_ROLE_ID, PAGE_ID, EVENT_PGA) where RCPT_ROLE_ID is not null;


-- Leave  DW1_PAGES.NEXT_REPLY_ID as is, doesn't matter.


-- Trigger reindexation of all posts since their ids has changed.
update DW1_PAGE_ACTIONS set INDEX_VERSION = 0 where TYPE = 'Post';


-- Don't recreate constraint DW1_PAGE_ACTIONS.DW1_PACTIONS_PAID_NOT_0__C.

