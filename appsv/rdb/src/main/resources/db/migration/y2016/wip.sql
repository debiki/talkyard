CLEAN_UP // remove guest_prefs3.version column, use the aduit_log3 table instead
-- Later:
-- alter table categories3 drop column staff_only;
-- alter table categories3 drop column only_staff_may_create_topics;



not needed?:

create table topic_popularity_timeline(
  site_id int not null,
  topic_id varchar not null,
  upserted_at timestamp not null,
  num_posts int not null,
  num_views_by_strangers int not null,
  num_views_by_members int not null,
  num_views_by_trusted int not null,
  num_views_by_core int not null,
  num_likes_total int not null,
  num_likes_by_trusted int not null,
  num_likes_by_core int not null,
  num_disagrees_total int not null,
  num_disagrees_by_trusted int not null,
  num_disagrees_by_core int not null,
  num_unwanted_total int not null,
  num_unwanted_by_trusted int not null,
  num_unwanted_by_core int not null,
  num_op_likes_total int not null,
  num_op_likes_by_trusted int not null,
  num_op_likes_by_core int not null,
  num_op_disagrees_total int not null,
  num_op_disagrees_by_trusted int not null,
  num_op_disagrees_by_core int not null,
  num_op_unwanted_total int not null,
  num_op_unwanted_by_trusted int not null,
  num_op_unwanted_by_core int not null,
  topmost_like_score_total float not null,
  topmost_like_score_by_trusted float not null,
  topmost_like_score_by_core float not null,
  topmost_disagree_score_total float not null,
  topmost_disagree_score_by_trusted float not null,
  topmost_disagree_score_by_core float not null,
  topmost_unwanted_score_total float not null,
  topmost_unwanted_score_by_trusted float not null,
  topmost_unwanted_score_by_core float not null);

instead?:

create table old_page_visits(
  site_id int not null,
  page_id varchar not null,
  when_ms bigint,
  num_views_by_strangers int not null,
  num_views_by_members int not null,
  num_views_by_trusted int not null,
  num_views_by_core int not null);

create table page_visits(
  site_id int not null,
  page_id varchar not null,
  num_views_by_strangers int not null,
  num_views_by_members int not null,
  num_views_by_trusted int not null,
  num_views_by_core int not null,
  viewed_by_member_ids bytea not null,
  viewed_by_ips bytea not null);


-- abs = roughly  popularity-at-end-of-period - popularity-at-start
-- =  like-votes-weigthed / num-views / num-posts, but with priority given to



create table page_views_by_strangers3 (
  site_id varchar not null,
  page_id varchar not null,
  ip varchar not null);    -- NO too much storage space

Triggers to add on page_users3:
    member_page_settings3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON member_page_settings3 FOR EACH ROW EXECUTE PROCEDURE member_page_settings3_sum_quota()


-- ?? Allow trust level 0 = strangers.
-- alter table users3 drop constraint users_lockedtrustlevel_c_betw;
-- alter table users3 drop constraint users_trustlevel_c_betw;
--
-- alter table users3 add constraint people_lockedtrustlevel_c_betw check (
--   locked_trust_level >= 0 and locked_trust_level <= 6);
-- alter table users3 add constraint people_trustlevel_c_betw check (
--   trust_level >= 0 and trust_level <= 6);


----

alter table settings3 add column flag_fraction_to_close_topic real not null default 0.1;
alter table settings3 add column num_flags_to_close_topic int not null default 10;
alter table settings3 add column num_users_to_close_topic int not null default 3;



create table tags3(
  site_id
  tag_id
  tag_label
  num_tagged_pages
  num_tagged_total

create table post_tags3(
  site_id varchar not null,
  post_id int not null,
  tag_id varchar not null,  <--
  is_page bool not null  <--


user_tag_notfs
  site_id
  user_id
  tag_id
  notf_level

user_category_notfs
  site_id
  user_id
  tag_id
  notf_level



create table tag_labels3(
  site_id varchar,
  label_id int,
  label_text varchar not null,
  constraint taglbls_tagid__p primary key (site_id, label_id),
  constraint taglbls_labeltext__c_len check (length (label_text) between 1 and 200)
);

create table post_tags3(
  site_id varchar not null,
  post_id int,
  label_id int not null,
  is_page bool not null,
  constraint posttags_site_post__p primary key (site_id, post_id, label_id),
  constraint posttags__r__taglbls foreign key (site_id, label_id) references tag_labels3(site_id, label_id)
);
