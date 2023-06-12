
alter table emails_out3 rename column  id    to  email_id_c;
alter table emails_out3 rename column  type  to  out_type_c;

alter table emails_out3
    alter column  out_type_c      type i16_gz_lt1000_d,
    add   column  out_sub_type_c       i16_gz_lt1000_d,
    drop constraint emailsout_type__c_betw;


create table system_settings_t (
  maintenance_until_unix_secs_c i64_gz_d
);


insert into system_settings_t (maintenance_until_unix_secs_c) values (null);
