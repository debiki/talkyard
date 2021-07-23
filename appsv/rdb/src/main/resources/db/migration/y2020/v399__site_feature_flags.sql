
alter table sites3 add column feature_flags_c varchar;
alter table sites3 add constraint sites3_c_featureflags_len check (
  length(feature_flags_c) between 1 and 500);
