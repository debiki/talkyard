
alter table dw1_tenants drop column creator_tenant_id;
alter table dw1_tenants drop column creator_role_id;

alter table dw1_tenants add column creator_email_address varchar;
alter table dw1_tenants add constraint dw1_tnt_creatoremail__c
    check (creator_email_address like '%@%.%');

update dw1_tenants set creator_email_address = 'unknown@example.com';
update dw1_tenants set creator_ip = '0.0.0.0' where creator_ip is null;
update dw1_tenants set name = 'embedded-site-' || id where name is null;

alter table dw1_tenants alter creator_email_address set not null;
alter table dw1_tenants alter creator_ip set not null;
alter table dw1_tenants alter name set not null;

create index dw1_tenants_creatoremail on dw1_tenants(creator_email_address);

