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



-- Restrict alg id to [1, 1000] to catch bugs.
-- First, shouldn't be needed, but anyway:
update page_popularity_scores3
    set score_alg_c = 1 where score_alg_c != 1 or score_alg_c is null;

alter table page_popularity_scores3
    alter column score_alg_c type i16_gz_lt1000_d,
    -- This > 0 no longer needed (see _gz above):
    drop constraint pagepopscores_alg_gtz,

    -- Add alg id to primary key.
    drop constraint pagepopscores_site_page_p,
    add  constraint pagepopscores_p_pageid_algid
            primary key (site_id, page_id, score_alg_c);

create index pagepopscores_i_algid_dayscore on page_popularity_scores3 (
    site_id, score_alg_c, day_score);
create index pagepopscores_i_algid_weekscore on page_popularity_scores3 (
    site_id, score_alg_c, week_score);
create index pagepopscores_i_algid_monthscore on page_popularity_scores3 (
    site_id, score_alg_c, month_score);
create index pagepopscores_i_algid_quarterscore on page_popularity_scores3 (
    site_id, score_alg_c, quarter_score);
create index pagepopscores_i_algid_yearscore on page_popularity_scores3 (
    site_id, score_alg_c, year_score);
create index pagepopscores_i_algid_allscore on page_popularity_scores3 (
    site_id, score_alg_c, all_score);
