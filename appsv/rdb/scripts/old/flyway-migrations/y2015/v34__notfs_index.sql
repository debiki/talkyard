
create index dw1_ntfs_seen_createdat__i on dw1_notifications ((
    case when seen_at is null then created_at + INTERVAL '100 years' else created_at end) desc);

-- Change notf email stauts to int.
alter table dw1_notifications alter email_status drop default;
alter table dw1_notifications alter email_status type smallint using (
    case email_status
        when 'U' then 1
        when 'S' then 2
        when 'C' then 3
        else 989537 -- this would generate an error directly (smallint) or in a constraint below
    end);
alter table dw1_notifications add constraint dw1_notfs_emailstatus__c_in check (
  email_status between 1 and 20);
alter table dw1_notifications alter email_status set default 1;
alter table dw1_notifications alter email_status set not null;

drop index dw1_ntfs_createdat; -- checks for 'U' not 1
create index dw1_ntfs_createdat_email_undecided__i on dw1_notifications (created_at)
    where email_status = 1;

alter table dw1_notifications add constraint dw1_notfs_seenat_ge_createdat__c check (
    seen_at > created_at);

alter table dw1_notifications add constraint dw1_notfs_postnr_id__c_nn check (
    (post_nr is null) = (unique_post_id is null));

alter table dw1_notifications add constraint dw1_notfs_postnr_pageid__c_nn check (
    (post_nr is not null) or (page_id is null));

alter table dw1_notifications add notf_id int;

-- There are fairly few notifications.
create sequence dw1_notfs_id_tmp start with 10;
update dw1_notifications set notf_id = nextval('dw1_notfs_id_tmp');
drop sequence dw1_notfs_id_tmp;


alter table dw1_notifications add constraint dw1_notfs_id__p primary key (site_id, notf_id);

-- Make it possible to test just resolution-is-not-null:

drop index dw2_reviewtasks_causedby_postid__u;
create unique index dw2_reviewtasks_open_causedby_postid__u on dw2_review_tasks (
    site_id, caused_by_id, post_id) where post_id is not null and resolution is null;

drop index dw2_reviewtasks_causedby_userid__u;
create unique index dw2_reviewtasks_open_causedby_userid__u on dw2_review_tasks (
    site_id, caused_by_id, user_id) where user_id is not null and resolution is null;

create index dw2_reviewtasks_open_createdat__i on dw2_review_tasks (
    site_id, created_at desc) where resolution is null;

-- Oops fix wrong notf_type bug in recent migration.
update dw1_notifications set
    notf_type = case notf_type when 1 then 2 when 2 then 1 when 4 then 5 when 3 then 4 end;


-- Allow video/ prefix in uploads file path.
create or replace function is_valid_hash_path(text varchar) returns boolean as $$
begin
    return
    text ~ '^[0-9a-z]/[0-9a-z]/[0-9a-z\.]+$' or -- old, deprecated, remove later
    text ~ '^([a-z][a-z0-9]*/)?[0-9][0-9]?/[0-9a-z]/[0-9a-z]{2}/[0-9a-z\.]+$';
end;
$$ language plpgsql;

