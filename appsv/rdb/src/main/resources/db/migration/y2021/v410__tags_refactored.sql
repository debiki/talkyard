
create domain color_d as text;
alter domain  color_d add
   constraint color_d_c_hex_or_rgb_or_hsl check (value ~ '^#[a-f0-9]{3}([a-f0-9]{3})?$');
comment on domain color_d is
    'CSS colors, for now lowercase hex: "#ab3", "#aabb33". Later, also rgba, hsl, hsla.';


create or replace function is_trimmed(value text) returns boolean
language plpgsql as $_$
begin
    return value ~ '^(\S(.*\S)?)?$';
end;
$_$;

create domain text_nonempty_inf_d text;
alter domain  text_nonempty_inf_d add
   constraint text_nonempty_inf_d_c_nonempty check (length(value) > 0);


create domain text_nonempty_ste2100_d text_nonempty_inf_d;
alter domain  text_nonempty_ste2100_d add
   constraint text_nonempty_ste2100_d_c_ste2100 check (length(value) <= 2100);

create domain text_nonempty_ste2100_trimmed_d text_nonempty_ste2100_d;
alter domain  text_nonempty_ste2100_trimmed_d add
   constraint text_nonempty_ste2100_trimmed_d_c_trimmed check (is_trimmed(value));


create domain text_nonempty_ste120_d text_nonempty_inf_d;
alter domain  text_nonempty_ste120_d add
   constraint text_nonempty_ste120_d_c_ste120 check (length(value) <= 120);

create domain text_nonempty_ste120_trimmed_d text_nonempty_ste120_d;
alter domain  text_nonempty_ste120_trimmed_d add
   constraint text_nonempty_ste120_trimmed_d_c_trimmed check (is_trimmed(value));


create domain text_nonempty_ste60_d text_nonempty_inf_d;
alter domain  text_nonempty_ste60_d add
   constraint text_nonempty_ste60_d_c_ste60 check (length(value) <= 60);

create domain text_nonempty_ste60_trimmed_d text_nonempty_ste60_d;
alter domain  text_nonempty_ste60_trimmed_d add
   constraint text_nonempty_ste60_trimmed_d_c_trimmed check (is_trimmed(value));


create domain text_nonempty_ste30_d text_nonempty_inf_d;
alter domain  text_nonempty_ste30_d add
   constraint text_nonempty_ste30_d_c_ste30 check (length(value) <= 30);

create domain text_nonempty_ste30_trimmed_d text_nonempty_ste30_d;
alter domain  text_nonempty_ste30_trimmed_d add constraint
              text_nonempty_ste30_trimmed_d_c_trimmed check (is_trimmed(value));

create domain text_nonempty_ste15_d text_nonempty_inf_d;
alter domain  text_nonempty_ste15_d add
   constraint text_nonempty_ste15_d_c_ste15 check (length(value) <= 15);

comment on domain text_nonempty_ste15_d is
    'Non-empty text, shorter than or equal to 15 chars long.';

create domain text_nonempty_ste15_trimmed_d  text_nonempty_ste15_d;
alter domain  text_nonempty_ste15_trimmed_d add
   constraint text_nonempty_ste15_trimmed_d_c_trimmed check (is_trimmed(value));

comment on domain text_nonempty_ste15_trimmed_d is
    'Like text_nonempty_ste15_d, but does not start or end with spaces, tabs, newlines.';



create domain url_slug_d text_nonempty_ste2100_d;
alter domain  url_slug_d add
   constraint url_slug_d_c_regex check (value ~ '^[[:alnum:]_-]*$');
alter domain  url_slug_d add
  constraint  url_slug_d_c_lower check (lower(value) = value);

comment on domain url_slug_d is
    'Chars that make sense in an URL slug — lowercase alphanumeric, and "-_".';

create domain url_slug_60_d url_slug_d;
alter domain  url_slug_60_d add
   constraint url_slug_60_d_c_ste60 check (length(value) <= 60);
comment on domain url_slug_60_d is
    'Like url_slug_d, but at most 60 chars long.';



-- If wasn't a suffix, would need to verify didn't start with Ty's own classes,
-- that is, c_... and e_... (or legacy: s_... es_... and others).
create domain html_class_suffix_30_d  text_nonempty_ste30_d;
alter domain  html_class_suffix_30_d add
   constraint html_class_suffix_30_d_c_regex check (
    value ~ '^[a-zA-Z0-9_-]*$');
comment on domain html_class_suffix_30_d is
    'Text that make sense to append to a CSS class: ASCII alnum and "-_", at most 30 chars.';



-- See tags.dd.adoc. It's a bitfield; 7 and 56 mean all types of pats and posts, respectively.
create domain thing_types_d i64_d;
alter domain  thing_types_d add
   constraint thing_types_d_c_in_7_56 check (value in (7, 56));


create or replace function is_ok_tag_chars(txt text) returns boolean
language plpgsql as $_$
begin
    -- No separators like semicolon and commas, '(){}[]' etcetera.
    -- Sync with Scala [ok_tag_chars]
    return txt ~ '^[[:alnum:] ''!?&#%_.:=/^~+*-]*$';
end;
$_$;

create domain tag_name_120_d text_nonempty_ste120_trimmed_d;
alter domain  tag_name_120_d add
   constraint tag_name_120_d_c_chars check (is_ok_tag_chars(value));

create domain tag_name_60_d text_nonempty_ste60_trimmed_d;
alter domain  tag_name_60_d add
   constraint tag_name_60_d_c_chars check (is_ok_tag_chars(value));

create domain tag_name_15_d text_nonempty_ste15_trimmed_d;
alter domain  tag_name_15_d add
   constraint tag_name_15_d_c_chars check (is_ok_tag_chars(value));

comment on domain tag_name_15_d is
    'Like text_nonempty_ste15_trimmed_d, but allows only alnum, space and '
    'some punctuation chars.';


create or replace function index_friendly(value text) returns text
language plpgsql as $_$
begin
    -- Treat all punctuation as the same — replace with a single '_'.
    -- And consider all blanks the same as well: replace with a single ' '.
    -- In the future, maybe do index punctuation, if tag just 1 or 2 chars long?
    -- (That'd be *less* restrictive, so is ok to allow later on; can wait.
    -- Would need to create new indexes though, delete the old? That'd be fine.)
    return regexp_replace(regexp_replace(regexp_replace(
            lower(trim(value)),
            '[^[:print:]]+', '', 'g'),
            '[[:blank:]]+', ' ', 'g'),
            '[[:punct:]]+', '_', 'g');
end;
$_$ immutable;




create table tagtypes_t (
  site_id_c  int,  -- pk
  id_c  i32_gz_d,  -- pk
  can_tag_what_c  thing_types_d not null,
  scoped_to_pat_id_c  int,
  is_personal bool,
  url_slug_c  url_slug_60_d,
  disp_name_c  tag_name_60_d not null,
  long_name_c  tag_name_120_d,
  abbr_name_c  tag_name_15_d,
  descr_page_id_c  text,
  descr_url_c  http_url_d,
  text_color_c  color_d,
  handle_color_c  color_d,
  background_color_c color_d,
  css_class_suffix_c  html_class_suffix_30_d,
  sort_order_c  i16_d,

  created_by_id_c int not null,
  deleted_by_id_c int,
  merged_into_tagtype_id_c int,
  merged_by_id_c int,

  constraint tagtypes_p_id primary key (site_id_c, id_c),

  -- fk ix: primary key
  constraint tagtypes_r_sites foreign key (site_id_c)
      references sites3 (id) deferrable,

  -- fk ix: tagtypes_i_scopedto
  constraint tagtypes_scopedtopat_r_pats foreign key (site_id_c, scoped_to_pat_id_c)
      references users3 (site_id, user_id) deferrable,

  -- fk ix: tagtypes_i_descrpage
  constraint tagtypes_descrpage_r_pages foreign key (site_id_c, descr_page_id_c)
      references pages3 (site_id, page_id) deferrable,

  -- fk ix: tagtypes_i_createdby
  constraint tagtypes_createdby_r_pats foreign key (site_id_c, created_by_id_c)
      references users3 (site_id, user_id) deferrable,

  -- fk ix: tagtypes_i_deletedby
  constraint tagtypes_deleteby_r_pats foreign key (site_id_c, deleted_by_id_c)
      references users3 (site_id, user_id) deferrable,

  -- fk ix: tagtypes_i_mergedinto
  constraint tagtypes_mergedinto_r_tagtypes foreign key (site_id_c, merged_into_tagtype_id_c)
      references tagtypes_t (site_id_c, id_c) deferrable,

  -- fk ix: tagtypes_i_mergedby
  constraint tagtypes_mergedby_r_pats foreign key (site_id_c, merged_by_id_c)
      references users3 (site_id, user_id) deferrable,

  -- For now, to catch bugs, see runQueryFindNextFreeInt32(), starts at 1001.
  constraint tagtypes_c_id_gt1000 check (id_c > 1000)
);


-- App server code will need to prevent abbr_name_c, disp_name_c, long_name_c from
-- being the same, for different tag types.
create unique index tagtypes_u_anypat_urlslug  on tagtypes_t (site_id_c, coalesce(scoped_to_pat_id_c, 0), url_slug_c);
create unique index tagtypes_u_anypat_dispname on tagtypes_t (site_id_c, coalesce(scoped_to_pat_id_c, 0), index_friendly(disp_name_c));
create unique index tagtypes_u_anypat_longname on tagtypes_t (site_id_c, coalesce(scoped_to_pat_id_c, 0), index_friendly(long_name_c));
create unique index tagtypes_u_anypat_abbrname on tagtypes_t (site_id_c, coalesce(scoped_to_pat_id_c, 0), index_friendly(abbr_name_c));

create index tagtypes_i_scopedto on tagtypes_t (site_id_c, scoped_to_pat_id_c);
create index tagtypes_i_descrpage on tagtypes_t (site_id_c, descr_page_id_c);
create index tagtypes_i_createdby on tagtypes_t (site_id_c, created_by_id_c);
create index tagtypes_i_deletedby on tagtypes_t (site_id_c, deleted_by_id_c);
create index tagtypes_i_mergedinto on tagtypes_t (site_id_c, merged_into_tagtype_id_c);
create index tagtypes_i_mergedby on tagtypes_t (site_id_c, merged_by_id_c);




create table tags_t (
  site_id_c  int,  -- pk
  id_c  i32_gz_d,  -- pk
  tagtype_id_c  int not null,
  parent_tag_id_c  int,
  on_pat_id_c  int,
  on_post_id_c  int,

  constraint tags_p_id primary key (site_id_c, id_c),
  -- Postgres 10 wants these unique constraints, so two foreign keys below have
  -- something unique to reference — but Postgres 10 doesn't realize that
  -- these rows are unique without these constraints, because of the primary key.
  -- Remove later [when_pg_smarter]?
  constraint tags_u_id_patid unique (site_id_c, id_c, on_pat_id_c),
  constraint tags_u_id_postid unique (site_id_c, id_c, on_post_id_c),

  -- fk ix: tags_i_tagtypeid
  constraint tags_r_tagtypes foreign key (site_id_c, tagtype_id_c)
      references tagtypes_t (site_id_c, id_c) deferrable,

  -- fk ix: tags_i_parentid
  -- The parent tag (user badge) must be on the same page or pat — that's
  -- checked by two additional foreign keys below.
  constraint tags_parenttagid_r_tags_id foreign key (site_id_c, parent_tag_id_c)
      references tags_t (site_id_c, id_c) deferrable,

  -- The parent tag (user badge) must be for the same *user* (or guest or group).
  -- Postgres v10 wants a unique index on these columns, although there's already
  -- tags_p_id, so they're already unique for sure.
  -- fk ix: tags_i_parentid (can use it, although  on_pat_id_c not in the index?,
  -- since it's last [.skip_fk_ix_last_col])
  -- references unique index: tags_u_id_patid
  constraint tags_parenttagid_onpatid_r_tags_id_onpatid
      foreign key (site_id_c, parent_tag_id_c, on_pat_id_c)        -- tags_i_parentid and tags_i_parentid_patid
      references tags_t (site_id_c, id_c, on_pat_id_c) deferrable, -- tags_u_id_patid

  -- The parent tag must be on the same *post*.
  -- fk ix: tags_i_parentid (can use for this? [.skip_fk_ix_last_col] )
  -- references unique index: tags_u_id_postid
  constraint tags_parenttagid_onpostid_r_tags_id_onpostid
      foreign key (site_id_c, parent_tag_id_c, on_post_id_c)        -- tags_i_parentid and tags_i_parentid_postid
      references tags_t (site_id_c, id_c, on_post_id_c) deferrable, -- tags_u_id_postid

  -- fk ix: tags_i_onpatid
  constraint tags_onpat_r_pats foreign key (site_id_c, on_pat_id_c)
      references users3 (site_id, user_id) deferrable,

  -- fk ix: tags_i_onpostid
  constraint tags_onpost_r_posts foreign key (site_id_c, on_post_id_c)
      references posts3 (site_id, unique_post_id) deferrable,

  constraint tags_c_tags_one_thing check (
      (on_pat_id_c is not null) <> (on_post_id_c is not null)),

  -- For now, see runQueryFindNextFreeInt32().
  constraint tags_c_id_gt1000 check (id_c > 1000)
);


create index tags_i_tagtypeid on tags_t (site_id_c, tagtype_id_c);
create index tags_i_parentid  on tags_t (site_id_c, parent_tag_id_c) where parent_tag_id_c is not null;
create index tags_i_onpatid   on tags_t (site_id_c, on_pat_id_c) where on_pat_id_c is not null;
create index tags_i_onpostid  on tags_t (site_id_c, on_post_id_c) where on_post_id_c is not null;

-- Maybe these are needed in Postgres 10? But later on, when Postgres gets better,
-- they won't be needed — because there's already index tags_i_parentid on parent_tag_id_c
-- which should be a good enough fk index. [when_pg_smarter]
-- Or keep these; remove tags_i_parentid instead? Maybe remove tags_parenttagid_r_tags_id too?
create index tags_i_parentid_patid  on tags_t (site_id_c, parent_tag_id_c, on_pat_id_c)
    where parent_tag_id_c is not null and on_pat_id_c is not null;
create index tags_i_parentid_postid on tags_t (site_id_c, parent_tag_id_c, on_post_id_c)
    where parent_tag_id_c is not null and on_post_id_c is not null;
