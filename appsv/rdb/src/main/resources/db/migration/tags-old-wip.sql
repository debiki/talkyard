-- Don't do like this. But do reuse some stuff from here?


-- in  src/main/resources/db/migration/r__functions.sql:
------------------------------------------------------------------

@@ -51,7 +51,7 @@ create or replace function is_valid_tag_label(text character varying) returns bo
        as $_$
    begin
        -- No whitespace, commas, ';' etcetera. Sync with Scala [7JES4R3]
-       return text ~ '^[^\s,;\|''"<>]+$' and length(text) between 1 and 100;
+       return text !~ bad_tag_label_char_regex() and length(text) between 1 and 100;
    end;
    $_$;


-- in new migration file:
------------------------------------------------------------------

alter table post_tags3 rename to post_tags3_old;
alter table tag_notf_levels3 rename to tag_notf_levels3_old;
 create table tags3(
  site_id int not null,
  tag_id int not null,
  tag_name varchar not null,
  constraint tags_p primary key (site_id, tag_id),
  constraint tags_r_sites foreign key (site_id) references sites3 (id),
  constraint tags_c_name_ok check (tag_name_seems_ok(tag_name)),
);
--    users3
--    "dw1_users_username__c_at" CHECK (username::text !~~ '%@%'::text)
--    "dw1_users_username__c_len" CHECK (length(btrim(username::text)) >= 2)
--    "dw1_users_username__c_len2" CHECK (length(username::text) < 40)
--    "users3_username_c_blank" CHECK (NOT contains_blank(username))
--    "users_c_email_ok" CHECK (email_seems_ok(primary_email_addr))
--    "users_member_email__c" CHECK (user_id < 0 OR primary_email_addr::text ~~ '%@%.%'::text)
--
--    user_emails3
--    "useremails_c_email_ok" CHECK (email_seems_ok(email_address))
 /*
create table page_tags3(
  site_id int not null,
  page_id varchar not null,
  tag_id int not null,
  constraint pagetags_p primary key (site_id, page_id, tag_id),
  constraint pagetags_r_tags foreign key (site_id, tag_id) references tags3(site_id, tag_id),
  constraint pagetags_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id),
); */
 create table post_tags3(
  site_id int not null,
  post_id int not null,
  tag_id int not null,
  constraint posttags_p primary key (site_id, post_id, tag_id),
  constraint posttags_r_tags foreign key (site_id, tag_id) references tags3(site_id, tag_id),
  constraint posttags_r_pages foreign key (site_id, post_id) references posts3(site_id, unique_post_id)
);
 create table user_tag_settings3(
  site_id varchar,
  user_id int,
  tag_id int,
  notf_level int,   <-- change from varchar to int
);
 create function bad_tag_label_char_regex(varchar) returns varchar language plpgsql as $_$
begin
  -- No whitespace, commas, ';' etcetera. Sync with Scala [7JES4R3]
  -- These allowed:  ._~:-
  return '[\s!"#$%&''()*+,\/\\:;<=>?@[\]^`{|}]';
end;
$_$;
 -- Leave 100 in case wants built-in tags, later, somehow.
insert into tags3 (site_id, tag_id, tag_name)
  select
    site_id,
    100 + row_number() over (partition by site_id order by tag),
    regexp_replace(tag, bad_tag_label_char_regex(), '', 'g')
  from (
    select site_id, tag, count(*) from post_tags3 group by site_id, tag) oldtags;

