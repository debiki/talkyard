

-- New domains
-------------------------------------------------

create domain text_nonempty_ste250_d text_nonempty_inf_d;
alter domain  text_nonempty_ste250_d add
   constraint text_nonempty_ste250_d_c_ste250 check (length(value) <= 250);

create domain text_nonempty_ste250_trimmed_d text_nonempty_ste250_d;
alter domain  text_nonempty_ste250_trimmed_d add
   constraint text_nonempty_ste250_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste500_d text_nonempty_inf_d;
alter domain  text_nonempty_ste500_d add
   constraint text_nonempty_ste500_d_c_ste500 check (length(value) <= 500);

create domain text_nonempty_ste500_trimmed_d text_nonempty_ste500_d;
alter domain  text_nonempty_ste500_trimmed_d add
   constraint text_nonempty_ste500_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste1000_d text_nonempty_inf_d;
alter domain  text_nonempty_ste1000_d add
   constraint text_nonempty_ste1000_d_c_ste1000 check (length(value) <= 1000);

create domain text_nonempty_ste1000_trimmed_d text_nonempty_ste1000_d;
alter domain  text_nonempty_ste1000_trimmed_d add
   constraint text_nonempty_ste1000_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste2000_d text_nonempty_inf_d;
alter domain  text_nonempty_ste2000_d add
   constraint text_nonempty_ste2000_d_c_ste2000 check (length(value) <= 2000);

create domain text_nonempty_ste4000_d text_nonempty_inf_d;
alter domain  text_nonempty_ste4000_d add
   constraint text_nonempty_ste4000_d_c_ste4000 check (length(value) <= 4000);

create domain text_nonempty_ste8000_d text_nonempty_inf_d;
alter domain  text_nonempty_ste8000_d add
   constraint text_nonempty_ste8000_d_c_ste8000 check (length(value) <= 8000);

create domain text_nonempty_ste16000_d text_nonempty_inf_d;
alter domain  text_nonempty_ste16000_d add
   constraint text_nonempty_ste16000_d_c_ste16000 check (length(value) <= 16000);


create domain jsonb_ste500_d jsonb;
alter domain  jsonb_ste500_d add
   constraint jsonb_ste500_d_c_ste500 check (pg_column_size(value) <= 500);

create domain jsonb_ste1000_d jsonb;
alter domain  jsonb_ste1000_d add
   constraint jsonb_ste1000_d_c_ste1000 check (pg_column_size(value) <= 1000);

create domain jsonb_ste2000_d jsonb;
alter domain  jsonb_ste2000_d add
   constraint jsonb_ste2000_d_c_ste2000 check (pg_column_size(value) <= 2000);

create domain jsonb_ste4000_d jsonb;
alter domain  jsonb_ste4000_d add
   constraint jsonb_ste4000_d_c_ste4000 check (pg_column_size(value) <= 4000);

create domain jsonb_ste8000_d jsonb;
alter domain  jsonb_ste8000_d add
   constraint jsonb_ste8000_d_c_ste8000 check (pg_column_size(value) <= 8000);

create domain jsonb_ste16000_d jsonb;
alter domain  jsonb_ste16000_d add
   constraint jsonb_ste16000_d_c_ste16000 check (pg_column_size(value) <= 16000);


create domain i32_lt2e9_d i32_d;
alter  domain i32_lt2e9_d add
   constraint i32_lt2e9_d_c_lt2e9 check (value < 2000000000);

create domain i64_lt2e9_d i64_d;
alter  domain i64_lt2e9_d add
   constraint i64_lt2e9_d_c_lt2e9 check (value < 2000000000);

create domain i32_abs_lt2e9_d i32_lt2e9_d;
alter  domain i32_abs_lt2e9_d add
   constraint i32_abs_lt2e9_d_c_gt_m2e9 check (value > -2000000000);

create domain i64_abs_lt2e9_d i64_lt2e9_d;
alter  domain i64_abs_lt2e9_d add
   constraint i64_abs_lt2e9_d_c_gt_m2e9 check (value > -2000000000);

create domain i32_abs_lt2e9_nz_d i32_abs_lt2e9_d;
alter  domain i32_abs_lt2e9_nz_d add
   constraint i32_abs_lt2e9_nz_d_c_nz check (value <> 0);

create domain i64_abs_lt2e9_nz_d i64_abs_lt2e9_d;
alter  domain i64_abs_lt2e9_nz_d add
   constraint i64_abs_lt2e9_nz_d_c_nz check (value <> 0);

create domain i32_lt2e9_gz_d i32_lt2e9_d;
alter  domain i32_lt2e9_gz_d add
   constraint i32_lt2e9_gz_d_c_gz check (value > 0);

create domain i64_lt2e9_gz_d i64_lt2e9_d;
alter  domain i64_lt2e9_gz_d add
   constraint i64_lt2e9_gz_d_c_gz check (value > 0);

create domain i32_lt2e9_gt1000_d i32_lt2e9_d;
alter  domain i32_lt2e9_gt1000_d add
   constraint i32_lt2e9_gt1000_d_c_gt1000 check (value > 1000);

create domain i64_lt2e9_gt1000_d i64_lt2e9_d;
alter  domain i64_lt2e9_gt1000_d add
   constraint i64_lt2e9_gt1000_d_c_gt1000 check (value > 1000);


create domain page_id_st_d text_nonempty_ste60_d;
alter  domain page_id_st_d add
   constraint page_id_st_d_c_chars check (value ~ '^[a-zA-Z0-9_]*$');

create domain page_id_d__later  i64_lt2e9_gz_d;

create domain site_id_d     i32_abs_lt2e9_nz_d;
create domain cat_id_d      i32_lt2e9_gz_d;
create domain tagtype_id_d  i32_lt2e9_gt1000_d;

create domain pat_id_d      i32_abs_lt2e9_nz_d;

create domain member_id_d   pat_id_d;
alter  domain member_id_d add
   constraint member_id_d_c_gtz check (value > 0);


create domain webhook_id_d   i16_gz_d;
create domain event_id_d     i64_lt2e9_gz_d;
create domain event_type_d   i16_gz_d;

create domain api_version_d text_nonempty_ste60_d;
alter  domain api_version_d add
   constraint api_version_d_c_in check (value in ('0.0.1'));


create domain retry_nr_d i16_d;
alter  domain retry_nr_d add
   constraint retry_nr_d_c_m1_gte1 check (value = -1 or value >= 1);
comment on domain retry_nr_d is
    '-1 = manual extra retry; 1, 2, 3 ... = automatic retry nr, null = not a retry.';



-- Constraints
-------------------------------------------------

-- This was too strict — don't require a post nr; a post id is enough
-- (e.g. when un-accepting an answer).
alter table audit_log3 drop constraint dw2_auditlog_post__c;
alter table audit_log3 add constraint auditlog_c_postnr_null check (
   (post_nr is null) or (post_id is not null));



-- Webhooks
-------------------------------------------------


create table webhooks_t (
  site_id_c    site_id_d,     -- pk
  webhook_id_c webhook_id_d,  -- pk

  ---- conf:

  owner_id_c   pat_id_d not null,
  run_as_id_c  pat_id_d,

  enabled_c    bool not null,
  deleted_c    bool not null,

  descr_c                text_nonempty_ste500_trimmed_d,
  send_to_url_c          http_url_d not null,
  check_dest_cert_c      bool,
  send_event_types_c     int[], -- event_type_d[],
  send_event_subtypes_c  int[], -- maybe later
  api_version_c          api_version_d,
  to_ext_app_ver_c       text_nonempty_ste120_d,
  send_max_reqs_per_sec_c    f32_gz_d,
<<<<<<< HEAD
  send_max_events_per_req_c  i16_gz_d,
  send_max_delay_secs_c      i16_gz_d,
  send_custom_headers_c      jsonb_ste4000_d,

  retry_max_secs_c       i32_gez_d,
  retry_extra_times_c    i16_gz_d,

  ---- state:

  failed_since_c         timestamp,
  last_failed_how_c      i16_gz_d,
  last_err_msg_or_resp_c text_nonempty_ste16000_d,
  retried_num_times_c    i16_gez_d,
  retried_num_secs_c     i32_gez_d,
  broken_reason_c        i16_gz_d,

  sent_up_to_when_c      timestamp,
  sent_up_to_event_id_c  event_id_d,
  num_pending_maybe_c    i16_gez_d,
  done_for_now_c         bool,
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
  -- see e.g.: https://doc.batch.com/api/webhooks, [10..=1000] 100 default.
  send_max_events_per_req_c  i16_gz_d,   -- default 100? Max 500, Zapier limit
  -- https://community.zapier.com/code-webhooks-52/putting-many-api-objects-into-one-zap-vs-one-zap-per-object-7697
  --  —>  https://zapier.com/help/create/other-functions/loop-your-zap-actions
  --  &  https://community.zapier.com/featured-articles-65/by-zapier-learn-about-looping-11670
  --  &  https://community.zapier.com/featured-articles-65/how-to-repeat-action-s-in-your-zap-for-a-variable-number-of-values-3037
  --         let data = []; ... data[i] = { ... }; output = data;
  -- see e.g.: https://doc.batch.com/api/webhooks, [1..=30], 5s default.
  send_max_delay_secs_c      i16_gz_d,  -- default 10?  [1..3600*24]?
  send_custom_headers_c      jsonb_ste4000_d,

  retry_max_secs_c      i32_gz_d,
  retry_extra_times_c   i16_gz_d,

  failed_reason_c       i16_gz_d,
  failed_since_c        timestamp,
  failed_message_c      text_nonempty_ste16000_d,
  retried_num_times_c   i16_gez_d,
  retried_num_secs_c    i32_gez_d,
  broken_reason_c       i16_gz_d,

  sent_up_to_when_c     timestamp,
  sent_up_to_event_id_c event_id_d,
  num_pending_maybe_c   i16_gez_d,
  done_for_now_c        bool,
=======
  -- see e.g.: https://doc.batch.com/api/webhooks, [10..=1000] 100 default.
  send_max_events_per_req_c  i16_gz_d,   -- default 100? Max 500, Zapier limit
  -- https://community.zapier.com/code-webhooks-52/putting-many-api-objects-into-one-zap-vs-one-zap-per-object-7697
  --  —>  https://zapier.com/help/create/other-functions/loop-your-zap-actions
  --  &  https://community.zapier.com/featured-articles-65/by-zapier-learn-about-looping-11670
  --  &  https://community.zapier.com/featured-articles-65/how-to-repeat-action-s-in-your-zap-for-a-variable-number-of-values-3037
  --         let data = []; ... data[i] = { ... }; output = data;
  -- see e.g.: https://doc.batch.com/api/webhooks, [1..=30], 5s default.
  send_max_delay_secs_c  i16_gz_d,  -- default 10?  [1..3600*24]?
  send_header_names_c    text[],
  send_header_values_c   text[][],

  retry_max_secs_c       i32_gz_d,
  retry_extra_times_c    i16_gz_d,

  failed_reason_c        i16_gz_d,
  failed_since_c         timestamp,
  failed_message_c       text_nonempty_ste16000_d,
  retried_num_times_c    i16_gez_d,
  retried_num_secs_c     i32_gez_d,
  broken_reason_c        i16_gz_d,

  sent_up_to_when_c      timestamp,
  sent_up_to_event_id_c  event_id_d,
  num_pending_maybe_c    i16_gez_d,
  done_for_now_c         bool,
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
  -- Not needed, if batching, and one req at a time:
  -- retry_event_ids_c   int[], -- event_id_d[],

  constraint webhooks_p_id primary key (site_id_c, webhook_id_c),

  -- fk ix: pk
  constraint webhooks_r_sites foreign key (site_id_c) references sites3 (id),

  -- fk ix: webhooks_i_ownerid
  constraint webhooks_ownerid_r_pats foreign key (site_id_c, owner_id_c)
      references users3 (site_id, user_id),

  -- fk ix: webhooks_i_runasid
  constraint webhooks_runasid_r_pats foreign key (site_id_c, run_as_id_c)
<<<<<<< HEAD
      references users3 (site_id, user_id),

  -- Can only retry, if is failing.
  constraint webhooks_c_retry_failed check (
      (retry_extra_times_c is null) or (failed_since_c is not null)),

  constraint webhooks_c_retry_eq1 check (
      retry_extra_times_c = 1), -- or null

  constraint webhooks_c_failed_since_how check (
      (failed_since_c is null) = (last_failed_how_c is null)),

  constraint webhooks_c_failed_errmsgresp check (
      (failed_since_c is not null) or (last_err_msg_or_resp_c is null)),

  constraint webhooks_c_failed_retriednumtimes check (
      (failed_since_c is not null) or (retried_num_times_c is null)),

  constraint webhooks_c_failed_retriednumsecs check (
      (failed_since_c is not null) or (retried_num_secs_c is null)),

  constraint webhooks_c_failed_brokenreason check (
      (failed_since_c is not null) or (broken_reason_c is null))
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
      references users3 (site_id, user_id)
=======
      references users3 (site_id, user_id),

  constraint webhookreqsout_c_send_names_values check (
      (send_header_names_c is null) = (send_header_values_c is null)),

  constraint webhookreqsout_c_send_names_values_len check (
      (array_length(send_header_names_c) = array_length(send_header_values_c))
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
);


create index webhooks_i_ownerid on webhooks_t (site_id_c, owner_id_c);
create index webhooks_i_runasid on webhooks_t (site_id_c, run_as_id_c);
create index webhooks_ig_sendtourl on webhooks_t (send_to_url_c);
create index webhooks_ig_sentuptowhen on webhooks_t (sent_up_to_when_c);

-- Webhooks to consider, the next time it's time to send webhook requests.
create index webhooks_ig_sentuptowhen_more on webhooks_t (sent_up_to_when_c)
    where enabled_c
      and deleted_c is not true
      and done_for_now_c is not true
      and (broken_reason_c is null or retry_extra_times_c >= 1);



create table webhook_reqs_out_t (
  site_id_c     site_id_d,     -- pk
  webhook_id_c  webhook_id_d,  -- pk
  req_nr_c      i64_gz_d,      -- pk

  sent_at_c              timestamp not null,
  sent_as_id_c           pat_id_d,
  sent_to_url_c          http_url_d not null,
  sent_by_app_ver_c      text_nonempty_ste120_d not null,
  sent_api_version_c     api_version_d not null,
  sent_to_ext_app_ver_c  text_nonempty_ste120_d,
  sent_event_types_c     int[] not null,  -- event_type_d[],
  sent_event_subtypes_c  int[],
  sent_event_ids_c       int[] not null,  -- event_id_d[],
  sent_json_c            jsonb not null,
  sent_header_names_c    text[] not null,
  sent_header_values_c   text[][] not null,

<<<<<<< HEAD
  retry_nr_c          retry_nr_d,

  failed_at_c         timestamp,
  failed_how_c        i16_gz_d,
  failed_msg_c        text_nonempty_ste16000_d,
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
  failed_at_c         timestamp,
  failed_how_c        i16_gz_d,
  failed_msg_c        text_nonempty_ste16000_d,
=======
  failed_at_c            timestamp,
  failed_how_c           i16_gz_d,
  failed_msg_c           text_nonempty_ste16000_d,
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb

<<<<<<< HEAD
  resp_at_c           timestamp,
  resp_status_c       i32_d,
  resp_status_text_c  text_nonempty_ste250_trimmed_d,
  resp_body_c         text_nonempty_ste16000_d,
  resp_headers_c      jsonb_ste8000_d,
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
  resp_at_c           timestamp,
  resp_status_c       i16_gz_d,
  resp_status_text_c  text_nonempty_ste120_trimmed_d,
  resp_body_c         text_nonempty_ste16000_d,
  resp_headers_c      jsonb_ste8000_d,
=======
  resp_at_c              timestamp,
  resp_status_c          i16_gz_d,
  resp_status_text_c     text_nonempty_ste120_trimmed_d,
  resp_body_c            text_nonempty_ste16000_d,
  resp_header_names_c    text[],
  resp_header_values_c   text[][],
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb


  constraint webhookreqsout_p_webhookid_reqnr primary key (site_id_c, webhook_id_c, req_nr_c),

  -- fk ix: pk
  constraint webhookreqsout_webhookid_r_webhooks foreign key (site_id_c, webhook_id_c)
      references webhooks_t (site_id_c, webhook_id_c),

  -- fk ix: webhookreqsout_i_sentasid
  constraint webhookreqsout_sentasid_r_pats foreign key (site_id_c, sent_as_id_c)
      references users3 (site_id, user_id),

  constraint webhookreqsout_c_not_yet_any_subtypes check (
      sent_event_subtypes_c is null),

  -- Each event is of one main type, e.g. PageCreated or PageUpdated.
  constraint webhookreqsout_c_num_ev_types_lte_num_evs check (
      cardinality(sent_event_types_c) <= cardinality(sent_event_ids_c)),

<<<<<<< HEAD
  -- At least one event type and one event must have been sent.
  constraint webhookreqsout_c_num_ev_types_gte1 check (
      cardinality(sent_event_types_c) >= 1),
  constraint webhookreqsout_c_num_ev_subtypes_gte1 check (
      cardinality(sent_event_subtypes_c) >= 1),
  constraint webhookreqsout_c_num_events_gte1 check (
      cardinality(sent_event_ids_c) >= 1),

||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
=======
  constraint webhookreqsout_c_sent_names_values_len check (
      (array_length(sent_header_names_c) = array_length(sent_header_values_c)),

>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
  constraint webhookreqsout_c_sent_bef_failed check (sent_at_c <= failed_at_c),
  constraint webhookreqsout_c_sent_bef_resp   check (sent_at_c <= resp_at_c),

  constraint webhookreqsout_c_failed_at_how_null check (
      (failed_at_c is null) = (failed_how_c is null)),

  constraint webhookreqsout_c_failed_at_msg_null check (
      (failed_at_c is not null) or (failed_msg_c is null)),

  constraint webhookreqsout_c_resp_at_status_null check (
      (resp_at_c is not null) or (resp_status_c is null)),

  constraint webhookreqsout_c_resp_at_statustext_null check (
      (resp_at_c is not null) or (resp_status_text_c is null)),

  constraint webhookreqsout_c_resp_at_body_null check (
      (resp_at_c is not null) or (resp_body_c is null)),

  constraint webhookreqsout_c_resp_at_headers_null check (
      (resp_at_c is not null) or (resp_header_names_c is null)),

  constraint webhookreqsout_c_resp_names_values check (
      (resp_header_names_c is null) = (resp_header_values_c is null)),

  constraint webhookreqsout_c_resp_names_values_len check (
      (array_length(resp_header_names_c) = array_length(resp_header_values_c))
);


create index webhookreqsout_i_sentat on webhook_reqs_out_t (site_id_c, sent_at_c);
create index webhookreqsout_i_sentasid on webhook_reqs_out_t (site_id_c, sent_as_id_c);

-- Skip sent_event_types_c — would probably just be a full scan anyway?
-- Wait. Should include site id too. Will work w/o any extension?
-- create index webhookreqsout_i_senteventsubtypes
--     on webhook_reqs_out_t using gin (sent_event_subtypes_c);  + site_id_c ?
-- create index webhookreqsout_i_senteventids
--     on webhook_reqs_out_t using gin (sent_event_ids_c);      + site_id_c ?
