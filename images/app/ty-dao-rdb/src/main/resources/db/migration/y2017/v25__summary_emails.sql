
alter table users3 add column summary_email_interval_mins int;
alter table users3 add column summary_email_if_active bool;

alter table user_stats3 add column last_summary_email_at timestamp;
alter table user_stats3 add column next_summary_email_at timestamp;

alter table page_users3 add column incl_in_summary_email_at_mins int;

create index userstats_nextsummary_i on user_stats3 (next_summary_email_at nulls first);

alter table emails_out3 drop constraint dw1_emlot_type__c_in;
alter table emails_out3 alter column "type" type smallint using (
  case "type"
  when 'Notf' then 1
  when 'AcSm' then 2
  when 'Invt' then 11
  when 'InAc' then 12
  when 'InPw' then 13
  when 'CrAc' then 21
  when 'RsPw' then 22
  end);

alter table emails_out3 add constraint emailsout_type__c_betw check ("type" between 1 and 50);

