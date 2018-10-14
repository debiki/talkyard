CREATE or replace FUNCTION delete_page(the_site_id character varying, the_page_id character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
delete from post_actions3 where TENANT = the_site_id and PAGE_ID = the_page_id;
delete from page_paths3 where TENANT = the_site_id and PAGE_ID = the_page_id;
delete from posts3 where SITE_ID = the_site_id and PAGE_ID = the_page_id;
delete from pages3 where TENANT = the_site_id and GUID = the_page_id;
end;
$$;


CREATE or replace FUNCTION hex_to_int(hexval character varying) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    result  int;
BEGIN
    EXECUTE 'SELECT x''' || hexval || '''::int' INTO result;
    RETURN result;
END;
$$;


CREATE or replace FUNCTION inc_next_page_id(site_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
next_id int;
begin
update sites3
set NEXT_PAGE_ID = NEXT_PAGE_ID + 1
where ID = site_id
returning NEXT_PAGE_ID into next_id;
return next_id - 1;
end;
$$;


CREATE or replace FUNCTION is_valid_css_class(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    return text ~ '^[ a-zA-Z0-9_-]+$';
end;
$_$;


create or replace function is_valid_tag_label(text character varying) returns boolean
    language plpgsql
    as $_$
begin
    -- No whitespace, commas, ';' etcetera. Sync with Scala [7JES4R3]
    return text ~ '^[^\s,;\|''"<>]+$' and length(text) between 1 and 100;
end;
$_$;


create or replace function is_valid_notf_level(notf_level int) returns boolean
    language plpgsql
    as $_$
begin
    return notf_level between 1 and 5;  -- sync with Scala code [7KJE0W3]
end;
$_$;


CREATE or replace FUNCTION is_valid_hash_path(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    return
    text ~ '^[0-9a-z]/[0-9a-z]/[0-9a-z\.]+$' or -- old, deprecated, remove later
    text ~ '^([a-z][a-z0-9]*/)?[0-9][0-9]?/[0-9a-z]/[0-9a-z]{2}/[0-9a-z\.]+$';
end;
$_$;


CREATE or replace FUNCTION now_utc() RETURNS timestamp without time zone
    LANGUAGE plpgsql
    AS $$
begin
  -- Truncate to millis, so can be represented as a Java date.
  return date_trunc('milliseconds', now() at time zone 'utc');
end;
$$;


CREATE or replace FUNCTION update_upload_ref_count(the_base_url character varying, the_hash_path character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
    num_post_refs int;
    num_avatar_refs int;
    num_refs int;
begin
    -- (Don't use site_id here — uploads3 is for all sites)
    select count(*) into num_post_refs
        from upload_refs3 where base_url = the_base_url and hash_path = the_hash_path;
    select count(*) into num_avatar_refs
        from users3
        where (avatar_tiny_base_url = the_base_url and avatar_tiny_hash_path = the_hash_path)
             or (avatar_small_base_url = the_base_url and avatar_small_hash_path = the_hash_path)
             or (avatar_medium_base_url = the_base_url and avatar_medium_hash_path = the_hash_path);
    num_refs = num_post_refs + num_avatar_refs;
    update uploads3 set
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
end $$;


