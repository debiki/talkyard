
alter table settings3 add column enable_gitlab_login boolean;
alter table settings3 add column enable_linkedin_login boolean;
alter table settings3 add column enable_vk_login boolean;
alter table settings3 add column enable_instagram_login boolean;
alter table settings3 add column enable_forum boolean;
alter table settings3 add column enable_api boolean;
alter table settings3 add column enable_tags boolean;

alter table settings3 add column embedded_comments_category_id int;
alter table settings3 add constraint settings_embcmtscatid_r_categories
  foreign key (site_id, embedded_comments_category_id)
  references categories3(site_id, id);

