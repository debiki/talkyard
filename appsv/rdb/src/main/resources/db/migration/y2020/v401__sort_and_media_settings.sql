

alter table users3 add column max_upload_bytes_c int;

alter table users3 add constraint pats_c_maxuploadbytes_gez check (
    max_upload_bytes_c >= 0);



alter table users3 add column allowed_upload_extensions_c varchar;

alter table users3 add constraint pats_c_alloweduploadexts_len check (
    length(allowed_upload_extensions_c) between 1 and 2000);

alter table users3 add constraint pats_c_alloweduploadexts_alnum check (
    allowed_upload_extensions_c ~ '^[a-z0-9 _.*-]+$');

update users3 set
    max_upload_bytes_c = 1048576,  -- 1 MiB
    allowed_upload_extensions_c = 'jpg jpeg png gif'
    where user_id = 11;  -- all members


alter table users3 add constraint pats_c_alloweduploads_is_group check (
    is_group or (
        (allowed_upload_extensions_c is null) and
        (max_upload_bytes_c is null)));



alter table settings3 add column emb_com_sort_order_c int;
alter table settings3 add column emb_com_nesting_c int;

alter table settings3 add constraint settings_c_embcomsortorder check (
    emb_com_sort_order_c between 0 and 1000);

alter table settings3 add constraint settings_c_embcomnesting check (
    emb_com_nesting_c between -1 and 100);

update settings3 set
    emb_com_sort_order_c = disc_post_sort_order,
    emb_com_nesting_c = disc_post_nesting,
    disc_post_sort_order = null,
    disc_post_nesting = null
where disc_post_sort_order is not null
   or disc_post_nesting is not null;
