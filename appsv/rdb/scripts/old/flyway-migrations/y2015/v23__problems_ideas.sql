
-- When a problem or idea was accepted / planned to be fixed/done.
alter table dw1_pages add column planned_at timestamp;

update dw1_pages set planned_at = created_at where done_at is not null;
update dw1_pages set closed_at = done_at where done_at is not null and closed_at is null;
update dw1_pages set closed_at = answered_at where answered_at is not null and closed_at is null;

alter table dw1_pages add constraint dw1_pages_createdat_plannedat__c_le check (created_at <= planned_at);
alter table dw1_pages add constraint dw1_pages_plannedat_doneat__c_le check (planned_at <= done_at);
alter table dw1_pages add constraint dw1_pages_plannedat_doneat__c_null check (
    done_at is null or planned_at is not null);

-- A topic gets closed when it's marked as done or answered.
alter table dw1_pages add constraint dw1_pages__c_closed_if_done_answered check (
    (done_at is null and answered_at is null) or closed_at is not null);
