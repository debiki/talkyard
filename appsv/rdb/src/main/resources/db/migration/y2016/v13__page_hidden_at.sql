
alter table pages3 add column hidden_at timestamp;
alter table pages3 add constraint dw1_pages_createdat_hiddenat__c_le CHECK (created_at <= hidden_at);

alter table audit_log3 drop constraint dw2_auditlog_page_post__c;
delete from audit_log3 where did_what = 3;  -- 3 = new page
alter table audit_log3 add constraint dw2_auditlog_page_post__c check (
  did_what <> 3 or (page_id is not null and post_id is not null));
