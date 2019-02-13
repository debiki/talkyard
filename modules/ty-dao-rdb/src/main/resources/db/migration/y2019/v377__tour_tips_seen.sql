
alter table user_stats3 add column tour_tips_seen varchar[];
alter table user_stats3 add constraint userstats_c_tourtipsseen_len check (
    pg_column_size(tour_tips_seen) <= 400);

-- Don't show intro tours, for people who have old existing admin accounts already.
-- They might have customized their communities, possibly breaking the tours.
update user_stats3 us
  set tour_tips_seen ='{"fa", "aa"}'
  where us.user_id >= 100
    and exists (
    select 1 from users3 u
    where u.site_id = us.site_id and u.user_id = us.user_id and u.is_admin);


