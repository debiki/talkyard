
alter table users3 drop constraint dw1_users_guestcookie__c_len;
alter table users3 rename guest_cookie to guest_browser_id;
alter table users3 add constraint users_c_guestbrowserid_len check (
  length(guest_browser_id) between 2 and 100);

