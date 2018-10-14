# This evolution:
# - Adds email + password login columns to DW1_IDS_OPENID (which should be renamed
#   to DW1_IDENTITIES)
# - Adds TYPE and CREATED_AT and TO_GUEST/ROLE_ID columns to DW1_EMAILS_OUT


# --- !Ups


-- Password identity:

alter table DW1_IDS_OPENID add column PASSWORD_HASH varchar;

alter table DW1_IDS_OPENID add constraint DW1_IDS_PSWDHASH__C_LEN
  check (length(PASSWORD_HASH) < 100);

alter table DW1_IDS_OPENID add constraint DW1_IDS_PSWDHASH_EMAIL__C
  check (case
    when PASSWORD_HASH is not null
    then EMAIL is not null
     and OID_CLAIMED_ID is null
     and OID_OP_LOCAL_ID is null
     and OID_REALM is null
     and OID_ENDPOINT is null
     and OID_VERSION is null
     and FIRST_NAME is null
     and COUNTRY is null
  end);

alter table DW1_IDS_OPENID alter column OID_CLAIMED_ID drop not null;
alter table DW1_IDS_OPENID alter column OID_OP_LOCAL_ID drop not null;
alter table DW1_IDS_OPENID alter column OID_REALM drop not null;
alter table DW1_IDS_OPENID alter column OID_ENDPOINT drop not null;
alter table DW1_IDS_OPENID alter column OID_VERSION drop not null;
alter table DW1_IDS_OPENID alter column FIRST_NAME drop not null;
alter table DW1_IDS_OPENID alter column COUNTRY drop not null;

alter table DW1_IDS_OPENID add constraint DW1_IDSOID_OID__C_NN
  check (case
    when OID_CLAIMED_ID is not null
    then OID_OP_LOCAL_ID is not null
     and OID_REALM is not null
     and OID_ENDPOINT is not null
     and OID_VERSION is not null
     and PASSWORD_HASH is null
  end);

create unique index DW1_IDSOID_SITE_PSWD_EMAIL__U on DW1_IDS_OPENID(TENANT, EMAIL)
  where PASSWORD_HASH is not null;


-- Emails:

alter table DW1_EMAILS_OUT add column TYPE varchar;
alter table DW1_EMAILS_OUT add column CREATED_AT timestamp;
alter table DW1_EMAILS_OUT add column TO_GUEST_ID varchar(32);
alter table DW1_EMAILS_OUT add column TO_ROLE_ID varchar(32);

update DW1_EMAILS_OUT set CREATED_AT = SENT_ON;
-- I've verified in the prod db that no interesting data is lost:
delete from DW1_NOTFS_PAGE_ACTIONS n
    where EMAIL_SENT in (
        select e.ID from DW1_EMAILS_OUT e
        where e.TENANT = n.TENANT
          and e.ID = n.EMAIL_SENT
          and e.CREATED_AT is null);
delete from DW1_EMAILS_OUT where CREATED_AT is null;
alter table DW1_EMAILS_OUT alter column CREATED_AT set not null;
alter table DW1_EMAILS_OUT add constraint DW1_EMLOT_CREATED_SENT__C_LE
    check (CREATED_AT <= SENT_ON);

update DW1_EMAILS_OUT set TYPE = 'Notf';
alter table DW1_EMAILS_OUT alter column TYPE set not null;
alter table DW1_EMAILS_OUT add constraint DW1_EMLOT_TYPE__C_IN
    check (TYPE in ('Notf', 'CrAc', 'RsPw'));

alter table DW1_EMAILS_OUT add constraint DW1_EMLOT__R__GUESTS
    foreign key (TENANT, TO_GUEST_ID) references DW1_GUESTS(SITE_ID, ID) deferrable;

alter table DW1_EMAILS_OUT add constraint DW1_EMLOT__R__ROLES
    foreign key (TENANT, TO_ROLE_ID) references DW1_USERS(TENANT, SNO) deferrable;

alter table DW1_EMAILS_OUT drop constraint DW1_EMLOT__R__TNTS;

-- Use `distinct` because the guest id might be repeated, if many notifications
-- were included in the same email to a single guest.
update DW1_EMAILS_OUT set TO_GUEST_ID = (
    select distinct RCPT_ID_SIMPLE from DW1_NOTFS_PAGE_ACTIONS n
    where n.TENANT = TENANT and n.EMAIL_SENT = ID);

-- See comment above about `distinct`.
update DW1_EMAILS_OUT set TO_ROLE_ID = (
    select distinct RCPT_ROLE_ID from DW1_NOTFS_PAGE_ACTIONS n
    where n.TENANT = TENANT and n.EMAIL_SENT = ID);

-- This handles some website-has-been-created emails that aren't associated with any
-- notifications.
update dw1_emails_out e set to_role_id = (
    select u.sno from dw1_users u
    where e.tenant = u.tenant and e.sent_to = u.email limit 1)
  where to_role_id is null and to_guest_id is null;

-- Finally delete old "broken" rows (two test emails it seems).
delete from dw1_emails_out where to_role_id is null and to_guest_id is null;

alter table DW1_EMAILS_OUT add constraint DW1_EMLOT_ROLEID_GUESTID__C
  check (case
    -- user id not knownt when creating account...
    when TYPE = 'CrAc' then TO_GUEST_ID is null and TO_ROLE_ID is null
    -- ... but otherwise the email is either to a role or to a guest
    when TO_ROLE_ID is null then TO_GUEST_ID is not null
    else TO_GUEST_ID is null
  end);



# --- !Downs


alter table DW1_EMAILS_OUT add constraint DW1_EMLOT__R__TNTS
    foreign key (TENANT) references DW1_TENANTS(ID) deferrable;

alter table DW1_EMAILS_OUT drop column TYPE;
alter table DW1_EMAILS_OUT drop column CREATED_AT;
alter table DW1_EMAILS_OUT drop column TO_GUEST_ID;
alter table DW1_EMAILS_OUT drop column TO_ROLE_ID;

delete from DW1_IDS_OPENID where PASSWORD_HASH is not null;
alter table DW1_IDS_OPENID drop column PASSWORD_HASH;

alter table DW1_IDS_OPENID alter column OID_CLAIMED_ID set not null;
alter table DW1_IDS_OPENID alter column OID_OP_LOCAL_ID set not null;
alter table DW1_IDS_OPENID alter column OID_REALM set not null;
alter table DW1_IDS_OPENID alter column OID_ENDPOINT set not null;
alter table DW1_IDS_OPENID alter column OID_VERSION set not null;
alter table DW1_IDS_OPENID alter column FIRST_NAME set not null;
alter table DW1_IDS_OPENID alter column COUNTRY set not null;
