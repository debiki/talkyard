-- SKIP all this?
-- For example, instead of pages_t, there'll be a  nodes_t,
-- which will replace: pages3, categories3 and posts3 (it'd be posts3 renamed to nodes_t)
--
-- However maybe do create:
--
--   pat_node_prefs_t  with personal settings for pages and cats,


-- SKIP the rest of this file?  Move to  (proj-root)/old/don-t/ ?
--

create table pages_t (  -- [disc_props_view_stats].  nodes_t  instead of  pages_t?
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
  -------------------------------------------------------------------
  -- MOSTLY DON'T this,  insetad, there's pat_node_rels_t with RelType.AuthorOf,
  -- and  node_node_rels_t wiht RelType.AnswerTo, etc.
  -- And  nodes_t.doing_status_c = planned/started/paused/done.
  --              closed_status ...

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
  --  ... [Edit, 2023-01] can what? What was I going to write? Share the same
  --  props, between different categories?  But that's not so important, is it?
  --  can be better to have a way to configure many cats together,
  --  or copy props from one to another, instead?
  --  So maybe skip sect_props_c and sect_props_t, store directly in  nodes_t instead?
  -- 
  sect_props_c references sect_props_t (site_id_c, Everyone.id, props_id_c), -- or skip
  sect_view_c  references sect_views_t (site_id_c, Everyone.id, view_id_c),
  -- No, reference from cats_t, the root cat, instead? because there should
  -- be just one stats entry, not one per "view" page.
  sect_stats_c references sect_stats_c (site_id_c, Everyone.id, stats_id_c),

  -- For a section page, this'd be the defaults for all pages in the section
  -- (or if navigating to those pages, via this section page).
  -- And the stats would be the aggregate stats, for the whole section.
  disc_props_c references disc_props_t (site_id_c, Everyone.id, props_id_c), -- or skip
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
-- SKIP, not needed,  now when there'll be  nodes_t which stores cats, pages, posts,
--       and where settings get inherited from cats to child cats and pages.
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
  -- SKIP, such a rare use case! Never heard anyone ask for or any forum supporting it.
  --    (However, copying and syncing settings between cats, maybe can be useful sometimes.)
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


-- SKIP. Currently in  page_users3 — or no, doesn't yet exist?.
-- Will use  pages3  renamed to node_stats_t?  for both cats & pages.
--
create table sect_stats_t (
  -- ...
);


-- SKIP, for same reason as not needing sect_props_t above.
---
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
--
-- Maybe: Add these columns to disc_prefs_t (will be named:  node_prefs_t  instead),
-- and to reuse layout settings,
-- instead create a layouts_t with layout settings, and then one can choose from those
-- predefined settings?  Hmm but if an admin edits a layouts_t row, then,
-- should those changes take effect in the cats that used those templates, or not?
-- Maybe instead: Link from it to disc_views_t.
--
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


-- SKIP, will use  pages3  renamed to node_stats_t?  for both cats & pages.
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


-- Maybe make some per cat settings individually / by-group configurable?
-- Categories are less frequent, so no need for a  cat_props_t with id rows and
-- referencing them, for sharing the same settings between many cats?
-- (But for pages — then, having pages_t.disc_props_id_c link to disc_props_t.props_id_c
-- makes sense.)
--
alter table disc_prefs_t add column view_id_c; -- or inline in table?
alter table disc_prefs_t add column incl_in_summaries;
alter table disc_prefs_t add column unlist_topics; -- ?
                             column unpinned; -- can individually unpin a topic one has read?
-- create table cat_pat_props_t (   -- or  per_pat_cat_props_t   or  cat_per_pat_props_t?
--                                 -- no, instead, incl in disc_prefs_t, see above
--   site_id_c,
--   cat_props_id_c,
--   -- cat_id_c,
--   -- pat_id_c default everyone.id,
--   anon_by_def_c           bool,
--   def_anon_level_c        anon_status_d,
--   max_anon_level_c        anon_status_d,
-- 
--   incl_in_summaries,  -- so people can choose themselves
--   unlist_topics,      -- if one thinks it's just noise in this category
-- );




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
