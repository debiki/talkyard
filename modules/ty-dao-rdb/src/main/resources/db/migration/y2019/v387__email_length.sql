alter table emails_out3 drop constraint dw1_emlot_bodyhtml__c_len;
alter table emails_out3 add constraint emailsout_c_bodyhtml_len check (
  length(body_html) between 1 and 20000);

