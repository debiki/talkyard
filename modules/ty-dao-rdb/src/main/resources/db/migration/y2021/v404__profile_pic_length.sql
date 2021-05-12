
-- A Google profile pic URL was 830 chars, so let's allow up to, hmm,
-- 2100, because there has to be *some* max limit, and IE11 apparently cuts urls
-- at 2083 chars (URL path max 2048 chars).
-- https://support.microsoft.com/en-us/topic/maximum-url-length-is-2-083-characters-in-internet-explorer-174e7c8a-6666-f4e0-6fd6-908b53c12246
--
create domain pic_url_d as varchar;
alter domain pic_url_d add constraint picurl_c_len_gz check (length(value) > 0);
alter domain pic_url_d add constraint picurl_c_len_max check (length(value) <= 2100);

alter table identities3 drop constraint idtys_c_pictureurl_len;
alter table identities3 alter column picture_url_c type pic_url_d;

