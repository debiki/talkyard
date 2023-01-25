-- In this migration: Anonymous posts, per page; discussion preferences;
-- and some new datatype domains.



-- New domains
-------------------------------------------------


create domain never_allow_recmd_always_d i16_d;
alter  domain never_allow_recmd_always_d add
   constraint never_allow_recmd_always_d_c_in check (value in (1, 2, 3, 4));

-- See AnonStatus in the Scala code.
create domain anonym_status_d i16_d;
-- er  domain anonym_status_d add
-- constraint anonym_status_d_c_in_ hmm what check (value in (?, ?, ...));

create domain deanon_status_d i16_d;

-- Says if the poster is still author and owner. And if others have been
-- added as authors or owners, or assigned to do this post — then, they'd
-- be looked up in pat_post_rels_t.
create domain creator_status_d i16_gz_lt1024_d;

-- If not null, the page or post and all descendants, are private.
-- The value shows if more private pats can bee added.
create domain private_status_d i16_gz_lt1024_d;
alter  domain private_status_d add
   constraint private_status_d_c_null_1 check ((value is null) or (value = 1));


-- For now, always null. Will drop that constr, and add other constraints later.
create domain pseudonym_status_d i16_d;
alter  domain pseudonym_status_d add
   constraint pseudonym_status_d_c_null check (value is null);

create domain can_see_private_d i16_d;
alter  domain can_see_private_d add
   constraint can_see_private_d_c_null_123 check (
            (value is null) or (value between 1 and 5));

create domain can_see_assigned_d i16_d;
alter  domain can_see_assigned_d add
   constraint can_see_assigned_d_c_null_123 check (
            (value is null) or (value between 1 and 4));



-- New permissions
-------------------------------------------------

alter table settings3
    -- For site admins or cat mods. Lets them change moderation settings.
    -- If can change:  approve before,  review after,  pending review.
    add column  can_remove_mod_reqmts_c  i32_gz_d,
    add column  enable_anon_posts_c  bool;

alter table perms_on_pages3
    add column  can_see_others_priv_c  can_see_private_d,
    add column  can_see_priv_aft_c     timestamp,
    add column  can_delete_own_c       bool,

    add column  can_alter_c            i64_gz_d,  -- [alterPage]
    add column  is_owner_c             bool,
    add column  on_pats_id_c           pat_id_d, -- default = anyone
    add column  can_manage_pats_c      i64_gz_d,
    add column  can_invite_pats_c      i64_gz_d,  -- instead of adder
    add column  can_suspend_pats_c     i64_gz_d,  -- instead of bouncer

    add column  can_assign_pats_c      bool,
    add column  can_see_assigned_c     can_see_assigned_d;





-- Authors? Or Anonymous votes?
-------------------------------------------------


alter table post_actions3
    add column  as_pat_id_c    pat_id_d,
    add column  added_by_id_c  pat_id_d,

    -- fk ix: patpostrels_i_aspatid
    add constraint patpostrels_aspatid_r_pats
    foreign key (site_id, as_pat_id_c)
    references users3 (site_id, user_id) deferrable,

    -- fk ix: patpostrels_i_addedbyid
    add constraint patpostrels_addedbyid_r_pats
    foreign key (site_id, added_by_id_c)
    references users3 (site_id, user_id) deferrable;

create index patpostrels_i_aspatid on post_actions3 (site_id, as_pat_id_c)
    where as_pat_id_c is not null;  --   [fk_ix_where_not_null]

create index patpostrels_i_addedbyid on post_actions3 (site_id, added_by_id_c)
    where as_pat_id_c is not null;  --   [fk_ix_where_not_null]



-- Anonymous posts
-------------------------------------------------



-- Dupl cols: both on categories3, and posts3. Won't be dupl, after [nodes_t] in use.
alter table categories3
    add column  comts_start_hidden_c         never_allow_recmd_always_d,
    add column  comts_shown_aft_mins_c       i32_gz_d,

    add column  op_starts_anon_c             never_allow_recmd_always_d,
    add column  comts_start_anon_c           never_allow_recmd_always_d,
    add column  deanon_mins_aft_first_c      i32_gz_d,
    add column  deanon_mins_aft_last_c       i32_gz_d,
    add column  deanon_page_mins_aft_first_c i32_gz_d,
    add column  deanon_page_mins_aft_last_c  i32_gz_d;



-- Dupl cols, also in posts3, as created_by_true_id_c. [nodes_t]
alter table pages3
    add column  author_true_id_c            member_id_d,

    -- fk ix: pages_i_authortrueid
    add constraint nodes_authortrueid_r_pats
          foreign key (site_id, author_true_id_c)
          references users3 (site_id, user_id) deferrable,

    add column  old_false_id_c                member_id_d,

    -- fk ix: pages_i_oldfalseid
    add constraint nodes_oldfalseid_r_pats
          foreign key (site_id, old_false_id_c)
          references users3 (site_id, user_id) deferrable;


create index pages_i_authortrueid on pages3 (site_id, author_true_id_c)
    where author_true_id_c is not null;  -- [fk_ix_where_not_null]

create index pages_i_oldfalseid on pages3 (site_id, old_false_id_c)
    where old_false_id_c is not null;  -- [fk_ix_where_not_null]



alter table posts3
    -- Dupl col, also in pages, as author_true_id_c. [nodes_t]
    add column  created_by_true_id_c            member_id_d,

    -- fk ix: nodes_i_createdbytrueid
    add constraint nodes_createdbytrueid_r_pats
          foreign key (site_id, created_by_true_id_c)
          references users3 (site_id, user_id) deferrable,

    -- If an anonym has now been deanonymized, created_by_id gets set to the
    -- true id of the creator, and deanond_id_c gets set to the anon's id
    -- (and that anon is no longer anonymous), and created_by_true_id_c to null?
    -- Dupl col, also in pages. [nodes_t]
    add column  old_false_id_c                member_id_d,

    -- fk ix: nodes_i_oldfalseid
    add constraint nodes_oldfalseid_r_pats
          foreign key (site_id, old_false_id_c)
          references users3 (site_id, user_id) deferrable,

    -- Dupl, same cols as above, for categories3: [nodes_t]
    add column  comts_start_hidden_c         never_allow_recmd_always_d,
    add column  comts_shown_aft_mins_c       i32_gz_d,

    add column  op_starts_anon_c             never_allow_recmd_always_d,
    add column  comts_start_anon_c           never_allow_recmd_always_d,
    add column  deanon_mins_aft_first_c      i32_gz_d,
    add column  deanon_mins_aft_last_c       i32_gz_d,
    add column  deanon_page_mins_aft_first_c i32_gz_d,
    add column  deanon_page_mins_aft_last_c  i32_gz_d,

    -- Private sub threads
    -- There's already hidden_status_c.
    add column  private_status_c  private_status_d,
    add column  creator_status_c  creator_status_d,

    -- Old mistakes
    -- These will be in  pat_rels_t,  no,  pat_post_rels_t,  instead,
    -- so can look up post ids directly
    -- by pat id, relationship type and time.  Otherwise, if having many post authors,
    -- by pointing  authors_id_c  to a pats_t user list group,  the database
    -- would need to do one lookup, for each user list group one is a member of.
    -- (These have never been used, ok to drop.)
    --
    drop column  owners_id_c,
    drop column  authors_id_c;


create index nodes_i_createdbytrueid on posts3 (site_id, created_by_true_id_c)
    where created_by_true_id_c is not null;  -- [fk_ix_where_not_null]

create index nodes_i_oldfalseid on posts3 (site_id, old_false_id_c)
    where old_false_id_c is not null;  -- [fk_ix_where_not_null]



alter table drafts3
    add column new_anon_status_c  anonym_status_d,
    add column post_as_id_c       pat_id_d,

    -- fk ix: drafts_i_postasid
    add constraint drafts_postasid_r_pats
        foreign key (site_id, post_as_id_c)
        references users3 (site_id, user_id) deferrable;

create index drafts_i_postasid on drafts3 (site_id, post_as_id_c);
    -- where post_as_id_c is not null; ?   [fk_ix_where_not_null]
    -- and elsewhere in this file



alter table users3
    add column true_id_c            member_id_d,
    add column deanon_status_c      deanon_status_d,
    add column pseudonym_status_c   pseudonym_status_d,
    add column anonym_status_c      anonym_status_d,
    add column anon_on_page_id_st_c page_id_st_d,
    add column anon_on_page_id_c    page_id_d__later,

    -- fk ix: pats_i_trueid_anononpageid
    add constraint pats_trueid_r_pats
        foreign key (site_id, true_id_c)
        references users3 (site_id, user_id) deferrable,

    -- fk ix: pats_i_anononpageid
    add constraint pats_anononpage_r_pages
        foreign key (site_id, anon_on_page_id_st_c)
        references pages3 (site_id, page_id) deferrable;


-- Good to be able to look up if a pat (true_id_c) has any anonymous
-- comments on a given page.
create index pats_i_trueid_anononpageid on users3 (
    site_id, true_id_c, anon_on_page_id_st_c);

create index pats_i_anononpageid on users3 (
    site_id, anon_on_page_id_st_c);



alter table users3
    add constraint pats_c_pseudonymid_gte100 check (
          pseudonym_status_c is null or user_id >= 100),

    add constraint pats_c_anonid_ltem10 check (
          anonym_status_c is null or user_id <= -10),

    add constraint pats_c_not_both_anon_pseudo check (
          num_nonnulls(pseudonym_status_c, anonym_status_c) <= 1);

alter table users3 add constraint pats_c_anon_null_same check (
    -- Either not an aonym or pseudonym:
    ((true_id_c is null) and
      (anonym_status_c is null) and
      (anon_on_page_id_st_c is null) and
      (pseudonym_status_c is null)
      )
    or ((true_id_c is not null)
      and (
        -- or an aonym:
        ((anonym_status_c is not null) and
         (anon_on_page_id_st_c is not null) and
         (pseudonym_status_c is null)
         )
        or -- pseudonym:
        ((anonym_status_c is null) and
         (anon_on_page_id_st_c is null) and
         (pseudonym_status_c is not null)
         )
        )));

-- But pseudonyms might need to get approved? Since can have custom name and bio.
-- Anons (and pseudonyms too) can get suspended, I think, so if someone behaves
-- via an anon account, then, suspending just that anon account, is a bit more
-- friendly than suspending the user's real account — like, a first small warning,
-- suitable in some cases (but sometimes better suspend the real account directly).
alter table users3 add constraint pats_c_anons_need_no_approval check (
    anonym_status_c is null
    or (created_at is not null and
        is_approved is null and
        approved_at is null and
        approved_by_id is null));

-- Maybe later it'll be possible for pseudonyms to configure a different
-- notifications email address — in case one wants discussions related to
-- the pseudonym, to get sent elsewhere. But is that over complicated? Because
-- then it could also make sense with *per category* notification email adrs,
-- maybe better avoid.
-- For now, neither anonyms nor pseudonyms can have any own email addr
-- (so cannot be different from their true account).
--
alter table users3 add constraint pats_c_anon_no_email check (
    (anonym_status_c is null and
      pseudonym_status_c is null
      )
    or (guest_email_addr is null and
        primary_email_addr is null and
        email_notfs is null and
        email_verified_at is null and
        email_for_every_new_post is null and
        summary_email_interval_mins is null and
        summary_email_if_active is null));

-- These: is_approved, approved_at, approved_by_id
-- are not listed here, because anon users don't need to get approved.
-- Instead, if the real user is approved, the annon is approved too.
--
-- These: suspended_at, suspe/nded_till, suspended_by_id, suspended_reason
-- also aren't listed, because anons *can* get suspended. Can be
-- better than blocking the real account, and, if someone
-- misbehaves repeatedly, when being anon, then, after some of those
-- anon users have gotten suspended, the real user can automatically
-- get prevented from posting anonymously — and this'd happen *without*
-- the mods having to know who hen is, that is, the misbehaving user got
-- blocked and identity remained private.
--
-- These: deactivated_at, deleted_at
-- also aren't included. Can make sense to delete an anon account?
--
alter table users3 add constraint pats_c_anon_nulls check (
    anonym_status_c is null
    or (guest_browser_id is null and
        sso_id is null and
        ext_id is null and
        username is null and
        password_hash is null and
        full_name is null and
        country is null and
        website is null and
        about is null and
        is_moderator is null and
        is_admin is null and
        is_superadmin is null and
        is_owner is null and
        is_group = false and
        ui_prefs is null and
        max_upload_bytes_c is null and
        allowed_upload_extensions_c is null and
        -- Maybe there should be an anon user group, where these are configured?:
        -- Or would that be the Everyone group?
        may_search_engines_index_me_c is null and
        may_see_my_activity_tr_lv_c is null and
        may_see_my_username_tr_lv_c is null and
        may_see_my_full_name_tr_lv_c is null and
        may_see_my_tiny_avatar_tr_lv_c is null and
        may_see_my_medium_avatar_tr_lv_c is null and
        may_see_my_brief_bio_tr_lv_c is null and
        may_see_my_full_bio_tr_lv_c is null and
        may_see_my_memberships_tr_lv_c is null and
        may_see_my_profile_tr_lv_c is null and
        may_see_me_in_lists_tr_lv_c is null and
        may_see_if_im_online_tr_lv_c is null and
        may_see_my_visit_stats_tr_lv_c is null and
        may_see_my_post_stats_tr_lv_c is null and
        may_see_my_approx_stats_tr_lv_c is null and
        may_see_my_exact_stats_tr_lv_c is null and
        may_find_me_by_email_tr_lv_c is null and
        may_follow_me_tr_lv_c is null and
        may_mention_me_tr_lv_c is null and
        may_mention_me_same_disc_tr_lv_c is null and
        may_dir_msg_me_tr_lv_c is null and
        why_may_not_mention_msg_me_html_c is null and
        may_see_my_account_email_adrs_tr_lv_c is null and
        may_see_my_contact_email_adrs_tr_lv_c is null and
        may_assign_me_tr_lv_c is null and
        may_see_my_assignments_tr_lv_c is null and
        email_threading_c is null and
        email_notf_details_c is null
        ));

-- Better lock the real user account's levels instead?
alter table users3 add constraint pats_c_anon_no_levels check (
    anonym_status_c is null
    or (trust_level is null and
        locked_trust_level is null and
        threat_level is null and
        locked_threat_level is null and
        tech_level_c is null
        ));

alter table users3 add constraint pats_c_anon_no_avatar check (
    anonym_status_c is null
    or (avatar_tiny_base_url is null and
        avatar_tiny_hash_path is null and
        avatar_small_base_url is null and
        avatar_small_hash_path is null and
        avatar_medium_base_url is null and
        avatar_medium_hash_path is null));


alter table users3 drop constraint pps_c_guest_not_nulls;
alter table users3 add constraint pats_c_guest_non_nulls check (
    -- Member or anonym?
    (user_id > 0 or anonym_status_c is not null)
    -- Else, is a guest (or the Unknown user) and then, add back the constr
    -- deleted above:  (guest email is '-' if absent, so, never null)
    or (created_at is not null and
        full_name is not null and
        guest_email_addr is not null));

alter table users3 drop constraint pps_c_guest_w_no_browserid_has_extid;
alter table users3 add constraint pats_c_guest_w_no_browserid_has_extid check (
    -- Member or anonym?
    (user_id > 0 or anonym_status_c is not null)
    -- Else, is guest (or the Unknown user); then needs a browser id or an ext id.
    or guest_browser_id is not null
    or ext_id is not null);



alter table review_tasks3  rename column  user_id  to about_user_id_c;
alter table review_tasks3
    add column  created_by_true_id_c  member_id_d,
    add column  about_true_id_c       member_id_d,

    -- fk ix: reviewtasks_i_createdbytrueid
    add constraint reviewtasks_createdbytrueid_r_pats
          foreign key (site_id, created_by_true_id_c)
          references users3 (site_id, user_id) deferrable;

    -- fk ix: reviewtasks_i_abouttrueid
    add constraint reviewtasks_abouttrueid_r_pats
          foreign key (site_id, about_true_id_c)
          references users3 (site_id, user_id) deferrable,


create index reviewtasks_i_createdbytrueid on review_tasks3 (site_id, created_by_true_id_c)
    where created_by_true_id_c is not null;  -- [fk_ix_where_not_null]

create index reviewtasks_i_abouttrueid on review_tasks3 (site_id, about_true_id_c)
    where created_by_true_id_c is not null;  -- [fk_ix_where_not_null]




-- Skip fks — no fks in this table.
alter table spam_check_queue3  rename column  author_id to author_id_c;
alter table spam_check_queue3  add    column               author_true_id_c  member_id_d;



alter table audit_log3 rename column  doer_id            to doer_id_c;
alter table audit_log3 rename column  target_user_id     to target_pat_id_c;

alter table audit_log3
    add column  doer_true_id_c    member_id_d,
    add column  target_true_id_c  member_id_d,
    add column  sess_id_part_1    base64us_len16_d,

    -- fk ix: auditlog_i_doertrueid
    add constraint auditlog_doertrueid_r_pats
        foreign key (site_id, doer_true_id_c)
        references users3 (site_id, user_id) deferrable,

    -- fk ix: auditlog_i_targettrueid
    add constraint auditlog_targettrueid_r_pats
        foreign key (site_id, target_true_id_c)
        references users3 (site_id, user_id) deferrable,

    -- For now, to find bugs. Delete constraint later?
    -- fk ix: auditlog_i_sid_part1
    add constraint auditlog_sid_part1_r_sessions
        foreign key (site_id, sess_id_part_1)
        references sessions_t (site_id_c, part_1_comp_id_c) deferrable;

create index  auditlog_i_doertrueid    on audit_log3 (site_id, doer_true_id_c);
create index  auditlog_i_targettrueid  on audit_log3 (site_id, target_true_id_c);
create index  auditlog_i_sid_part1     on audit_log3 (site_id, sess_id_part_1);




-- Notification preferences
-------------------------------------------------

-- About new pages, replies, maybe edits to wiki pages.

alter table page_notf_prefs3  rename to page_notf_prefs_t;  -- OR node/content_notf_prefs_t?
alter table page_notf_prefs_t rename column people_id to pat_id_c;

alter table page_notf_prefs_t rename column pages_in_whole_site  to pages_in_whole_site_c;
alter table page_notf_prefs_t rename column pages_in_category_id to pages_in_cat_id_c;
alter table page_notf_prefs_t rename column incl_sub_categories  to incl_sub_cats_c;
alter table page_notf_prefs_t rename column pages_pat_created    to pages_pat_created_c;
alter table page_notf_prefs_t rename column pages_pat_replied_to to pages_pat_replied_to_c;

