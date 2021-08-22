
alter table dw1_tenants rename num_blobs to num_uploads;
alter table dw1_tenants rename num_blob_bytes to num_upload_bytes;
alter table dw1_tenants alter num_upload_bytes type bigint;

alter table dw1_tenants add column num_post_revisions integer default 0 not null;
alter table dw1_tenants add column num_post_rev_bytes bigint default 0 not null;


create or replace function sum_post_revs_quota_3() returns trigger as $$
    declare
        delta_rows integer;
        delta_bytes integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_bytes =
                - coalesce(length(old.source_patch), 0)
                - coalesce(length(old.full_source), 0)
                - coalesce(length(old.title), 0);
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_bytes =
                + coalesce(length(new.source_patch), 0)
                + coalesce(length(new.full_source), 0)
                + coalesce(length(new.title), 0),
                - coalesce(length(old.source_patch), 0)
                - coalesce(length(old.full_source), 0)
                - coalesce(length(old.title), 0);
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_bytes =
                + coalesce(length(new.source_patch), 0)
                + coalesce(length(new.full_source), 0)
                + coalesce(length(new.title), 0);
            site_id = new.site_id;
        end if;
        update dw1_tenants
            set num_post_revisions = num_post_revisions + delta_rows,
                num_post_rev_bytes = num_post_rev_bytes + delta_bytes
            where id = site_id;
        return null;
    end;
$$ language plpgsql;

create trigger sum_post_revs_quota_3
after insert or update or delete on dw2_post_revisions
    for each row execute procedure sum_post_revs_quota_3();


update dw1_tenants set num_post_revisions = (
    select count(*) from dw2_post_revisions
    where dw1_tenants.id = dw2_post_revisions.site_id);

update dw1_tenants set num_post_rev_bytes = (
    select coalesce(
        sum(coalesce(length(source_patch), 0)) +
        sum(coalesce(length(full_source), 0)) +
        sum(coalesce(length(title), 0)),
        0)
    from dw2_post_revisions
    where dw1_tenants.id = dw2_post_revisions.site_id);


with refs as (
    select site_id, base_url bu, hash_path hp from dw2_upload_refs
    union
    select site_id, avatar_tiny_base_url bu, avatar_tiny_hash_path hp from dw1_users
    union
    select site_id, avatar_small_base_url bu, avatar_small_hash_path hp from dw1_users
    union
    select site_id, avatar_medium_base_url bu, avatar_medium_hash_path hp from dw1_users)
update dw1_tenants set
    num_uploads = (
        select count(*)
        from refs inner join dw2_uploads u on refs.bu = u.base_url and refs.hp = u.hash_path
        where refs.site_id = id),
    num_upload_bytes = (
        select coalesce(sum(u.size_bytes), 0)
        from refs inner join dw2_uploads u
            on refs.bu = u.base_url and refs.hp = u.hash_path
        where refs.site_id = id);


create or replace function is_valid_hash_path(text varchar) returns boolean as $$
begin
    return
        text ~ '^[0-9a-z]/[0-9a-z]/[0-9a-z\.]+$' or -- old, deprecated, remove later
        text ~ '^[0-9][0-9]?/[0-9a-z]/[0-9a-z]{2}/[0-9a-z\.]+$';
end;
$$ language plpgsql;

alter table dw2_audit_log drop constraint dw2_auditlog_hashpathsuffix__c;
alter table dw2_audit_log add constraint dw2_auditlog_hashpath__c check (
    is_valid_hash_path(upload_hash_path));


-- Make it possible to delete unreferenced files after a while.
alter table dw2_uploads add column unused_since timestamp;
alter table dw2_uploads add constraint dw2_uploads_0refs_unusedsince__c check(
    (num_references = 0) = unused_since is not null);

drop index dw2_uploads_unused__i;
create index dw2_uploads_unusedsince__i on dw2_uploads (unused_since) where num_references = 0;


create or replace function update_upload_ref_count(the_base_url varchar, the_hash_path varchar)
    returns void as $$
declare
    num_post_refs int;
    num_avatar_refs int;
    num_refs int;
begin
    -- (Don't use site_id here — dw2_uploads is for all sites)
    select count(*) into num_post_refs
        from dw2_upload_refs where base_url = the_base_url and hash_path = the_hash_path;
    select count(*) into num_avatar_refs
        from dw1_users
        where (avatar_tiny_base_url = the_base_url and avatar_tiny_hash_path = the_hash_path)
             or (avatar_small_base_url = the_base_url and avatar_small_hash_path = the_hash_path)
             or (avatar_medium_base_url = the_base_url and avatar_medium_hash_path = the_hash_path);
    num_refs = num_post_refs + num_avatar_refs;
    update dw2_uploads set
        updated_at = now_utc(),
        num_references = num_refs,
        unused_since =
            case when num_refs > 0 then null else
              case
                when unused_since is null then now_utc()
                else unused_since
              end
            end
        where base_url = the_base_url and hash_path = the_hash_path;
end $$ language plpgsql;


-- Let's do this too:
alter table dw2_posts rename post_id to post_nr;
alter table dw2_posts rename parent_post_id to parent_nr;
alter table dw2_post_actions rename post_id to post_nr;
alter table dw1_notifications rename post_id to post_nr;
alter table dw1_posts_read_stats rename post_id to post_nr;
