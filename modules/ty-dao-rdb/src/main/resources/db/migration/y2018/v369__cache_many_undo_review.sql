-- Make it possible to undo review decisions: add decided-at column.

alter table review_tasks3 add column decided_at timestamp;

alter table review_tasks3 rename column completed_by_id to decided_by_id;
alter table review_tasks3 rename column completed_at_rev_nr to decided_at_rev_nr;
alter table review_tasks3 rename column resolution to decision;

alter table review_tasks3 add constraint reviewtasks_c_decidedat_ge_createdat check (
  (decided_at >= created_at));

alter table review_tasks3 drop constraint reviewtasks_completedat_atrevnr__c_nn;
alter table review_tasks3 add constraint reviewtasks_c_decided_compl_match_atrevnr check (
  (decided_at is not null or completed_at is not null) or (decided_at_rev_nr is null));

alter table review_tasks3 drop constraint reviewtasks_completedat_by__c_nn;
alter table review_tasks3 add constraint reviewtasks_c_decided_compl_match_by check (
  (decided_at is null and completed_at is null) = (decided_by_id is null));

alter table review_tasks3 drop constraint reviewtasks_resolution__c_n;
alter table review_tasks3 add constraint reviewtasks_c_decided_compl_match_decision check (
  (decided_at is null and completed_at is null) = (decision is null));

alter table review_tasks3 drop constraint reviewtasks_invalidatedat_ge_morereasonsat__c;

update review_tasks3 set decision = 1001 where decision = 1;

create index reviewtasks_decided_do_soon_i on review_tasks3 (decided_at)
  where decided_at is not null and completed_at is null and invalidated_at is null;

create index reviewtasks_undecided_i on review_tasks3 (site_id, created_at desc)
  where decision is null and completed_at is null and invalidated_at is null;


-- Cache different ways of rendering the same page.

drop table page_html3;
create table page_html3 (
  site_id integer not null,
  page_id character varying not null,
  width_layout smallint not null,  -- later: remove? use react_store_json instead
  --forum_layout smallint not null,  -- no, use react_store_json instead
  --posts_layout smallint not null,  --
  --sort_order smallint not null,    --
  is_embedded bool not null,  -- remove? use react_store_json instead
  origin varchar not null, -- remove? use react_store_json instead
  cdn_origin varchar not null, -- remove? use react_store_json instead
  site_version integer not null, -- remove? use react_store_json instead
  page_version integer not null, -- remove? use react_store_json instead
  app_version character varying not null, -- remove? use react_store_json instead
  react_store_json_hash character varying not null,
  updated_at timestamp not null,
  react_store_json jsonb not null,
  cached_html text not null,
  constraint pagehtml_p primary key (site_id, page_id, width_layout, is_embedded, origin, cdn_origin),
  constraint pagehtml_r_pages foreign key (site_id, page_id) references pages3(site_id, page_id) deferrable
);


-- Incl country code too, not just language.
update settings3 set language_code = 'sv_SE' where language_code = 'sv';
update settings3 set language_code = 'en_US' where language_code = 'en';
