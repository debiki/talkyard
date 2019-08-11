
alter table invites3 add column start_at_url varchar;
alter table invites3 add constraint invites_c_startaturl_len check (
    length(start_at_url) between 1 and 100);

alter table invites3 add column add_to_group_id int;
alter table invites3 add constraint invites_addtogroup_r_users
    foreign key (site_id, add_to_group_id) references users3 (site_id, user_id) deferrable;

