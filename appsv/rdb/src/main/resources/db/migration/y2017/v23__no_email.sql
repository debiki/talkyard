
alter table settings3 add column require_verified_email bool;
alter table settings3 add column may_compose_before_signup bool;
alter table settings3 add column may_login_before_email_verified bool;
alter table settings3 add column double_type_email_address bool;
alter table settings3 add column double_type_password bool;
alter table settings3 add column beg_for_email_address bool;

update settings3 set require_verified_email = false where allow_guest_login;


alter table settings3 drop constraint settings3_only_for_site__c;
alter table settings3 add  constraint settings3_only_for_site__c check (
  category_id is null and page_id is null
  or
  user_must_be_auth is null and
  user_must_be_approved is null and
  allow_guest_login is null and
  require_verified_email is null and
  may_compose_before_signup is null and
  may_login_before_email_verified is null and
  double_type_email_address is null and
  double_type_password is null and
  beg_for_email_address is null and
  num_first_posts_to_review is null and
  num_first_posts_to_approve is null and
  num_first_posts_to_allow is null and
  org_domain is null and
  org_full_name is null and
  org_short_name is null and
  contrib_agreement is null and
  content_license is null and
  google_analytics_id is null and
  experimental is null and
  many_sections is null and
  num_flags_to_hide_post is null and
  cooldown_minutes_after_flagged_hidden is null and
  num_flags_to_block_new_user is null and
  num_flaggers_to_block_new_user is null and
  notify_mods_if_user_blocked is null and
  regular_member_flag_weight is null and
  core_member_flag_weight is null);

-- [SIGNUPDRAFT]
alter table settings3 add  constraint settings3_signup_email_verif_c check (
  not (require_verified_email and (
    may_compose_before_signup or may_login_before_email_verified or allow_guest_login)));

-- [SIGNUPDRAFT]
alter table settings3 add  constraint settings3_compose_before_c check (
  not may_compose_before_signup or may_login_before_email_verified);


