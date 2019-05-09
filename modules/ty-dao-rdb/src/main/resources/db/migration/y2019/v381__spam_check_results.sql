
delete from spam_check_queue3;

alter table spam_check_queue3 rename column user_id to author_id;
alter table spam_check_queue3 rename column action_at to created_at;
alter table spam_check_queue3 drop column inserted_at;

alter table spam_check_queue3 add column post_nr int;
alter table spam_check_queue3 add column page_id varchar;
alter table spam_check_queue3 add column page_type int;
alter table spam_check_queue3 add column page_available_at timestamp;
alter table spam_check_queue3 add column author_name varchar;
alter table spam_check_queue3 add column author_email_addr varchar;
alter table spam_check_queue3 add column author_trust_level int;
alter table spam_check_queue3 add column author_url varchar;
alter table spam_check_queue3 add column html_to_spam_check varchar;
alter table spam_check_queue3 add column language varchar;

alter table spam_check_queue3 add constraint spamcheckqueue_c_post_null_eq check (
    (post_id is null) = (post_nr is null) and
    (post_id is null) = (post_rev_nr is null) and
    (post_id is null) = (page_id is null) and
    (post_id is null) = (page_type is null) and
    (post_id is null) = (page_available_at is null) and
    (post_id is null) = (language is null));

alter table spam_check_queue3 add constraint spamcheckqueue_c_post_html_null check (
    (post_id is null) or (html_to_spam_check is not null));

alter table spam_check_queue3 add constraint spamcheckqueue_c_authorname_len check (
    length(author_name) between 1 and 200);

alter table spam_check_queue3 add constraint spamcheckqueue_c_authoremailaddr_len check (
    length(author_email_addr) between 1 and 200);

alter table spam_check_queue3 add constraint spamcheckqueue_c_trustlevel_betw check (
    author_trust_level between 1 and 6);

alter table spam_check_queue3 add constraint spamcheckqueue_c_authorurl_len check (
    length(author_url) between 1 and 200);

alter table spam_check_queue3 add constraint spamcheckqueue_c_htmltospamcheck_len check (
    length(html_to_spam_check) between 1 and 20200);

alter table spam_check_queue3 add constraint spamcheckqueue_c_language_len check (
    length(language) between 1 and 200);


alter table spam_check_queue3 add column results_at timestamp;
alter table spam_check_queue3 add column results_json jsonb;
alter table spam_check_queue3 add column results_text varchar;
alter table spam_check_queue3 add column num_is_spam_results int;
alter table spam_check_queue3 add column num_not_spam_results int;
alter table spam_check_queue3 add column human_says_is_spam bool;
alter table spam_check_queue3 add column is_misclassified bool; -- dupl data, for simpler lookup
alter table spam_check_queue3 add column misclassifications_reported_at timestamp;

alter table spam_check_queue3 add constraint spamcheckqueue_c_results_null_eq check (
    (results_at is null) = (results_json is null) and
    (results_at is null) = (num_is_spam_results is null) and
    (results_at is null) = (num_not_spam_results is null));

alter table spam_check_queue3 add constraint spamcheckqueue_c_resultstext_null check (
    (results_at is not null) or (results_text is null));

alter table spam_check_queue3 add constraint spamcheckqueue_c_ismiscl_null check (
    (results_at is not null and human_says_is_spam is not null) = (is_misclassified is not null));

alter table spam_check_queue3 add constraint spamcheckqueue_c_results_before_report_miscl check (
    (results_json is not null and human_says_is_spam is not null)
    or (misclassifications_reported_at is null));

-- json and text result fields 2 x larger than the text to spam check --
-- because what if it's links only, all of them echoed in the results?

alter table spam_check_queue3 add constraint spamcheckqueue_c_resultsjson_len check (
    pg_column_size(results_json) between 2 and 40400);

alter table spam_check_queue3 add constraint spamcheckqueue_c_resultstext_len check (
    length(results_text) between 0 and 40400);

alter table spam_check_queue3 drop constraint scq_site_post__p;
alter table spam_check_queue3 add constraint scq_site_postid_revnr__p primary key (
    site_id, post_id, post_rev_nr);

create index spamcheckqueue_next_miscl_i on spam_check_queue3 (results_at asc)
  where
    is_misclassified and
    misclassifications_reported_at is null;


alter table settings3 add column enable_stop_forum_spam bool;
alter table settings3 add column send_email_to_stop_forum_spam bool;
alter table settings3 add column enable_akismet bool;
alter table settings3 add column send_email_to_akismet bool;
alter table settings3 add column akismet_api_key varchar;

alter table settings3 add constraint settings3_c_akismetapikey_len check (
    length(akismet_api_key) between 1 and 200);

alter table settings3 add constraint settings_forum_features check (
    enable_forum is not false or (
        show_categories = false and
        enable_tags = false and
        enable_chat = false and
        enable_direct_messages = false and
        show_sub_communities is not true and  -- default: false
        show_topic_filter = false and
        show_topic_types = false and
        select_topic_type = false and
        experimental is not true and  -- default: false
        embedded_comments_category_id is null));
