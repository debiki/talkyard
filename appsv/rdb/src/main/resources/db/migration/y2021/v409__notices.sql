create domain when_mins_d i32_gez_d;
alter domain when_mins_d add constraint when_mins_d_c_aft_y2010 check (value >= 21050000);
alter domain when_mins_d add constraint when_mins_d_c_bef_y2100 check (value <= 68400000);
comment on domain when_mins_d is
    'A point in time, in minutes (not seconds) since 1970, so fits in an i32. '
    'To catch bugs, must be between year 2010 and 2100.';

create table notices_t (
  site_id_c int,  -- pk
  to_pat_id_c int,  -- pk
  notice_id_c i32_gz_d,  -- pk
  first_at_c when_mins_d not null,
  last_at_c when_mins_d not null,
  num_total_c i32_gz_d not null,
  notice_data_c jsonb,

  constraint notices_p_patid_noticeid primary key (site_id_c, to_pat_id_c, notice_id_c),

  -- ix: pk
  constraint notices_r_pats foreign key (site_id_c, to_pat_id_c) references
      users3 (site_id, user_id) deferrable,

  constraint notices_c_firstat_lte_lastat check (first_at_c <= last_at_c)
);

create index notices_ig_noticeid on notices_t (notice_id_c);

