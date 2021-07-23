
create table message_members_3(
  site_id varchar,
  page_id varchar not null,
  user_id int not null,
  added_by_id int not null,
  added_at timestamp not null,
  constraint msgmbr3_page_user__p primary key (site_id, page_id, user_id),
  constraint msgmbr3__r__pages foreign key (site_id, page_id) references dw1_pages(site_id, page_id),
  constraint msgmbr3_user__r__users foreign key (site_id, user_id) references dw1_users(site_id, user_id),
  constraint msgmbr3_addedby__r__users foreign key (site_id, added_by_id) references dw1_users(site_id, user_id)
);

-- Foreign key indexes:

-- page: indexed already by pk.
create index msgmbr3_user__i on message_members_3(site_id, user_id);
create index msgmbr3_addedby__i on message_members_3(site_id, added_by_id);


alter table dw1_notifications drop constraint dw1_notfs_type__c_in;
alter table dw1_notifications alter column notf_type type smallint using (
    case notf_type
        when 'M' then 1
        when 'R' then 2
        when 'N' then 4
        else null -- this would generate an error
    end);
alter table dw1_notifications add constraint dw1_notfs_type__c_in check (notf_type between 1 and 100);

