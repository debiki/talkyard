drop table category_notf_levels3;
drop table dw1_settings;

create domain i16_d as smallint;
create domain i16_gz_d as smallint constraint i16gz_c_gz check (value > 0);
create domain i16_gez_d as smallint constraint i16gez_c_gez check (value >= 0);

create domain i32_d as int;
create domain i32_gz_d as int constraint i32gz_c_gz check (value > 0);
create domain i32_gez_d as int constraint i32gez_c_gez check (value >= 0);

create domain i64_d as bigint;
create domain i64_gz_d as bigint constraint i64_c_gz check (value > 0);
create domain i64_gez_d as bigint constraint i64_c_gez check (value >= 0);

create domain f32_d as real;
create domain f32_gz_d as real constraint f32gz_c_gz check (value > 0);
create domain f32_gez_d as real constraint f32gez_c_gez check (value >= 0);

create domain f64_d as double precision;
create domain f64_gz_d as double precision constraint f64gz_c_gz check (value > 0);
create domain f64_gez_d as double precision constraint f64gez_c_gez check (value >= 0);

create domain trust_level_or_staff_d as int
    constraint trustlevelstaff_c_0_8 check (value between 0 and 8);


alter table sites3 add column deleted_at_c timestamp;
alter table sites3 add column auto_purge_at_c timestamp;
alter table sites3 add column purged_at_c timestamp;


alter table sites3 rename column quota_limit_mbs to rdb_quota_mibs_c;
update sites3 set rdb_quota_mibs_c = 0 where rdb_quota_mibs_c < 0;
alter table sites3 add constraint sites_c_rdbquotamibs_gez check (rdb_quota_mibs_c >= 0);

alter table sites3 add column file_quota_mibs_c i32_gez_d;

alter table sites3 add column max_upl_size_kibs_c i32_gez_d;

alter table sites3 add column may_upl_pub_media_min_tr_lv_c trust_level_or_staff_d;
alter table sites3 add column may_upl_pub_risky_min_tr_lv_c trust_level_or_staff_d;
alter table sites3 add column may_upl_pub_safer_min_tr_lv_c trust_level_or_staff_d;

alter table sites3 add column may_upl_priv_media_min_tr_lv_c trust_level_or_staff_d;
alter table sites3 add column may_upl_priv_risky_min_tr_lv_c trust_level_or_staff_d;
alter table sites3 add column may_upl_priv_safer_min_tr_lv_c trust_level_or_staff_d;


alter table sites3 add column read_lims_mult_c f32_gez_d;
alter table sites3 add column log_lims_mult_c f32_gez_d;
alter table sites3 add column create_lims_mult_c f32_gez_d;


-- 6 = SiteStatus.Deleted
update sites3 set deleted_at_c = now_utc() where status = 6;
update sites3 set file_quota_mibs_c = rdb_quota_mibs_c;


alter table sites3 drop constraint sites_status__c_in;
alter table sites3 add constraint sites_c_status check (
    status between 1 and 7);

alter table sites3 add constraint sites_c_deleted_status check (
    (deleted_at_c is not null) = (status >= 6));

alter table sites3 add constraint sites_c_autopurge_at check (
    (auto_purge_at_c is null) or (status >= 6));

alter table sites3 add constraint sites_c_purged_at check (
    (purged_at_c is not null) = (status >= 7));


-- Indexes:
-- "dw1_tnthsts_host__u" UNIQUE CONSTRAINT, btree (host)
-- "dw1_tnthsts_tnt_cncl__u" UNIQUE, btree (site_id) WHERE canonical::text = 'C'::text
alter table hosts3 drop constraint dw1_tnthsts_host__u;
create unique index hosts_u_g_hostname on hosts3 (host) where canonical <> 'X';

alter index dw1_tnthsts_tnt_cncl__u rename to hosts_u_canonical;

alter table hosts3 drop constraint dw1_tnthsts_cncl__c;  -- doesn't incl 'X'
alter table hosts3 add constraint hosts_c_role_in check (
    canonical in ('C', 'R', 'L', 'D', 'X'));



update perms_on_pages3 set may_create_page = null
    where not may_create_page;

