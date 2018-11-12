-- This evolution starts using Null instead of "" if email absent (it is for Twitter users).

alter table DW1_IDS_OPENID alter column EMAIL drop not null;
update DW1_IDS_OPENID set EMAIL = null where length(EMAIL) = 0;
alter table DW1_IDS_OPENID add constraint DW1_IDS_EMAIL__C_LEN check (length(EMAIL) between 1 and 100);

