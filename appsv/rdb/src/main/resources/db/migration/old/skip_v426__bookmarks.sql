
-- alter table  page_html_cache_t
--    add column  from_post_nr  i32_gez_d,
--    add column  to_post_nr    i32_gez_d,
--    add constraint  pagecache_c_from_to_null  check (
--          (from_post_nr is null) = (to_post_nr is null));


--- Skip everytihg below? Won't use tags or pages for storing bookmarks, f.ex.
-- Except for [sub_pages] and [about_user_notes] below maybe?

alter table  posts3 rename column type to post_type_c;  -- grep friendly

alter table  pages3
    -- [sub_pages]
    add  column parent_page_id_st_c  page_id_st_d,  -- hmm?
    add  column parent_post_id_c     post_id_d,     -- maybe only this?

    -- fk ix: pages_parentpageid_r_pages
    add constraint  (site_id, parent_page_id_st_c)
        references  pages3 (site_id, page_id)  deferrable,

    -- fk ix: pages_parentpostid_r_posts
    add constraint  (site_id, parent_post_id_c)
        references  posts3 (site_id, unique_post_id)  deferrable,

    -- A bookmark has a parent post (the one it's bookmarking).
    add constraint  pages_c_bookmark_parentpost check (
          (page_role = 29) = (parent_post_id is not null));


create index  pages_parentpageid_r_pages  on  pages3 (site_id, parent_page_id_st_c);
create index  pages_parentpostid_r_posts  on  posts3 (site_id, parent_post_id_c);

-- One cannot bookmark the same post many times? At least for now, to catch bugs.
-- Tihs also let's us look up all relevant bookmarks, on a page.
create unique index  pages_u_authorid_parentpostid_if_bookmark  on  pages3 (
    site_id, author_id, parent_post_id_c) where page_role = 29 and deleted_at is null;

-- For listing one's recent bookmarks.
create index  pages_i_authorid_createdat_if_bookmark  on  pages3 (
    site_id, author_id, created_at desc) where page_role = 29 and deleted_at is null;

-- For listing one's deleted bookmarks.
create index  pages_i_authorid_createdat_if_bookmark_deleted on  pages3 (
    site_id, author_id, created_at desc) where page_role = 29 and deleted_at is not null;



-- Nix.
-- alter table  tagtypes_t
--     alter  column id_c type i32_nz_d,
--     drop constraint  tagtypes_c_id_gt1000,
--     add constraint types_c_id_gt_m100 check (id_c between -99 and -1 or id_c > 1000);
-- 
-- insert into  tagtypes_t (
--     site_id_c,
--     id_c,
--     can_tag_what_c,
--     is_personal,
--     disp_name_c,
--     created_by_id_c,
--     wants_value_c,
--     value_type_c)
-- select  id, -1, 56, true, 'Bookmark', 1, 3, 18
-- from  sites3;


-- No!   (Except for the bugfix.)
-- Bookmarks need  visible_only_to_pat_id_c,  since they're private (per person).
--
alter table tags_t
    -- Ooops, this is an i32_d, should be an f64. Ok to change, not in use yet.
    alter column val_f64_b_c type f64_d using (val_f64_b_c::f64_d),

    -- E.g. [about_user_notes]: Tag a user with a "Notes" badge, visible only to staff,
    -- and share some notes about that user. (The post id would be the orig-post
    -- (or title post?) of the page with notes about the user.)
    add column  val_post_id_c             post_id_d,

    -- When is this useful? A tag that points to a user? Feels it's needed, for symmetry.
    -- Maybe to *suggest* assigning a task (the tagged post) to someone? If a
    -- community creates such a tag type.
    add column  val_pat_id_c              pat_id_d,

    -- Could be helpul e.g. if marking pages which maybe should be moved to another
    -- category? To get an overview, and later on, move them?
    add column  val_cat_id_c              cat_id_d,

    -- If a tag type is visilbe only to, saye, mods & admins, it's good to
    -- have a way to directly find all publicly visible tags on a page, plus those
    -- the current requester can see.
    add column  visible_only_to_pat_id_c  pat_id_d,

    -- fk ix: tags_i_valpostid
    add constraint tags_valpostid_r_posts foreign key (site_id_c, val_post_id_c)
        references posts3 (site_id, unique_post_id) deferrable,

    -- fk ix: tags_i_valpatid
    add constraint tags_valpatid_r_pats foreign key (site_id_c, val_pat_id_c)
        references users3 (site_id, user_id) deferrable,

    -- fk ix: tags_i_valcatid
    add constraint tags_valcatid_r_cats foreign key (site_id_c, val_cat_id_c)
        references categories3 (site_id, id) deferrable,

    -- fk ix: tags_i_visibleonlytopatid
    add constraint tags_visibleonlytopatid_r_pats foreign key (
                                            site_id_c, visible_only_to_pat_id_c)
        references users3 (site_id, user_id) deferrable;


-- Foreign key indexes:

create index tags_i_valpostid on tags_t (site_id_c, val_post_id_c)
    where val_post_id_c is not null;

create index tags_i_valpatid on tags_t (site_id_c, val_pat_id_c)
    where val_pat_id_c is not null;

create index tags_i_valcatid on tags_t (site_id_c, val_cat_id_c)
    where val_cat_id_c is not null;

create index tags_i_visibleonlytopatid on tags_t (site_id_c, visible_only_to_pat_id_c)
    where visible_only_to_pat_id_c is not null;


-- Rendering pages fast:

-- We look up the null rows, to find tags everyone may see, when rendering a page.
-- And look up rows with the current requester's id, to we can show han all hans bookmarks
-- on that page.

create index tags_i_onpostid_visibleonlytopatid on tags_t (
      site_id_c, on_post_id_c, visible_only_to_pat_id_c)
    where on_post_id_c is not null;

create index tags_i_onpatid_visibleonlytopatid on tags_t (
      site_id_c, on_pat_id_c, visible_only_to_pat_id_c)
    where on_pat_id_c is not null;




------------------------------------------------------------------------
comment on column  tags_t.visible_only_to_pat_id_c  is $_$
Bookmarks are visible only to oneself, so we need to remember who may
see them. And there'll be private tags & badges, e.g. staff-only user
notes (see below), so this makes sense for tags & badges too.
$_$;  -- '
