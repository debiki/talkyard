
alter table settings3 add column feature_flags varchar;

alter table settings3 add column enable_sso boolean;
alter table settings3 add column sso_url varchar;
alter table settings3 add column sso_not_approved_url varchar;

alter table settings3 add constraint settings_c_featureflags_len check (length(feature_flags) < 10000);
alter table settings3 add constraint settings_c_ssourl_len check (length(sso_url) < 200);
alter table settings3 add constraint settings_c_ssonotappr_len check (length(sso_not_approved_url) < 200);

alter table settings3 add constraint settings_c_enablesso_ssourl check (
  not enable_sso or sso_url is not null);



-- Forgot to add the Sysbot user to new sites.
insert into users3(
    site_id, user_id, full_name, username, is_admin,
    created_at, email_for_every_new_post, trust_level, threat_level)
  select id,  2, 'Sysbot', 'sysbot', true, now_utc(), false, 1, 3 from sites3
  on conflict do nothing;

-- Forgot to add username3 entries for the Sysbot user.
insert into usernames3 (site_id, username_lowercase, in_use_from, user_id)
  select site_id, lower(username), created_at, user_id
  from users3
  where username is not null and user_id = 2
  on conflict do nothing;

-- And forgot statistics for the Sysbot user (all users should have statistics, for consistency).
insert into user_stats3 (site_id, user_id, last_seen_at, first_seen_at, topics_new_since)
  select site_id, user_id, created_at, created_at, created_at
  from users3
  where user_id = 2
  on conflict do nothing;


