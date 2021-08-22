
alter table dw1_pages add last_reply_at timestamp;

-- Always specify bumped_at so one can sort by bumped_at in the forum topic list.
update dw1_pages set bumped_at = coalesce(published_at, created_at) where bumped_at is null;
alter table dw1_pages alter bumped_at set not null;

alter table dw1_pages add constraint dw1_pages_createdat_replyat__c_le check (created_at <= last_reply_at);
alter table dw1_pages add constraint dw1_pages_replyat_bumpedat__c_le check (last_reply_at <= bumped_at);
alter table dw1_pages add constraint dw1_pages_publdat_bumpedat__c_le check (published_at <= bumped_at);


-- Fix multireply bug.
update dw2_posts set multireply = null
  where multireply is not null and multireply not like '%,%';


-- Audit log size. I'll add triggers later?
alter table dw1_tenants add column num_audit_rows int not null default 0;

-- Images and videos (stored in the file system? in Postgres? not sure).
alter table dw1_tenants add column num_blobs int not null default 0;
alter table dw1_tenants add column num_blob_bytes int not null default 0;

alter table dw1_tenants add column price_plan varchar;
alter table dw1_tenants add constraint dw1_tnt_priceplan__c_ne check (length(trim(price_plan)) > 0);
alter table dw1_tenants add constraint dw1_tnt_priceplan__c_len check (length(price_plan) < 100);

