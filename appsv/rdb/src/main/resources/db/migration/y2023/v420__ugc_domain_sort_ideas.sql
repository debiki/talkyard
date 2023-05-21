alter table page_html_cache_t
    rename param_origin_c     to param_origin_or_empty_c;
alter table page_html_cache_t
    rename param_cdn_origin_c to param_cdn_origin_or_empty_c;
alter table page_html_cache_t
    add column                   param_ugc_origin_or_empty_c text default '' not null,
    -- Later. Unused "_u" currently.
    add column                   param_theme_id_c_u i16_gz_d default 2 not null,
    -- For now.
    add constraint pagehtmlcache_c_themeid_eq_2 check (param_theme_id_c_u = 2),

    drop constraint pagehtmlcache_p,
    add constraint pagehtmlcache_p primary key (
          site_id_c,
          page_id_c,
          param_comt_order_c,
          param_comt_nesting_c,
          param_width_layout_c,
          param_theme_id_c_u,
          param_is_embedded_c,
          param_origin_or_empty_c,
          param_cdn_origin_or_empty_c,
          param_ugc_origin_or_empty_c);

create index pagehtmlcache_gi_updatedat on page_html_cache_t (updated_at_c);
