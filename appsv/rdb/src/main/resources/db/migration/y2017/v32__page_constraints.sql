
alter table pages3 drop constraint dw1_pages_plannedat_doneat__c_null;
alter table pages3 add constraint pages_c_plannedat_le_startedat check (planned_at <= started_at);
alter table pages3 add constraint pages_c_startedat_le_doneat check (started_at <= done_at);
