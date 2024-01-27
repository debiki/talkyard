
-- New cookie names: '__Host-' prefix. All old sessions will stop working,
-- so, safer to delete them.
--
update  sessions_t  set
  deleted_at_c = greatest(created_at_c, now_utc())
where  deleted_at_c  is null
  and  expired_at_c  is null;


-- This index is on:  (site_id, category_id)  but it's no longer needed because
-- Postgres will use one of the 3 new indexes (below) since they start on
-- (site_id, category_id).
drop index  dw1_pages_category__i;

create index  pages_i_cat_createdat_id  on  pages3 (
    site_id, category_id, created_at desc, page_id desc);

create index  pages_i_cat_bumpedat_id  on  pages3 (
    site_id, category_id, bumped_at desc, page_id desc);

create index  pages_i_cat_publishedat_id  on  pages3 (
    site_id, category_id, published_at desc, page_id desc);


alter table  settings3  add column  ai_conf_c               jsonb_ste16000_d,
                        add column  enable_online_status_c  bool,
                        add column  follow_links_to_c       text_nonempty_ste2000_d;

alter table  users3     add column  mod_conf_c              jsonb_ste500_d,
                        add column  may_set_rel_follow_c    bool;
