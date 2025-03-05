--
-- PostgreSQL database dump
--

-- Dumped from database version 10.23
-- Dumped by pg_dump version 10.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET SESSION AUTHORIZATION 'talkyard_test';

--
-- Data for Name: sites3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.sites3 (id, name, ctime, creator_ip, next_page_id, creator_email_address, rdb_quota_mibs_c, num_guests, num_identities, num_roles, num_role_settings, num_pages, num_posts, num_post_text_bytes, num_posts_read, num_actions, num_notfs, num_emails_sent, num_audit_rows, num_uploads, num_upload_bytes, version, num_post_revisions, num_post_rev_bytes, status, publ_id, super_staff_notes, feature_flags_c, deleted_at_c, auto_purge_at_c, purged_at_c, file_quota_mibs_c, max_upl_size_kibs_c, may_upl_pub_media_min_tr_lv_c, may_upl_pub_risky_min_tr_lv_c, may_upl_pub_safer_min_tr_lv_c, may_upl_priv_media_min_tr_lv_c, may_upl_priv_risky_min_tr_lv_c, may_upl_priv_safer_min_tr_lv_c, read_lims_mult_c, log_lims_mult_c, create_lims_mult_c) FROM stdin;
\.


--
-- Data for Name: pages3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.pages3 (site_id, page_id, page_role, category_id, created_at, updated_at, published_at, bumped_at, author_id, num_child_pages, embedding_page_url, num_likes, num_wrongs, deleted_at, num_replies_visible, num_replies_to_review, num_replies_total, num_bury_votes, num_unwanted_votes, last_reply_at, pin_order, pin_where, num_op_like_votes, num_op_wrong_votes, num_op_bury_votes, num_op_unwanted_votes, num_op_replies_visible, answered_at, answer_post_id, done_at, closed_at, locked_at, frozen_at, unwanted_at, planned_at, version, last_reply_by_id, frequent_poster_1_id, frequent_poster_2_id, frequent_poster_3_id, frequent_poster_4_id, html_tag_css_classes, html_head_title, html_head_description, layout, hidden_at, incl_in_summaries, started_at, postponed_til_c, num_posts_total, ext_id, num_op_do_it_votes_c, num_op_do_not_votes_c, answered_by_id_c, published_by_id_c, postponed_by_id_c, planned_by_id_c, started_by_id_c, paused_by_id_c, done_by_id_c, closed_by_id_c, locked_by_id_c, frozen_by_id_c, unwanted_by_id_c, hidden_by_id_c, deleted_by_id_c, forum_search_box_c, forum_main_view_c, forum_cats_topics_c, comt_order_c, comt_nesting_c, comts_start_hidden_c, comts_start_anon_c, new_anon_status_c) FROM stdin;
\.


--
-- Data for Name: alt_page_ids3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.alt_page_ids3 (site_id, alt_page_id, real_page_id) FROM stdin;
\.


--
-- Data for Name: users3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.users3 (site_id, user_id, full_name, primary_email_addr, country, website, is_admin, email_notfs, is_owner, username, email_verified_at, created_at, password_hash, email_for_every_new_post, guest_browser_id, is_approved, approved_at, approved_by_id, suspended_at, suspended_till, suspended_by_id, suspended_reason, updated_at, is_moderator, avatar_tiny_base_url, avatar_tiny_hash_path, avatar_small_base_url, avatar_small_hash_path, avatar_medium_base_url, avatar_medium_hash_path, trust_level, locked_trust_level, threat_level, locked_threat_level, is_superadmin, about, summary_email_interval_mins, summary_email_if_active, guest_email_addr, deactivated_at, deleted_at, may_see_my_activity_tr_lv_c, sso_id, ui_prefs, is_group, ext_id, max_upload_bytes_c, allowed_upload_extensions_c, may_search_engines_index_me_c, may_see_my_username_tr_lv_c, may_see_my_full_name_tr_lv_c, may_see_my_tiny_avatar_tr_lv_c, may_see_my_medium_avatar_tr_lv_c, may_see_my_brief_bio_tr_lv_c, may_see_my_full_bio_tr_lv_c, may_see_my_memberships_tr_lv_c, may_see_my_profile_tr_lv_c, may_see_me_in_lists_tr_lv_c, may_see_if_im_online_tr_lv_c, may_see_my_visit_stats_tr_lv_c, may_see_my_post_stats_tr_lv_c, may_see_my_approx_stats_tr_lv_c, may_see_my_exact_stats_tr_lv_c, may_find_me_by_email_tr_lv_c, may_follow_me_tr_lv_c, may_mention_me_tr_lv_c, may_mention_me_same_disc_tr_lv_c, may_dir_msg_me_tr_lv_c, why_may_not_mention_msg_me_html_c, may_see_my_account_email_adrs_tr_lv_c, may_see_my_contact_email_adrs_tr_lv_c, may_assign_me_tr_lv_c, may_see_my_assignments_tr_lv_c, email_threading_c, email_notf_details_c, tech_level_c, can_see_others_email_adrs_c, true_id_c, pseudonym_status_c, anonym_status_c, anon_on_page_id_st_c, anon_in_tree_id__later_c, mod_conf_c, may_set_rel_follow_c) FROM stdin;
\.


--
-- Data for Name: api_secrets3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.api_secrets3 (site_id, secret_nr, user_id, created_at, deleted_at, is_deleted, secret_key) FROM stdin;
\.


--
-- Data for Name: posts3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.posts3 (site_id, unique_post_id, page_id, post_nr, parent_nr, multireply, created_at, created_by_id, curr_rev_started_at, curr_rev_last_edited_at, curr_rev_by_id, last_approved_edit_at, last_approved_edit_by_id, num_distinct_editors, num_edit_suggestions, last_edit_suggestion_at, safe_rev_nr, approved_source, approved_html_sanitized, approved_at, approved_by_id, approved_rev_nr, curr_rev_source_patch, curr_rev_nr, collapsed_status, collapsed_at, collapsed_by_id, closed_status, closed_at, closed_by_id, hidden_at, hidden_by_id, hidden_reason, deleted_status, deleted_at, deleted_by_id, pinned_position, pinned_at, pinned_by_id, num_pending_flags, num_handled_flags, num_like_votes, num_wrong_votes, num_times_read, num_bury_votes, num_unwanted_votes, type, prev_rev_nr, branch_sideways, ext_id, smtp_msg_id_prefix_c, private_pats_id_c, sub_type_c, val_i32_c, postponed_status_c, answered_status_c, doing_status_c, review_status_c, unwanted_status_c, flagged_status_c, hidden_status_c, index_prio_c, private_status_c, creator_status_c, order_c) FROM stdin;
\.


--
-- Data for Name: sessions_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.sessions_t (site_id_c, pat_id_c, created_at_c, deleted_at_c, expired_at_c, version_c, start_ip_c, start_browser_id_c, start_headers_c, part_1_comp_id_c, hash_2_for_embg_storage_c, hash_3_for_dir_js_c, hash_4_http_only_c, hash_5_strict_c) FROM stdin;
\.


--
-- Data for Name: audit_log3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.audit_log3 (site_id, audit_id, doer_id_c, done_at, did_what, details, ip, browser_id_cookie, browser_fingerprint, anonymity_network, country, region, city, page_id, page_role, post_id, post_nr, post_action_type, post_action_sub_id, target_page_id, target_post_id, target_post_nr, target_pat_id_c, target_site_id, size_bytes, upload_hash_path, upload_file_name, email_address, batch_id, forgotten, doer_true_id_c, target_pat_true_id_c, sess_id_part_1) FROM stdin;
\.


--
-- Data for Name: backup_test_log3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.backup_test_log3 (logged_at, logged_by, backup_of_what, random_value, got_ok_message_at, file_name) FROM stdin;
\.


--
-- Data for Name: blocks3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.blocks3 (site_id, threat_level, blocked_at, blocked_till, blocked_by_id, ip, browser_id_cookie) FROM stdin;
\.


--
-- Data for Name: categories3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.categories3 (site_id, id, page_id, parent_id, name, slug, "position", description, new_topic_types, created_at, updated_at, locked_at, frozen_at, deleted_at, unlist_category, staff_only, only_staff_may_create_topics, default_topic_type, default_category_id, incl_in_summaries, unlist_topics, ext_id, def_sort_order_c, def_score_alg_c, def_score_period_c, do_vote_style_c, do_vote_in_topic_list_c, comt_order_c, comt_nesting_c, comts_start_hidden_c, comts_start_anon_c, op_starts_anon_c, new_anon_status_c) FROM stdin;
\.


--
-- Data for Name: drafts3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.drafts3 (site_id, by_user_id, draft_nr, draft_type, created_at, last_edited_at, deleted_at, category_id, to_user_id, topic_type, page_id, post_nr, post_id, post_type, title, text, new_anon_status_c, post_as_id_c, order_c) FROM stdin;
\.


--
-- Data for Name: tagtypes_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.tagtypes_t (site_id_c, id_c, can_tag_what_c, scoped_to_pat_id_c, is_personal, url_slug_c, disp_name_c, long_name_c, abbr_name_c, descr_page_id_c, descr_url_c, text_color_c, handle_color_c, background_color_c, css_class_suffix_c, sort_order_c, created_by_id_c, deleted_by_id_c, merged_into_tagtype_id_c, merged_by_id_c, ref_id_c, wants_value_c, value_type_c) FROM stdin;
\.


--
-- Data for Name: tags_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.tags_t (site_id_c, id_c, tagtype_id_c, parent_tag_id_c, on_pat_id_c, on_post_id_c, val_type_c, val_i32_c, val_f64_c, val_str_c, val_url_c, val_jsonb_c, val_i32_b_c, val_f64_b_c) FROM stdin;
\.


--
-- Data for Name: emails_out3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.emails_out3 (site_id, email_id_c, sent_to, sent_on, subject, body_html, provider_email_id, failure_type, failure_text, failure_time, out_type_c, created_at, to_user_id, can_login_again, sent_from_c, num_replies_back_c, secret_value_c, secret_status_c, smtp_msg_id_c, smtp_in_reply_to_c, smtp_in_reply_to_more_c, smtp_references_c, by_pat_id_c, about_pat_id_c, about_cat_id_c, about_tag_id_c, about_page_id_str_c, about_page_id_int_c, about_post_id_c, about_post_nr_c, about_parent_nr_c, out_sub_type_c) FROM stdin;
\.


--
-- Data for Name: flyway_schema_history; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.flyway_schema_history (installed_rank, version, description, type, script, checksum, installed_by, installed_on, execution_time, success) FROM stdin;
1	1	base version	SQL	y2016/v1__base_version.sql	-727462444	talkyard_test	2025-03-05 08:28:07.909326	1426	t
2	2	rename tables	SQL	y2016/v2__rename_tables.sql	572600308	talkyard_test	2025-03-05 08:28:07.909326	490	t
3	3	unknown user	SQL	y2016/v3__unknown_user.sql	1245706671	talkyard_test	2025-03-05 08:28:07.909326	16	t
4	4	index queue	SQL	y2016/v4__index_queue.sql	-284517594	talkyard_test	2025-03-05 08:28:07.909326	34	t
5	5	superadmin	SQL	y2016/v5__superadmin.sql	496339035	talkyard_test	2025-03-05 08:28:07.909326	42	t
6	6	branch sideways	SQL	y2016/v6__branch_sideways.sql	573053669	talkyard_test	2025-03-05 08:28:07.909326	13	t
7	7	tags	SQL	y2016/v7__tags.sql	802633438	talkyard_test	2025-03-05 08:28:07.909326	110	t
8	8	system user id 1	SQL	y2016/v8__system_user_id_1.sql	-506319812	talkyard_test	2025-03-05 08:28:10.355003	189	t
9	9	spam check queue	SQL	y2016/v9__spam_check_queue.sql	-276980512	talkyard_test	2025-03-05 08:28:10.355003	40	t
10	10	remove constraint	SQL	y2016/v10__remove_constraint.sql	-964907613	talkyard_test	2025-03-05 08:28:10.355003	18	t
11	11	topic list style	SQL	y2016/v11__topic_list_style.sql	139038933	talkyard_test	2025-03-05 08:28:10.355003	69	t
12	12	spam settings	SQL	y2016/v12__spam_settings.sql	636064645	talkyard_test	2025-03-05 08:28:10.355003	173	t
13	13	page hidden at	SQL	y2016/v13__page_hidden_at.sql	1045769495	talkyard_test	2025-03-05 08:28:10.355003	32	t
14	14	more settings	SQL	y2016/v14__more_settings.sql	-1713442076	talkyard_test	2025-03-05 08:28:10.355003	39	t
15	15	change usernamed	SQL	y2016/v15__change_usernamed.sql	276428427	talkyard_test	2025-03-05 08:28:10.355003	31	t
16	16	show settings	SQL	y2016/v16__show_settings.sql	-880834571	talkyard_test	2025-03-05 08:28:10.355003	22	t
17	17	check names trimmed	SQL	y2016/v17__check_names_trimmed.sql	-1160085899	talkyard_test	2025-03-05 08:28:10.355003	50	t
18	18	forum settings user stats	SQL	y2017/v18__forum_settings_user_stats.sql	101136689	talkyard_test	2025-03-05 08:28:10.355003	218	t
19	19	site id int perms on pages	SQL	y2017/v19__site_id_int_perms_on_pages.sql	-763558640	talkyard_test	2025-03-05 08:28:10.355003	1636	t
20	20	migr perms	SQL	y2017/v20__migr_perms.sql	791727557	talkyard_test	2025-03-05 08:28:10.355003	269	t
21	21	username lowercase	SQL	y2017/v21__username_lowercase.sql	1433859473	talkyard_test	2025-03-05 08:28:10.355003	14	t
22	22	backup test log	SQL	y2017/v22__backup_test_log.sql	-1165483807	talkyard_test	2025-03-05 08:28:10.355003	23	t
23	23	no email	SQL	y2017/v23__no_email.sql	-1000765616	talkyard_test	2025-03-05 08:28:10.355003	43	t
24	24	page pop	SQL	y2017/v24__page_pop.sql	1468496267	talkyard_test	2025-03-05 08:28:10.355003	30	t
25	25	summary emails	SQL	y2017/v25__summary_emails.sql	893766549	talkyard_test	2025-03-05 08:28:10.355003	53	t
26	26	nulls last	SQL	y2017/v26__nulls_last.sql	674610625	talkyard_test	2025-03-05 08:28:10.355003	20	t
27	27	plan done any role	SQL	y2017/v27__plan_done_any_role.sql	-340569622	talkyard_test	2025-03-05 08:28:10.355003	22	t
28	28	allow embedding	SQL	y2017/v28__allow_embedding.sql	1625446271	talkyard_test	2025-03-05 08:28:10.355003	30	t
29	29	remove columns	SQL	y2017/v29__remove_columns.sql	1570377368	talkyard_test	2025-03-05 08:28:10.355003	19	t
30	30	page started at wait until	SQL	y2017/v30__page_started_at_wait_until.sql	-1552258202	talkyard_test	2025-03-05 08:28:10.355003	24	t
31	31	num posts total	SQL	y2017/v31__num_posts_total.sql	1992348397	talkyard_test	2025-03-05 08:28:10.355003	82	t
32	32	page constraints	SQL	y2017/v32__page_constraints.sql	-817690068	talkyard_test	2025-03-05 08:28:10.355003	20	t
33	33	many emails	SQL	y2018/v33__many_emails.sql	-796113826	talkyard_test	2025-03-05 08:28:10.355003	97	t
34	34	longer allow embedding	SQL	y2018/v34__longer_allow_embedding.sql	-408237425	talkyard_test	2025-03-05 08:28:10.355003	18	t
35	35	sub communities lang delete user	SQL	y2018/v35__sub_communities_lang_delete_user.sql	-597571236	talkyard_test	2025-03-05 08:28:10.355003	93	t
36	36	publ site id	SQL	y2018/v36__publ_site_id.sql	49478103	talkyard_test	2025-03-05 08:28:10.355003	27	t
37	367	more settings	SQL	y2018/v367__more_settings.sql	-816266437	talkyard_test	2025-03-05 08:28:10.355003	51	t
38	368	no browser id cookie	SQL	y2018/v368__no_browser_id_cookie.sql	95817395	talkyard_test	2025-03-05 08:28:10.355003	19	t
39	369	cache many undo review	SQL	y2018/v369__cache_many_undo_review.sql	-1953186348	talkyard_test	2025-03-05 08:28:10.355003	89	t
40	370	bump after close	SQL	y2018/v370__bump_after_close.sql	-122145770	talkyard_test	2025-03-05 08:28:10.355003	15	t
41	371	drafts	SQL	y2018/v371__drafts.sql	1199994399	talkyard_test	2025-03-05 08:28:10.355003	137	t
42	372	sso and api	SQL	y2018/v372__sso_and_api.sql	47362569	talkyard_test	2025-03-05 08:28:10.355003	62	t
43	373	sso settings	SQL	y2018/v373__sso_settings.sql	1149354265	talkyard_test	2025-03-05 08:28:10.355003	48	t
44	374	many invites	SQL	y2018/v374__many_invites.sql	-1785164277	talkyard_test	2025-03-05 08:28:10.355003	29	t
45	375	more notfs	SQL	y2018/v375__more_notfs.sql	1246495568	talkyard_test	2025-03-05 08:28:10.355003	71	t
46	376	guest id constr	SQL	y2018/v376__guest_id_constr.sql	1203524809	talkyard_test	2025-03-05 08:28:10.355003	21	t
47	377	tour tips seen	SQL	y2019/v377__tour_tips_seen.sql	519634386	talkyard_test	2025-03-05 08:28:10.355003	41	t
48	378	more settings	SQL	y2019/v378__more_settings.sql	-1604557268	talkyard_test	2025-03-05 08:28:10.355003	52	t
49	379	tos privacy settings	SQL	y2019/v379__tos_privacy_settings.sql	-817508427	talkyard_test	2025-03-05 08:28:10.355003	58	t
50	380	review task notfs	SQL	y2019/v380__review_task_notfs.sql	397156776	talkyard_test	2025-03-05 08:28:10.355003	35	t
51	381	spam check results	SQL	y2019/v381__spam_check_results.sql	-1283282401	talkyard_test	2025-03-05 08:28:10.355003	182	t
52	382	group members	SQL	y2019/v382__group_members.sql	140221294	talkyard_test	2025-03-05 08:28:10.355003	245	t
53	383	ext imp id	SQL	y2019/v383__ext_imp_id.sql	-1822653912	talkyard_test	2025-03-05 08:28:10.355003	252	t
54	384	invites add to group	SQL	y2019/v384__invites_add_to_group.sql	-1913758189	talkyard_test	2025-03-05 08:28:10.355003	38	t
55	385	sso logout url	SQL	y2019/v385__sso_logout_url.sql	1720665599	talkyard_test	2025-03-05 08:28:10.355003	28	t
56	386	guests wo browserid use extid	SQL	y2019/v386__guests_wo_browserid_use_extid.sql	-1673248708	talkyard_test	2025-03-05 08:28:10.355003	22	t
57	387	email length	SQL	y2019/v387__email_length.sql	679940910	talkyard_test	2025-03-05 08:28:10.355003	27	t
58	388	rm email notf char check	SQL	y2019/v388__rm_email_notf_char_check.sql	-1929093210	talkyard_test	2025-03-05 08:28:10.355003	18	t
59	389	backup test log	SQL	y2020/v389__backup_test_log.sql	-1951608989	talkyard_test	2025-03-05 08:28:10.355003	23	t
60	390	sort order	SQL	y2020/v390__sort_order.sql	-576869395	talkyard_test	2025-03-05 08:28:10.355003	73	t
61	391	root cat slug	SQL	y2020/v391__root_cat_slug.sql	142429088	talkyard_test	2025-03-05 08:28:10.355003	15	t
62	392	cors settings	SQL	y2020/v392__cors_settings.sql	-2041883709	talkyard_test	2025-03-05 08:28:10.355003	27	t
63	393	nav conf settings	SQL	y2020/v393__nav_conf_settings.sql	1106338264	talkyard_test	2025-03-05 08:28:10.355003	18	t
64	394	settings	SQL	y2020/v394__settings.sql	377311522	talkyard_test	2025-03-05 08:28:10.355003	24	t
65	395	appr bef settings	SQL	y2020/v395__appr_bef_settings.sql	1583737954	talkyard_test	2025-03-05 08:28:10.355003	42	t
66	396	links	SQL	y2020/v396__links.sql	-140527013	talkyard_test	2025-03-05 08:28:10.355003	186	t
67	397	oidc	SQL	y2020/v397__oidc.sql	-1203090243	talkyard_test	2025-03-05 08:28:10.355003	248	t
68	398	max html length	SQL	y2020/v398__max_html_length.sql	806628551	talkyard_test	2025-03-05 08:28:10.355003	85	t
69	399	site feature flags	SQL	y2020/v399__site_feature_flags.sql	373903712	talkyard_test	2025-03-05 08:28:10.355003	24	t
70	400	missing fx ix	SQL	y2020/v400__missing_fx_ix.sql	937288584	talkyard_test	2025-03-05 08:28:10.355003	26	t
71	401	sort and media settings	SQL	y2020/v401__sort_and_media_settings.sql	-50029795	talkyard_test	2025-03-05 08:28:10.355003	58	t
72	402	idp verif email domains	SQL	y2020/v402__idp_verif_email_domains.sql	1952102033	talkyard_test	2025-03-05 08:28:10.355003	249	t
73	403	settings purge sites	SQL	y2021/v403__settings_purge_sites.sql	-834613136	talkyard_test	2025-03-05 08:28:10.355003	431	t
74	404	profile pic length	SQL	y2021/v404__profile_pic_length.sql	878504063	talkyard_test	2025-03-05 08:28:10.355003	61	t
75	405	email secrets	SQL	y2021/v405__email_secrets.sql	-2011581856	talkyard_test	2025-03-05 08:28:10.355003	187	t
76	406	emb coms sso	SQL	y2021/v406__emb_coms_sso.sql	433231092	talkyard_test	2025-03-05 08:28:10.355003	240	t
77	407	upvote features	SQL	y2021/v407__upvote_features.sql	731886288	talkyard_test	2025-03-05 08:28:10.355003	549	t
78	408	email from name	SQL	y2021/v408__email_from_name.sql	-664044438	talkyard_test	2025-03-05 08:28:10.355003	165	t
79	409	notices	SQL	y2021/v409__notices.sql	-685913243	talkyard_test	2025-03-05 08:28:10.355003	41	t
80	410	tags refactored	SQL	y2021/v410__tags_refactored.sql	-1652918705	talkyard_test	2025-03-05 08:28:10.355003	317	t
81	411	sessions t	SQL	y2021/v411__sessions_t.sql	-1877602703	talkyard_test	2025-03-05 08:28:10.355003	90	t
82	412	forum search box	SQL	y2021/v412__forum_search_box.sql	-565087383	talkyard_test	2025-03-05 08:28:10.355003	356	t
83	413	webhooks	SQL	y2022/v413__webhooks.sql	-1432159100	talkyard_test	2025-03-05 08:28:10.355003	304	t
84	414	webhooks constr	SQL	y2022/v414__webhooks_constr.sql	1785532274	talkyard_test	2025-03-05 08:28:10.355003	41	t
85	415	drop reply at constr	SQL	y2022/v415__drop_reply_at_constr.sql	-611779909	talkyard_test	2025-03-05 08:28:10.355003	19	t
86	416	may and msg id	SQL	y2022/v416__may_and_msg_id.sql	-1882521740	talkyard_test	2025-03-05 08:28:10.355003	1621	t
87	417	smtp id pat rels	SQL	y2022/v417__smtp_id_pat_rels.sql	-2106429809	talkyard_test	2025-03-05 08:28:10.355003	1924	t
88	418	comment sort deindex	SQL	y2022/v418__comment_sort_deindex.sql	623946678	talkyard_test	2025-03-05 08:28:10.355003	346	t
89	419	anon posts disc prefs	SQL	y2023/v419__anon_posts_disc_prefs.sql	-2067459438	talkyard_test	2025-03-05 08:28:10.355003	582	t
90	420	ugc domain sort ideas	SQL	y2023/v420__ugc_domain_sort_ideas.sql	-620797304	talkyard_test	2025-03-05 08:28:10.355003	107	t
91	421	sys settings	SQL	y2023/v421__sys_settings.sql	-1631097564	talkyard_test	2025-03-05 08:28:10.355003	73	t
92	422	maint msg	SQL	y2023/v422__maint_msg.sql	-1807416722	talkyard_test	2025-03-05 08:28:10.355003	73	t
93	423	type val type	SQL	y2023/v423__type_val_type.sql	2608574	talkyard_test	2025-03-05 08:28:10.355003	118	t
94	424	job queue	SQL	y2023/v424__job_queue.sql	1917090791	talkyard_test	2025-03-05 08:28:10.355003	113	t
95	425	term sess more conf	SQL	y2024/v425__term_sess_more_conf.sql	-1604725190	talkyard_test	2025-03-05 08:28:10.355003	169	t
96	426	bookmarks	SQL	y2024/v426__bookmarks.sql	1068168016	talkyard_test	2025-03-05 08:28:10.355003	221	t
97	\N	comments	SQL	r__comments.sql	658829823	talkyard_test	2025-03-05 08:28:10.355003	160	t
98	\N	functions	SQL	r__functions.sql	-1412307539	talkyard_test	2025-03-05 08:28:10.355003	38	t
99	\N	triggers	SQL	r__triggers.sql	1602437423	talkyard_test	2025-03-05 08:28:10.355003	174	t
\.


--
-- Data for Name: group_participants3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.group_participants3 (site_id, group_id, participant_id, is_member, is_manager, is_adder, is_bouncer) FROM stdin;
\.


--
-- Data for Name: guest_prefs3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.guest_prefs3 (site_id, ctime, version, email, email_notfs) FROM stdin;
\.


--
-- Data for Name: hosts3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.hosts3 (site_id, host, canonical, ctime, mtime) FROM stdin;
\.


--
-- Data for Name: idps_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.idps_t (site_id_c, idp_id_c, protocol_c, alias_c, enabled_c, display_name_c, description_c, admin_comments_c, trust_verified_email_c, link_account_no_login_c, gui_order_c, sync_mode_c, oidc_config_url, oidc_config_fetched_at, oidc_config_json_c, oau_authorization_url_c, oau_auth_req_scope_c, oau_auth_req_claims_c, oau_auth_req_claims_locales_c, oau_auth_req_ui_locales_c, oau_auth_req_display_c, oau_auth_req_prompt_c, oau_auth_req_max_age_c, oau_auth_req_hosted_domain_c, oau_auth_req_access_type_c, oau_auth_req_include_granted_scopes_c, oau_access_token_url_c, oau_access_token_auth_method_c, oau_client_id_c, oau_client_secret_c, oau_issuer_c, oidc_user_info_url_c, oidc_user_info_fields_map_c, oidc_userinfo_req_send_user_ip_c, oidc_logout_url_c, email_verified_domains_c) FROM stdin;
\.


--
-- Data for Name: identities3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.identities3 (idty_id_c, site_id, user_id_c, user_id_orig_c, oid_claimed_id, oid_op_local_id, oid_realm, oid_endpoint, oid_version, first_name_c, email_adr_c, country_c, inserted_at_c, last_name_c, full_name_c, picture_url_c, conf_file_idp_id_c, idp_user_id_c, broken_idp_sth_c, idp_id_c, oidc_id_token_str_c, oidc_id_token_json_c, idp_user_json_c, pref_username_c, idp_realm_id_c, idp_realm_user_id_c, issuer_c, is_email_verified_by_idp_c, nickname_c, middle_name_c, phone_nr_c, is_phone_nr_verified_by_idp_c, profile_url_c, website_url_c, gender_c, birthdate_c, time_zone_info_c, locale_c, is_realm_guest_c, last_updated_at_idp_at_sec_c) FROM stdin;
\.


--
-- Data for Name: invites3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.invites3 (site_id, secret_key, email_address, created_by_id, created_at, accepted_at, user_id, deleted_at, deleted_by_id, invalidated_at, start_at_url, add_to_group_id) FROM stdin;
\.


--
-- Data for Name: job_queue_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.job_queue_t (inserted_at, action_at, site_id, site_version, page_id, page_version, post_id, post_rev_nr, cat_id_c, pat_id_c, type_id_c, time_range_from_c, time_range_from_ofs_c, time_range_to_c, time_range_to_ofs_c, do_what_c) FROM stdin;
\.


--
-- Data for Name: link_previews_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.link_previews_t (site_id_c, link_url_c, fetched_from_url_c, fetched_at_c, cache_max_secs_c, status_code_c, preview_type_c, first_linked_by_id_c, content_json_c) FROM stdin;
\.


--
-- Data for Name: links_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.links_t (site_id_c, from_post_id_c, link_url_c, added_at_c, added_by_id_c, is_external_c, to_staff_space_c, to_page_id_c, to_post_id_c, to_pat_id_c, to_tag_id_c, to_category_id_c) FROM stdin;
\.


--
-- Data for Name: notices_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.notices_t (site_id_c, to_pat_id_c, notice_id_c, first_at_c, last_at_c, num_total_c, notice_data_c) FROM stdin;
\.


--
-- Data for Name: post_actions3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.post_actions3 (site_id, action_id, to_post_id_c, page_id, post_nr, rel_type_c, sub_type_c, from_pat_id_c, created_at, updated_at, deleted_at, deleted_by_id, to_post_rev_nr_c, dormant_status_c, val_i32_c, from_true_id_c, added_by_id_c, order_c) FROM stdin;
\.


--
-- Data for Name: notifications3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.notifications3 (site_id, notf_type, created_at, about_page_id_str_c, by_user_id, to_user_id, email_id, email_status, seen_at, about_post_id_c, action_type, action_sub_id, notf_id, smtp_msg_id_prefix_c, about_page_id_int_c, about_pat_id_c, about_cat_id_c, about_tag_id_c, about_thing_type_c, about_sub_type_c, by_true_id_c, to_true_id_c) FROM stdin;
\.


--
-- Data for Name: page_html_cache_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.page_html_cache_t (site_id_c, page_id_c, param_width_layout_c, param_is_embedded_c, param_origin_or_empty_c, param_cdn_origin_or_empty_c, cached_site_version_c, cached_page_version_c, cached_app_version_c, cached_store_json_hash_c, updated_at_c, cached_store_json_c, cached_html_c, param_comt_order_c, param_comt_nesting_c, param_ugc_origin_or_empty_c, param_theme_id_c_u) FROM stdin;
\.


--
-- Data for Name: page_notf_prefs_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.page_notf_prefs_t (site_id, pat_id_c, notf_level, page_id, pages_in_whole_site_c, pages_in_cat_id_c, incl_sub_cats_c, pages_pat_created_c, pages_pat_replied_to_c) FROM stdin;
\.


--
-- Data for Name: page_paths3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.page_paths3 (site_id, parent_folder, page_id, show_id, page_slug, cdati, canonical_dati, canonical) FROM stdin;
\.


--
-- Data for Name: page_popularity_scores3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.page_popularity_scores3 (site_id, page_id, popular_since, updated_at, score_alg_c, day_score, week_score, month_score, quarter_score, year_score, all_score, triennial_score_c) FROM stdin;
\.


--
-- Data for Name: page_users3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.page_users3 (site_id, page_id, user_id, joined_by_id, kicked_by_id, notf_level, notf_reason, num_seconds_reading, num_low_posts_read, first_visited_at_mins, last_visited_at_mins, last_viewed_post_nr, last_read_at_mins, last_read_post_nr, recently_read_nrs, low_post_nrs_read, incl_in_summary_email_at_mins) FROM stdin;
\.


--
-- Data for Name: perms_on_pages3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.perms_on_pages3 (site_id, perm_id, for_people_id, on_whole_site, on_category_id, on_page_id, on_post_id, on_tag_id, may_edit_page, may_edit_comment, may_edit_wiki, may_edit_own, may_delete_page, may_delete_comment, may_create_page, may_post_comment, may_see, may_see_own, may_see_private_flagged, can_see_others_priv_c, can_see_who_can_see_c, can_see_priv_aft_c, can_post_private_c, can_delete_own_c, can_alter_c, is_owner_c, on_pats_id_c, can_manage_pats_c, can_invite_pats_c, can_suspend_pats_c, can_assign_pats_c, can_assign_self_c, can_see_assigned_c) FROM stdin;
\.


--
-- Data for Name: post_read_stats3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.post_read_stats3 (site_id, page_id, post_nr, ip, user_id, read_at) FROM stdin;
\.


--
-- Data for Name: post_revisions3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.post_revisions3 (site_id, post_id, revision_nr, previous_nr, source_patch, full_source, title, composed_at, composed_by_id, approved_at, approved_by_id, hidden_at, hidden_by_id) FROM stdin;
\.


--
-- Data for Name: post_tags3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.post_tags3 (site_id, post_id, tag, is_page) FROM stdin;
\.


--
-- Data for Name: review_tasks3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.review_tasks3 (site_id, id, reasons, created_by_id, created_at, created_at_rev_nr, more_reasons_at, more_reasons_at_rev_nr, completed_at, decided_at_rev_nr, decided_by_id, invalidated_at, decision, about_pat_id_c, page_id, post_id, post_nr, decided_at) FROM stdin;
\.


--
-- Data for Name: settings3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.settings3 (site_id, category_id, page_id, user_must_be_auth, user_must_be_approved, allow_guest_login, num_first_posts_to_review, num_first_posts_to_approve, max_posts_pend_appr_before, head_styles_html, head_scripts_html, end_of_body_html, header_html, footer_html, horizontal_comments, social_links_html, logo_url_or_html, org_domain, org_full_name, org_short_name, contrib_agreement, content_license, google_analytics_id, experimental, many_sections, html_tag_css_classes, num_flags_to_hide_post, cooldown_minutes_after_flagged_hidden, num_flags_to_block_new_user, num_flaggers_to_block_new_user, notify_mods_if_user_blocked, regular_member_flag_weight, core_member_flag_weight, invite_only, allow_signup, allow_local_signup, show_categories, show_topic_filter, show_topic_types, select_topic_type, forum_main_view, forum_topics_sort_buttons, forum_category_links, forum_topics_layout, forum_categories_layout, require_verified_email, may_compose_before_signup, may_login_before_email_verified, double_type_email_address, double_type_password, beg_for_email_address, allow_embedding_from, show_sub_communities, language_code, enable_google_login, enable_facebook_login, enable_twitter_login, enable_github_login, email_domain_blacklist, email_domain_whitelist, show_author_how, watchbar_starts_open, favicon_url, enable_chat, enable_direct_messages, feature_flags, enable_sso, sso_url, sso_not_approved_url, expire_idle_after_mins, enable_gitlab_login, enable_linkedin_login, enable_vk_login, enable_instagram_login, enable_forum, enable_api, enable_tags, embedded_comments_category_id, terms_of_use_url, privacy_url, rules_url, contact_email_addr, contact_url, enable_stop_forum_spam, send_email_to_stop_forum_spam, enable_akismet, send_email_to_akismet, akismet_api_key, enable_similar_topics, sso_login_required_logout_url, discussion_layout, disc_post_nesting, disc_post_sort_order, progress_layout, progr_post_nesting, progr_post_sort_order, orig_post_reply_btn_title, orig_post_votes, enable_cors, allow_cors_from, allow_cors_creds, cache_cors_prefl_secs, nav_conf, start_of_body_html, appr_before_if_trust_lte, review_after_if_trust_lte, max_posts_pend_revw_aftr, enable_custom_idps, use_only_custom_idps, emb_com_sort_order_c, emb_com_nesting_c, enable_disagree_vote_c, sso_logout_redir_url_c, sso_show_emb_authn_btns_c, sso_paseto_v2_loc_secret_c, sso_paseto_v2_pub_pub_key_c, sso_refresh_authn_token_url_c, remember_emb_sess_c, expire_idle_emb_sess_after_mins_c, outbound_emails_from_name_c, outbound_emails_from_addr_c, outbound_emails_reply_to_c, outbound_emails_smtp_conf_c, commonmark_conf_c, can_remove_mod_reqmts_c, enable_anon_posts_c, ai_conf_c, enable_online_status_c, follow_links_to_c, own_domains_c, authn_diag_conf_c) FROM stdin;
\.


--
-- Data for Name: spam_check_queue3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.spam_check_queue3 (created_at, site_id, post_id, post_rev_nr, author_id_c, browser_id_cookie, browser_fingerprint, req_uri, req_ip, req_user_agent, req_referer, post_nr, page_id, page_type, page_available_at, author_name, author_email_addr, author_trust_level, author_url, html_to_spam_check, language, results_at, results_json, results_text, num_is_spam_results, num_not_spam_results, human_says_is_spam, is_misclassified, misclassifications_reported_at) FROM stdin;
\.


--
-- Data for Name: system_settings_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.system_settings_t (maintenance_until_unix_secs_c, maint_words_html_unsafe_c, maint_msg_html_unsafe_c) FROM stdin;
\N	\N	\N
\.


--
-- Data for Name: tag_notf_levels3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.tag_notf_levels3 (site_id, user_id, tag, notf_level) FROM stdin;
\.


--
-- Data for Name: upload_refs3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.upload_refs3 (site_id, post_id, base_url, hash_path, added_by_id, added_at, uploaded_file_name_c) FROM stdin;
\.


--
-- Data for Name: uploads3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.uploads3 (base_url, hash_path, original_hash_path, size_bytes, mime_type, width, height, uploaded_at, updated_at, num_references, verified_present_at, verified_absent_at, unused_since) FROM stdin;
\.


--
-- Data for Name: user_emails3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.user_emails3 (site_id, user_id, email_address, added_at, verified_at) FROM stdin;
\.


--
-- Data for Name: user_stats3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.user_stats3 (site_id, user_id, last_seen_at, last_posted_at, last_emailed_at, last_emaill_link_clicked_at, last_emaill_failed_at, email_bounce_sum, first_seen_at, first_new_topic_at, first_discourse_reply_at, first_chat_message_at, topics_new_since, notfs_new_since_id, num_days_visited, num_seconds_reading, num_discourse_replies_read, num_discourse_replies_posted, num_discourse_topics_entered, num_discourse_topics_replied_in, num_discourse_topics_created, num_chat_messages_read, num_chat_messages_posted, num_chat_topics_entered, num_chat_topics_replied_in, num_chat_topics_created, num_likes_given, num_likes_received, num_solutions_provided, last_summary_email_at, next_summary_maybe_at, tour_tips_seen, snooze_notfs_until, after_snooze_then) FROM stdin;
\.


--
-- Data for Name: user_visit_stats3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.user_visit_stats3 (site_id, user_id, visit_date, num_seconds_reading, num_discourse_replies_read, num_discourse_topics_entered, num_chat_messages_read, num_chat_topics_entered) FROM stdin;
\.


--
-- Data for Name: usernames3; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.usernames3 (site_id, username_lowercase, in_use_from, in_use_to, user_id, first_mention_at) FROM stdin;
\.


--
-- Data for Name: webhooks_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.webhooks_t (site_id_c, webhook_id_c, owner_id_c, run_as_id_c, enabled_c, deleted_c, descr_c, send_to_url_c, check_dest_cert_c, send_event_types_c, send_event_subtypes_c, api_version_c, to_ext_app_ver_c, send_max_reqs_per_sec_c, send_max_events_per_req_c, send_max_delay_secs_c, send_custom_headers_c, retry_max_secs_c, retry_extra_times_c, failed_since_c, last_failed_how_c, last_err_msg_or_resp_c, retried_num_times_c, retried_num_secs_c, broken_reason_c, sent_up_to_when_c, sent_up_to_event_id_c, num_pending_maybe_c, done_for_now_c) FROM stdin;
\.


--
-- Data for Name: webhook_reqs_out_t; Type: TABLE DATA; Schema: public; Owner: talkyard_test
--

COPY public.webhook_reqs_out_t (site_id_c, webhook_id_c, req_nr_c, sent_at_c, sent_as_id_c, sent_to_url_c, sent_by_app_ver_c, sent_api_version_c, sent_to_ext_app_ver_c, sent_event_types_c, sent_event_subtypes_c, sent_event_ids_c, sent_json_c, sent_headers_c, retry_nr_c, failed_at_c, failed_how_c, failed_msg_c, resp_at_c, resp_status_c, resp_status_text_c, resp_body_c, resp_headers_c) FROM stdin;
\.


--
-- Name: dw1_tenants_id; Type: SEQUENCE SET; Schema: public; Owner: talkyard_test
--

SELECT pg_catalog.setval('public.dw1_tenants_id', 10, false);


--
-- PostgreSQL database dump complete
--

