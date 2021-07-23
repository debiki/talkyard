

create table dw1_role_page_settings (
  site_id varchar not null,
  role_id varchar not null,
  page_id varchar not null,
  notf_level varchar not null,
  constraint dw1_ropgst_site_role_page__p primary key (site_id, role_id, page_id),
  constraint dw1_ropgst_site_page__r__pages foreign key (site_id, page_id) references dw1_pages(tenant, guid), -- index: dw1_ropgst_site_page
  constraint dw1_ropgst_site_role__r__roles foreign key (site_id, role_id) references dw1_users(tenant, sno), -- index: dw1_ropgst_site_role_page__p
  constraint dw1_ropgst_notflevel__c_in check (notf_level in (
    'W', -- watching
    'T', -- tracking
    'R', -- regular
    'M')) -- muted
);

create index dw1_ropgst_site_page on dw1_role_page_settings (site_id, page_id);


drop table dw1_notfs_page_actions;

create table dw1_notifications (
  site_id varchar not null,
  notf_type varchar not null,
  created_at timestamp not null,
  page_id varchar,
  post_id int,
  action_id int,
  by_user_id varchar,
  to_user_id varchar not null,
  email_id varchar,
  email_status varchar default 'U' not null,
  seen_at timestamp,
  constraint dw1_notfs_type__c_in check (notf_type in (
    'M',   -- @mentioned
    'R',   -- direct reply
    -- 'r',   -- indirect reply
    'N')), -- new post or topic in watched topic or category
    -- 'A' -- comment approved
    -- 'Q' -- quoted
    -- 'E' -- edited
    -- 'L' -- liked
    -- 'W' -- wrong
    -- 'O' -- off-topic
    -- 'P' -- private message
    -- 'I' -- invite to private message
    -- 'C' -- invite accepted
    -- 'M' -- moved post
    -- 'K' -- linked
  constraint dw1_ntfs__r__sites foreign key (site_id)
      references dw1_tenants(id), -- index: dw1_ntfs_post__u
  constraint dw1_ntfs__r__pages foreign key (site_id, page_id)
      references dw1_pages(tenant, guid), -- index: dw1_ntfs_post__u
  constraint dw1_ntfs__r__posts foreign key (site_id, page_id, post_id)
      references dw1_posts(site_id, page_id, post_id), -- index: dw1_ntfs_post__u
  constraint dw1_ntfs__r__actions foreign key (site_id, page_id, action_id)
      references dw1_page_actions(tenant, page_id, paid), -- index: dw1_ntfs_action__u
  constraint dw1_ntfs__r__emails foreign key (site_id, email_id)
      references dw1_emails_out(tenant, id), -- index: dw1_ntfs_emailid
  constraint dw1_ntfs_by_to__c_ne check (by_user_id <> to_user_id)
);


-- Each user may be notified only once about a new post.
create unique index dw1_ntfs_post__u on dw1_notifications (
    site_id, page_id, post_id, to_user_id) where notf_type in ('M', 'R', 'r', 'N');

-- Each user may be notified only once about a like/wrong vote.
create unique index dw1_ntfs_action__u on dw1_notifications (
    site_id, page_id, action_id, to_user_id) where notf_type in ('L', 'W', 'O');

-- Not unique — each email might contain many notfs.
create index dw1_ntfs_emailid on dw1_notifications (site_id, email_id);

-- When loading notfs to mail out.
create index dw1_ntfs_createdat on dw1_notifications (created_at) where email_status = 'U';

