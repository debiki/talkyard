
-- ===== New domains

-- Nice to have, for consistency?:

create domain text_nonempty_ste8000_trimmed_d text_nonempty_ste8000_d;
alter domain  text_nonempty_ste8000_trimmed_d add
   constraint text_nonempty_ste8000_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste16000_trimmed_d text_nonempty_ste16000_d;
alter domain  text_nonempty_ste16000_trimmed_d add
   constraint text_nonempty_ste16000_trimmed_d_c_trimmed check (is_trimmed(value));

-- These domains will be nice for SomethingType, e.g. PageType, PostType, RelType
-- — the database does a sanity test: is the value in [1, 127], then at least it's
-- possible that it's a valid Something-Type, or a tiny bit flield. Whilst the
-- details — the exact numbers — are managed by app server code, without any need for
-- database migrations when adding new types.

create domain i16_gz_lt128_d i16_gz_d;
alter domain  i16_gz_lt128_d add
   constraint i16_gz_lt128_d_c_lt128 check (value < 128);

create domain i16_gz_lt1000_d i16_gz_d;
alter domain  i16_gz_lt1000_d add
  constraint  i16_gz_lt1000_d_c_lt1000 check (value < 1000);

create domain i16_gz_lt1024_d i16_gz_d;
alter domain  i16_gz_lt1024_d add
  constraint  i16_gz_lt1024_d_c_lt1024 check (value < 1024);

create domain i16_gz_lt10_000_d i16_gz_d;
alter domain  i16_gz_lt10_000_d add
  constraint  i16_gz_lt10_000_d_c_lt10_000 check (value < 10000);

create domain i32_gz_lt128_d i32_gz_d;
alter domain  i32_gz_lt128_d add
  constraint  i32_gz_lt128_d_c_lt128 check (value < 128);

create domain i32_gz_lt1000_d i32_gz_d;
alter domain  i32_gz_lt1000_d add
  constraint  i32_gz_lt1000_d_c_lt1000 check (value < 1000);

create domain i32_gz_lt1024_d i32_gz_d;
alter domain  i32_gz_lt1024_d add
  constraint  i32_gz_lt1024_d_c_lt1024 check (value < 1024);

create domain i32_gz_lt10_000_d i32_gz_d;
alter domain  i32_gz_lt10_000_d add
  constraint  i32_gz_lt10_000_d_c_lt10_000 check (value < 10000);

-- For posts and contents:

create domain tag_id_d           i32_lt2e9_gz_d;
create domain post_id_d          i32_lt2e9_gz_d;
create domain post_nr_d          i32_abs_lt2e9_d;
create domain rev_nr_d           i32_lt2e9_gz_d;

create domain postponed_status_d i16_gz_lt128_d;
create domain answered_status_d  i16_gz_lt128_d;
create domain doing_status_d     i16_gz_lt128_d;
create domain review_status_d    i16_gz_lt128_d;
create domain unwanted_status_d  i16_gz_lt128_d;
create domain flagged_status_d   i16_gz_lt128_d;
create domain collapsed_status_d i16_gz_lt128_d;
create domain hidden_status_d    i16_gz_lt128_d;
create domain closed_status_d    i16_gz_lt128_d;
create domain deleted_status_d   i16_gz_lt128_d;
create domain dormant_status_d   i32_gz_d;

create domain thing_type_d       i16_gz_lt1000_d;
create domain page_type_d        i16_gz_lt1000_d;
create domain post_type_d        i16_gz_lt1000_d;
create domain pat_rel_type_d     i16_gz_lt1000_d;
create domain post_rel_type_d    i16_gz_lt1000_d;  -- later

create domain sub_type_d         i32_gz_d;

-- For threaded emails:

create domain smtp_msg_ids_out_d text[];
alter domain  smtp_msg_ids_out_d add
   constraint smtp_msg_ids_out_d_c_nonempty check (
      length(array_to_string(value, '')) > 0);
alter domain  smtp_msg_ids_out_d add
   constraint smtp_msg_ids_out_d_c_size_lt_8000 check (pg_column_size(value) < 8000);
alter domain  smtp_msg_ids_out_d add
   constraint smtp_msg_ids_out_d_c_chars check (
    (array_to_string(value, ' ') || ' ')
       ~ '^([a-zA-Z0-9_.+-]+@[a-z0-9_.-]+(:[0-9]+)? )* ?$');



-- ===== Refactor notfs: rename & add columns


alter table notifications3 rename column page_id        to about_page_id_str_c;
alter table notifications3 rename column unique_post_id to about_post_id_c;
alter table notifications3 add column                      about_page_id_int_c page_id_d__later;
alter table notifications3 add column                      about_pat_id_c      pat_id_d;
alter table notifications3 add column                      about_cat_id_c      cat_id_d;
alter table notifications3 add column                      about_tag_id_c      tag_id_d;
alter table notifications3 add column                      about_thing_type_c  thing_type_d;
alter table notifications3 add column                      about_sub_type_c    sub_type_d;

-- fk ix: notfs_i_aboutpage_topat — was missing.
alter table notifications3 rename constraint ntfs_r_pages to notfs_aboutpage_r_pages;
create index notfs_i_aboutpage_topat on notifications3 (
        site_id, about_page_id_str_c, to_user_id) where about_page_id_str_c is not null;

-- fk ix: notfs_i_bypat — was missing.
alter table notifications3 rename constraint ntfs_byuser_r_people to notfs_bypat_r_pats;
create index notfs_i_bypat on notifications3 (
        site_id, by_user_id) where by_user_id is not null;

-- fk ix: notfs_i_aboutpat_topat
alter table notifications3 add constraint notfs_aboutpat_r_pats
    foreign key (site_id, about_pat_id_c) references users3 (site_id, user_id) deferrable;
create index notfs_i_aboutpat_topat on notifications3 (
    site_id, about_pat_id_c, to_user_id) where about_pat_id_c is not null;

-- fk ix: notfs_i_aboutcat_topat
alter table notifications3 add constraint notfs_aboutcat_r_cats
    foreign key (site_id, about_cat_id_c) references categories3 (site_id, id) deferrable;
create index notfs_i_aboutcat_topat on notifications3 (
    site_id, about_cat_id_c, to_user_id) where about_cat_id_c is not null;

-- fk ix: notfs_i_abouttag_topat
alter table notifications3 add constraint notfs_abouttag_r_tags
    foreign key (site_id, about_tag_id_c) references tags_t (site_id_c, id_c) deferrable;
create index notfs_i_abouttag_topat on notifications3 (
    site_id, about_tag_id_c, to_user_id) where about_tag_id_c is not null;

-- fk ix: notfs_i_aboutthingtype_subtype
-- Later, for custom types?:
-- alter table notifications3 add constraint notfs_aboutthingtype_subtype_r_types
--  foreign key (site_id, about_thing_type_c, about_sub_type_c)
--  references types_t (site_id_c, thing_type_c, sub_type_c) deferrable;
alter table notifications3 add constraint notfs_c_aboutthingtype_subtype_null check (
    (about_thing_type_c is null) = (about_sub_type_c is null));
create index notfs_i_aboutthingtype_subtype on notifications3 (
    site_id, about_thing_type_c, about_sub_type_c) where about_thing_type_c is not null;

-- fk ix: notfs_i_aboutpost_patreltype_frompat_subtype — was missing.
alter table notifications3 rename constraint ntfs_r_postacs
    to notfs_aboutpost_reltype_frompat_subtype_r_patrels;
create index notfs_i_aboutpost_patreltype_frompat_subtype on notifications3 (
      site_id, about_post_id_c, action_type, by_user_id, action_sub_id)
    where about_post_id_c is not null;



-- ===== Threaded emails


alter table emails_out3 add column smtp_in_reply_to_c      smtp_msg_id_out_d;
alter table emails_out3 add column smtp_in_reply_to_more_c smtp_msg_ids_out_d;
alter table emails_out3 add column smtp_references_c       smtp_msg_ids_out_d;
alter table emails_out3 add column by_pat_id_c             pat_id_d;
alter table emails_out3 add column about_pat_id_c          pat_id_d;
alter table emails_out3 add column about_cat_id_c          cat_id_d;
alter table emails_out3 add column about_tag_id_c          tag_id_d;
alter table emails_out3 add column about_page_id_str_c     page_id_st_d;
alter table emails_out3 add column about_page_id_int_c     page_id_d__later;
alter table emails_out3 add column about_post_id_c         post_id_d;
alter table emails_out3 add column about_post_nr_c         post_nr_d;
alter table emails_out3 add column about_parent_nr_c       post_nr_d;

alter index dw1_emlot_tnt_id__p rename to emailsout_p_id;

-- fk ix: emailsout_i_topat
alter table emails_out3 rename constraint emlot_r_people to emailsout_topat_r_pats;
alter index dw2_emlot_touser__i rename to emailsout_i_topat;

-- fk ix: emailsout_i_bypat
alter table emails_out3 add constraint emailsout_bypat_r_pats
    foreign key (site_id, by_pat_id_c) references users3 (site_id, user_id) deferrable;

create index emailsout_i_bypat on emails_out3 (
        site_id, by_pat_id_c) where by_pat_id_c is not null;

-- fk ix: emailsout_i_aboutpat
alter table emails_out3 add constraint emailsout_aboutpat_r_pats
    foreign key (site_id, about_pat_id_c) references users3 (site_id, user_id) deferrable;

create index emailsout_i_aboutpat on emails_out3 (
        site_id, about_pat_id_c) where about_pat_id_c is not null;

-- fk ix: emailsout_i_aboutcat
alter table emails_out3 add constraint emailsout_aboutcat_r_cats
    foreign key (site_id, about_cat_id_c) references categories3 (site_id, id) deferrable;

create index emailsout_i_aboutcat on emails_out3 (
        site_id, about_cat_id_c) where about_cat_id_c is not null;

-- fk ix: emailsout_i_abouttag
alter table emails_out3 add constraint emailsout_abouttag_r_tags
    foreign key (site_id, about_tag_id_c) references tags_t (site_id_c, id_c) deferrable;

create index emailsout_i_abouttag on emails_out3 (
        site_id, about_tag_id_c) where about_tag_id_c is not null;

-- fk ix: emailsout_i_aboutpagestr
alter table emails_out3 add constraint emailsout_aboutpagestr_r_pages
    foreign key (site_id, about_page_id_str_c) references pages3 (site_id, page_id) deferrable;

create index emailsout_i_aboutpagestr on emails_out3 (
        site_id, about_page_id_str_c) where about_page_id_str_c is not null;

-- fk ix: emailsout_i_aboutpostid
alter table emails_out3 add constraint emailsout_aboutpostid_r_posts
    foreign key (site_id, about_post_id_c) references posts3 (site_id, unique_post_id) deferrable;

create index emailsout_i_aboutpostid on emails_out3 (
        site_id, about_post_id_c) where about_post_id_c is not null;

-- Cannot add constraints to post nr and parent nr — the post might get moved
-- to another page, and get new nrs.


-- ===== Pat settings


-- There're many lists not just any main /-/users list. Also, for example,
-- in-place user lists if one starts typing '@name...' — probably one's name
-- should be hidden in all lists of users, not just /-/users.
alter table users3 rename column may_see_me_in_users_list_tr_lv_c
                              to may_see_me_in_lists_tr_lv_c;

alter table users3 add column  may_see_my_account_email_adrs_tr_lv_c  trust_level_or_staff_d;
alter table users3 add column  may_see_my_contact_email_adrs_tr_lv_c  trust_level_or_staff_d;

alter table users3 add constraint pats_c_contactemailadr_lte_accountadr_trlv check (
    may_see_my_contact_email_adrs_tr_lv_c <= may_see_my_account_email_adrs_tr_lv_c);

alter table users3 add column  may_assign_me_tr_lv_c  trust_level_or_staff_d;

-- This could be a  who-may, in-which-categories, see-whose-assignments.
-- For now, just:
alter table users3 add column  may_see_my_assignments_tr_lv_c  trust_level_or_staff_d;

alter table users3 add constraint pats_c_mayseemyassignments_lte_mayassign_trlv check (
    may_see_my_assignments_tr_lv_c <= may_assign_me_tr_lv_c);

alter table users3 add column email_threading_c     i16_gz_lt1024_d;
alter table users3 add column email_notf_details_c  i16_gz_lt1024_d;
alter table users3 add column tech_level_c          i16_gz_lt1024_d;



-- ===== Relationships, a la graph db


----- pat_rels_t:  Slowly change-rename post_actions3 to pat_rels_t.

alter table post_actions3 rename column  created_by_id  to from_pat_id_c;
alter table post_actions3 rename column  unique_post_id to to_post_id_c;
alter table post_actions3 rename column  type           to rel_type_c;
alter table post_actions3 rename column  sub_id         to sub_type_c;
alter table post_actions3 add    column  to_post_rev_nr_c  rev_nr_d;
alter table post_actions3 add    column  dormant_status_c  dormant_status_d;
alter table post_actions3 add    column  val_i32_c         i32_d;

-- Let the software mostly control this, instead.
-- (Was:  check in (31, 32, 41, 42, 43, 44, 51, 52, 53)
alter table post_actions3 drop constraint dw2_postacs__c_type_in;
alter table post_actions3 alter column rel_type_c type pat_rel_type_d;

-- Not needed. Same as patrels_i_frompat_reltype_addedat  but w/o (..., rel_type_c, created_at).
drop index dw2_postacs_createdby__i;

-- For looking up one's assigned-to tasks, including closed (with dormant_status_c != null).
create index patrels_i_frompat_reltype_addedat on post_actions3 (
    site_id, from_pat_id_c, rel_type_c, created_at desc);

-- For looking up one's active (not closed) assigned-to tasks.
create index patrels_i_frompat_reltype_addedat_0dormant on post_actions3 (
    site_id, from_pat_id_c, rel_type_c, created_at desc) where dormant_status_c is null;


----- post_rels_t

-- Later



-- ===== Posts

-- Upcoming private comments, and changing post author and owner.
-- But AssignedTo will be stored in  pat_rels_t, because
-- many-pats-to-many-AssignedTo.*-to-one-post.

alter table posts3 add column  owners_id_c        pat_id_d;
alter table posts3 add column  authors_id_c       pat_id_d;
alter table posts3 add column  private_pats_id_c  pat_id_d;

-- More status fields:

-- Was: check (type >= 1 and type <= 100), switch to post_type_d  which is < 1000.
alter table posts3 drop constraint dw2_posts_type__c_in;
alter table posts3 alter column  type  set data type  post_type_d; -- rename: post_type_c, later

-- Make it possible to store flags, with PostType.Flag sub types, in posts_t.
alter table posts3 add column  sub_type_c   sub_type_d;
alter table posts3 add column  val_i32_c    i32_d;

alter table posts3 add column  postponed_status_c  postponed_status_d;

-- If this post has been answered. Can be nice to know, without looking in post_rels_t?
alter table posts3 add column  answered_status_c  answered_status_d;

-- Use PageDoingStatus, but rename to PostDoingStatus? [5KBF02]
-- Also replace pages_t.planned_by_id_c/started/paused/done/reviewed with this;
-- keep details in the audit_log_t.
alter table posts3 add column  doing_status_c  doing_status_d;

alter table posts3 add column  review_status_c  review_status_d;

-- or is just unwanted vote count, enough? Hmm but weighted by pats' influences,
-- then can be nice to cache:?
alter table posts3 add column  unwanted_status_c  unwanted_status_d;

-- Flags are weighted by the influence of the flaggers, and let's cache the
-- results of all flags, in  flagged_status_c? So available directly when rendering
-- the post.
alter table posts3 add column  flagged_status_c  flagged_status_d;

-- already a smallint
-- alter table posts3 add column collapsed_status_c collapsed_status_d;

alter table posts3 add column  hidden_status_c  hidden_status_d;

-- Look up who closed it and when, in the audit log?
-- already a smallint
-- alter table posts3 add column closed_status_c closed_status_d;

-- already a smallint
-- alter table posts3 add column deleted_status_c deleted_status_d;



-- fk ix:  posts_i_ownersid
alter table posts3 add constraint  posts_ownersid_r_pats
    foreign key (site_id, owners_id_c) references users3 (site_id, user_id) deferrable;

create index  posts_i_ownersid  on posts3 (
        site_id, owners_id_c) where owners_id_c is not null;


-- fk ix:  posts_i_authorsid
alter table posts3 add constraint  posts_authorsid_r_pats
    foreign key (site_id, authors_id_c) references users3 (site_id, user_id) deferrable;

create index  posts_i_authorsid  on posts3 (
        site_id, authors_id_c) where authors_id_c is not null;


-- fk ix:  posts_i_privatepatsid
alter table posts3 add constraint  posts_privatepatsid_r_pats
    foreign key (site_id, private_pats_id_c) references users3 (site_id, user_id) deferrable;

create index  posts_i_privatepatsid  on posts3 (
        site_id, private_pats_id_c) where private_pats_id_c is not null;
