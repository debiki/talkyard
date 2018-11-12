
alter table DW1_PAGE_ACTIONS add column MULTIREPLY varchar;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_TYPE_MULTIREPLY__C check (TYPE = 'Post' or MULTIREPLY is null);
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_MULTIREPLY__C_NUM check (MULTIREPLY ~ '[0-9,]');

alter table DW1_POSTS add column MULTIREPLY varchar;
alter table DW1_POSTS add constraint DW1_POSTS_MULTIREPLY__C_NUM check (MULTIREPLY ~ '[0-9,]');

