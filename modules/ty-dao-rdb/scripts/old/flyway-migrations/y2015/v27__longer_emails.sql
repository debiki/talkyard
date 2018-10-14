
-- Allow longer email columns, e.g. body too short (only 2000).
-- First remove varchar(NNN) length, then add constraints instead.
alter table dw1_emails_out alter sent_to type varchar;
alter table dw1_emails_out alter subject type varchar;
alter table dw1_emails_out alter body_html type varchar;
alter table dw1_emails_out alter provider_email_id type varchar;
alter table dw1_emails_out alter failure_text type varchar;

alter table dw1_emails_out add constraint dw1_emlot_sentto__c_len check(length(sent_to) <= 200);
alter table dw1_emails_out add constraint dw1_emlot_subject__c_len check(length(subject) between 1 and 200);
alter table dw1_emails_out add constraint dw1_emlot_bodyhtml__c_len check(length(body_html) between 1 and 5000);
alter table dw1_emails_out add constraint dw1_emlot_provideremailid__c_len check(length(provider_email_id) <= 200);
alter table dw1_emails_out add constraint dw1_emlot_failuretext__c_len check(length(failure_text) <= 10000);

