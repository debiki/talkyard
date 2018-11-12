
create table drafts3 (
  site_id int not null,
  by_user_id int not null,
  draft_nr int not null,
  draft_type smallint not null,
  created_at timestamp not null,
  last_edited_at timestamp,
  deleted_at timestamp,
  category_id int,
  to_user_id int,
  topic_type smallint,
  page_id varchar,
  post_nr int,
  post_id int,
  post_type smallint,
  title varchar not null,
  text varchar not null,

  constraint drafts_byuser_nr_p primary key (site_id, by_user_id, draft_nr),

	-- ix: pk
  constraint drafts_byuser_r_users foreign key (
      site_id, by_user_id) references users3 (site_id, user_id) deferrable,

	-- ix: drafts_category_i
  constraint drafts_category_r_cats foreign key (
      site_id, category_id) references categories3 (site_id, id) deferrable,

	-- ix: drafts_touser_i
  constraint drafts_touser_r_users foreign key (
      site_id, to_user_id) references users3 (site_id, user_id) deferrable,

  -- ix: drafts_pageid_postnr_i (sometimes with null postnr)
  constraint drafts_pageid_r_pages foreign key (
      site_id, page_id) references pages3 (site_id, page_id) deferrable,

  -- ix: drafts_pageid_postnr_i
  constraint drafts_pageid_postnr_r_posts foreign key (
      site_id, page_id, post_nr) references posts3 (site_id, page_id, post_nr) deferrable,

	-- ix: drafts_postid_i
  constraint drafts_postid_r_posts foreign key (
      site_id, post_id) references posts3 (site_id, unique_post_id) deferrable,

  constraint drafts_c_nr_gte_1 check (draft_nr >= 1),
  constraint drafts_c_createdat_lte_lasteditedat check (created_at <= last_edited_at),
  constraint drafts_c_createdat_lte_deletedat    check (created_at <= deleted_at),
  constraint drafts_c_lasteditedat_lte_deletedat check (last_edited_at <= deleted_at),
  constraint drafts_c_postnr_has_pageid check ((post_nr is null) or (page_id is not null)),

  constraint drafts_c_title_len_lte_500 check (length(title) <= 500),
  constraint drafts_c_text_len_lte_500k check (length(text) <= 500*1000),

  -- Draft type 1 = scratch, all fine.

  -- Is an okay new-topic draft?
  constraint drafts_c_type_topic check (
    draft_type <> 2 or (
      category_id is not null and
      topic_type is not null and
      page_id is not null and
      post_nr is null and
      post_id is null and
      post_type is null and
      to_user_id is null)),

  constraint drafts_c_type_direct_message check (
    draft_type <> 3 or (
      category_id is null and
      topic_type is not null and
      page_id is null and
      post_nr is null and
      post_id is null and
      post_type is null and
      to_user_id is not null)),

  constraint drafts_c_type_edit check (
    draft_type <> 4 or (
      category_id is null and
      topic_type is null and
      page_id is not null and
      post_nr is not null and
      post_id is not null and
      -- post_type: any is fine
      to_user_id is null)),

  constraint drafts_c_type_reply check (
    draft_type <> 5 or (
      category_id is null and
      topic_type is null and
      page_id is not null and
      post_nr is not null and
      post_id is not null and
      post_type is not null and
      to_user_id is null))
);


create index drafts_byuser_editedat_i on drafts3 (
  site_id, by_user_id, coalesce(last_edited_at, created_at)) where deleted_at is null;

create index drafts_byuser_deldat_i on drafts3 (
  site_id, by_user_id, deleted_at desc) where deleted_at is not null;


create index drafts_category_i      on drafts3 (site_id, category_id);
create index drafts_touser_i        on drafts3 (site_id, to_user_id);
create index drafts_pageid_postnr_i on drafts3 (site_id, page_id, post_nr);
create index drafts_postid_i        on drafts3 (site_id, post_id);

