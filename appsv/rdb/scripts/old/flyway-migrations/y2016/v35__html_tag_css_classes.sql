
alter table dw1_pages add column html_tag_css_classes varchar;

alter table dw1_pages add constraint dw1_pages_htmltagcssclass__c_len check (
  length(html_tag_css_classes) between 1 and 100);


-- Will be reused, if categories will get their own css class too.
create or replace function is_valid_css_class(text varchar) returns boolean as $$
begin
    return text ~ '^[ a-zA-Z0-9_-]+$';
end;
$$ language plpgsql;

alter table dw1_pages add constraint dw1_pages_htmltagcssclass__c_ptrn check (
  is_valid_css_class(html_tag_css_classes));

