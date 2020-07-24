
alter table settings3 add column nav_conf jsonb;
alter table settings3 add constraint settings_c_navconf_len check (
    pg_column_size(nav_conf) <= 50000);

