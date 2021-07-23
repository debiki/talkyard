
create table dw2_review_tasks(
  site_id varchar not null,
  id int not null,
  reasons bigint not null,
  caused_by_id int not null,
  created_at timestamp not null,
  created_at_rev_nr int,
  more_reasons_at timestamp,
  completed_at timestamp,
  completed_at_rev_nr int,
  completed_by_id int,
  invalidated_at timestamp,
  resolution int,
  user_id int,
  page_id varchar,
  post_id int,
  post_nr int,
  -- could also review:
  --category_id varchar,
  --upload_id varchar,
  --group_id int,
  constraint dw2_reviewtasks__p primary key (site_id, id),
  constraint dw2_reviewtasks_causedbyid__r__users foreign key (site_id, caused_by_id) references dw1_users(site_id, user_id), -- ix: dw2_reviewtasks_causedbyid__i
  constraint dw2_reviewtasks_complbyid__r__users foreign key (site_id, completed_by_id) references dw1_users(site_id, user_id), -- ix: dw2_reviewtasks_completedbyid__i
  constraint dw2_reviewtasks_userid__r__users foreign key (site_id, user_id) references dw1_users(site_id, user_id), -- ix: dw2_reviewtasks_userid__i
  constraint dw2_reviewtasks__r__pages foreign key (site_id, page_id) references dw1_pages(site_id, page_id), -- ix: dw2_reviewtasks_pageid__i
  constraint dw2_reviewtasks__r__posts foreign key (site_id, post_id) references dw2_posts(site_id, unique_post_id), -- ix: dw2_reviewtasks_postid__i
  constraint dw2_reviewtasks_morereasonsat_ge_createdat__c check(more_reasons_at >= created_at),
  constraint dw2_reviewtasks_completedat_ge_createdat__c check(completed_at >= created_at),
  constraint dw2_reviewtasks_completedat_ge_morereasonsat__c check(completed_at >= more_reasons_at),
  constraint dw2_reviewtasks_completedat_by__c_nn check(completed_at is null = completed_by_id is null),
  constraint dw2_reviewtasks_completedat_atrevnr__c_nn check(completed_at is not null or completed_at_rev_nr is null),
  constraint dw2_reviewtasks_invalidatedat_ge_createdat__c check (invalidated_at >= created_at),
  constraint dw2_reviewtasks_invalidatedat_ge_morereasonsat__c check(invalidated_at >= more_reasons_at),
  constraint dw2_reviewtasks_completed_or_invalidatedat_null__c check (completed_at is null or invalidated_at is null),
  constraint dw2_reviewtasks_resolution__c_n check(
    (completed_by_id is null and invalidated_at is null) = resolution is null),
  constraint dw2_reviewtasks_postid_nr__c_n check (post_id is null = post_nr is null),
  constraint dw2_reviewtasks_thing__c_nn check(
    post_id is not null or user_id is not null or page_id is not null)
);

-- Only one row per causer and thing being reviewed. We'll update it if the same
-- user causes even more review reasons (rather than creating many rows).

create unique index dw2_reviewtasks_causedby_postid__u on dw2_review_tasks(
    site_id, caused_by_id, post_id)
    where post_id is not null and completed_at is null and invalidated_at is null;

create unique index dw2_reviewtasks_causedby_userid__u on dw2_review_tasks(
    site_id, caused_by_id, user_id)
    where user_id is not null and completed_at is null and invalidated_at is null;


-- On the review page, we'll list all tasks, most recent first.
create index dw2_reviewtasks_createdat__i on dw2_review_tasks(site_id, created_at desc);

-- Foreign key indexes:

create index dw2_reviewtasks_causedbyid__i on dw2_review_tasks(site_id, caused_by_id);

create index dw2_reviewtasks_completedbyid__i on dw2_review_tasks(site_id, completed_by_id)
    where completed_by_id is not null;

create index dw2_reviewtasks_userid__i on dw2_review_tasks(site_id, user_id)
    where user_id is not null;

create index dw2_reviewtasks_pageid__i on dw2_review_tasks(site_id, page_id)
    where page_id is not null;

create index dw2_reviewtasks_postid__i on dw2_review_tasks(site_id, post_id)
    where post_id is not null;


-- Hide in forum category setting:
alter table dw2_categories add hide_in_forum boolean not null default false;

