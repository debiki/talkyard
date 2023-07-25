

alter table system_settings_t
    add column  maint_words_html_unsafe_c  text_nonempty_ste500_d,
    add column  maint_msg_html_unsafe_c    text_nonempty_ste2000_d;


create domain http_url_ste_250_d http_url_d;
 alter domain http_url_ste_250_d add
   constraint http_url_ste_250_d_c_ste250 check (length(value) <= 250);


alter table tags_t
    add column  val_type_c   i16_gz_d,
    add column  val_i32_c    i32_d,
    add column  val_f64_c    f64_d,
    add column  val_str_c    text_nonempty_ste250_trimmed_d,
    add column  val_url_c    http_url_ste_250_d,
    add column  val_jsonb_c  jsonb_ste1000_d,
    add constraint  tags_c_valtype_has_val  check (
        (val_type_c is null)
          = (num_nonnulls(val_i32_c, val_f64_c, val_str_c, val_url_c, val_jsonb_c) = 0)),
    add constraint  tags_c_max_one_val_for_now  check (
        num_nonnulls(val_i32_c, val_f64_c, val_str_c, val_url_c, val_jsonb_c) <= 1),
    add constraint  tags_c_val_is_i32_or_txt_for_now  check (
        num_nonnulls(val_url_c, val_jsonb_c) = 0),
    add constraint  tags_c_valtype_simple_1_for_now  check (
        (val_type_c = 1) or (val_type_c is null));
