
create table link_previews_t(
  site_id_c int not null,
  link_url_c varchar not null,
  fetched_from_url_c varchar not null,
  fetched_at_c timestamp not null,
  cache_max_secs_c int,
  status_code_c int not null,
  preview_type_c int not null,
  first_linked_by_id_c int not null,
  content_json_c jsonb,

  constraint linkpreviews_p_linkurl_fetchurl primary key (  -- [lnpv_t_pk]
      site_id_c, link_url_c, fetched_from_url_c),

  -- fk index: linkpreviews_i_firstlinkedby
  constraint linkpreviews_firstlinkedby_r_pps foreign key (
        site_id_c, first_linked_by_id_c)
      references users3 (site_id, user_id),

  constraint linkpreviews_c_linkurl_len check (
      length(link_url_c) between 5 and 500),

  constraint linkpreviews_c_fetchedfromurl_len check (
      length(fetched_from_url_c) between 5 and 500),

  constraint linkpreviews_c_cachemaxsecs check (
      cache_max_secs_c >= 0),

  constraint linkpreviews_c_statuscode check (
      status_code_c >= 0),

  constraint linkpreviews_c_previewtype check (
      preview_type_c between 1 and 9),

  constraint linkpreviews_c_contentjson_len check (
      pg_column_size(content_json_c) between 1 and 27000)
);


create index linkpreviews_i_g_linkurl on link_previews_t (link_url_c);
create index linkpreviews_i_g_fetchedat on link_previews_t (fetched_at_c);
create index linkpreviews_i_fetchedat on link_previews_t (site_id_c, fetched_at_c);
create index linkpreviews_i_firstlinkedby on link_previews_t (site_id_c, first_linked_by_id_c);

create index linkpreviews_i_g_fetch_err_at on link_previews_t (fetched_at_c)
    where status_code_c <> 200;

create index linkpreviews_i_fetch_err_at on link_previews_t (site_id_c, fetched_at_c)
    where status_code_c <> 200;



create table links_t(
  site_id_c int not null,
  from_post_id_c int not null,
  link_url_c varchar not null,
  added_at_c timestamp not null,
  added_by_id_c int not null,
  -- Exactly one of these:
  is_external_c boolean,
  to_staff_space_c boolean,
  to_page_id_c varchar,
  to_post_id_c int,
  to_pp_id_c int,
  to_tag_id_c int,
  to_category_id_c int,

  constraint links_p_postid_url primary key (site_id_c, from_post_id_c, link_url_c),

  -- fk index: the primary key.
  constraint links_frompostid_r_posts foreign key (site_id_c, from_post_id_c)
      references posts3 (site_id, unique_post_id),

  -- fk index: links_i_addedbyid
  constraint links_addedby_r_pps foreign key (site_id_c, added_by_id_c)
      references users3 (site_id, user_id),

  -- fk index: links_i_topageid
  constraint links_topageid_r_pages foreign key (site_id_c, to_page_id_c)
      references pages3 (site_id, page_id),

  -- fk index: links_i_topostid
  constraint links_topostid_r_posts foreign key (site_id_c, to_post_id_c)
      references posts3 (site_id, unique_post_id),

  -- fk index: links_i_toppid
  constraint links_toppid_r_pps foreign key (site_id_c, to_pp_id_c)
      references users3 (site_id, user_id),

  -- fk idnex: links_i_totagid
  -- constranit  tag refs tag_defs_t  — table not yet created

  -- fk index: links_i_tocategoryid
  constraint links_tocatid_r_categories foreign key (site_id_c, to_category_id_c)
      references categories3 (site_id, id),

  constraint links_c_linkurl_len check (
      length(link_url_c) between 1 and 500),

  constraint links_c_isexternal_null_true check (
      is_external_c or (is_external_c is null)),

  constraint links_c_tostaffspace_null_true check (
      to_staff_space_c or (to_staff_space_c is null)),

  constraint links_c_to_just_one check (
      num_nonnulls(
            is_external_c, to_staff_space_c, to_page_id_c,
            to_post_id_c, to_pp_id_c, to_tag_id_c, to_category_id_c)
          = 1)
);


create index links_i_linkurl      on links_t (site_id_c, link_url_c);
create index links_i_addedbyid    on links_t (site_id_c, added_by_id_c);
create index links_i_topageid     on links_t (site_id_c, to_page_id_c);
create index links_i_topostid     on links_t (site_id_c, to_post_id_c);
create index links_i_toppid       on links_t (site_id_c, to_pp_id_c);
create index links_i_totagid      on links_t (site_id_c, to_tag_id_c);
create index links_i_tocategoryid on links_t (site_id_c, to_category_id_c);

