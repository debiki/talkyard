
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


