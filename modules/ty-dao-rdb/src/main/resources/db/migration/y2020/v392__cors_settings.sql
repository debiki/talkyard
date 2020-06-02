
alter table settings3 add column enable_cors boolean;
alter table settings3 add column allow_cors_from varchar;
alter table settings3 add column allow_cors_creds boolean;
alter table settings3 add column cache_cors_prefl_secs int;

alter table settings3 add constraint settings_c_allowcorsfrom_len check (
    length(allow_cors_from) between 1 and 1000);

