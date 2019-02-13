
alter table user_stats3 add column tour_tips_seen varchar[];
alter table user_stats3 add constraint userstats_c_tourtipsseen_len check (
    pg_column_size(tour_tips_seen) <= 400);

