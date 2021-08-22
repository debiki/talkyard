alter table notifications3 drop constraint dw1_notfs_type__c_in;
update notifications3 set notf_type = notf_type + 300;
update notifications3 set notf_type = 406 where notf_type = 306;
alter table notifications3 add constraint notfs_c_notftype_range check (notf_type between 101 and 999);


alter table settings3 drop constraint settings3_auth_guest__c;
alter table settings3 add constraint settings_c_guestlogin_auth check (not (
    allow_guest_login and (
        user_must_be_auth or user_must_be_approved or invite_only)));

