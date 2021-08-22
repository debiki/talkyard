-- Fix bug, prev release. (Forgot ^ $ regex anchors.)
-- Also see: v407__upvote_features.adoc
alter domain http_url_d drop constraint http_url_d_c_regex;
alter domain http_url_d add constraint http_url_d_c_regex check (
    value ~ '^https?:\/\/[a-z0-9_.-]+(:[0-9]+)?(/.*)?$');

create domain text_trimmed_not_empty_d text;
alter domain text_trimmed_not_empty_d
    add constraint text_trimmed_not_empty_d_c_not_empty check (length(value) >= 1);
alter domain text_trimmed_not_empty_d
    add constraint text_trimmed_not_empty_d_c_trimmed check (
    value ~ '^(\S(.*\S)?)?$');

create domain page_sort_order_d i16_gz_d;
alter domain page_sort_order_d add constraint page_sort_order_d_c_lt100 check (value < 100);

create domain trending_period_d i16_gz_d;
alter domain trending_period_d add constraint trending_period_d_c_lte6 check (value <= 6);

create domain do_vote_style_d i16_gez_d;
alter domain do_vote_style_d add constraint do_vote_style_d_c_lte5 check (value <= 5);

alter table upload_refs3 add column uploaded_file_name_c text_trimmed_not_empty_d;


alter table page_popularity_scores3 rename algorithm to score_alg_c;

alter table categories3 add column def_sort_order_c page_sort_order_d;
alter table categories3 add column def_score_alg_c i16_gez_d;
alter table categories3 add column def_score_period_c trending_period_d;

alter table categories3 add constraint cats_c_defscorealg_period check (
  (def_score_alg_c is null) = (def_score_period_c is null));


alter table categories3 add column do_vote_style_c do_vote_style_d;
alter table categories3 add column do_vote_in_topic_list_c bool;

alter table pages3 add column num_op_do_it_votes_c i32_gez_d not null default 0;
alter table pages3 add column num_op_do_not_votes_c i32_gez_d not null default 0;

alter table pages3 add column answered_by_id_c int;
alter table pages3 add column published_by_id_c int;
alter table pages3 rename column wait_until to postponed_til_c;
alter table pages3 add column postponed_by_id_c int;
alter table pages3 add column planned_by_id_c int;
alter table pages3 add column started_by_id_c int;
alter table pages3 add column paused_by_id_c int;
alter table pages3 add column done_by_id_c int;
alter table pages3 add column closed_by_id_c int;
alter table pages3 add column locked_by_id_c int;
alter table pages3 add column frozen_by_id_c int;
alter table pages3 add column unwanted_by_id_c int;
alter table pages3 add column hidden_by_id_c int;
alter table pages3 add column deleted_by_id_c int;

alter table pages3 add constraint pages_answeredby_r_pats foreign key (
  site_id, answered_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_publishedby_r_pats foreign key (
  site_id, published_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_postponedby_r_pats foreign key (
  site_id, postponed_by_id_c ) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_plannedby_r_pats foreign key (
  site_id, planned_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_startedby_r_pats foreign key (
  site_id, started_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_pausedby_r_pats foreign key (
  site_id, paused_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_doneby_r_pats foreign key (
  site_id, done_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_closedby_r_pats foreign key (
  site_id, closed_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_lockedby_r_pats foreign key (
  site_id, locked_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_frozenby_r_pats foreign key (
  site_id, frozen_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_unwantedby_r_pats foreign key (
  site_id, unwanted_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_hiddenby_r_pats foreign key (
  site_id, hidden_by_id_c) references users3(site_id, user_id) deferrable;

alter table pages3 add constraint pages_deletedby_r_pats foreign key (
  site_id, deleted_by_id_c) references users3(site_id, user_id) deferrable;

-- deleted_by_id_c was added later, so might be null even if deleted_at isn't.
alter table pages3 add constraint pages_c_deletedby_at_null check (
  deleted_by_id_c is null or deleted_at is not null);

-- Foreign key indexes.
create index pages_i_answeredby on pages3 (site_id, answered_by_id_c)
  where answered_by_id_c is not null;
create index pages_i_publishedby on pages3 (site_id, published_by_id_c)
  where published_by_id_c is not null;
create index pages_i_postponedby on pages3 (site_id, postponed_by_id_c)
  where postponed_by_id_c is not null;
create index pages_i_plannedby on pages3 (site_id, planned_by_id_c)
  where planned_by_id_c is not null;
create index pages_i_startedby on pages3 (site_id, started_by_id_c)
  where started_by_id_c is not null;
create index pages_i_pausedby on pages3 (site_id, paused_by_id_c)
  where paused_by_id_c is not null;
create index pages_i_doneby on pages3 (site_id, done_by_id_c)
  where done_by_id_c is not null;
create index pages_i_closedby on pages3 (site_id, closed_by_id_c)
  where closed_by_id_c is not null;
create index pages_i_lockedby on pages3 (site_id, locked_by_id_c)
  where locked_by_id_c is not null;
create index pages_i_frozenby on pages3 (site_id, frozen_by_id_c)
  where frozen_by_id_c is not null;
create index pages_i_unwantedby on pages3 (site_id, unwanted_by_id_c)
  where unwanted_by_id_c is not null;
create index pages_i_hiddenby on pages3 (site_id, hidden_by_id_c)
  where hidden_by_id_c is not null;
create index pages_i_deletedby on pages3 (site_id, deleted_by_id_c)
  where deleted_by_id_c is not null;
