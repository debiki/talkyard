
alter table DW1_PAGE_ACTIONS drop column LOGIN;
-- Also dropped constraint DW1_PGAS_LOGIN_GUEST_ROLE__C.

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_GUEST_ROLE__C check (
    (GUEST_ID is null and ROLE_ID is null)
    or
    ((GUEST_ID is null) <> (ROLE_ID is null)));


alter table DW1_IDS_SIMPLE_EMAIL drop column LOGIN;
alter table DW1_QUOTAS drop column NUM_LOGINS;
alter table DW1_TENANTS drop column CREATOR_LOGIN_ID;

drop table DW1_LOGINS;
drop sequence DW1_LOGINS_SNO;


alter table DW1_USERS add column USERNAME varchar;
-- Scala code currently requires 3 - 20 chars, but be a bit lax here in the database
-- so I don't have to add an evolution just to change this.
alter table DW1_USERS add constraint DW1_USERS_USERNAME__C_LEN check (length(trim(USERNAME)) >= 2);
alter table DW1_USERS add constraint DW1_USERS_USERNAME__C_LEN2 check (length(USERNAME) < 40);
alter table DW1_USERS add constraint DW1_USERS_USERNAME__C_AT check (USERNAME not like '%@%');

create unique index DW1_USERS_SITE_USERNAME__U on DW1_USERS (TENANT, USERNAME);


-- Create unique index on user email, but first delete duplicated email users.
delete from DW1_NOTFS_PAGE_ACTIONS where TENANT = '12' and RCPT_ROLE_ID = '53';
delete from DW1_USERS where TENANT = '12' and SNO = '53' and EMAIL = 'kajmagnus79d@gmail.com';
delete from DW1_USERS where TENANT = '3'  and SNO = '56' and EMAIL = 'kajmagnus79d@gmail.com';
-- Set email addresses to null for old Google OpenID users (Googe is disabling OpenID).
update DW1_USERS as u set EMAIL = null
    from DW1_IDS_OPENID as i
    where u.TENANT = i.TENANT
      and u.SNO = i.USR
      and i.OID_ENDPOINT = 'https://www.google.com/accounts/o8/ud';
create unique index DW1_USERS_SITE_EMAIL__U on DW1_USERS (TENANT, EMAIL);


alter table DW1_USERS add column EMAIL_VERIFIED_AT timestamp;


alter table DW1_USERS add column CREATED_AT timestamp;
update DW1_USERS set CREATED_AT = now();
alter table DW1_USERS alter column CREATED_AT set not null;


alter table DW1_USERS add column PASSWORD_HASH varchar;
alter table DW1_USERS add constraint DW1_USERS_PASSWORDHASH__C_LEN check (
    length(PASSWORD_HASH) between 8 and 150);

-- There are no passwords right now anyway, need not move to DW1_USERS.PASSWORD_HASH.
alter table DW1_IDS_OPENID drop column PASSWORD_HASH;


-- Now a new user is created before the confirmation email is sent, so this constraint
-- no longer works. Delet it, don't fix it, I think it's too restrictive.
alter table DW1_EMAILS_OUT drop constraint DW1_EMLOT_ROLEID_GUESTID__C;

