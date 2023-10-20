
-- Or is it needed, in old pg versions?
drop index dw1_pages_category__i; -- is on: (site_id, category_id)

create index pages_i_cat_createdat_id on pages3 (
    site_id, category_id, created_at desc, page_id desc);

create index pages_i_cat_bumpedat_id on pages3 (
    site_id, category_id, bumped_at desc, page_id desc);

create index pages_i_cat_publishedat_id on pages3 (
    site_id, category_id, published_at desc, page_id desc);