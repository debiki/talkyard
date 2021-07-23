alter table sites3 add column super_staff_notes varchar;
alter table sites3 add constraint sites3_c_superstaffnotes_len check (
  length(super_staff_notes) between 1 and 2000);


alter table settings3 add column discussion_layout int;
alter table settings3 add constraint settings_c_discussionlayout check (
    discussion_layout between 0 and 100);

alter table settings3 add column disc_post_nesting int;
alter table settings3 add constraint settings_c_discpostnesting check (
    disc_post_nesting between -1 and 100);

alter table settings3 add column disc_post_sort_order int;
alter table settings3 add constraint settings_c_discpostsortorder check (
    disc_post_sort_order between 0 and 1000);

alter table settings3 add column progress_layout int;
alter table settings3 add constraint settings_c_progresslayout check (
    progress_layout between 0 and 100);

alter table settings3 add column progr_post_nesting int;
alter table settings3 add constraint settings_c_progrpostnesting check (
    progr_post_nesting between -1 and 100);

alter table settings3 add column progr_post_sort_order int;
alter table settings3 add constraint settings_c_progrpostsortorder check (
    progr_post_sort_order between 0 and 1000);

alter table settings3 add column orig_post_reply_btn_title varchar;
alter table settings3 add constraint settings_c_origpostreplybtntitle check (
    length(orig_post_reply_btn_title) between 1 and 100);

alter table settings3 add column orig_post_votes int;
alter table settings3 add constraint settings_c_origpostvotes check (
    orig_post_votes between 0 and 100);

