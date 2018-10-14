
-- This constraint might contain many hostnames, so let it be fairly long.
alter table settings3 drop constraint settings_allowembeddingfrom__c_len;
alter table settings3 add constraint settings_c_allowembeddingfrom_btw_5_300 check (
  length(allow_embedding_from) between 5 and 300);

