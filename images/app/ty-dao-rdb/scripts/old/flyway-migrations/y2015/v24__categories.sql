
-- Create categories table
------------------------------------------------------

create table dw2_categories(
  site_id varchar not null,
  id int not null,
  page_id varchar not null,
  parent_id int,
  name varchar not null,
  slug varchar not null,
  position int not null,
  description varchar,
  new_topic_types varchar, -- comma separated topic type list, e.g. "5,3,11"
  created_at timestamp not null,
  updated_at timestamp not null,
  locked_at timestamp,
  frozen_at timestamp,
  deleted_at timestamp,

  constraint dw2_cats_id__p primary key (site_id, id),

  constraint dw2_cats_page__r__pages foreign key (site_id, page_id)
    references dw1_pages(site_id, page_id) deferrable, -- ix: dw2_cats_page__i

  constraint dw2_cats__r__cats foreign key (site_id, parent_id)
    references dw2_categories(site_id, id), -- ix: dw2_cats_parent_slug__u

  constraint dw2_cats_name__c_len check(length(name) between 1 and 100),
  constraint dw2_cats_slug__c_len check(length(slug) between 1 and 100),
  constraint dw2_cats_description__c_len check(length(description) < 1000),
  constraint dw2_cats_newtopictypes__c check(new_topic_types ~ '^([0-9]+,)*[0-9]+$'),
  constraint dw2_cats_created_updated__c_le check(created_at <= updated_at),
  constraint dw2_cats_created_locked__c_le check(created_at <= locked_at),
  constraint dw2_cats_created_frozen__c_le check(created_at <= frozen_at),
  constraint dw2_cats_created_deleted__c_le check(created_at <= deleted_at)
);


create index dw2_cats_page__i on dw2_categories(site_id, page_id);
create unique index dw2_cats_parent_slug__u on dw2_categories(site_id, parent_id, slug);
create index dw2_cats_slug__i on dw2_categories(site_id, slug);

-- Not sure if this will be needed, but just in case, better add it now, because it'd
-- be hard to add it later. The constraint prevents two categories in the same section
-- (e.g. in the same forum), at any level (including sub categories, sub sub ...),m
-- from having the same slug. This makes it possible to show just one slug in the URL
-- rather than a path of slugs.
create unique index dw2_cats_page_slug__u on dw2_categories(site_id, page_id, slug);


-- Create categories for www.effectivediscussions.org:
------------------------------------------------------

insert into dw2_categories select
    '3', 1, '4jqu3', null, '(Category Root)', '(category-root)', 1, null, null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3';

insert into dw2_categories select
    '3', 2, '4jqu3', 1,  'General', 'general', 5, 'description', null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3';

insert into dw2_categories select
    '3', 3, '4jqu3', 1,  'Pages', 'pages', 100, 'description', null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3';

insert into dw2_categories select
    '3', 4, '4jqu3', 1, 'Sandbox', 'sandbox', 999, 'description', null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3';

insert into dw2_categories select
    '3', 5, '4jqu3', 1, 'Uncategorized', 'uncategorized', 1000, '__uncategorized__', null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3';

-- Another site:
insert into dw2_categories select
    '55', 1, '1', null, '(Category Root)', '(category-root)', 1, null, null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3'; -- doesn't matter

insert into dw2_categories select
    '55', 2, '1', 1, 'Uncategorized', 'uncategorized', 1000, '__uncategorized__', null, now_utc(), now_utc()
    from dw1_pages where site_id = '3' and page_id = '4jqu3'; -- doesn't matter


-- Make dw1_pages use categories not parent page ids:
------------------------------------------------------

alter table dw1_pages drop constraint dw1_pages_parentpage__r__pages;

-- Link topics to categories at www.effectivediscussions.org:
alter table dw1_pages rename column parent_page_id to category_id;
alter table dw1_pages alter column category_id type int using (
    case site_id
        when '3' then
            -- Map former category pages, which will hereafter be about-category pages,
            -- to the new categories table.
            case page_id
                when '4jqu3' then 1  -- The forum root category
                when '1d8z5' then 2  -- the General category
                when '2' then 3      -- Pages
                when '110j7' then 4  -- Sandbox
                -- Map topics to the new categories table.
                else case category_id
                    when '1d8z5' then 2  -- General
                    when '2' then 3      -- Pages
                    when '110j7' then 4  -- Sandbox
                    when '4jqu3' then 5  -- Uncategorized
                    else null
                end
            end
        when '55' then
            case page_role
                when 7 then 1 -- the forum page
                else 2 -- uncategorized
            end
        else null
    end);
alter table dw1_pages add constraint dw1_pages_category__r__categories
    foreign key (site_id, category_id) references dw2_categories(site_id, id) deferrable;

-- Change from type Category to type About-Category for www.effectivediscussions.org,
-- or Discussion for other sites (there are no page-role-8 for site '55').
update dw1_pages set
    page_role = case
        when site_id = '3' then case page_id
            when '4jqu3' then 7 -- forum
            else 9  -- about category
            end
        else 12 -- discussion
        end
  where page_role = 8;


-- Could add constraint that each forum page links to a category

alter index dw1_pages_parentid_about rename to dw1_pages_category_about__u;
alter index dw1_pages_tnt_parentpage rename to dw1_pages_category__i;
alter index dw1_pages_site_publishedat rename to dw1_pages_publishedat__i;



-- Bug fixes
------------------------------------------------------

alter table dw2_audit_log drop constraint dw1_pages_pagerole__c_in; -- requires values <= 12
alter table dw2_audit_log add constraint dw2_auditlog_pagerole__c_in check(page_role between 1 and 100);

-- The constraint pattern didn't match on ^ and $ and some other things.
alter table dw2_posts drop constraint dw2_posts_multireply__c_num;
alter table dw2_posts add constraint dw2_posts_multireply__c_num check (
    multireply ~ '^([0-9]+,)*[0-9]+$');

