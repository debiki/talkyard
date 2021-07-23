# This evolution adds num likes and num wrongs columns.


# --- !Ups


alter table DW1_PAGES add column CACHED_NUM_LIKES int not null default -1;
alter table DW1_PAGES add column CACHED_NUM_WRONGS int not null default -1;

-- There are actually some valid(?) empty titles, oddly enough.
alter table DW1_PAGES drop constraint DW1_PAGES_CACHEDTITLE__C_NE;


-- Don't think these are needed.
drop index DW1_PAGES_TNT_PRNT_CDATI_NOPUB;
drop index DW1_PAGES_TNT_PARENT_PUBLDATI;

-- Useful when sorting pages on the forum index page.
create index DW1_PAGES_SITE_PUBLISHEDAT on DW1_PAGES(TENANT, PUBL_DATI);
create index DW1_PAGES_SITE_BUMPEDAT on DW1_PAGES(TENANT, CACHED_LAST_VISIBLE_POST_DATI);
create index DW1_PAGES_SITE_NUMPOSTS on DW1_PAGES(TENANT, CACHED_NUM_REPLIES_VISIBLE, CACHED_LAST_VISIBLE_POST_DATI);
create index DW1_PAGES_SITE_NUMLIKES on DW1_PAGES(TENANT, CACHED_NUM_LIKES, CACHED_LAST_VISIBLE_POST_DATI);



# --- !Downs


alter table DW1_PAGES drop column CACHED_NUM_LIKES;
alter table DW1_PAGES drop column CACHED_NUM_WRONGS;

update DW1_PAGES set CACHED_TITLE = null where trim(CACHED_TITLE) = '';
alter table DW1_PAGES add constraint DW1_PAGES_CACHEDTITLE__C_NE check (
    btrim(cached_title::text) <> ''::text);


drop index DW1_PAGES_SITE_PUBLISHEDAT;
drop index DW1_PAGES_SITE_BUMPEDAT;
drop index DW1_PAGES_SITE_NUMPOSTS;
drop index DW1_PAGES_SITE_NUMLIKES;

create index DW1_PAGES_TNT_PARENT_PUBLDATI on DW1_PAGES (tenant, parent_page_id, publ_dati);

create index DW1_PAGES_TNT_PRNT_CDATI_NOPUB on DW1_PAGES (tenant, parent_page_id, cdati)
    where PUBL_DATI is null;

