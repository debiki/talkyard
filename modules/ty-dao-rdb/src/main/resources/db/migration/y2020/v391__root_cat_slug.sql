update categories3 set slug = '__root_cat_' || id
  where parent_id is null;

