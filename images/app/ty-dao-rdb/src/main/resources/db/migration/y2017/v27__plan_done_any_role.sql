
alter table pages3 drop constraint dw1_pages_role_answered__c;
alter table pages3 drop constraint dw1_pages_role_planned_done__c;

alter table user_stats3 rename column next_summary_email_at to next_summary_maybe_at;

alter table pages3 add column incl_in_summaries smallint;
alter table categories3 add column incl_in_summaries smallint;
