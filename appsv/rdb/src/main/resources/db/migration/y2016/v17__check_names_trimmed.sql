
create or replace function is_trimmed(text character varying) returns boolean
language plpgsql as $_$
begin
    if text ~ '^\s+' then
      return false;
    end if;
    if text ~ '\s+$' then
      return false;
    end if;
    return true;
end;
$_$;


create or replace function contains_blank(text character varying) returns boolean
language plpgsql as $_$
begin
    return text ~ '\s';
end;
$_$;


alter table users3 rename display_name to full_name;

update users3 set full_name = trim(full_name) where full_name <> trim(full_name);
alter table users3 add constraint users3_fullname_c_trim check (is_trimmed(full_name));
alter table users3 add constraint users3_username_c_blank check (not contains_blank(username));
alter table users3 add constraint users3_country_c_trim check (is_trimmed(country));

update users3 set website = null where contains_blank(website);
alter table users3 add constraint users3_website_c_trim check (not contains_blank(website));

insert into usernames3 (site_id, username, in_use_from, user_id)
  select site_id, username, created_at, user_id
  from users3
  where username is not null
  on conflict do nothing;

