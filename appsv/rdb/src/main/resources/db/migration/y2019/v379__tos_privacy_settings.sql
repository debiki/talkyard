
alter table settings3 add column terms_of_use_url varchar;
alter table settings3 add column privacy_url varchar;
alter table settings3 add column rules_url varchar;
alter table settings3 add column contact_email_addr varchar;
alter table settings3 add column contact_url varchar;


alter table settings3 add constraint settings_c_termsofuseurl_len check (
  length(terms_of_use_url) between 1 and 200);

alter table settings3 add constraint settings_c_privacyurl_len check (
  length(privacy_url) between 1 and 200);

alter table settings3 add constraint settings_c_rulesurl_len check (
  length(rules_url) between 1 and 200);

alter table settings3 add constraint settings_c_contactemailaddr_len check (
  length(contact_email_addr) between 1 and 200);

alter table settings3 add constraint settings_c_contacturl_len check (
  length(contact_url) between 1 and 200);

