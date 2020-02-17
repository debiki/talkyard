alter table sites3 add column super_staff_notes varchar;
alter table sites3 add constraint sites3_c_superstaffnotes_len check (
  length(super_staff_notes) between 1 and 2000);

