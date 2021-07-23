
alter table dw2_audit_log add column target_site_id varchar;
alter table dw2_audit_log add constraint dw2_auditlog_tgtsite__r__sites
    foreign key (target_site_id) references dw1_tenants(id);

-- Previously, a column 'sno' (sequence no) later renamed to 'id' was the primary key.
alter table dw1_identities drop constraint dw1_idsoid_sno__p;
alter table dw1_identities add constraint dw1_ids_siteid_id__p primary key (site_id, id);

