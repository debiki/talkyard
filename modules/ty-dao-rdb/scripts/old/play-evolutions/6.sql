# This evolution:
# - Allows null parent posts



# --- !Ups


alter table DW1_POSTS alter column PARENT_POST_ID drop not null;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_MAGIC_ID_PARENTS__C;

update DW1_POSTS set PARENT_POST_ID = null where PARENT_POST_ID = POST_ID;
update DW1_PAGE_ACTIONS set RELPA = null where RELPA = PAID and TYPE = 'Post';

-- These posts should be top level posts, with no parents:

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS__C_POST_NOT_ITS_PARENT check(
  case TYPE
    when 'Post' then RELPA is null or RELPA <> PAID
  end);

alter table DW1_POSTS add constraint DW1_POSTS__C_POST_NOT_ITS_PARENT check(
  PARENT_POST_ID is null or POST_ID <> PARENT_POST_ID);



# --- !Downs

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS__C_POST_NOT_ITS_PARENT;
alter table DW1_POSTS drop constraint DW1_POSTS__C_POST_NOT_ITS_PARENT;

update DW1_POSTS set PARENT_POST_ID = POST_ID where PARENT_POST_ID is null;
update DW1_PAGE_ACTIONS set RELPA = PAID where RELPA is null and TYPE = 'Post';

alter table DW1_POSTS alter column PARENT_POST_ID set not null;

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_MAGIC_ID_PARENTS__C check (
  RELPA = case
    when PAID = 65501 THEN 65501
    when PAID = 65502 THEN 65502
    when PAID = 65503 THEN 65503
    else RELPA
  end);

