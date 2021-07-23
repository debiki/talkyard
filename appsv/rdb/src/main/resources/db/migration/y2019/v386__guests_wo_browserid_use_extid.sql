
drop index pps_u_site_guest_no_browser_id;
alter table users3 add constraint pps_c_guest_w_no_browserid_has_extid check (
    (user_id > 0) or (guest_browser_id is not null) or (ext_id is not null));

