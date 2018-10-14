

-- No foreign keys, because that'd prevent us from deleting the site, page or post.
create table index_queue3(
  inserted_at timestamp not null default now_utc(),
  -- When the item was created or inserted into the queue or whatever. We sort by this
  -- field when determining in which order to index stuff. Or not?
  action_at timestamp not null,
  site_id varchar not null,
  site_version int not null,
  page_id varchar,
  page_version int,
  post_id int,
  post_rev_nr int,
  constraint ixq_site_page__u unique (site_id, page_id),
  constraint ixq_site_post__u unique (site_id, post_id),
  constraint ixq_page_or_post__c_xor check (page_id is null or post_id is null),
  constraint ixq_page_pageversion__c_nl_eq check ((page_id is null) = (page_version is null)),
  constraint ixq_post_postrevnr__c_nl_eq check ((post_id is null) = (post_rev_nr is null))
);

create index ixq_actionat__i on index_queue3 (action_at desc);


