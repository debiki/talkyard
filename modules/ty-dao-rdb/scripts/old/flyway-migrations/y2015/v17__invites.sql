
create table dw2_invites(
  site_id varchar,
  secret_key varchar not null,
  email_address varchar not null,
  created_by_id int not null,
  created_at timestamp not null,
  accepted_at timestamp,
  user_id int,
  deleted_at timestamp,
  deleted_by_id int,
  invalidated_at timestamp,
  constraint dw2_invites__p primary key(site_id, secret_key),
  constraint dw2_invites_user__r__users foreign key(site_id, user_id) references dw1_users(site_id, user_id),
  constraint dw2_invites_inviter__r__users foreign key(site_id, created_by_id) references dw1_users(site_id, user_id),
  constraint dw2_invites_email__c check (email_address like '%@%' and length(email_address) >= 3),
  constraint dw2_invites_secretkey__c_len check (length(secret_key) > 20),
  constraint dw2_invites_accepted_user__c check (accepted_at is null = user_id is null),
  constraint dw2_invites_deleted__c check (deleted_at is null = deleted_by_id is null),
  constraint dw2_invites_deleted__c2 check (deleted_at is null or accepted_at is null),
  constraint dw2_invites_deleted__c3 check (deleted_at >= created_at),
  constraint dw2_invites_invalidated__c check (invalidated_at >= created_at),
  constraint dw2_invites_invalidated__c2 check (invalidated_at is null or accepted_at is null),
  constraint dw2_invites_invalidated_deleted__c check (invalidated_at is null or deleted_at is null)
);

create unique index dw2_invites_email__u on dw2_invites(site_id, email_address, created_by_id)
  where deleted_at is null and invalidated_at is null;

create index dw2_invites_createdby_at__i on dw2_invites(site_id, created_by_id, created_at);
create index dw2_invites_user__i on dw2_invites(site_id, user_id) where user_id is not null;
create index dw2_invites_deletedby__i on dw2_invites(site_id, deleted_by_id) where deleted_by_id is not null;

alter table dw1_emails_out drop constraint dw1_emlot_type__c_in;
alter table dw1_emails_out add constraint dw1_emlot_type__c_in check (
  type in ('Notf', 'CrAc', 'RsPw', 'Invt', 'InAc', 'InPw'));

