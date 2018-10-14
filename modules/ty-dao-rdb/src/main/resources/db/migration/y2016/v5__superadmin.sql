
alter table sites3 add column status int not null default 1;
alter table users3 add column is_superadmin boolean;

alter table sites3 add constraint sites_status__c_in check (status between 1 and 7);

