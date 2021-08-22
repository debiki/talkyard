
drop index userstats_nextsummary_i;
create index userstats_nextsummary_i on user_stats3 (next_summary_email_at nulls last);

