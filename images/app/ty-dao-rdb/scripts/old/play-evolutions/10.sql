-- This evolution is for vote fraud prevention.
-- It adds browser id cookie and browser fingerprint columns,
-- and denormalizes the ip number from DW1_LOGINS.LOGIN_IP to DW1_PAGE_ACTIONS.IP.


# --- !Ups


alter table DW1_PAGE_ACTIONS add column BROWSER_ID_COOKIE varchar;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_BROWSERID__C_LEN check (length(BROWSER_ID_COOKIE) <= 30);
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_BROWSERID__C_TRIM check (trim(BROWSER_ID_COOKIE) = BROWSER_ID_COOKIE);

alter table DW1_PAGE_ACTIONS add column BROWSER_FINGERPRINT int;


alter table DW1_PAGE_ACTIONS rename column NEW_IP to IP;
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_IP__C_LEN check (length(IP) between 1 and 39);
alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_IP__C_TRIM check (trim(IP) = IP);

update DW1_PAGE_ACTIONS a
  set IP = (
    select l.LOGIN_IP from DW1_LOGINS l
    where a.TENANT = l.TENANT
      and a.LOGIN = l.SNO);

-- IP will be null for the system user, since LOGIN (and GUEST_ID and ROLE_ID)
-- is already null for that user.

alter table DW1_PAGE_ACTIONS add constraint DW1_PGAS_SYSTEMUSER__C check(
    (IP is not null) -- not the system user (0.0.0.0 used if ip unknown, not null)
    or ( -- this is for the system user:
      LOGIN is null and
      GUEST_ID is null and
      ROLE_ID is null and
      BROWSER_ID_COOKIE is null and
      BROWSER_FINGERPRINT is null));


# --- !Downs


alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_IP__C_LEN;
alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_IP__C_TRIM;
alter table DW1_PAGE_ACTIONS rename column IP to NEW_IP;

alter table DW1_PAGE_ACTIONS drop constraint DW1_PGAS_SYSTEMUSER__C;
update DW1_PAGE_ACTIONS set NEW_IP = null;

alter table DW1_PAGE_ACTIONS drop column BROWSER_ID_COOKIE;
alter table DW1_PAGE_ACTIONS drop column BROWSER_FINGERPRINT;

