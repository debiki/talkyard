-- Won't need more that 30 page roles
alter table dw1_pages drop constraint dw1_pages_pagerole__c_in;
alter table dw1_pages add constraint dw1_pages_pagerole__c_in check (page_role between 1 and 30);

-- These stats will initially be incorrect for many existing pages. Doesn't matter much.
alter table dw1_pages add column num_op_like_votes int not null default 0;
alter table dw1_pages add column num_op_wrong_votes int not null default 0;
alter table dw1_pages add column num_op_bury_votes int not null default 0;
alter table dw1_pages add column num_op_unwanted_votes int not null default 0;
alter table dw1_pages add column num_op_replies_visible int not null default 0;

-- Q&A and to-do and won't-do stuff.
alter table dw1_pages add column answered_at timestamp;
alter table dw1_pages add column answer_post_id int;
alter table dw1_pages add column done_at timestamp;
alter table dw1_pages add column closed_at timestamp;
alter table dw1_pages add column locked_at timestamp;
alter table dw1_pages add column frozen_at timestamp;
alter table dw1_pages add column unwanted_at timestamp;
-- deleted_at: already exists.

alter table dw1_pages add constraint dw1_pages_answerat_answerpostid__c check (
    answered_at is null = answer_post_id is null);
alter table dw1_pages add constraint dw1_pages_createdat_doneat__c_lt check (created_at <= done_at);
alter table dw1_pages add constraint dw1_pages_createdat_closedat__c_lt check (created_at <= closed_at);
alter table dw1_pages add constraint dw1_pages_createdat_lockedat_at check (created_at <= locked_at);
alter table dw1_pages add constraint dw1_pages_createdat_frozenat__c_lt check (created_at <= frozen_at);
alter table dw1_pages add constraint dw1_pages_createdat_unwantedat__c_lt check (created_at <= unwanted_at);
alter table dw1_pages add constraint dw1_pages_createdat_deletedat__c_lt check (created_at <= deleted_at);

