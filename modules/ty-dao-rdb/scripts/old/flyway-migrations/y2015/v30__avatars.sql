
create or replace function is_valid_hash_path(text varchar) returns boolean as $$
    begin
        return text ~ '^[0-9a-z]/[0-9a-z]/[0-9a-z\.]+$';
    end;
$$ language plpgsql;

alter table dw2_uploads rename hash_path_suffix to hash_path;
alter table dw2_upload_refs rename hash_path_suffix to hash_path;
alter table dw2_uploads rename original_hash_path_suffix to original_hash_path;
alter table dw2_audit_log rename upload_hash_path_suffix to upload_hash_path;

-- Remove some dupl code in old constraint checks:
alter table dw2_uploads drop constraint dw2_uploads_hashpathsuffix__c;
alter table dw2_uploads add constraint dw2_uploads_hashpath__c check(
    is_valid_hash_path(hash_path));

alter table dw2_upload_refs drop constraint dw2_uploadrefs_hashpathsuffix__c;
alter table dw2_upload_refs add constraint dw2_uploadrefs_hashpath__c check(
    is_valid_hash_path(hash_path));

-- Add forgotten check.
alter table dw2_uploads add constraint dw2_uploads_originalhashpath__c check(
    is_valid_hash_path(original_hash_path));


-- Avatars
--------------------

-- Add avatar image columns. One for tiny (25x25 like Discourse?), one for small (say 50x50),
-- and one for medium (say 400x400) images.
alter table dw1_users add column avatar_tiny_base_url varchar;
alter table dw1_users add column avatar_tiny_hash_path varchar;
alter table dw1_users add column avatar_small_base_url varchar;
alter table dw1_users add column avatar_small_hash_path varchar;
alter table dw1_users add column avatar_medium_base_url varchar;
alter table dw1_users add column avatar_medium_hash_path varchar;

-- Only authenticated users can have avatars.
alter table dw1_users add constraint dw1_users_avatars__c check(
    user_id > 0 or avatar_tiny_base_url is null);

-- Either all (tiny, small, medium) avatars images are specified, or none at all.
alter table dw1_users add constraint dw1_users_avatars_none_or_all__c check((
    avatar_tiny_base_url is null and avatar_tiny_hash_path is null and
    avatar_small_base_url is null and avatar_small_hash_path is null and
    avatar_medium_base_url is null and avatar_medium_hash_path is null)
    or (
    avatar_tiny_base_url is not null and avatar_tiny_hash_path is not null and
    avatar_small_base_url is not null and avatar_small_hash_path is not null and
    avatar_medium_base_url is not null and avatar_medium_hash_path is not null));

alter table dw1_users add constraint dw1_users_avatartinyhashpath__c check(
    is_valid_hash_path(avatar_tiny_hash_path));
alter table dw1_users add constraint dw1_users_avatarsmallhashpath__c check(
    is_valid_hash_path(avatar_small_hash_path));
alter table dw1_users add constraint dw1_users_avatarmediumhashpath__c check(
    is_valid_hash_path(avatar_medium_hash_path));

alter table dw1_users add constraint dw1_users_avatartinybaseurl__c_len check(
    length(avatar_tiny_base_url) between 1 and 100);
alter table dw1_users add constraint dw1_users_avatarsmallbaseurl__c_len check(
    length(avatar_small_base_url) between 1 and 100);
alter table dw1_users add constraint dw1_users_avatarmediumbaseurl__c_len check(
    length(avatar_medium_base_url) between 1 and 100);

create index dw1_users_avatartinybaseurl__i on dw1_users(avatar_tiny_base_url);
create index dw1_users_avatartinyhashpath__i on dw1_users(avatar_tiny_hash_path);
create index dw1_users_avatarsmallbaseurl__i on dw1_users(avatar_small_base_url);
create index dw1_users_avatarsmallhashpath__i on dw1_users(avatar_small_hash_path);
create index dw1_users_avatarmediumbaseurl__i on dw1_users(avatar_medium_base_url);
create index dw1_users_avatarmediumhashpath__i on dw1_users(avatar_medium_hash_path);


-- Fix bumped-at bugs: closed topics no longer bumped.
alter table dw1_pages drop constraint dw1_pages_replyat_bumpedat__c_le;

update dw1_pages set bumped_at = closed_at where bumped_at > closed_at;
alter table dw1_pages add constraint dw1_pages_bumpedat_le_closedat__c check (bumped_at <= closed_at);


-- Frequent posters
--------------------

alter table dw1_pages add column last_reply_by_id int;
update dw1_pages pg set last_reply_by_id = (
    select po.created_by_id from dw2_posts po
    where po.site_id = pg.site_id
      and po.page_id = pg.page_id
      and po.created_at = pg.last_reply_at);
alter table dw1_pages add constraint dw1_pages_lastreplyat_byid__c_nn check(
    last_reply_at is null = last_reply_by_id is null);

alter table dw1_pages add column frequent_poster_1_id int;
alter table dw1_pages add column frequent_poster_2_id int;
alter table dw1_pages add column frequent_poster_3_id int;
alter table dw1_pages add column frequent_poster_4_id int;

alter table dw1_pages add constraint dw1_pages_lastreplybyid__r__users foreign key (
    site_id, last_reply_by_id) references dw1_users(site_id, user_id);
alter table dw1_pages add constraint dw1_pages_frequentposter1id__r__users foreign key (
    site_id, frequent_poster_1_id) references dw1_users(site_id, user_id);
alter table dw1_pages add constraint dw1_pages_frequentposter2id__r__users foreign key (
    site_id, frequent_poster_2_id) references dw1_users(site_id, user_id);
alter table dw1_pages add constraint dw1_pages_frequentposter3id__r__users foreign key (
    site_id, frequent_poster_3_id) references dw1_users(site_id, user_id);
alter table dw1_pages add constraint dw1_pages_frequentposter4id__r__users foreign key (
    site_id, frequent_poster_4_id) references dw1_users(site_id, user_id);

-- FK indexes:
-- Adding all these indexes should be fine — there'll be few pages in comparison to
-- the number of posts; these indexes likely don't matter much?
create index dw1_pages_lastreplybyid__i on dw1_pages(site_id, last_reply_by_id) where last_reply_by_id is not null;
create index dw1_pages_frequentposter1id__i on dw1_pages(site_id, frequent_poster_1_id) where frequent_poster_1_id is not null;
create index dw1_pages_frequentposter2id__i on dw1_pages(site_id, frequent_poster_2_id) where frequent_poster_2_id is not null;
create index dw1_pages_frequentposter3id__i on dw1_pages(site_id, frequent_poster_3_id) where frequent_poster_3_id is not null;
create index dw1_pages_frequentposter4id__i on dw1_pages(site_id, frequent_poster_4_id) where frequent_poster_4_id is not null;

-- If last-poster is null, all frequent-poster-X must be null.
-- And if frequent-poster-X is null, then X+1 must be null too.
-- (So if e.g. frequent_poster_3_id is null, we know that frequent_poster_4_id is null too.)
alter table dw1_pages add constraint dw1_pages_frequentposter1234__c_null check (
    (last_reply_by_id is not null or frequent_poster_1_id is null) and
    (frequent_poster_1_id is not null or frequent_poster_2_id is null) and
    (frequent_poster_2_id is not null or frequent_poster_3_id is null) and
    (frequent_poster_3_id is not null or frequent_poster_4_id is null));

