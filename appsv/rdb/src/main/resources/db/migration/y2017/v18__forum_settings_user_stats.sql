
-- like:  'abc' or 'abc|def|ghi' + accept chars in other languages / charsets like åäö éá etc, hmm.
-- '/' is allowed, so e.g. 'latest/questions' will work.
create or replace function is_menu_spec(text varchar) returns boolean
language plpgsql as $_$
begin
  return text  ~ '^\S+(\|\S+)?$' and text !~ '[!"\#\$\%\&''\(\)\*\+,\.:;\<=\>\?@\[\\\]\^`\{\}~]';
end;
$_$;

alter table settings3 add column forum_main_view varchar;
alter table settings3 add column forum_topics_sort_buttons varchar;
alter table settings3 add column forum_category_links varchar;
alter table settings3 add column forum_topics_layout int;
alter table settings3 add column forum_categories_layout int;

alter table settings3 add constraint settings_forummainview_c_in check (
  is_menu_spec(forum_main_view) and length(forum_main_view) between 1 and 100);

alter table settings3 add constraint settings_forumtopicssort_c_in check (
  is_menu_spec(forum_topics_sort_buttons) and length(forum_topics_sort_buttons) between 1 and 200);

alter table settings3 add constraint settings_forumcatlinks_c_in check (
  is_menu_spec(forum_category_links) and length(forum_category_links) between 1 and 300);

alter table settings3 add constraint settings_forumtopicslayout_c_in check (
  forum_topics_layout between 0 and 20);

alter table settings3 add constraint settings_forumcatslayout_c_in check (
  forum_categories_layout between 0 and 20);


-- Just type "unnamed oranization" instead, for now.
alter table settings3 drop constraint settings3_required_for_site__c;

-- Use forum_main_view instead.
alter table settings3 drop column show_forum_categories;


-- Will be updated frequently, so don't store in users3 (which contains large & fairly static rows).
create table user_stats3(
  site_id varchar not null,
  user_id int not null,
  last_seen_at timestamp not null,
  last_posted_at timestamp,
  last_emailed_at timestamp,
  last_emaill_link_clicked_at timestamp,
  last_emaill_failed_at timestamp,
  email_bounce_sum real not null default 0,
  first_seen_at timestamp not null,
  first_new_topic_at timestamp,
  first_discourse_reply_at timestamp,
  first_chat_message_at timestamp,
  topics_new_since timestamp not null,
  notfs_new_since_id int not null default 0,
  num_days_visited int not null default 0,
  num_seconds_reading int not null default 0,
  num_discourse_replies_read int not null default 0,
  num_discourse_replies_posted int not null default 0,
  num_discourse_topics_entered int not null default 0,
  num_discourse_topics_replied_in int not null default 0,
  num_discourse_topics_created int not null default 0,
  num_chat_messages_read int not null default 0,
  num_chat_messages_posted int not null default 0,
  num_chat_topics_entered int not null default 0,
  num_chat_topics_replied_in int not null default 0,
  num_chat_topics_created int not null default 0,
  num_likes_given int not null default 0,
  num_likes_received int not null default 0,
  num_solutions_provided int not null default 0,
  constraint userstats_p primary key (site_id, user_id),
  constraint userstats_r_people foreign key (site_id, user_id) references users3 (site_id, user_id),
  constraint userstats_c_lastseen_greatest check (
    (last_seen_at >= last_posted_at or last_posted_at is null) and
    (last_seen_at >= first_seen_at) and
    (last_seen_at >= first_new_topic_at or first_new_topic_at is null) and
    (last_seen_at >= first_discourse_reply_at or first_discourse_reply_at is null) and
    (last_seen_at >= first_chat_message_at or first_chat_message_at is null) and
    (last_seen_at >= topics_new_since)),
  constraint userstats_c_firstseen_gz check (extract (epoch from first_seen_at) > 0),
  constraint userstats_c_firstseen_smallest check (
    (first_seen_at <= last_posted_at or last_posted_at is null) and
    (first_seen_at <= first_new_topic_at or first_new_topic_at is null) and
    (first_seen_at <= first_discourse_reply_at or first_discourse_reply_at is null) and
    (first_seen_at <= first_chat_message_at or first_chat_message_at is null)),
  constraint userstats_c_gez check (
    email_bounce_sum >= 0 and
    notfs_new_since_id >= 0 and
    num_days_visited >= 0 and
    num_seconds_reading >= 0 and
    num_discourse_replies_read >= 0 and
    num_discourse_replies_posted >= 0 and
    num_discourse_topics_entered >= 0 and
    num_discourse_topics_replied_in >= 0 and
    num_discourse_topics_created >= 0 and
    num_chat_messages_read >= 0 and
    num_chat_messages_posted >= 0 and
    num_chat_topics_entered >= 0 and
    num_chat_topics_replied_in >= 0 and
    num_chat_topics_created >= 0 and
    num_likes_given >= 0 and
    num_likes_received >= 0 and
    num_solutions_provided >= 0)
);

-- Hmm, this seems like interesting?
create index userstats_lastseen_i on user_stats3 (site_id, last_seen_at desc);

-- No one should be without statistics.
insert into user_stats3 (site_id, user_id, last_seen_at, first_seen_at, topics_new_since)
  select site_id, user_id, created_at, created_at, created_at from users3;

create table user_visit_stats3(
  site_id varchar not null,
  user_id int not null,
  visit_date date not null,
  num_seconds_reading int not null default 0,
  num_discourse_replies_read int not null default 0,
  num_discourse_topics_entered int not null default 0,
  num_chat_messages_read int not null default 0,
  num_chat_topics_entered int not null default 0,
  constraint uservisitstats_p primary key (site_id, user_id, visit_date),
  constraint uservisitstats_r_people foreign key (site_id, user_id) references users3 (site_id, user_id),
  constraint uservisitstats_c_gez check (
    num_seconds_reading >= 0
    and num_discourse_replies_read >= 0
    and num_discourse_topics_entered >= 0
    and num_chat_messages_read >= 0
    and num_chat_topics_entered >= 0)
);


-- Adding another trust level, the Helpful member, so now there're 6 trust levels not 5.
alter table users3 drop constraint users3_lockedtrustlevel__c_betw;
alter table users3 drop constraint users3_trustlevel__c_betw;

alter table users3 add constraint users_lockedtrustlevel_c_betw check (
  locked_trust_level between 1 and 6);

alter table users3 add constraint users_trustlevel_c_betw check (
  trust_level between 1 and 6);


-- Replaces both page_members3 and member_page_settings3: (will drop them later + add trigger here?)
create table page_users3 (
  site_id varchar not null,
  page_id varchar not null,
  user_id int not null,
  joined_by_id int,
  kicked_by_id int,
  any_pin_cleared boolean,
  notf_level smallint,
  notf_reason smallint,
  num_seconds_reading int not null default 0,
  num_low_posts_read smallint not null default 0,
  -- Per page and user = many rows, so store timestamps with minute resolution only.
  first_visited_at_mins int,
  last_visited_at_mins int,
  last_viewed_post_nr int,
  last_read_at_mins int,
  last_read_post_nr int,
  recently_read_nrs bytea,
  low_post_nrs_read bytea,
  constraint pageusers_page_user_p primary key (site_id, page_id, user_id),
  constraint pageusers_user_r_users foreign key (site_id, user_id) references users3 (site_id, user_id),
  constraint pageusers_joinedby_r_users foreign key (site_id, joined_by_id) references users3 (site_id, user_id),
  constraint pageusers_kickedby_r_users foreign key (site_id, kicked_by_id) references users3 (site_id, user_id),
  constraint pageusers_page_r_pages foreign key (site_id, page_id) references pages3 (site_id, page_id),
  constraint pageusers_notflevel_c_in check (notf_level between 1 and 20),
  constraint pageusers_notfreason_c_in check (notf_reason between 1 and 20),
  constraint pageusers_reason_level_c_null check ((notf_reason is null) or (notf_level is not null)),
  constraint pageusers_lastvisited_firstvisited_c_null check (
    (last_visited_at_mins is null) = (first_visited_at_mins is null)),
  constraint pageusers_lastvisited_lastviewedpostnr_c_null check (
    (last_visited_at_mins is not null) or (last_viewed_post_nr is null)),
  constraint pageusers_lastvisited_lastreadat_c_null check (
    (last_visited_at_mins is not null) or (last_read_at_mins is null)),
  constraint pageusers_lastreadat_lastreadpostnr_c_null check (
    (last_read_at_mins is not null) or (last_read_post_nr is null)),
  constraint pageusers_lastreadat_numsecondsreading_c_0 check (
    (last_read_at_mins is null) = (num_seconds_reading = 0)),
  constraint pageusers_lastreadat_low_last_nrs_c_null check (
    (last_read_at_mins is not null) or (low_post_nrs_read is null and recently_read_nrs is null)),
  constraint pageusers_c_gez check (
    num_seconds_reading >= 0
    and num_low_posts_read >= 0
    and (last_visited_at_mins >= first_visited_at_mins or last_visited_at_mins is null)
    and (last_viewed_post_nr >= 0 or last_viewed_post_nr is null)
    and (last_read_at_mins >= first_visited_at_mins or last_read_at_mins is null)
    and (last_read_post_nr >= 0 or last_read_post_nr is null))
);

-- To lookup per-user statistics quickly.
create index pageusers_user_i on page_users3 (site_id, user_id);

-- Foreign key constraints.
create index pageusers_joinedby_i on page_users3 (site_id, joined_by_id);
create index pageusers_kickedby_i on page_users3 (site_id, kicked_by_id);

insert into page_users3 (site_id, page_id, user_id, joined_by_id)
  select site_id, page_id, user_id, added_by_id
  from page_members3;


-- I've never inited the total-replies count.
update pages3 set num_replies_total = (
  select count(*) from posts3 p
  where p.site_id = pages3.site_id
        and p.page_id = pages3.page_id
        and p.post_nr >= 2); -- skip title (nr 0) and orig post (nr 1)

