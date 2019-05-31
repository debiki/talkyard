update users3 set full_name = 'All Members', username = 'all_members'
  where user_id = 11 and username = 'new_members';

update users3 set full_name = 'Trusted Regulars', username = 'trusted_regulars'
  where user_id = 15 and username = 'regular_members';


alter table users3 add column is_group bool not null default false;
update users3 set is_group = trust_level is null and user_id > 0;

update users3 set username = null where user_id < 0; -- not needed, just in case
alter table users3 add constraint participants_c_guest_no_username check (
  user_id > 0 or username is null);

-- Allow longer usernames, if member deleted -- so can append-rename to '..._deleted'.
alter table users3 drop constraint dw1_users_username__c_len2;
alter table users3 add constraint participants_c_username_len_active check (
  deleted_at is not null or length(username) <= 40);
alter table users3 add constraint participants_c_username_len_deleted check (
  deleted_at is null or length(username) <= 80);

update users3 set
    is_admin = case when user_id = 19 then true else null end,
    is_moderator = case when user_id in (17, 18) then true else null end,
    is_owner = null,
    is_superadmin = null,
    trust_level = null,  -- not needed here, but anyway
    threat_level = null,
    is_approved = null,
    approved_at = null,
    approved_by_id = null,
    suspended_at = null,
    suspended_till = null,
    suspended_by_id = null,
    suspended_reason = null,
    deactivated_at = null
    -- external_id = null  skip, want to know if error
  where is_group;

alter table users3 add constraint participants_c_group_not_adm_mod_ownr check (
  not is_group or (
    (is_admin is not true or user_id = 19) and
    (is_moderator is not true or user_id in (17, 18)) and  -- staff and mods
    is_owner is not true and
    is_superadmin is not true));

alter table users3 add constraint participants_c_group_id_gz check (
  not is_group or user_id > 0);

alter table users3 add constraint participants_c_group_no_password check (
  not is_group or (
    password_hash is null));

alter table users3 add constraint participants_c_group_not_approved check (
  not is_group or (
    is_approved is null and
    approved_at is null and
    approved_by_id is null));

alter table users3 add constraint participants_c_group_not_suspended check (
  not is_group or (
    suspended_at is null and
    suspended_till is null and
    suspended_by_id is null and
    suspended_reason is null));

alter table users3 add constraint participants_c_group_not_deactivated check (
  not is_group or (
    deactivated_at is null));

alter table users3 add constraint participants_c_group_no_external_id check (
  not is_group or (
    external_id is null));

alter table users3 add constraint participants_c_group_no_trust_threat_lvl check (
  not is_group or (
    trust_level is null and threat_level is null));


-- 2 x not needed, just in case:
update users3 set trust_level = 1 where user_id >= 0 and trust_level is null and not is_group;
update users3 set threat_level = 3 where user_id >= 0 and threat_level is null and not is_group;

alter table users3 add constraint participants_c_user_has_trust_threat_lvl check (
  is_group or user_id < 0 or (
    trust_level is not null and threat_level is not null));


update users3 set guest_email_addr = null  -- not needed, just in case
    where user_id >= 0 and guest_email_addr is not null;
alter table users3 add constraint participants_c_member_no_guest_email check (
    user_id < 0 or guest_email_addr is null);



create table group_participants3 (
  site_id int not null,
  group_id int not null,
  participant_id int not null,
  is_member bool not null default false,
  is_manager bool not null default false,
  is_adder bool not null default false,
  is_bouncer bool not null default false,

  constraint groupparticipants_groupid_ppid_p primary key (site_id, group_id, participant_id),

  -- ix: groupparticipants_groupid_ppid_p
  constraint groupparticipants_group_r_pps foreign key (
      site_id, group_id) references users3 (site_id, user_id) deferrable,

  -- ix: groupparticipants_ppid_i
  constraint groupparticipants_pp_r_pps foreign key (
      site_id, participant_id) references users3 (site_id, user_id) deferrable,

  constraint groupparticipants_c_groupid check (
      group_id >= 100),

  constraint groupparticipants_c_no_guests_or_built_in_users check (
      participant_id >= 100),

  constraint groupparticipants_c_pp_does_sth check (
      is_member or is_manager or is_adder or is_bouncer)
);


create index groupparticipants_ppid_i on group_participants3 (site_id, participant_id);

create index participants_groups_i on users3 (site_id, user_id) where is_group;


alter table emails_out3 add column can_login_again bool;

alter table settings3 add column enable_similar_topics bool;

