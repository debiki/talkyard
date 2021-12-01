
alter table sessions_t add column                          hash_4_ho_ss_none_c  bytea_len32_d;
alter table sessions_t rename column hash_4_http_only_c to hash_5_ho_ss_lax_c;
alter table sessions_t rename column hash_5_strict_c    to hash_6_ho_ss_strict_c;
