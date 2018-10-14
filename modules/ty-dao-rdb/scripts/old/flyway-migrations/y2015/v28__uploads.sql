
-- Cannot add a original_hash_path_suffix --> hash_path_suffix foreign key because there
-- might be many rows for each hash_path_suffix, e.g. one for localhost, one for a CDN
-- (which would mean that the file is currently stored in two places).
-- (Could "fix" this by normalizing the table, but might as well not.)
create table dw2_uploads(
  base_url varchar not null,
  hash_path_suffix varchar not null,
  original_hash_path_suffix varchar not null,
  size_bytes int not null,
  mime_type varchar not null,
  width int,
  height int,
  uploaded_at timestamp not null,
  updated_at timestamp not null,
  num_references int not null,
  verified_present_at timestamp,
  verified_absent_at timestamp,
  constraint dw2_uploads__p primary key (base_url, hash_path_suffix),
  constraint dw2_uploads_baseurl__c check (base_url like '%/'),
  constraint dw2_uploads_hashpathsuffix__c check (
    hash_path_suffix ~ '^[[:alnum:]]/[[:alnum:]]/[[:alnum:]\.]+$'),
  constraint dw2_uploads_baseurl__c_len check (length(base_url) between 1 and 100),
  constraint dw2_uploads_hashpathsuffix__c_len check (length(hash_path_suffix) between 1 and 100),
  constraint dw2_uploads_orighashpathsuffix__c_len check (length(original_hash_path_suffix) between 1 and 100),
  constraint dw2_uploads_mimetype__c_len check (length(mime_type) between 1 and 100),
  constraint dw2_uploads__c_numbers check (num_references >= 0 and size_bytes > 0 and width > 0 and height > 0),
  constraint dw2_uploads__c_dates check (
    verified_present_at > uploaded_at and verified_absent_at > uploaded_at)
);

create index dw2_uploads_hashpathsuffix__i on dw2_uploads(hash_path_suffix);
create index dw2_uploads_unused__i on dw2_uploads(updated_at) where num_references = 0;


-- Don't reference dw2_uploads, because people might (in some weird way) create
-- links to uploads, before the uploads exist, or after they've been removed. And
-- I think it's better to know about all links to uploads, also broken links.
create table dw2_upload_refs(
  site_id varchar not null,
  post_id int not null,
  base_url varchar not null,
  hash_path_suffix varchar not null,
  added_by_id int not null,
  added_at timestamp not null,
  constraint dw2_uploadrefs__p primary key (site_id, post_id, base_url, hash_path_suffix),
  constraint dw2_uploadrefs__r__users foreign key (site_id, added_by_id)
    references dw1_users(site_id, user_id), -- ix: dw2_uploadrefs_addedby__i
  constraint dw2_uploadrefs_hashpathsuffix__c check (
    hash_path_suffix ~ '^[[:alnum:]]/[[:alnum:]]/[[:alnum:]\.]+$'),
  constraint dw2_uploadrefs_baseurl__c_len check (length(base_url) between 1 and 100),
  constraint dw2_uploadrefs_hashpathsuffix__c_len check (length(hash_path_suffix) between 1 and 100)
);

create index dw2_uploadrefs_baseurl__i on dw2_upload_refs(base_url);
create index dw2_uploadrefs_hashpathsuffix__i on dw2_upload_refs(hash_path_suffix);
create index dw2_uploadrefs_addedby__i on dw2_upload_refs(site_id, added_by_id);


alter table dw2_audit_log add column size_bytes int;
alter table dw2_audit_log add column upload_hash_path_suffix varchar;
alter table dw2_audit_log add column upload_file_name varchar;
alter table dw2_audit_log add constraint dw2_auditlog_size__c_gez check (size_bytes >= 0);
alter table dw2_audit_log add constraint dw2_auditlog_hashpathsuffix__c check (
    upload_hash_path_suffix ~ '^[[:alnum:]]/[[:alnum:]]/[[:alnum:]\.]+$');
alter table dw2_audit_log add constraint dw2_auditlog_hashpathsuffix__c_len check (
    length(upload_hash_path_suffix) between 1 and 100);
alter table dw2_audit_log add constraint dw2_auditlog_uploadfilename__c check (
    upload_file_name not like '%/%');
alter table dw2_audit_log add constraint dw2_auditlog_uploadfilename__c_len check (
    length(upload_file_name) between 1 and 200);

create index dw2_auditlog_uploadhashpathsuffix__i on dw2_audit_log(upload_hash_path_suffix)
    where upload_hash_path_suffix is not null;

