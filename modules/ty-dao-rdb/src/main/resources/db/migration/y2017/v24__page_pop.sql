
create table page_popularity_scores3(
  site_id int not null,
  page_id varchar not null,
  popular_since timestamp not null,
  updated_at timestamp not null,
  algorithm smallint not null,
  day_score float not null,
  week_score float not null,
  month_score float not null,
  quarter_score float not null,
  year_score float not null,
  all_score float not null,
  constraint pagepopscores_site_page_p primary key (site_id, page_id),
  constraint pagepopscores_r_pages foreign key (site_id, page_id) references pages3 (site_id, page_id),
  constraint pagepopscores_updat_ge_popsince check (updated_at >= popular_since),
  constraint pagepopscores_alg_gtz check (algorithm > 0)
  -- Scores can perhaps be < 0? If many Unwanted votes, e.g. no Likes, and orig post = unwanted?
);
