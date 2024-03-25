

-- Bookmarks need  visible_only_to_pat_id_c,  since they're private (per person).
--
alter table tags_t
    -- Ooops, this is an i32_d, should be an f64. Ok to change, not in use yet.
    alter column val_f64_b_c type f64_d using (val_f64_b_c::f64_d),

    -- E.g. about-user notes: Tag a user with a "Notes" badge, visible only to staff,
    -- and share some notes about that user. (The post id would be the orig-post
    -- (or title post?) of the page with notes about the user.)
    add column  val_post_id_c             post_id_d,

    -- When is this useful? A tag that points to a user? Feels it's needed, for symmetry.
    -- Maybe to *suggest* assigning a task (the tagged post) to someone? If a
    -- community creates such a tag type.
    add column  val_pat_id_c              pat_id_d,

    -- Could be helpul e.g. if marking pages which maybe should be moved to another
    -- categories? To get an overview, and later on, move them?
    add column  val_cat_id_c              cat_id_d,

    -- E.g. one's bookmarks are visible only to oneself, and it's good to
    -- have a way to "instantly" find all publicly visible tags,
    -- plus all one's own bookmarks, on a page.
    add column  visible_only_to_pat_id_c  pat_id_d,

    -- fk ix: tags_valpostid_i
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
