

insert into users3(
    site_id, user_id, full_name, username, is_admin,
    created_at, email_for_every_new_post, trust_level, threat_level)
  select id,  2, 'Sysbot', 'sysbot', true, now_utc(), false, 1, 3 from sites3;


alter table users3 add column external_id varchar;
alter table users3 add constraint users_c_extid_min_len check (1 <= length(external_id));
alter table users3 add constraint users_c_extid_max_len check (length(external_id) <= 200);

create unique index users_externalid_u on users3 (site_id, external_id);


create table api_secrets3 (
  site_id int not null,
  secret_nr int not null,
  user_id int,
  created_at timestamp not null,
  deleted_at timestamp,
  is_deleted boolean not null default false,
  secret_key varchar not null,

  constraint apisecrets_nr_p primary key (site_id, secret_nr),

  constraint apisecrets_user_r_users foreign key (site_id, user_id)
    references users3 (site_id, user_id) deferrable,

  constraint apisecrets_c_createdat_lte_deletedat check (created_at <= deleted_at),
  constraint apisecrets_c_deleted_has_deletedat check (not is_deleted or deleted_at is not null),

  constraint apisecrets_c_secretkey_len check (length(secret_key) between 20 and 200),
  constraint apisecrets_c_secretkey_alnum check (secret_key ~ '^[a-zA-Z0-9]+$')
);


create index secrets_user_i on api_secrets3 (site_id, user_id);

