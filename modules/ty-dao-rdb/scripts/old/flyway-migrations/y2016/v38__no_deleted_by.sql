
alter table dw1_pages drop column deleted_by_id;

alter table dw2_audit_log add column batch_id bigint;
alter table dw2_audit_log add constraint dw2_auditlog_batchid_btwn_1_id__c check (
  batch_id between 1 and audit_id);

alter table dw2_audit_log alter column did_what type smallint using (
    case did_what
        when 'CrSt' then 1
        when 'TsCr' then 2
        when 'NwPg' then 3
        when 'NwPs' then 4
        when 'NwCt' then 5
        when 'EdPs' then 6
        when 'ChPT' then 7
        when 'UpFl' then 8
        else null -- this would generate an error
    end);

alter table dw2_audit_log add constraint dw2_auditlog_didwhat__c_in check (
  did_what between 1 and 200);

alter table dw2_audit_log drop constraint dw2_auditlog_tgtpage_tgtuser__c; -- what did that do?
alter table dw2_audit_log drop constraint dw2_auditlog_tgtpost_tgtuser__c; -- and that?

alter table dw2_posts add constraint dw2_posts_parent__c_not_title check (parent_nr <> 0);

alter table dw1_notifications drop column post_nr;

-- Make constraints deferrable.
alter table dw1_posts_read_stats drop constraint dw1_pstsrd__r__posts;
alter table dw1_posts_read_stats drop constraint dw1_pstsrd__r__users;
alter table dw1_posts_read_stats add constraint dw1_pstsrd__r__posts foreign key (
    site_id, page_id, post_nr) references dw2_posts(site_id, page_id, post_nr) deferrable;
alter table dw1_posts_read_stats add constraint dw1_pstsrd__r__users foreign key (
    site_id, user_id) references dw1_users(site_id, user_id) deferrable;

