
alter table settings3 add column start_of_body_html varchar;
alter table settings3 add constraint settings_c_startofbodyhtml_len check (
    length(start_of_body_html) between 1 and 50000);

alter table user_stats3 add column snooze_notfs_until timestamp;
alter table user_stats3 add column after_snooze_then int;


