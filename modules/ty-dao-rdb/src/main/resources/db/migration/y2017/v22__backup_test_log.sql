
create table backup_test_log3(
  logged_at timestamp not null,
  logged_by varchar not null,
  backup_of_what varchar not null,
  random_value varchar not null,
  got_ok_message_at timestamp);

create index backup_test_log_i on backup_test_log3 (logged_at desc);


