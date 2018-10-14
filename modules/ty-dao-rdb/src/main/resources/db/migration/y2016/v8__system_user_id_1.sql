alter table audit_log3 alter constraint dw2_auditlog_doer__r__users deferrable;
alter table audit_log3 alter constraint dw2_auditlog_targetuser__r__users deferrable;

-- alter table emails_out3 alter constraint dw1_emlot__r__users deferrable;

alter table pages3 alter constraint dw1_pages_createdbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_createdbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_approvedbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_lasteditedbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_closedbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_collapsedbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_deletedbyid__r__users deferrable;
alter table posts3 alter constraint dw2_posts_lastapprovededitbyid__r__users deferrable;

alter table post_revisions3 alter constraint dw2_postrevs_approvedby__r__users deferrable;
alter table post_revisions3 alter constraint dw2_postrevs_composedby__r__users deferrable;

alter table post_actions3 alter constraint dw2_postacs_createdbyid__r__users deferrable;
alter table post_actions3 alter constraint dw2_postacs_deletedbyid__r__users deferrable;

set constraints all deferred;

update pages3 set author_id = 1 where author_id = -1;

alter table posts3 drop constraint dw2_posts__c_first_rev_by_creator;
update posts3 set created_by_id = 1 where created_by_id = -1;
update posts3 set approved_by_id = 1 where approved_by_id = -1;
update posts3 set curr_rev_by_id = 1 where curr_rev_by_id = -1;
update posts3 set closed_by_id = 1 where closed_by_id = -1;
update posts3 set collapsed_by_id = 1 where collapsed_by_id = -1;
update posts3 set deleted_by_id = 1 where deleted_by_id = -1;
update posts3 set last_approved_edit_by_id = 1 where last_approved_edit_by_id = -1;
update posts3 set curr_rev_by_id = 1 where curr_rev_by_id = -1;

alter table post_revisions3 disable trigger user;
update post_revisions3 set composed_by_id = 1 where composed_by_id = -1;
update post_revisions3 set approved_by_id = 1 where approved_by_id = -1;

update audit_log3 set doer_id = 1 where doer_id = -1;
update audit_log3 set target_user_id = 1 where target_user_id = -1;

delete from notifications3 where to_user_id = -1;


alter table users3 drop constraint dw1_users_auth__c_notnulls;
alter table users3 drop constraint dw1_users_auth__c_nulls;
alter table users3 drop constraint dw1_users_email__c;
alter table users3 drop constraint dw1_users_guest__c_nn;
alter table users3 drop constraint dw1_users_guest__c_nulls;
alter table users3 drop constraint dw1_users_id__c;

update users3 set user_id = 1 where user_id = -1;

-- Need to commit here, otherwise there's some error when running the rest
-- of the commands. Don't remember what error.
commit;


-- add back triggers adn constraints.

alter table post_revisions3 enable trigger user;

alter table posts3 add constraint posts__c_first_rev_by_creator check (curr_rev_by_id = created_by_id or curr_rev_nr > 1);


alter table users3 add constraint users_member__c_nn check (user_id < 0 or created_at is not null and username is not null and email_for_every_new_post is not null);

alter table users3 add constraint users_member__c_nulls check (user_id < 0 or guest_cookie is null);

alter table users3 add constraint users_member_email__c check (user_id < 0 or email::text ~~ '%@%.%'::text);

alter table users3 add constraint users_guest__c_nn check (user_id > 0 or created_at is not null and display_name is not null and email is not null and guest_cookie is not null);

alter table users3 add constraint users_guest__c_nulls check (user_id > 0 or is_approved is null and approved_at is null and approved_by_id is null and suspended_at is null and suspended_till is null and suspended_by_id is null and country is null and website is null and is_owner is null and is_admin is null and is_moderator is null and is_editor is null and username is null and email_notfs is null and email_verified_at is null and password_hash is null and email_for_every_new_post is null);

alter table users3 add constraint users_id__c check (user_id <> 0);

commit;
