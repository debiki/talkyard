
create table pages_t (  -- [disc_props_view_stats]
  site_id_c,
  id_c,
  old_id_st_c, -- legacy textual id
  page_type_c,
  category_id_c,

  --- Maybe skip all these? Use posts_t.* instead from the Orig Post?
  --- Or can it make sense to mark a page Done, independently of if
  --- all mini tasks therein are done or not? I suppose so, yes,
  --- so maybe these fields should be *both* in posts_t and pages_t?
  created_by_id_c,
  author_id_c,

  answered_by_id_c,  -- Or use only posts_t.answered_status_c etc instead,
                     --   and maybe this caches the Orig Posts statuses,
                     --   for rendering the topic list faster?
  planned_by_id_c,   -- No? doing_status_c instead,
  --  assigned_to_id_c ? No, see PatRelType_later  instead — relationships
                                  --   from pats to posts of type AssignedTo.
  started_by_id_c,   --    with details in the audit log:  when, by who
  done_by_id_c,      --

  closed_by_id_c,
  locked_by_id_c,  -- cannot post new replies
  frozen_by_id_c,  -- cannot even edit one's old replies
  deleted_by_id_c,
  may_undelete_c,  -- ? if page deleted by non-staff author, and staff wants to prevent
                    -- the author from undeleting it. Null (default) means yes, may.
  purged_by_id_c,  -- ?
  -------------------------------------------------------------------

  pin_where_c,
  pin_order_c,

  -- Only for section pages: (e.g. forum topics & cats list page, or wiki main page)
  -- Why not in cats_t? Because now, with this in pages_t, one can
  -- 
  sect_props_c references sect_props_t (site_id_c, Everyone.id, props_id_c),
  sect_view_c  references sect_views_t (site_id_c, Everyone.id, view_id_c),
  -- No, reference from cats_t, the root cat, instead? because there should
  -- be just one stats entry, not one per "view" page.
  sect_stats_c references sect_stats_c (site_id_c, Everyone.id, stats_id_c),

  -- For a section page, this'd be the defaults for all pages in the section
  -- (or if navigating to those pages, via this section page).
  -- And the stats would be the aggregate stats, for the whole section.
  disc_props_c references disc_props_t (site_id_c, Everyone.id, props_id_c),
  disc_view_c  references disc_view_t  (site_id_c, Everyone.id, props_id_c),
  disc_stats_c references disc_stats_c (site_id_c, Everyone.id, stats_id_c),
);

-- Too complicated: (one table per site section type: forum, wiki, blog etc)
-- alter table pages_t add column forum_props_c references forum_props_t (props_id_c);
-- alter table pages_t add column wiki_props_c  references wiki_props_t (props_id_c);
-- alter table pages_t add column blog_props_c  references blog_props_t (props_id_c);
-- alter table pages_t add column article_props_c  references article_props_t (props_id_c);
-- alter table pages_t add column disc_props_c  references disc_props_t (props_id_c);
-- alter table pages_t add column podcast_props_c  references disc_props_t (props_id_c);
-- alter table pages_t add column video_props_c  references disc_props_t (props_id_c);
-- alter table pages_t add column image_props_c  references disc_props_t (props_id_c);
-- alter table pages_t add column link_props_c  references disc_props_t (props_id_c);


-- Site section config table — how a forum / wiki / blog section should look and function.
-- Can be overridden in categories, and individual pages.
create table sect_props_t (  -- or: forum_props_t?
  site_id_c,
  id_c
  ---- No, use a props id instead, (the row above), ------
  -- and magic id 1 could be the site defaults?
  --forum_page_id_c  page_id_st_d,   -- if null, is the default for all forums in the Ty site
  -- cat_id_c -- if should look different in a category
  -- pat_id_c, -- optionally, configure one's own different default settings?
  ----------------------------------------------------------
  -- Move these to here:
  -- pages3.column forum_search_box_c  i16_gz_d;
  -- pages3.column forum_main_view_c   i16_gz_d;
  -- pages3.column forum_cats_topics_c i32_gz_d;

  -- Hmm but shouldn't these (the above & the below) be in  sect_view_t  instead?
  -- they're related to how to layout & show the section, not to
  -- how it functions?  Maybe how it functions, is in fact defined by
  -- the permissions tables? Who may do what?  perms_on_pages_t.

  show_categories            bool,
  show_topic_filter          bool,
  show_topic_types           bool,
  select_topic_type          bool, 
  forum_main_view            text,
  forum_topics_sort_buttons  text,
  forum_category_links       text,
  forum_topics_layout        int,
  forum_categories_layout    int,
  horizontal_comments,

  -- Move from categories3 to here? So simpler to share same settings,
  -- in different categories.
  def_page_sort_order_c        page_sort_order_d,
  def_page_score_alg_c         i16_gez_d,
  def_page_score_period_c      trending_period_d,
  do_vote_style_c         do_vote_style_d,
  do_vote_in_topic_list_c bool

  -- If is a wiki, wiki props would be here, right?
  -- I think there wouldn't be a separate wiki_props_t.
  -- Or if is a blog, there wouldn't be a blog_props_t — instead,
  -- any such props would be here in sect_props_t.
  -- And knowledge base props, e.g. "index squares" layout,
  -- also would be in this table.
);

create table sect_view_t (
  -- ...
  forumSearchBox: Opt[i32] = None,
  forumMainView: Opt[i32] = None,
  forumCatsTopics: Opt[i32] = None,
);

create table sect_stats_t (
  -- ...
);

create table disc_props_t (   -- Scala:  DiscProps
  site_id,
  props_id_c,
  -- Most by staff & author changeable things from pages3
  -- that aren't specific to one single page, but make more sense to
  -- configure for groups of pages? (in a cat, or site siction)
  ---------------------------------------------

  orig_post_reply_btn_title  text.  -- max len?
  orig_post_votes            int,
  enable_disagree_vote_c
  ...other-votes-&-reactions...
  ...
);

-- or name it  disc_layout_t  instead?
-- Or skip for now, incl in  disc_props_t  instead?  then, not configurable per pat.
-- Can customize individually: (just how discussions *look*)
create table disc_view_t (   -- people can configure their own ~~view~~ layout (distant future)
  site_id,
  pat_id_c,  -- if someone's personal view. Default Everyone.Id
  view_nr_c,

  discussion_layout          int,
  comt_order,
  comt_nesting,

  -- Skip?:
  --progress_layout          int,
  --timeline_comt_nesting    int,
  --timeline_comt_order      int,

  emb_comt_order_c           int,  -- or could be a (or two?) nibble(s) in comt_ordr?
  emb_comt_nesting_c         int,  -- this too?   And if nibble is 0, then
                                   -- use the not-embedded config.

  SquashSiblingIndexLimit
  SummarizeNumRepliesVisibleLimit
);

create table disc_stats_t (   -- updated automatically
  site_id,
  -- Auto updated fields from pages3
  num_op_replies_visible,
  num_replies_visible,
  num_op_likes_votes,
  num_op_wrong_votes,
  ...
  num_likes,
  ...
);





sect_views_t, maybe:
  search_box_c  bool
  cat_active_topics_c  sort_order_c
  cat_popular_topics_day_c  sort_order_c
  cat_popular_topics_2days_c  sort_order_c
  cat_popular_topics_week_c  sort_order_c
  cat_popular_topics_2weeks_c  sort_order_c
  cat_popular_topics_month_c  sort_order_c
  cat_popular_topics_quarter_c  sort_order_c
  cat_popular_topics_year_c  sort_order_c
popular topics, last week, sort order 0-100
popular topics, last month, sort order 0-100
popular topics, last year, sort order 0-100
popular topics, all time, sort order 0-100
Squares: Featured topics / tags: what tag, how many squares
Choose cats layout:
  0 = default, whatever that is (might change)
  1 = only cats
  2 = cats, currently active topics, popular topics last week, month
  3 = cats, popular topics last month, week,  then currently active topics
