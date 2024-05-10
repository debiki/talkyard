
alter table  settings3
    add column  own_domains_c           text_nonempty_ste2000_d,
    add column  authn_diag_conf_c       jsonb_ste8000_d;


alter table  tags_t
    -- Ooops, this is an i32_d, should be an f64. Ok to change, not in use yet.
    alter column val_f64_b_c type f64_d using (val_f64_b_c::f64_d);


alter table  drafts3        add column  order_c  f32_d;
alter table  post_actions3  add column  order_c  f32_d;

alter table  posts3
    add column  order_c  f32_d,

    -- Just for now, to catch bugs.
    add constraint posts_c_order_only_bookmarks_for_now check (
        (order_c is null) or (type = 51)),

    -- For now, let's not approve bookmarks. No one else sees them anyway.
    -- And if, later, they can be shared with others, good to know they haven't
    -- been reviewed/approved by anyone.
    add constraint posts_c_bookmark_not_appr check (
        type != 51 or (approved_at is null)),

    add constraint posts_c_bookmark_neg_nr check (
        type != 51 or post_nr <= -1001), -- PageParts.MaxPrivateNr

    add constraint posts_c_privatecomt_neg_nr check (
        (private_status_c is null) or post_nr <= -1001); -- PageParts.MaxPrivateNr

-- One cannot bookmark the same post many times? At least for now, to catch bugs.
-- This also let's us look up all relevant bookmarks, on a page.
create unique index  posts_u_patid_pageid_parentnr_if_bookmark_0deld on posts3 (
    site_id, created_by_id, page_id, parent_nr) where type = 51 and deleted_status = 0;

-- For listing one's recent bookmarks. Including unique_post_id, in case
-- lots of bookmarks are created via the API in the same transaction —
-- by including the id, they can still be listed in a predictable order,
-- although they'd have the same timestamp.
create index  posts_i_patid_createdat_postid_if_bookmark_0deld on posts3 (
    site_id, created_by_id, created_at, unique_post_id) where type = 51 and deleted_status = 0;

-- For listing one's deleted bookmarks.
create index  posts_i_patid_createdat_postid_if_bookmark_deld on posts3 (
    site_id, created_by_id, created_at, unique_post_id) where type = 51 and deleted_status != 0;

