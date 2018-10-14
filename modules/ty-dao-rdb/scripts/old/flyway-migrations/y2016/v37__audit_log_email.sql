
alter table dw2_audit_log add email_address varchar;
alter table dw2_audit_log add constraint dw2_auditlog_emailaddr__c_len check (
  length(email_address) between 3 and 200);
alter table dw2_audit_log add constraint dw2_auditlog_emailaddr__c_email check (
  email_address like '%_@_%');


