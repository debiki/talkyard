
alter table backup_test_log3 add column file_name varchar;
alter table backup_test_log3 add constraint backuptestlog_c_filename_len check (
  length(file_name) between 1 and 100);

alter table sites3 drop column price_plan;
