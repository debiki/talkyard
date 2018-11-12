
alter table blocks3 alter browser_id_cookie drop not null;

alter table spam_check_queue3 alter user_id_cookie drop not null;
alter table spam_check_queue3 rename user_id_cookie to browser_id_cookie;
