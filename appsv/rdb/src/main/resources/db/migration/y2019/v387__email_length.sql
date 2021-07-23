alter table emails_out3 drop constraint dw1_emlot_bodyhtml__c_len;
alter table emails_out3 add constraint emailsout_c_bodyhtml_len check (
  length(body_html) between 1 and 20000);

-- A Facebook avatar url was 263 chars long, so bump the previous 250 chars limit.
alter table identities3 drop constraint dw1_ids_avatarurl__c_len;
alter table identities3 add constraint identities_c_avatarurl_len check (
  length(avatar_url) between 1 and 500);

