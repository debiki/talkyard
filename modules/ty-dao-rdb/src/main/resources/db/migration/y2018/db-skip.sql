--------------------
-- Need not increment the user avatar hash path length? Because it's always
-- controlled by Talkyard code: avatars are uplaoded & stored locally,
-- with a local Talkyard generated restricted-length path?
-- So, skip:
alter table users3 drop constraint dw1_users_avatartinybaseurl__c_len;
alter table users3 drop constraint dw1_users_avatarsmallbaseurl__c_len;
alter table users3 drop constraint dw1_users_avatarmediumbaseurl__c_len;

alter table users3 add constraint pps_c_avatartinybaseurl_len check (length(avatar_tiny_base_url) between 1 and 500);
alter table users3 add constraint pps_c_avatarsmallbaseurl_len check (length(avatar_small_base_url) between 1 and 500);
alter table users3 add constraint pps_c_avatarmediumbaseurl_len check (length(avatar_medium_base_url) between 1 and 500);
--------------------
