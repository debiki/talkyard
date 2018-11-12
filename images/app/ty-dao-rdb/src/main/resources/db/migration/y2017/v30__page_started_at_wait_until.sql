-- Delete the To-Do page role, use Idea in status Planned instead, that's the same thing, right.
update pages3
  set page_role = 15  -- idea
  where page_role = 13; -- to do

alter table pages3 add column started_at timestamp;
alter table pages3 add column wait_until timestamp;

alter table pages3 add constraint pages_c_createdat_le_startedat check (created_at <= started_at);
alter table pages3 add constraint pages_c_not_todo check (page_role <> 13); -- todo

