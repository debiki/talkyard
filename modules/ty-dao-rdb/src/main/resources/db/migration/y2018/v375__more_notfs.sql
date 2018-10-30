
alter table categories3 rename unlisted to unlist_category;
alter table categories3 add column unlist_topics boolean;

-- This was always the wrong table for this column.
alter table page_users3 drop column any_pin_cleared;


create table page_notf_prefs3(
  site_id int not null,
  people_id int not null,
  notf_level int not null,
  page_id varchar,
  pages_in_whole_site boolean,
  pages_in_category_id int,
  incl_sub_categories boolean,

  -- ix pagenotfprefs_people_i
  constraint pagenotfprefs_r_people foreign key (site_id, people_id) references users3(
    site_id, user_id) deferrable,

  -- ix pagenotfprefs_pageid_people_u
  constraint pagenotfprefs_r_pages foreign key (site_id, page_id) references pages3(
    site_id, page_id) deferrable,

  -- ix pagenotfprefs_category_people_u
  constraint pagenotfprefs_r_cats foreign key (site_id, pages_in_category_id) references categories3(
    site_id, id) deferrable,

  constraint pagenotfprefs_pageid_people_u    unique (site_id, page_id, people_id),
  constraint pagenotfprefs_wholesite_people_u unique (site_id, pages_in_whole_site, people_id),
  constraint pagenotfprefs_category_people_u  unique (site_id, pages_in_category_id, people_id),

  -- The prefs must be for something.
  constraint pagenotfprefs_c_for_sth check (
    page_id is not null or
    pages_in_whole_site is not null or
    pages_in_category_id is not null),

  -- Either true or absent.
  constraint pagenotfprefs_c_wholesite_true check (pages_in_whole_site),

  -- Not yet impl.
  constraint pagenotfprefs_c_inclsubcats check (incl_sub_categories is null),

  constraint pagenotfprefs_c_notf_level check (notf_level between 1 and 9)
);


create index pagenotfprefs_people_i on page_notf_prefs3 (
  site_id, people_id);


insert into page_notf_prefs3(site_id, people_id, pages_in_whole_site, notf_level)
  select site_id, user_id, true, 8  -- = for every post
  from users3 where email_for_every_new_post;


insert into page_notf_prefs3(site_id, people_id, page_id, notf_level)
  select site_id, user_id, page_id,
   case notf_level
     when 1 then 8   -- notified about every post
     when 2 then 5   -- new topics
     when 3 then 4   -- tracking / highlight
     when 4 then 3   -- normal
     when 5 then 1   -- muted
   end
  from page_users3
  where notf_level between 1 and 5;

