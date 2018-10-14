-- This evolution:
--  - Adds a Special Content ('SP') page type
--  - Renames ForumGroump to Forum ('FG' to 'F') and Forum to ForumCategory ('F' to 'FC')
--  - Adds a delete page function


# --- !Ups


alter table DW1_PAGES drop constraint DW1_PAGES_PAGEROLE__C_IN;

-- Rename 'FG' to 'F', 'F' to 'FC'.
update DW1_PAGES set PAGE_ROLE = 'FC' where PAGE_ROLE = 'F';
update DW1_PAGES set PAGE_ROLE = 'F' where PAGE_ROLE = 'FG';

-- Add 'SP', and use 'F', 'FC'  instead of  'FG', 'F'
alter table DW1_PAGES add constraint DW1_PAGES_PAGEROLE__C_IN
  check (PAGE_ROLE in ('G', 'EC', 'B', 'BP', 'F', 'FC', 'FT', 'W', 'WP', 'C', 'SP'));


-- Usage example:  select delete_page('tenant_id', 'page_id')
--
-- (Play framework thinks that each 'semicolon' ends an evolution statement, so in the
-- function body use 'semicolonsemicolon' which Play converts to a single 'semicolon'.)
--
create function delete_page(the_site_id varchar, the_page_id varchar) returns void as $$
begin
  delete from DW1_PAGE_ACTIONS where TENANT = the_site_id and PAGE_ID = the_page_id;;
  delete from DW1_PAGE_PATHS where TENANT = the_site_id and PAGE_ID = the_page_id;;
  delete from DW1_POSTS where SITE_ID = the_site_id and PAGE_ID = the_page_id;;
  delete from DW1_PAGES where TENANT = the_site_id and GUID = the_page_id;;
end;;
$$ language plpgsql;



# --- !Downs


-- Remove 'SP', if possible, or fail.
alter table DW1_PAGES drop constraint DW1_PAGES_PAGEROLE__C_IN;
alter table DW1_PAGES add constraint DW1_PAGES_PAGEROLE__C_IN
  check (PAGE_ROLE in ('G', 'EC', 'B', 'BP', 'F', 'FC', 'FT', 'W', 'WP', 'C'));

-- Use 'FG' and 'F' not 'F' and 'FC'.
alter table DW1_PAGES drop constraint DW1_PAGES_PAGEROLE__C_IN;
update DW1_PAGES set PAGE_ROLE = 'FG' where PAGE_ROLE = 'F';
update DW1_PAGES set PAGE_ROLE = 'F' where PAGE_ROLE = 'FC';
alter table DW1_PAGES add constraint DW1_PAGES_PAGEROLE__C_IN
  check (PAGE_ROLE in ('G', 'EC', 'B', 'BP', 'FG', 'F', 'FT', 'W', 'WP', 'C'));


drop function delete_page(the_site_id varchar, the_page_id varchar);

