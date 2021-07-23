# This evolution adds a per site next page id sequence no.


# --- !Ups


alter table DW1_TENANTS add column NEXT_PAGE_ID int not null default 1;

create or replace function INC_NEXT_PAGE_ID(site_id character varying) returns int as $$
declare
  next_id int;;
begin
  update DW1_TENANTS
    set NEXT_PAGE_ID = NEXT_PAGE_ID + 1
    where ID = site_id
    returning NEXT_PAGE_ID into next_id;;
  return next_id - 1;;
end;;
$$ language plpgsql;


# --- !Downs


alter table DW1_TENANTS drop column NEXT_PAGE_ID;

drop function INC_NEXT_PAGE_ID(site_id character varying);

