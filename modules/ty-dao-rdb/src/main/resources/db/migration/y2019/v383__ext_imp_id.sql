
alter table users3 add column ext_imp_id varchar default null;
alter table pages3 add column ext_imp_id varchar default null;
alter table posts3 add column ext_imp_id varchar default null;
alter table categories3 add column ext_imp_id varchar default null;

alter table users3 add constraint participants_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table users3 add constraint participants_c_extimpid_not_builtin check (
    ext_imp_id is null or not user_id between -9 and 99);

alter table pages3 add constraint pages_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table posts3 add constraint posts_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);

alter table categories3 add constraint categories_c_extimpid_len check (
    length(ext_imp_id) between 1 and 100);



alter table users3 add constraint participants_c_member_id_not_for_imp check (user_id < 2000000000);
alter table users3 add constraint participants_c_guest_id_not_for_imp check (user_id > -2000000000);
alter table pages3 add constraint pages_c_id_not_for_imp check (page_id not like '200???????');
alter table posts3 add constraint posts_c_id_not_for_imp check (unique_post_id < 2000000000);
alter table posts3 add constraint posts_c_nr_not_for_imp check (post_nr < 2000000000);
alter table posts3 add constraint posts_c_parentnr_not_for_imp check (parent_nr < 2000000000);
alter table categories3 add constraint categories_c_id_not_for_imp check (id < 2000000000);

