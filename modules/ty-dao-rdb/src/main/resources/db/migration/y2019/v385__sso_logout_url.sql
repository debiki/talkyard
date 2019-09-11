
alter table settings3 add column sso_login_required_logout_url varchar;
alter table settings3 add constraint settings_c_ssologinrequiredlogouturl_len check (
    length(sso_login_required_logout_url) between 1 and 200);

