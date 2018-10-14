
alter table settings3 add column allow_embedding_from varchar;
alter table settings3 add constraint settings_allowembeddingfrom__c_len check (
  length(allow_embedding_from) between 5 and 100);

create table alt_page_ids3(
  site_id int not null,
  alt_page_id varchar not null,
  real_page_id varchar not null,
  constraint altpageids_p primary key (site_id, alt_page_id),
  constraint altpageids_r_pages foreign key (site_id, real_page_id) references pages3(site_id, page_id),
  constraint altpageids_altid_c_len check (length(alt_page_id) between 1 and 300)
);
