
create domain forgotten_d i16_d default 0;
alter  domain forgotten_d add
   constraint forgotten_d_c_in_0_1_2 check (value between 0 and 2);

alter table sessions_t add column                          hash_4_ho_ss_none_c  bytea_len32_d;
alter table sessions_t rename column hash_4_http_only_c to hash_5_ho_ss_lax_c;
alter table sessions_t rename column hash_5_strict_c    to hash_6_ho_ss_strict_c;

alter table sessions_t add column forgotten_c not null;


create sessions_i_to_forget_a_bit on sessions_t (least(deleted_at_c, expired_at_c))
  where forgotten_c = 0;

create sessions_i_to_forget_more on sessions_t (least(deleted_at_c, expired_at_c))
  where forgotten_c = 1;

create sessions_i_ended_at on sessions_t (least(deleted_at_c, expired_at_c));



alter table settings3 add column  email_subj_prefix_c  text_nonempty_ste90_trimmed_d;
alter table settings3 add column  email_regards_html_c text_nonempty_ste120_trimmed_d;
