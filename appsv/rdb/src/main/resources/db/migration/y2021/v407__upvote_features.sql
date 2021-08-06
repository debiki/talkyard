create domain text_trimmed_not_empty_d text;
alter domain text_trimmed_not_empty_d
    add constraint text_trimmed_not_empty_d_c_not_empty check (length(value) >= 1);
alter domain text_trimmed_not_empty_d
    add constraint text_trimmed_not_empty_d_c_trimmed check (
    value ~ '|\S(.*\S)?');

alter table upload_refs3 add column uploaded_file_name_c text_trimmed_not_empty_d;


alter table page_popularity_scores3 rename algorithm to score_alg_c;  -- check refs, done

alter table categories3 add column def_sort_order_c i16_gez_d;
alter table categories3 add column def_score_alg_c i16_gez_d;
alter table categories3 add column def_score_period_c i16_gez_d;

alter table categories3 add constraint cats_score_alg_period check (
  (def_score_alg_c is null) = (def_score_period_c is null));


alter table categories3 add column do_it_votes_c i16_gez_d;
alter table categories3 add column do_it_vote_in_topic_list_c bool;

-- null/0 = not at all (just Like votes inside the topics, as usual)
-- upvote via topic list page
-- upvote = orig post like
-- downvote via topic list page
-- downvote = orig post disgree
-- can/not disagree vote orig post
-- can/not disagree vote replies in topic

-- can/not like vote orig post
-- can/not like vote replies in topic

-- other reactions?

-- Initially, just:  OP like = topic upvote.  No downvotes. Like at HN.

alter table pages3 add column num_op_do_votes_c i32_gez_d not null default 0;
alter table pages3 add column num_op_dont_votes_c i32_gez_d not null default 0;



alter table pages3 add column answered_by_id_c int;
alter table pages3 add column published_by_id_c int;

alter table pages3 rename column wait_until to postponed_til_c;
alter table pages3 add column postponed_by_id_c int;

alter table pages3 add column planned_by_id_c int;
alter table pages3 add column started_by_id_c int;

alter table pages3 add column paused_by_id_c int;

alter table pages3 add column done_by_id_c int;
alter table pages3 add column closed_by_id_c int;
alter table pages3 add column locked_by_id_c int;
alter table pages3 add column frozen_by_id_c int;
alter table pages3 add column unwanted_by_id_c int;
alter table pages3 add column hidden_by_id_c int;
alter table pages3 add column deleted_by_id_c int;

alter table pages3 add constraint pages_answeredby_r_pats foreign key (
  site_id, answered_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_publishedby_r_pats foreign key (
  site_id, published_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_postponedby_r_pats foreign key (
  site_id, postponed_by_id_c ) references users3(site_id, user_id);

alter table pages3 add constraint pages_plannedby_r_pats foreign key (
  site_id, planned_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_startedby_r_pats foreign key (
  site_id, started_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_doneby_r_pats foreign key (
  site_id, done_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_closedby_r_pats foreign key (
  site_id, closed_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_lockedby_r_pats foreign key (
  site_id, locked_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_frozenby_r_pats foreign key (
  site_id, frozen_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_unwantedby_r_pats foreign key (
  site_id, unwanted_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_hiddenby_r_pats foreign key (
  site_id, hidden_by_id_c) references users3(site_id, user_id);

alter table pages3 add constraint pages_deletedby_r_pats foreign key (
  site_id, deleted_by_id_c) references users3(site_id, user_id);

