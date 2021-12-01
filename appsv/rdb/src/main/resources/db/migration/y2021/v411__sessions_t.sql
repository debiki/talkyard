
create domain browser_id_d text;
alter domain  browser_id_d add constraint browser_id_d_c_shte60 check (length(value) <= 60);
alter domain  browser_id_d add constraint browser_id_d_c_lote14 check (length(value) >= 14);
alter domain  browser_id_d add constraint browser_id_d_c_chars  check (value ~ '^[a-zA-Z0-9._=-]*$');

-- "us" is here for "url safe".
create domain base64us_inf_d text_nonempty_inf_d;
alter domain  base64us_inf_d add constraint base64us_inf_d_c_chars
    check (value ~ '^[a-zA-Z0-9_=-]*$');

create domain base64us_len16_d base64us_inf_d;
alter domain  base64us_len16_d add constraint base64us_len16_d_c_len16
    check (length(value) = 16);

-- For storing a SHA-512/224 or BLAKE3 hash the first 224 bits only.
create domain bytea_len28_d bytea;
alter domain  bytea_len28_d add constraint bytea_len28_d_c_len28
    check (length(value) = 28);

-- For storing a SHA-512/256 or BLAKE3 hash, 256 bits.
create domain bytea_len32_d bytea;
alter domain  bytea_len32_d add constraint bytea_len32_d_c_len32
    check (length(value) = 32);

-- For storing a 384 bits hash.
create domain bytea_len48_d bytea;
alter domain  bytea_len48_d add constraint bytea_len48_d_c_len48
    check (length(value) = 48);

-- For storing a 512 bits hash.
create domain bytea_len64_d bytea;
alter domain  bytea_len64_d add constraint bytea_len64_d_c_len64
    check (length(value) = 64);


create table sessions_t (
  site_id_c i32_d,  -- pk
  pat_id_c i32_d,  -- pk
  created_at_c timestamp, -- pk
  deleted_at_c timestamp,
  expired_at_c timestamp,
  version_c i16_gz_d not null,
  start_ip_c inet,
  start_browser_id_c browser_id_d,
  start_headers_c jsonb,
  part_1_comp_id_c base64us_len16_d not null,
  hash_2_for_embg_storage_c bytea_len32_d not null,
  hash_3_for_dir_js_c bytea_len32_d not null,
  hash_4_http_only_c bytea_len32_d not null,
  hash_5_strict_c bytea_len32_d not null,

  constraint sessions_p_patid_createdat primary key (site_id_c, pat_id_c, created_at_c),

  -- Part 1 needs to be unique, because it's used to compare session ids with
  -- each other, to see if they are the same (but more parts needed to
  -- actually use a session for anything).  [sid_part1]
  constraint sessions_u_part1 unique (site_id_c, part_1_comp_id_c),

  -- We never lookup by part 2 or 3. (So, no indexes or unique constraints.)

  -- There needs to be an index on part 4, so we can find sessions where part 1
  -- is missing (because of logging out client side only, when not connected to
  -- the server — then, parts 1-3 get deleted, but not parts 4 and 5, which are
  -- HttpOnly cookies). And then, we might as well make part 4 unique? — to catch bugs,
  -- because if not unique, that'd be a bug somehow (since statistically impossible).
  constraint sessions_u_hash4 unique (site_id_c, hash_4_http_only_c),

  -- We never lookup by part 5.

  -- fk ix: primary key
  constraint sessions_r_pats foreign key (site_id_c, pat_id_c)
    references users3 (site_id, user_id) deferrable,

  constraint sessions_c_createdat_lte_deletedat check (created_at_c <= deleted_at_c),
  constraint sessions_c_createdat_lte_expiredat check (created_at_c <= expired_at_c),

  constraint settings_c_startheaders_len check (pg_column_size(start_headers_c) <= 1000)
);


-- For quickly finding all active sessions by someone.
create index sessions_i_patid_createdat_active
    on sessions_t (site_id_c, pat_id_c, created_at_c desc)
    where deleted_at_c is null and expired_at_c is null;
