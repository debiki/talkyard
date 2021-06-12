
create domain email_d as text;
alter domain email_d add constraint email_d_c_format check (email_seems_ok(value));
-- a@b.c is 5 chars
alter domain email_d add constraint email_d_c_minlen check (length(value) >= 5);
alter domain email_d add constraint email_d_c_maxlen check (length(value) < 200);
alter domain email_d add constraint email_d_c_lower check (lower(value) = value);


create domain secret_alnum_d as text;
alter domain secret_alnum_d add constraint secret_alnum_d_c_alnum check (
    value ~ '^[a-zA-Z0-9]*$');
alter domain secret_alnum_d add constraint secret_alnum_d_c_minlen check (
    length(value) >= 20);
alter domain secret_alnum_d add constraint secret_alnum_d_c_maxlen check (
    length(value) <= 200);


create domain secret_status_d as i16_gz_d;
alter domain secret_status_d add constraint secret_status_d_c_lte6 check (value <= 6);


alter table emails_out3 add column sent_from_c email_d;
-- Backw compat: sent_from_c missing in old emails, otherwise would be null = null.
alter table emails_out3 add constraint emailsout_c_senton_sentfrom_null check (
    (sent_on is not null) or (sent_from_c is null));

-- Maybe drop later, and lookup via emails_in_t instead:
alter table emails_out3 add column num_replies_back_c i16_gez_d;


alter table emails_out3 add column secret_value_c secret_alnum_d;
alter table emails_out3 add column secret_status_c secret_status_d;

-- Backw compat: status w/o secret is ok.
alter table emails_out3 add constraint emailsout_c_secretval_status_null check (
    (secret_value_c is null) or (secret_status_c is not null));

create unique index emailsout_u_secretvalue on emails_out3 (site_id, secret_value_c)
    where secret_value_c is not null;


-- Good to be able to look up and expire statuses NotYetValid, Valid and DeletedCanUndo.
create index emailsout_gi_secretstatus on emails_out3 (secret_status_c)
    where secret_status_c in (1, 2, 3);

create index emailsout_i_secretstatus on emails_out3 (site_id, secret_status_c)
    where secret_status_c in (1, 2, 3);


create index emailsout_gi_createdat on emails_out3 (created_at);
create index emailsout_i_createdat on emails_out3 (site_id, created_at);

create index emailsout_gi_sentfrom on emails_out3 (sent_from_c)
    where sent_from_c is not null;
create index emailsout_i_sentfrom on emails_out3 (site_id, sent_from_c)
    where sent_from_c is not null;
