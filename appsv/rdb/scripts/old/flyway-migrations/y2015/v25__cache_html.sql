
-- Add html cache table
----------------------

-- Bumped if the site settings are changed in a way that requires
-- all html to be regenerated.
alter table dw1_tenants add column version int not null default 1;
alter table dw1_tenants add constraint dw1_sites_version__c_gz check (version >= 1);

-- Bumped whenever a post is added or edited or something else happens that
-- makes the cached page content html stale.
alter table dw1_pages add column version int not null default 1;
alter table dw1_pages add constraint dw1_pages_version__c_gz check (version >= 1);

create table dw2_page_html(
  site_id varchar not null,
  page_id varchar not null,
  site_version int not null,
  page_version int not null,
  -- In the future: changed if the application starts generating html
  -- in a different way — then all cached html becomes out of date.
  app_version varchar not null,
  -- A hash of the data input to the render algorithm. If the data hasn't
  -- changed, there's no need to re-render, unless the app version is different.
  data_hash varchar not null,
  updated_at timestamp not null,
  html text not null,

  constraint dw2_pagehtml__pageid primary key (site_id, page_id),
  constraint dw2_pagehtml__r__pages foreign key (site_id, page_id)
    references dw1_pages(site_id, page_id)
);

-- Later: Could add a rerender page queue table, or indexes that make it
-- easier to find pages to rerender.


-- Add constraint, fix bad rows
----------------------

-- Fix forum-has-no-category errors: change page type to Discussion.
update dw1_pages
    set page_role = 12 -- discussion
    where page_role = 7 -- forum
      and site_id not in ('3', '55');

-- Fix about-category-page linked to no category error: change to type Discussion.
update dw1_pages
    set page_role = 12 -- discussion
    where page_role in (6, 9) -- about page and blogs
      and category_id is null;

alter table dw1_pages add constraint dw1_pages__c_has_category check (
    page_role not in (6, 7, 9) or -- blog, forum, category
    category_id is not null);

alter table dw1_pages add constraint dw1_pages_role_answered__c check (
    page_role = 10 -- question
    or (answered_at is null and answer_post_id is null));

alter table dw1_pages add constraint dw1_pages_role_planned_done__c check (
    page_role in (13, 14, 15) -- to do, problem, idea
    or (planned_at is null and done_at is null));

