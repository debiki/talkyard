
-- Allow long hostnames, so e2e tests can use descriptive hostnames.
-- Change from varchar(50) to varchar any-length, then add a constraint instead.
alter table dw1_tenant_hosts alter host type varchar;
alter table dw1_tenant_hosts add constraint dw1_hosts_host__c_len
    check(length(host) between 1 and 100);

