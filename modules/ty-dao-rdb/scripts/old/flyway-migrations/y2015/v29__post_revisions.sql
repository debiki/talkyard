
create table dw2_post_revisions(
  site_id varchar not null,
  post_id int not null,
  revision_nr int not null,
  previous_nr int,
  source_patch text,
  full_source text,
  title varchar,
  composed_at timestamp not null,
  composed_by_id int not null,
  approved_at timestamp,
  approved_by_id int,
  hidden_at timestamp,
  hidden_by_id int,
  constraint dw2_postrevs_postid_revnr__p primary key (site_id, post_id, revision_nr),
  constraint dw2_postrevs_postid__r__posts foreign key (site_id, post_id) references dw2_posts(site_id, unique_post_id),
  constraint dw2_postrevs_prevnr_r__postrevs foreign key (site_id, post_id, previous_nr) references dw2_post_revisions(site_id, post_id, revision_nr), -- ix: dw2_postrevs_postid_prevnr__i
  constraint dw2_postrevs_composedby__r__users foreign key (site_id, composed_by_id) references dw1_users(site_id, user_id), -- ix: dw2_postrevs_composedby__i
  constraint dw2_postrevs_approvedby__r__users foreign key (site_id, approved_by_id) references dw1_users(site_id, user_id), -- ix: dw2_postrevs_approvedby__i
  constraint dw2_postrevs_hiddenby__r__users foreign key (site_id, hidden_by_id) references dw1_users(site_id, user_id), -- ix: dw2_postrevs_hiddenby__i
  constraint dw2_postrevs_revisionnr_prevnr__c_gz check (revision_nr > 0 and previous_nr > 0),
  constraint dw2_postrevs_revisionnr_gt_prevnr__c check (revision_nr > previous_nr),
  constraint dw2_postrevs_patch_source__c_nn check (source_patch is not null or full_source is not null),
  constraint dw2_postrevs_approvedat_ge_composedat__c check (approved_at >= composed_at),
  constraint dw2_postrevs_approved__c_null check(approved_at is null = approved_by_id is null),
  constraint dw2_postrevs_hiddenat_ge_composedat__c check (hidden_at >= composed_at),
  constraint dw2_postrevs_hidden__c_null check(hidden_at is null = hidden_by_id is null)
);

create index dw2_postrevs_postid_prevnr__i on dw2_post_revisions(site_id, post_id, previous_nr) where previous_nr is not null;
create index dw2_postrevs_composedby__i on dw2_post_revisions(site_id, composed_by_id);
create index dw2_postrevs_approvedby__i on dw2_post_revisions(site_id, approved_by_id) where approved_by_id is not null;
create index dw2_postrevs_hiddenby__i on dw2_post_revisions(site_id, hidden_by_id) where hidden_by_id is not null;


update dw2_posts set safe_version = 1, current_version = 1, approved_version = 1;

alter table dw2_posts rename safe_version to safe_rev_nr;
alter table dw2_posts rename current_version to curr_rev_nr;
alter table dw2_posts rename approved_version to approved_rev_nr;

alter table dw2_posts rename updated_at to curr_rev_started_at;
alter table dw2_posts rename last_edited_at to curr_rev_last_edited_at;
alter table dw2_posts rename last_edited_by_id to curr_rev_by_id;
alter table dw2_posts rename current_source_patch to curr_rev_source_patch;
alter table dw2_posts add prev_rev_nr int;

alter table dw2_posts drop constraint dw2_posts__c_last_apr_edit_at;
alter table dw2_posts drop constraint dw2_posts__c_last_edit;


create or replace function dw2_posts_summary() returns trigger as $dw2_posts_summary$
    declare
        delta_rows integer;
        delta_text_bytes integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_text_bytes =
                - coalesce(length(old.approved_source), 0)
                - coalesce(length(old.curr_rev_source_patch), 0);
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_text_bytes =
                + coalesce(length(new.approved_source), 0)
                + coalesce(length(new.curr_rev_source_patch), 0)
                - coalesce(length(old.approved_source), 0)
                - coalesce(length(old.curr_rev_source_patch), 0);
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_text_bytes =
                + coalesce(length(new.approved_source), 0)
                + coalesce(length(new.curr_rev_source_patch), 0);
            site_id = new.site_id;
        end if;
        update dw1_tenants
            set num_posts = num_posts + delta_rows,
                num_post_text_bytes = num_post_text_bytes + delta_text_bytes
            where id = site_id;
        return null;
    end;
$dw2_posts_summary$ language plpgsql;


update dw2_posts set curr_rev_started_at = created_at;
alter table dw2_posts alter curr_rev_started_at set not null;

-- All revisions were reset to 1 above, and we'll add a constraint that then curr_rev_by_id
-- must equal created_by_id.
update dw2_posts set curr_rev_by_id = created_by_id;
alter table dw2_posts alter curr_rev_by_id set not null;

alter table dw2_posts add constraint dw2_posts__c_first_rev_by_creator check(
    curr_rev_by_id = created_by_id or curr_rev_nr > 1);

alter table dw2_posts add constraint dw2_posts__c_first_rev_started_when_created check(
    curr_rev_started_at = created_at or curr_rev_nr > 1);

alter table dw2_posts add constraint dw2_posts_curreveditedat_ge_startedat__c check(
    curr_rev_last_edited_at >= curr_rev_started_at);

alter table dw2_posts add constraint dw2_posts_curreveditedat_ge_lastapprovededitat__c check(
    curr_rev_last_edited_at >= last_approved_edit_at);

alter table dw2_posts rename constraint dw2_posts__c_upd_at_ge_cre to dw2_posts_currevisionat_ge_createdat__c;

