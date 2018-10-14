

-- The unknown user was never created because of a bug in the v1 script, se the_bug below
insert into users3(site_id, user_id, display_name, email, guest_cookie, created_at)
  select '1',  -3, 'Unknown', '-', 'UU', now_utc()
  where not exists (
    select 1 from users3 where site_id = '1' and user_id = -3); -- the_bug: -3 was -1

