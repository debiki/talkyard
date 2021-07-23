
insert into dw1_tenants (id, name)
select '1', 'Main Site'
where not exists (
  select id from dw1_tenants where id = '1');
