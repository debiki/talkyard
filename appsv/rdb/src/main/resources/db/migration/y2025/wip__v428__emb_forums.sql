-- drop domain http_url_or_empty_ste_250_d;
-- drop domain http_url_or_empty_d;
-- 
-- alter table page_html_cache_t
--     drop column  param_emb_path_param_c,
--     drop column  param_embg_url_or_empty_c,
--     drop column  cached_priv_settings_json_c;



-- Dupl url regex, oh well.
create domain http_url_or_empty_d text;
alter domain http_url_or_empty_d add constraint http_url_d_c_regex check (
    value ~ 'https?:\/\/[a-z0-9_.-]+(/.*)?' or value = '');
alter domain http_url_or_empty_d add constraint http_url_d_c_no_blanks check (value !~ '\s');
alter domain http_url_or_empty_d add constraint http_url_d_c_maxlen check (length(value) <= 2100);

create domain http_url_or_empty_ste_250_d http_url_or_empty_d;
 alter domain http_url_or_empty_ste_250_d add
   constraint http_url_or_empty_ste_250_d_c_ste250 check (length(value) <= 250);



create domain text_oneline_or_empty_d text;
alter domain text_oneline_or_empty_d add constraint text_oneline_or_empty_d_c_print_chars check (
    value ~ '^[[:print:]]*$');

create domain text_oneline_or_empty_120_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_120_d add constraint text_oneline_120_or_empty_d_c_ste120 check (
    length(value) <= 120);

create domain text_oneline_or_empty_60_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_60_d add constraint text_oneline_60_or_empty_d_c_ste60 check (
    length(value) <= 60);

create domain text_oneline_or_empty_30_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_30_d add constraint text_oneline_or_empty_30_d_c_ste30 check (
    length(value) <= 30);

create domain text_oneline_or_empty_15_d text_oneline_d;
alter domain text_oneline_or_empty_15_d add constraint text_oneline_or_empty_15_d_c_ste15 check (
    length(value) <= 15);
comment on domain text_oneline_or_empty_15_d is
    'Like text_oneline_d, but at most 15 chars long.';



alter table page_html_cache_t
    -- rename column param_origin_or_empty_c to param_embd_origin_or_empty_c
    add column  param_emb_path_param_c          text_oneline_or_empty_60_d   default '',
    -- [cache_embg_url]
    -- Not needed? [maybe_need_only_embUrlParam] To deep link, it's enough to just:
    --    '#/-123/some-page'
    add column  param_embg_url_or_empty_c   http_url_or_empty_ste_250_d  default '',
    -- These:
    -- cached_site_version_c cached_page_version_c cached_app_version_c
    -- and  follow-links,  and what more, later?
    -- could instead be in a single json array or obj. Storing each one in
    -- its own column is inflexible — requires a data migration, to change
    -- anything, but are never used for looking things up, so, don't really
    -- need to be in their own columns.
    -- Follow-links isn't visible client-site — can be semi private, known to
    -- admins only (so hackers can't see to which sites links are followed) — so
    -- shouldn't be included in the  cached_store_json_c,
    -- instead, incl in  cached_priv_settings_json_c.
    add column  cached_priv_settings_json_c   jsonb_ste8000_d;


-- Append  param_embg_url_or_empty_c  and  param_emb_path_param_c  to the lookup params.
alter table page_html_cache_t drop constraint pagehtmlcache_p;

alter table page_html_cache_t add constraint pagehtmlcache_p primary key (
    site_id_c,
    page_id_c,
    param_comt_order_c,
    param_comt_nesting_c,
    param_width_layout_c,
    param_theme_id_c_u,
    param_is_embedded_c,
    param_origin_or_empty_c,
    param_cdn_origin_or_empty_c,
    param_ugc_origin_or_empty_c,
    param_emb_path_param_c,
    param_embg_url_or_empty_c);


