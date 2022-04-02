

create domain jsonb_ste100_000_d jsonb;
alter domain  jsonb_ste100_000_d add
   constraint jsonb_ste100_000_d_c_ste100_000 check (pg_column_size(value) <= 100000);

create domain jsonb_ste250_000_d jsonb;
alter domain  jsonb_ste250_000_d add
   constraint jsonb_ste250_000_d_c_ste250_000 check (pg_column_size(value) <= 250000);

create domain jsonb_ste500_000_d jsonb;
alter domain  jsonb_ste500_000_d add
   constraint jsonb_ste500_000_d_c_ste500_000 check (pg_column_size(value) <= 500000);

alter table webhook_reqs_out_t alter column sent_json_c type jsonb_ste500_000_d;
