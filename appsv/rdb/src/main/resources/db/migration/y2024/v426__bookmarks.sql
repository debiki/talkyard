
alter table  post_actions3  rename column      as_pat_id_c  to  from_true_id_c;
alter table  post_actions3  rename constraint  patnodesinrels_aspatid_r_pats
                                           to  patnoderels_fromtrueid_r_pats;

create index  patnoderels_i_pageid_fromtrueid  on  post_actions3 (
    site_id, page_id, from_true_id_c)  where  from_true_id_c  is not null;

alter index  dw2_postacs_page_byuser  rename to  patnoderels_i_pageid_frompatid;


alter table  notifications3
    add column  by_true_id_c   pat_id_d,
    add column  to_true_id_c   pat_id_d,

    -- by/to_true_id_c is null, if would have been the same.
    add constraint  notfs_c_byuserid_ne_bytrueid  check (by_user_id != by_true_id_c),
    add constraint  notfs_c_touserid_ne_totrueid  check (to_user_id != to_true_id_c),

    -- fk ix: notfs_i_bytrueid
    add constraint  notfs_bytrueid_r_pats  foreign key (site_id, by_true_id_c)
        references users3 (site_id, user_id) deferrable,

    -- fk ix: notfs_i_totrueid_createdat
    add constraint  notfs_totrueid_r_pats  foreign key (site_id, to_true_id_c)
        references users3 (site_id, user_id) deferrable;


create index  notfs_i_bytrueid on notifications3 (
    site_id, by_true_id_c) where by_true_id_c is not null;

create index  notfs_i_totrueid_createdat  on notifications3 (
    site_id, to_true_id_c, created_at desc) where to_true_id_c is not null;


alter index  dw1_notfs_id__p            rename to  notfs_p_notfid;
alter index  dw1_ntfs_createdat_email_undecided__i
                                        rename to  notfs_i_createdat_if_undecided;
alter index  dw1_ntfs_emailid           rename to  notfs_i_emailid;
alter index  dw1_ntfs_postid__i         rename to  notfs_i_aboutpostid;
alter index  dw1_ntfs_seen_createdat__i rename to  notfs_i_createdat_but_unseen_first;
alter index  notfs_touser_createdat__i  rename to  notfs_i_touserid_createdat;
alter index  notfs_touser_post__i       rename to  notfs_i_touserid_aboutpostid;



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

