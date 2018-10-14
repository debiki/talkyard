

create or replace function email_seems_ok(text character varying) returns boolean
language plpgsql as $_$
begin
  -- This isn't supposed to find *all* broken addresses. It's just a somewhat-best-&-short-of-time-
  -- effort to prevent some bugs, e.g. accidentally saving the wrong field. & Maybe xss attack attempts.
  return text ~ '^[^@\s,;!?&\|''"<>]+@[^@\s,;!?&\|''"<>]+\.[^@\s,;!?&\|''"<>]+$'
      -- sha512 is 128 hex chars, maybe someone some day generates an email address with a sha512 hash?
      and length(text) < 200
      -- Don't support email addresses with uppercase letters in the local part,
      -- although technically allowed. Seems like a waste of disk & my poor brain to store
      -- the email in both original case and lowercase — when considering casing is just a
      -- security risk anyway? (somehow somewhere impersonating someone by claiming the same email,
      -- but with different casing).
      and lower(text) = text;
end;
$_$;


create table user_emails3 (
  site_id integer not null,
  user_id integer not null,
  email_address varchar not null,
  added_at timestamp not null,
  verified_at timestamp,
  /* Later?:
  is_primary boolean not null, — no, keep in users3 instead? so can enforce that there is one.
  is_public boolean,
  can_reset_password boolean,
  can_login_via boolean,
  send_notfs boolean, */
  constraint useremails_p primary key (site_id, user_id, email_address),
  constraint useremails_r_users foreign key (site_id, user_id) references users3(site_id, user_id) deferrable,
  -- Cannot add this constraint right now, because OpenAuth emails are verified maybe 100 ms
  -- before user created. Could fix that, update timestamps in db, then add constraint? Later...
  -- constraint useremails_c_addedat_le_verifiedat check (added_at <= verified_at), [5GKRWZI]
  constraint useremails_c_email_ok check (email_seems_ok(email_address))
);

-- Only require verified emails to be unique, so no one can specify another persons email
-- and in that way prevent that other person from signing up with that email.
create unique index useremails_email_verified_u on user_emails3 (site_id, email_address)  -- for now at least
  where verified_at is not null;


-- Add dedicated email addresses column, for guests.
alter table users3 add column guest_email_addr varchar;

-- Move guests' email addresses to new column.
alter table users3 drop constraint users_guest__c_nn;
update users3 set guest_email_addr = email, email = null where user_id < 0;
alter table users3 add constraint users_c_guest_nn check (
  user_id > 0 or (
        email is null
    and created_at is not null
    and full_name is not null
    and guest_email_addr is not null
    and guest_cookie is not null));


alter table users3 rename column email to primary_email_addr;

-- Require lowercase and ok emails everywhere.
update users3 set primary_email_addr = lower(primary_email_addr);
update users3 set primary_email_addr = null where not email_seems_ok(primary_email_addr);
alter table users3 add constraint users_c_email_ok check (email_seems_ok(primary_email_addr));

-- Insert members' emails in email table.
insert into user_emails3 (site_id, user_id, email_address, added_at, verified_at)
  select site_id, user_id, primary_email_addr, created_at, email_verified_at from users3
  where primary_email_addr is not null;

-- Add a users3 –> user_emails3 foreign key.
alter table users3 add constraint users_primaryemail_r_useremails
  foreign key (site_id, user_id, primary_email_addr)
  references user_emails3 (site_id, user_id, email_address) deferrable;



drop index dw1_user_guest__u; -- was on primary_email_address column.
create unique index users_site_guest_u on users3 (site_id, full_name, guest_email_addr, guest_cookie);

drop index dw1_users_site_email__u; -- had a user_id >= -1 constraint, no longer needed.
create unique index users_site_primaryemail_u on users3 (site_id, primary_email_addr);


