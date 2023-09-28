
-- Reference id.
create domain  ref_id_d  text;
alter  domain  ref_id_d  add constraint ref_id_d_c_valid check (is_valid_ext_id(value));

create domain  value_type_d  i16_d;
alter  domain  value_type_d  add constraint value_type_d_c_lt3000_for_now check (value < 3000);
alter  domain  value_type_d  add constraint value_type_d_c_gtem3_nz check (
  value >= -3 and value <> 0);

alter table tagtypes_t
    add column  ref_id_c       ref_id_d,
    add column  wants_value_c  never_always_d,
    add column  value_type_c   value_type_d,
    add constraint  types_c_wantsval_valtype_null  check (
        ((wants_value_c is null) or (wants_value_c <= 2))
        or (value_type_c is not null));

create unique index types_u_refid on tagtypes_t (site_id_c, ref_id_c)
    where ref_id_c is not null;


-- Ref id not needed? Instead, the tag type ref id, and page or comment ref id
-- is enough to identify a tag. (Unless there can be & are many tags of the same
-- type. Then maybe use tag value too?)
alter table tags_t
    alter column  val_type_c type value_type_d,
    add column  val_i32_b_c  i32_d,
    add column  val_f64_b_c  i32_d,
    drop constraint  tags_c_valtype_has_val,
    add  constraint  tags_c_valtype_has_val  check (
         -- -1, -2 (and -3?) are False, True (and Null of unknown type?),
         -- and need no other fields.
         ((val_type_c is null) or val_type_c < 0)
           = (num_nonnulls(
               val_i32_c, val_i32_b_c,
               val_f64_c, val_f64_b_c,
               val_str_c, val_url_c, val_jsonb_c) = 0)),
    add  constraint  tags_c_vali32_b_null  check (
         (val_i32_c is not null) or (val_i32_b_c is null)),
    add  constraint  tags_c_valf64_b_null  check (
         (val_f64_c is not null) or (val_f64_b_c is null)),
    drop constraint  tags_c_max_one_val_for_now,
    drop constraint  tags_c_val_is_i32_or_txt_for_now,
    drop constraint  tags_c_valtype_simple_1_for_now;
