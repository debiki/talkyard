
create table usernames3(
  site_id varchar not null,
  username varchar not null,
  in_use_from timestamp not null,
  in_use_to timestamp,
  user_id int not null,
  first_mention_at timestamp,
  -- username + from...to should be unique, but we'll verify that in the app server instead.
  constraint usernames_p primary key (site_id, username, in_use_from),
  constraint usernames_r_users foreign key (site_id, user_id) references users3 (site_id, user_id),
  constraint usernames_c_from_lt_to check (in_use_from < in_use_to),
  constraint usernames_c_from_le_mention check (in_use_from <= first_mention_at),
  constraint usernames_c_mention_le_to check (first_mention_at <= in_use_to),
  constraint usernames_c_username_len check (length(username) between 2 and 50)
);

