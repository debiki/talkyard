
-- Add 'H'omepage role. Rename 'Generic' to Web'P'age (not 'W'iki'P'age).
alter table DW1_PAGES drop constraint DW1_PAGES_PAGEROLE__C_IN;
update DW1_PAGES set PAGE_ROLE = 'P' where PAGE_ROLE = 'G';
alter table DW1_PAGES add constraint DW1_PAGES_PAGEROLE__C_IN check (PAGE_ROLE in (
    'H', 'P', 'EC', 'B', 'BP', 'F', 'FC', 'FT', 'W', 'WP', 'C', 'SP'));

-- Convert own pages.
update DW1_PAGES set PAGE_ROLE = 'H' where TENANT = '3' and GUID in (
  '4xsq1',  -- the homepage
  '4vkm1'); -- the embedded comments page

