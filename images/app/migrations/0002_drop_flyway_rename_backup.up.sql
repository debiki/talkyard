
-- Not using Flyway any more. We're using sqlx instead. But new installations
-- haven't been using Flyway ever (they started instead with sqlx migration 0001),
-- so these tables might not exist.
--
drop table if exists flyway_schema_history;
drop table if exists schema_version;


-- Drop this unused fn. But it doesn't exist in all databases; apparently I've
-- added it manually in one db and forgotten about it.
drop function if exists member_page_settings3_sum_quota();

-- Another old unused fn that might not exist.
drop function if exists inc_next_page_id(site_id character varying);

-- Comment sometimes present. Was in a Flyway-repeatable-migration but then removed.
-- We'll delete this column anyway so let's remove the comment until then.
comment on column posts3.private_pats_id_c is null;


create domain text_oneline_250_d as text_oneline_d
	constraint text_oneline_250_d_c_ste250 check ((length((value)::text) <= 250));


-- Now (the first group of migrations in v1) is the time to rename the backup table
-- and add forgotten constraints.
--
-- Could rename and reuse  backup_test_log3,  but there were some strange rows with
-- filenames with '\n' inside (!) on one server, so the  text_oneline_250_d  constraint
-- broke. Let's create a new table instead, and delete  backup_test_log3  later.
--
-- There'll probably be a  backup_history_t  table too, later, for backups of
-- individual sites. So let's name this table  sys_... .
--
create table sys_backup_history_t (
  created_at_c  timestamp without time zone  not null,
  by_host_c     text_oneline_120_d  not null,
  component_c   text_oneline_120_d  not null,
  file_name_c   text_oneline_250_d  not null,
  rand_val_c    text_oneline_60_d   not null,
  label_c       text_oneline_120_d
);

create index sysbackup_i_createdat on sys_backup_history_t (created_at_c desc);

create unique index sysbackup_u_randval_component on sys_backup_history_t (
    rand_val_c, component_c);

