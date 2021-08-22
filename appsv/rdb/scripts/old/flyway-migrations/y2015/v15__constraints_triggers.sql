
-- Now the Scala based migration is over.
drop table dw1_page_actions;
drop table dw1_posts;
drop function dw1_actions_summary();
drop function dw1_posts_summary();


-- FK from dw1_posts_read_stats to dw2_posts:
alter table dw1_posts_read_stats drop constraint dw1_pstsrd_site_page__r__pages;
alter table dw1_posts_read_stats add constraint dw1_pstsrd__r__posts
  foreign key (site_id, page_id, post_id) references dw2_posts(site_id, page_id, post_id);


update dw1_tenants set num_posts = (
  select count(*) from dw2_posts where dw1_tenants.id = dw2_posts.site_id);

update dw1_tenants set num_post_text_bytes = (
  select coalesce(
    sum(coalesce(length(approved_source), 0)) +
    sum(coalesce(length(current_source_patch), 0)), 0)
  from dw2_posts where dw1_tenants.id = dw2_posts.site_id);

update dw1_tenants set num_posts_read = (
  select count(*) from dw1_posts_read_stats
  where dw1_tenants.id = dw1_posts_read_stats.site_id);

update dw1_tenants set num_actions = (
  select count(*) from dw2_post_actions
  where dw1_tenants.id = dw2_post_actions.site_id);

update dw1_tenants set num_notfs = (
  select count(*) from dw1_notifications
  where dw1_tenants.id = dw1_notifications.site_id);

