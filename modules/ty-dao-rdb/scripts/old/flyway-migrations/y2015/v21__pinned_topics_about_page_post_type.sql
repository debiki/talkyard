-- Pinned topics:

alter table dw1_pages add column pin_order smallint;
alter table dw1_pages add column pin_where smallint;
alter table dw1_pages add constraint dw1_pages_pinorder_where__c_n check(
    pin_where is null = pin_order is null);
alter table dw1_pages add constraint dw1_pages_pinwhere__c_in check(
    pin_where is null or pin_where between 1 and 3);

create index dw1_pages_pinorder__i on dw1_pages(site_id, pin_order) where pin_order is not null;
create index dw1_pages_bumpedat__i on dw1_pages(site_id, bumped_at desc);
create index dw1_pages_likes_bump__i on dw1_pages(site_id, num_likes desc, bumped_at desc);

-- Page role:

-- Add about-category page role, and rename some others.
alter table dw1_pages drop constraint dw1_pages_pagerole__c_in;

alter table dw1_pages alter column page_role type smallint using (
    case page_role
        when 'H' then 1
        when 'P' then 2
        when 'C' then 3
        when 'SP' then 4
        when 'EC' then 5
        when 'B' then 6
        when 'BP' then 12 -- discussion
        when 'F' then 7
        when 'FC' then 8
        when 'FT' then 12 -- discussion
        else null -- this would generate an error
    end);

alter table dw2_audit_log alter column page_role type smallint using (
    case page_role
        when 'H' then 1
        when 'P' then 2
        when 'C' then 3
        when 'SP' then 4
        when 'EC' then 5
        when 'B' then 6
        when 'BP' then 12 -- discussion
        when 'F' then 7
        when 'FC' then 8
        when 'FT' then 12 -- discussion
        else null -- this would generate an error
    end);

alter table dw1_pages add constraint dw1_pages_pagerole__c_in check (page_role between 1 and 12);
alter table dw2_audit_log add constraint dw1_pages_pagerole__c_in check (page_role between 1 and 12);
create unique index dw1_pages_parentid_about on dw1_pages(site_id, parent_page_id, page_role)
    where page_role = 9; -- the about role


-- Post type:

alter table dw2_posts add column type smallint;
-- Let's accept 1..100, that's a lot more than what's needed and should prevent most kinds of bugs?
alter table dw2_posts add constraint dw2_posts_type__c_in check (type between 1 and 100);

