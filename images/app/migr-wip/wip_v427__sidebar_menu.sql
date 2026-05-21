


create table menus_t (
  site_id_c         site_id_d,
  menu_id_c         menu_id_d,
  -- If one wants to include some things from what-would-have-been
  -- one's default menu. If null, then, looks up by looking at one's groups
  -- and their menus.
  default_menu_id     menu_id_d
  -- Currently only sidebar menu.
  menu_type_c       menu_type_d,
  -- People in this group, will use this menu, by default. (If two groups one
  -- is a member of have different menus, then what? Won't be a problem, for now:
  -- there'd probably just be an Everyone group's menu, and one's own changes
  -- if any.)
  for_pat_id_c      pat_id_d,
  -- People in this group, can edit the menu items.
  -- If null, the menu is for_pat_id_c's personal menu (someone's custom sidebar).
  -- (A new table, perms_on_menus_t, would be overkill, right?)
  managed_by_id_c   pat_id_d,
);


-- icon class? Or a number into an images table?
create domain  icon_d  text_oneline_60_d;


create table menu_items_t (
  site_id_c           site_id_d,
  menu_id_c           menu_id_d,
  item_id_c           i32_lt2e9_gt1000_d,
  parent_id_c         i32_lt2e9_gt1000_d
  position_c          i32_nz_d,
  disp_name_c         tag_name_60_d,
  abbr_name_c         tag_name_15_d,
  descr_c             text_nonempty_ste1000_trimmed_d,
  icon_c              icon_d,

  -- A link to all cats, all tags, groups, or something.
  -- Or, inserts the contents from the default_menu_id — so one can
  -- add a few menu items, without "losing" what-would-have-been the default menu
  -- items at that place in the menu.
  special_c           i16_gz_d,
  link_cat_id_c       cat_id_d,    -- link to a category
  link_type_id_c      type_d,      -- link to a tag type, bookmark type, user badge type
  link_page_id_c      page_id_d,   -- link to a page
  link_pat_id_c       pat_id_d,    -- link to some group
  link_url_path_c     http_url_d,  -- to a page in the forum
  link_url_c          http_url_d,  -- to a page elsewhere, e.g. in one's website
);
