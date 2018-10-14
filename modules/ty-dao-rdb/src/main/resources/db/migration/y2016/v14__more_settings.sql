
alter table settings3 add column invite_only boolean;
alter table settings3 add column allow_signup boolean;
alter table settings3 add column allow_local_signup boolean;

alter table settings3 drop constraint settings3_auth_guest__c;
alter table settings3 add constraint settings3_auth_guest__c check (
  not (allow_guest_login and (
    user_must_be_auth or user_must_be_approved or invite_only or not allow_signup)));

alter table settings3 add constraint settings3_signup__c check (
  allow_signup or (not allow_local_signup));


alter table users3 add column about varchar;
alter table users3 add constraint users_about__c_len check (length(about) between 1 and 2000);
-- Guests have no about field.
alter table users3 add constraint users_about_guest__c_n check (user_id >= 1 or about is null);

