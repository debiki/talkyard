alter table settings3 add column enable_google_login boolean;
alter table settings3 add column enable_facebook_login boolean;
alter table settings3 add column enable_twitter_login boolean;
alter table settings3 add column enable_github_login boolean;
alter table settings3 add column email_domain_blacklist varchar;
alter table settings3 add column email_domain_whitelist varchar;
alter table settings3 add column show_author_how smallint;
alter table settings3 add column watchbar_starts_open boolean;
alter table settings3 add column favicon_url varchar;
alter table settings3 add column enable_chat boolean;
alter table settings3 add column enable_direct_messages boolean;

alter table settings3 add constraint settings_c_emailblacklist_len check (
  length(email_domain_blacklist) between 1 and 10000);

-- Some companies add all their customers' domains to the whitelist, e.g. 300 customers
-- and 300 x 50 = 15 000 (50 chars = domain + optional comment). Allow 40 000 maybe?
alter table settings3 add constraint settings_c_emailwhitelist_len check (
  length(email_domain_whitelist) between 1 and 40000);

alter table settings3 add constraint settings_c_faviconurl_len check (
  length(favicon_url) between 1 and 200);

