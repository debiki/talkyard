
alter table invites3 add column start_at_url varchar;
alter table invites3 add constraint invites_c_startaturl_len check (
    length(start_at_url) between 1 and 100);

alter table invites3 add column add_to_group_id int;
alter table invites3 add constraint invites_addtogroup_r_pps -- ix: invites_i_addtogroupid
    foreign key (site_id, add_to_group_id) references users3 (site_id, user_id) deferrable;

create index invites_i_addtogroupid on invites3 (site_id, add_to_group_id)
    where add_to_group_id is not null;

