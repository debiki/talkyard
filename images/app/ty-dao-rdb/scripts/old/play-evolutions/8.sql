-- This evolution is for embedded sites:
-- - Adds EMBEDDING_PAGE_URL column to DW1_PAGES.


# --- !Ups


alter table DW1_PAGES add column EMBEDDING_PAGE_URL varchar;

alter table DW1_PAGES add constraint DW1_PAGES_EMBPAGEURL__C_LEN check (
    length(EMBEDDING_PAGE_URL) between 1 and 200);

alter table DW1_PAGES add constraint DW1_PAGES_EMBPAGEURL__C_TRIM check (
    trim(EMBEDDING_PAGE_URL) = EMBEDDING_PAGE_URL);


# --- !Downs


alter table DW1_PAGES drop column EMBEDDING_PAGE_URL;


