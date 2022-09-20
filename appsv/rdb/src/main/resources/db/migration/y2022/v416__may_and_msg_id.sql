
-- Should be deferrable, forgot:
alter table page_popularity_scores3 alter constraint pagepopscores_r_pages deferrable;
alter table perms_on_pages3 alter constraint permsonpages_r_cats deferrable;
alter table perms_on_pages3 alter constraint permsonpages_r_pages deferrable;
alter table perms_on_pages3 alter constraint permsonpages_r_people deferrable;
alter table perms_on_pages3 alter constraint permsonpages_r_posts deferrable;
alter table link_previews_t alter constraint linkpreviews_firstlinkedby_r_pps deferrable;
alter table links_t alter constraint links_addedby_r_pps deferrable;
alter table links_t alter constraint links_frompostid_r_posts deferrable;
alter table links_t alter constraint links_tocatid_r_categories deferrable;
alter table links_t alter constraint links_topageid_r_pages deferrable;
alter table links_t alter constraint links_topostid_r_posts deferrable;
alter table links_t alter constraint links_toppid_r_pps deferrable;
alter table settings3 alter constraint settings_embcmtscatid_r_categories deferrable;
alter table webhook_reqs_out_t alter constraint webhookreqsout_sentasid_r_pats deferrable;
alter table webhook_reqs_out_t alter constraint webhookreqsout_webhookid_r_webhooks deferrable;
alter table webhooks_t alter constraint webhooks_ownerid_r_pats deferrable;
alter table webhooks_t alter constraint webhooks_r_sites deferrable;
alter table webhooks_t alter constraint webhooks_runasid_r_pats deferrable;



create domain text_nonempty_ste2000_trimmed_d text_nonempty_ste2000_d;
alter domain  text_nonempty_ste2000_trimmed_d add
   constraint text_nonempty_ste2000_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste4000_trimmed_d text_nonempty_ste4000_d;
alter domain  text_nonempty_ste4000_trimmed_d add
   constraint text_nonempty_ste4000_trimmed_d_c_trimmed check (is_trimmed(value));



create domain smtp_msg_id_out_prefix_d text_nonempty_ste60_trimmed_d;
alter domain  smtp_msg_id_out_prefix_d add
   constraint smtp_msg_id_out_prefix_d_c_chars check (
    value ~ '^[a-zA-Z0-9_.+-]*$');
comment on domain smtp_msg_id_out_prefix_d is
    'The start of a Talkyard generated SMTP Message-ID to the left of the "@".';

create domain smtp_msg_id_out_d text_nonempty_ste250_trimmed_d;
alter domain  smtp_msg_id_out_d add
   constraint smtp_msg_id_out_d_c_chars check (
    value ~ '^([a-zA-Z0-9_.+-]+@[a-z0-9_.-]+(:[0-9]+)?)?$');
comment on domain smtp_msg_id_out_d is
    'A Talkyard generated SMTP Message-ID, e.g. "abcd-123-456+hmm@forum.example.com".';


alter table posts3         add column smtp_msg_id_prefix_c  smtp_msg_id_out_prefix_d;
alter table notifications3 add column smtp_msg_id_prefix_c  smtp_msg_id_out_prefix_d;
alter table emails_out3    add column smtp_msg_id_c         smtp_msg_id_out_d;



alter table users3 add column may_search_engines_index_me_c     bool;
alter table users3 add column may_see_my_username_tr_lv_c       trust_level_or_staff_d;
alter table users3 add column may_see_my_full_name_tr_lv_c      trust_level_or_staff_d;
alter table users3 add column may_see_my_tiny_avatar_tr_lv_c    trust_level_or_staff_d;
alter table users3 add column may_see_my_medium_avatar_tr_lv_c  trust_level_or_staff_d;
alter table users3 add column may_see_my_brief_bio_tr_lv_c      trust_level_or_staff_d;
alter table users3 add column may_see_my_full_bio_tr_lv_c       trust_level_or_staff_d;
alter table users3 add column may_see_my_memberships_tr_lv_c    trust_level_or_staff_d;
alter table users3 add column may_see_my_profile_tr_lv_c        trust_level_or_staff_d;
alter table users3 add column may_see_me_in_users_list_tr_lv_c  trust_level_or_staff_d;

alter table users3 add column may_see_if_im_online_tr_lv_c      trust_level_or_staff_d;
alter table users3 rename column see_activity_min_trust_level to may_see_my_activity_tr_lv_c;
alter table users3 add column may_see_my_visit_stats_tr_lv_c    trust_level_or_staff_d;
alter table users3 add column may_see_my_post_stats_tr_lv_c     trust_level_or_staff_d;

-- Upcoming anon posts:
-- By looking at last visit date-time, reading time, and comparing with
-- anonymous posts, it could be possible to, in a small forum, knwo who posted an
-- anonymous post.  So, sometimes the stats should be hidden, or not too exact.
alter table users3 add column may_see_my_approx_stats_tr_lv_c   trust_level_or_staff_d;
alter table users3 add column may_see_my_exact_stats_tr_lv_c    trust_level_or_staff_d;


alter table users3 add column may_find_me_by_email_tr_lv_c      trust_level_or_staff_d;
alter table users3 add column may_follow_me_tr_lv_c             trust_level_or_staff_d;
alter table users3 add column may_mention_me_tr_lv_c            trust_level_or_staff_d;
alter table users3 add column may_mention_me_same_disc_tr_lv_c  trust_level_or_staff_d;
alter table users3 add column may_dir_msg_me_tr_lv_c            trust_level_or_staff_d;
alter table users3 add column why_may_not_mention_msg_me_html_c text_nonempty_ste500_trimmed_d;



alter table users3 add constraint pats_c_maymentionme_gte_samedisc check (
    may_mention_me_tr_lv_c >= may_mention_me_same_disc_tr_lv_c);

alter table users3 add constraint pats_c_mayseemymediumavatar_gte_tiny check (
    may_see_my_medium_avatar_tr_lv_c >= may_see_my_tiny_avatar_tr_lv_c);

alter table users3 add constraint pats_c_mayseemyfullbio_gte_briefbio check (
    may_see_my_full_bio_tr_lv_c >= may_see_my_brief_bio_tr_lv_c);



alter table settings3 add column commonmark_conf_c  jsonb_ste4000_d;
