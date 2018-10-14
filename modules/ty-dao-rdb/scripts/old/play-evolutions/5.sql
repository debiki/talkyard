# This evolution:
# - Adds SecureSocial login columns to DW1_IDS_OPENID (which should be renamed
#   to DW1_IDENTITIES). Currently I don't save any OAuth1 and OAuth2 access tokens.


# --- !Ups


-- SecureSocial identity: (OAuth1 and 2, e.g. Twitter, Facebook, GitHub)

--  Current DW1_IDS_OPENID columns:
--       Column      |            Type             |       Modifiers
--  -----------------+-----------------------------+------------------------
--   sno             | character varying(32)       | not null
--   tenant          | character varying(32)       | not null
--   usr             | character varying(32)       | not null
--   usr_orig        | character varying(32)       | not null
--   oid_claimed_id  | character varying(500)      |
--   oid_op_local_id | character varying(500)      |
--   oid_realm       | character varying(100)      |
--   oid_endpoint    | character varying(100)      |
--   oid_version     | character varying(100)      |
--   first_name      | character varying(100)      |
--   email           | character varying(100)      | not null
--   country         | character varying(100)      |
--   cdati           | timestamp without time zone | not null default now()
--   password_hash   | character varying           |


alter table DW1_IDS_OPENID add column LAST_NAME varchar;
alter table DW1_IDS_OPENID add column FULL_NAME varchar;
alter table DW1_IDS_OPENID add column AVATAR_URL varchar;
alter table DW1_IDS_OPENID add column SECURESOCIAL_PROVIDER_ID varchar;
alter table DW1_IDS_OPENID add column SECURESOCIAL_USER_ID varchar;
alter table DW1_IDS_OPENID add column AUTH_METHOD varchar;

alter table DW1_IDS_OPENID add constraint DW1_IDS_LASTNAME__C_LEN check (length(LAST_NAME) < 100);
alter table DW1_IDS_OPENID add constraint DW1_IDS_FULLNAME__C_LEN check (length(FULL_NAME) < 100);
alter table DW1_IDS_OPENID add constraint DW1_IDS_AVATARURL__C_LEN check (length(AVATAR_URL) < 100);
alter table DW1_IDS_OPENID add constraint DW1_IDS_SSPROVIDERID__C_LEN check (length(SECURESOCIAL_PROVIDER_ID) < 500);
alter table DW1_IDS_OPENID add constraint DW1_IDS_SSUSERID__C_LEN check (length(SECURESOCIAL_USER_ID) < 500);
alter table DW1_IDS_OPENID add constraint DW1_IDS_AUTHMETHOD__C_LEN check (length(AUTH_METHOD) < 50);

alter table DW1_IDS_OPENID add constraint DW1_IDS_SECURESOCIAL__C
  check (case
    when SECURESOCIAL_PROVIDER_ID is not null
    then SECURESOCIAL_USER_ID is not null
     and AUTH_METHOD is not null
     and OID_CLAIMED_ID is null
     and OID_OP_LOCAL_ID is null
     and OID_REALM is null
     and OID_ENDPOINT is null
     and OID_VERSION is null
     and PASSWORD_HASH is null
  end);

alter table DW1_IDS_OPENID drop constraint DW1_IDS_PSWDHASH_EMAIL__C;
alter table DW1_IDS_OPENID  add constraint DW1_IDS_PSWDHASH_EMAIL__C
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
     and SECURESOCIAL_PROVIDER_ID is null
     and SECURESOCIAL_USER_ID is null
     -- allow AUTH_METHOD not null
  end);

alter table DW1_IDS_OPENID drop constraint DW1_IDSOID_OID__C_NN;
alter table DW1_IDS_OPENID  add constraint DW1_IDSOID_OID__C_NN
  check (case
    when OID_CLAIMED_ID is not null
    then OID_OP_LOCAL_ID is not null
     and OID_REALM is not null
     and OID_ENDPOINT is not null
     and OID_VERSION is not null
     and PASSWORD_HASH is null
     and SECURESOCIAL_PROVIDER_ID is null
     and SECURESOCIAL_USER_ID is null
     -- allow AUTH_METHOD not null
  end);


create unique index DW1_IDS_SECURESOCIAL
  on DW1_IDS_OPENID(TENANT, SECURESOCIAL_PROVIDER_ID, SECURESOCIAL_USER_ID);



# --- !Downs


alter table DW1_IDS_OPENID drop constraint DW1_IDS_PSWDHASH_EMAIL__C;
alter table DW1_IDS_OPENID  add constraint DW1_IDS_PSWDHASH_EMAIL__C
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

alter table DW1_IDS_OPENID drop constraint DW1_IDSOID_OID__C_NN;
alter table DW1_IDS_OPENID  add constraint DW1_IDSOID_OID__C_NN
  check (case
    when OID_CLAIMED_ID is not null
    then OID_OP_LOCAL_ID is not null
     and OID_REALM is not null
     and OID_ENDPOINT is not null
     and OID_VERSION is not null
     and PASSWORD_HASH is null
  end);

alter table DW1_IDS_OPENID drop column LAST_NAME;
alter table DW1_IDS_OPENID drop column FULL_NAME;
alter table DW1_IDS_OPENID drop column AVATAR_URL;
alter table DW1_IDS_OPENID drop column SECURESOCIAL_PROVIDER_ID;
alter table DW1_IDS_OPENID drop column SECURESOCIAL_USER_ID;
alter table DW1_IDS_OPENID drop column AUTH_METHOD;

