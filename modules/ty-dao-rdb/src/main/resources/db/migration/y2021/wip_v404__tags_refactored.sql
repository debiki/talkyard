
-- Tags want colors.
create domain color_d as varchar
    constraint color_d_c_hex_or_rgb_or_hsl check (
        value like '^#[a-f0-9]{3}([a-f0-9]{3})?$');

comment on domain color_d is
'CSS colors for now, lowercase hex: #ab3 or #aabb33. Later, also rgba, hsl, hsla.';


create domain tag_ttl_1_50



DONE  create table prop_defs_t(
  site_id_c int,
  id_c int,
  name_c varchar,
  url_slug_c varchar,
  descr_page_id_c,
  descr_url_c,
  icon_nr_c,
  image_upl_path_c,
  text_color_c,           -- text, so all of e.g.: #ff0033 and hsla(0,90%,50%,0.3) works
  handle_color_c,
  background_color_c,
  enabled_c,
  deleted_c,
  allowed_value_types_c  prop_type_d[],   -- extra table = overkill
  allowed_value_prop_set_c  —> prop_defs_t,  ?? what ?? not  prop_def_sets_t ?
                                             or did I mean:  prop_defs_t[]  but then fks won't work?
  allow_multi_vals_c,
  show_where_c,
  sort_order_c,
);




