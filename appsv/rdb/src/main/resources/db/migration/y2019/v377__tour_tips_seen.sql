
alter table user_stats3 add column tour_tips_seen varchar[];
alter table user_stats3 add constraint userstats_c_tourtipsseen_len check (
    pg_column_size(tour_tips_seen) <= 400);

-- Don't show intro tours, for people who have old existing admin accounts already.
-- They might have customized their communities, possibly breaking the tours.
update user_stats3 us
  set tour_tips_seen ='{"a_c_a", "a_b_a", "f_c_a", "f_b_a"}'
  where us.user_id >= 100
    and exists (
    select 1 from users3 u
    where u.site_id = us.site_id and u.user_id = us.user_id and u.is_admin);


alter table users3 add column ui_prefs jsonb;
alter table users3 add constraint users_c_uiprefs_len check (
    pg_column_size(ui_prefs) <= 400);


alter table settings3 add column expire_idle_after_mins int;


-- Unpin about category topics.
update pages3 set pin_order = null, pin_where = null where page_role = 9;
