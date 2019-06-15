
alter table users3 add column ext_imp_id varchar default null;
alter table pages3 add column ext_imp_id varchar default null;
alter table posts3 add column ext_imp_id varchar default null;
alter table categories3 add column ext_imp_id varchar default null;

alter table users3 add constraint participants_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table users3 add constraint participants_c_extimpid_not_builtin check (
    ext_imp_id is null or not user_id between -9 and 99);

alter table pages3 add constraint pages_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table posts3 add constraint posts_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table categories3 add constraint categories_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);


-- So won't accidentally insert import ids into the database,
-- without remapping to 1 .. 2e9 -1 numbers:

alter table api_secrets3 add constraint apisecrets_c_nr_not_for_imp check (secret_nr < 2000000000);
alter table audit_log3 add constraint auditlog_c_nr_not_for_imp check (audit_id < 2000000000);
alter table categories3 add constraint categories_c_id_not_for_imp check (id < 2000000000);
alter table drafts3 add constraint drafts_c_nr_not_for_imp check (draft_nr < 2000000000);
alter table identities3 add constraint identities_c_id_not_for_imp check (id < 2000000000);
alter table notifications3 add constraint notifications_c_id_not_for_imp check (notf_id < 2000000000);
alter table pages3 add constraint pages_c_id_not_for_imp check (page_id not like '200???????');
alter table perms_on_pages3 add constraint permsonpages_c_id_not_for_imp check (perm_id < 2000000000);
alter table post_actions3 add constraint postactions_c_actionid_not_for_imp check (action_id < 2000000000);
alter table post_actions3 add constraint postactions_c_subid_not_for_imp check (sub_id < 2000000000);
alter table post_actions3 add constraint postactions_c_postnr_not_for_imp check (post_nr < 2000000000);
alter table post_revisions3 add constraint postrevisions_c_revnr_not_for_imp check (revision_nr < 2000000000);
alter table posts3 add constraint posts_c_id_not_for_imp check (unique_post_id < 2000000000);
alter table posts3 add constraint posts_c_nr_not_for_imp check (post_nr < 2000000000);
alter table posts3 add constraint posts_c_parentnr_not_for_imp check (parent_nr < 2000000000);
alter table review_tasks3 add constraint reviewtasks_c_id_not_for_imp check (id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postid_not_for_imp check (post_id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postrevnr_not_for_imp check (post_rev_nr < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_postnr_not_for_imp check (post_nr < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_authorid_not_for_imp check (author_id < 2000000000);
alter table spam_check_queue3 add constraint spamcheckqueue_c_pageid_not_for_imp check (page_id not like '200???????');

alter table spam_check_queue3 add constraint spamcheckqueue_r_sites foreign key (site_id) references sites3 (id) deferrable;
alter table upload_refs3  add constraint uploadrefs_r_posts foreign key (site_id, post_id) references posts3 (site_id, unique_post_id) deferrable;

alter table users3 add constraint participants_c_member_id_not_for_imp check (user_id < 2000000000);
alter table users3 add constraint participants_c_guest_id_not_for_imp check (user_id > -2000000000);


