

-- No foreign keys, because that'd prevent us from deleting the post.
create table spam_check_queue3(
  inserted_at timestamp not null default now_utc(),
  -- When the item was created or inserted into the queue or whatever. We sort by this
  -- field when determining in which order to check for spam.
  action_at timestamp not null,
  site_id varchar not null,
  post_id int not null,
  post_rev_nr int not null,
  user_id int not null,
  user_id_cookie varchar not null,
  browser_fingerprint int not null,
  req_uri varchar not null,
  req_ip varchar not null,
  req_user_agent varchar,
  req_referer varchar,

  constraint scq_site_post__p primary key (site_id, post_id)
);

create index scq_actionat__i on spam_check_queue3 (action_at desc);


