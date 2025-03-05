--
-- PostgreSQL database dump
--

-- Dumped from database version 10.23
-- Dumped by pg_dump version 10.23

-- Generated like so:
--   docker compose exec rdb pg_dump --username=postgres --schema-only --no-tablespaces --use-set-session-authorization  talkyard_test
-- where  talkyard_test  is the db structure in an empty schema, after having applied migrations up to incl version v426__bookmarks.sql.
--
-- Then processed in Vim like so: (to remove comments and empty lines)
--   '<,'>s/^--.*$//g
--   %s/\n\n\n\n\n\n\n/\r\r\r/g


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET SESSION AUTHORIZATION DEFAULT;

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET SESSION AUTHORIZATION 'talkyard_test';



CREATE DOMAIN public.i32_d AS integer;


CREATE DOMAIN public.anonym_status_d AS public.i32_d
	CONSTRAINT anonym_status_d_c_in_65535_2097151 CHECK (((VALUE)::integer = ANY (ARRAY[65535, 2097151])));


CREATE DOMAIN public.i16_gz_d AS smallint
	CONSTRAINT i16gz_c_gz CHECK ((VALUE > 0));


CREATE DOMAIN public.i16_gz_lt128_d AS public.i16_gz_d
	CONSTRAINT i16_gz_lt128_d_c_lt128 CHECK (((VALUE)::smallint < 128));


CREATE DOMAIN public.answered_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.text_nonempty_inf_d AS text
	CONSTRAINT text_nonempty_inf_d_c_nonempty CHECK ((length(VALUE) > 0));


CREATE DOMAIN public.text_nonempty_ste60_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste60_d_c_ste60 CHECK ((length((VALUE)::text) <= 60));


CREATE DOMAIN public.api_version_d AS public.text_nonempty_ste60_d
	CONSTRAINT api_version_d_c_in CHECK (((VALUE)::text = '0.0.1'::text));


CREATE DOMAIN public.base64us_inf_d AS public.text_nonempty_inf_d
	CONSTRAINT base64us_inf_d_c_chars CHECK (((VALUE)::text ~ '^[a-zA-Z0-9_=-]*$'::text));


CREATE DOMAIN public.base64us_len16_d AS public.base64us_inf_d
	CONSTRAINT base64us_len16_d_c_len16 CHECK ((length((VALUE)::text) = 16));


CREATE DOMAIN public.browser_id_d AS text
	CONSTRAINT browser_id_d_c_chars CHECK ((VALUE ~ '^[a-zA-Z0-9._=-]*$'::text))
	CONSTRAINT browser_id_d_c_lote14 CHECK ((length(VALUE) >= 14))
	CONSTRAINT browser_id_d_c_shte60 CHECK ((length(VALUE) <= 60));


CREATE DOMAIN public.bytea_len28_d AS bytea
	CONSTRAINT bytea_len28_d_c_len28 CHECK ((length(VALUE) = 28));


CREATE DOMAIN public.bytea_len32_d AS bytea
	CONSTRAINT bytea_len32_d_c_len32 CHECK ((length(VALUE) = 32));


CREATE DOMAIN public.bytea_len48_d AS bytea
	CONSTRAINT bytea_len48_d_c_len48 CHECK ((length(VALUE) = 48));


CREATE DOMAIN public.bytea_len64_d AS bytea
	CONSTRAINT bytea_len64_d_c_len64 CHECK ((length(VALUE) = 64));


CREATE DOMAIN public.i16_d AS smallint;


CREATE DOMAIN public.can_see_who_d AS public.i16_d
	CONSTRAINT can_see_who_d_c_null_1234 CHECK (((VALUE IS NULL) OR (((VALUE)::smallint >= 1) AND ((VALUE)::smallint <= 4))));


COMMENT ON DOMAIN public.can_see_who_d IS '
Says if a pat can see other pats related to something, e.g. see who
is assigned to a task, or see which others also can see a private
page.  See: can_see_assigned_c and  can_see_who_can_see_c.
';


CREATE DOMAIN public.i32_lt2e9_d AS public.i32_d
	CONSTRAINT i32_lt2e9_d_c_lt2e9 CHECK (((VALUE)::integer < 2000000000));


CREATE DOMAIN public.i32_lt2e9_gz_d AS public.i32_lt2e9_d
	CONSTRAINT i32_lt2e9_gz_d_c_gz CHECK (((VALUE)::integer > 0));


CREATE DOMAIN public.cat_id_d AS public.i32_lt2e9_gz_d;


CREATE DOMAIN public.closed_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.collapsed_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.color_d AS text
	CONSTRAINT color_d_c_hex_or_rgb_or_hsl CHECK ((VALUE ~ '^#[a-f0-9]{3}([a-f0-9]{3})?$'::text));


COMMENT ON DOMAIN public.color_d IS 'CSS colors, for now lowercase hex: "#ab3", "#aabb33". Later, also rgba, hsl, hsla.';


CREATE DOMAIN public.i32_nz_d AS integer
	CONSTRAINT i32_nz_d_c_nz CHECK ((VALUE <> 0));


CREATE DOMAIN public.comt_order_d AS public.i32_nz_d
	CONSTRAINT comt_order_d_c_in CHECK (((VALUE)::integer = ANY (ARRAY[1, 2, 3, 18, 50])));


CREATE DOMAIN public.i16_gz_lt1024_d AS public.i16_gz_d
	CONSTRAINT i16_gz_lt1024_d_c_lt1024 CHECK (((VALUE)::smallint < 1024));


CREATE DOMAIN public.creator_status_d AS public.i16_gz_lt1024_d;


COMMENT ON DOMAIN public.creator_status_d IS '
Says if the poster is still author and owner. And if others have been
added as authors or owners, or assigned to this post — then, they''d
be looked up in pat_node_*_rels_t.
';


CREATE DOMAIN public.deleted_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.i16_gez_d AS smallint
	CONSTRAINT i16gez_c_gez CHECK ((VALUE >= 0));


CREATE DOMAIN public.do_vote_style_d AS public.i16_gez_d
	CONSTRAINT do_vote_style_d_c_lte5 CHECK (((VALUE)::smallint <= 5));


CREATE DOMAIN public.doing_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.i32_gz_d AS integer
	CONSTRAINT i32gz_c_gz CHECK ((VALUE > 0));


CREATE DOMAIN public.dormant_status_d AS public.i32_gz_d;


COMMENT ON DOMAIN public.dormant_status_d IS '
If not null, shows why a relationship (from a post or pat to something)
should be ignored. Then, indexes can exclude these relationships, e.g.
not looking up Assigned-To for a post that''s been closed or
deleted. But if the post is reopened, the relationships are activated
again (which wouldn''t be possible if they''d been deleted instead of
marked as dormant).
  Let this be a bitfield? An AssignedTo relationship could get bits
DormantBits.PostDone and PostClosed set, if the post got done.
Or if postponed, could get DormantBits.Postponed set?
';


CREATE FUNCTION public.email_seems_ok(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
  -- This isn't supposed to find *all* broken addresses. It's just a somewhat-best-&-short-of-time-
  -- effort to prevent some bugs, e.g. accidentally saving the wrong field. & Maybe xss attack attempts.
  return text ~ '^[^@\s,;!?&\|''"<>]+@[^@\s,;!?&\|''"<>]+\.[^@\s,;!?&\|''"<>]+$'
      -- sha512 is 128 hex chars, maybe someone some day generates an email address with a sha512 hash?
      and length(text) < 200
      -- Don't support email addresses with uppercase letters in the local part,
      -- although technically allowed. Seems like a waste of disk & my poor brain to store
      -- the email in both original case and lowercase — when considering casing is just a
      -- security risk anyway? (somehow somewhere impersonating someone by claiming the same email,
      -- but with different casing).
      and lower(text) = text;
end;
$_$;


CREATE DOMAIN public.email_d AS text
	CONSTRAINT email_d_c_format CHECK (public.email_seems_ok((VALUE)::character varying))
	CONSTRAINT email_d_c_lower CHECK ((lower(VALUE) = VALUE))
	CONSTRAINT email_d_c_maxlen CHECK ((length(VALUE) < 200))
	CONSTRAINT email_d_c_minlen CHECK ((length(VALUE) >= 5));


CREATE DOMAIN public.text_trimmed_not_empty_d AS text
	CONSTRAINT text_trimmed_not_empty_d_c_not_empty CHECK ((length(VALUE) >= 1))
	CONSTRAINT text_trimmed_not_empty_d_c_trimmed CHECK ((VALUE ~ '^(\S(.*\S)?)?$'::text));


CREATE DOMAIN public.text_oneline_d AS public.text_trimmed_not_empty_d
	CONSTRAINT text_oneline_d_c_print_chars CHECK (((VALUE)::text ~ '^[[:print:]]*$'::text))
	CONSTRAINT text_oneline_d_c_ste2100 CHECK ((length((VALUE)::text) <= 2100));


COMMENT ON DOMAIN public.text_oneline_d IS 'A one line string — alphanumeric chars, punctuation and space are ok but not tabs or newlines or control chars. At most 2100 chars — there has to be some limit. And old IE11 had a max URL length of 2083 chars so 2100 seems nice (in case is a URL). Also, the Sitemaps protocol supports only up to 2048 chars, https://www.sitemaps.org/protocol.html.';


CREATE DOMAIN public.text_oneline_60_d AS public.text_oneline_d
	CONSTRAINT text_oneline_60_d_c_ste60 CHECK ((length((VALUE)::text) <= 60));


CREATE DOMAIN public.email_name_d AS public.text_oneline_60_d
	CONSTRAINT email_name_d_c_regex CHECK (((VALUE)::text !~ '[!"#$%&();<=>?@[\]^`{|}]|//|https?:|script:'::text));


CREATE DOMAIN public.i64_d AS bigint;


CREATE DOMAIN public.i64_lt2e9_d AS public.i64_d
	CONSTRAINT i64_lt2e9_d_c_lt2e9 CHECK (((VALUE)::bigint < 2000000000));


CREATE DOMAIN public.i64_lt2e9_gz_d AS public.i64_lt2e9_d
	CONSTRAINT i64_lt2e9_gz_d_c_gz CHECK (((VALUE)::bigint > 0));


CREATE DOMAIN public.event_id_d AS public.i64_lt2e9_gz_d;


CREATE DOMAIN public.event_type_d AS public.i16_gz_d;


CREATE DOMAIN public.f32_d AS real;


CREATE DOMAIN public.f32_gez_d AS real
	CONSTRAINT f32gez_c_gez CHECK ((VALUE >= (0)::double precision));


CREATE DOMAIN public.f32_gz_d AS real
	CONSTRAINT f32gz_c_gz CHECK ((VALUE > (0)::double precision));


CREATE DOMAIN public.f64_d AS double precision;


CREATE DOMAIN public.f64_gez_d AS double precision
	CONSTRAINT f64gez_c_gez CHECK ((VALUE >= (0)::double precision));


CREATE DOMAIN public.f64_gz_d AS double precision
	CONSTRAINT f64gz_c_gz CHECK ((VALUE > (0)::double precision));


CREATE DOMAIN public.flagged_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.hidden_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.text_nonempty_ste30_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste30_d_c_ste30 CHECK ((length((VALUE)::text) <= 30));


CREATE DOMAIN public.html_class_suffix_30_d AS public.text_nonempty_ste30_d
	CONSTRAINT html_class_suffix_30_d_c_regex CHECK (((VALUE)::text ~ '^[a-zA-Z0-9_-]*$'::text));


COMMENT ON DOMAIN public.html_class_suffix_30_d IS 'Text that make sense to append to a CSS class: ASCII alnum and "-_", at most 30 chars.';


CREATE DOMAIN public.http_url_d AS text
	CONSTRAINT http_url_d_c_maxlen CHECK ((length(VALUE) <= 2100))
	CONSTRAINT http_url_d_c_no_blanks CHECK ((VALUE !~ '\s'::text))
	CONSTRAINT http_url_d_c_regex CHECK ((VALUE ~ '^https?:\/\/[a-z0-9_.-]+(:[0-9]+)?(/.*)?$'::text));


CREATE DOMAIN public.http_url_ste_250_d AS public.http_url_d
	CONSTRAINT http_url_ste_250_d_c_ste250 CHECK ((length((VALUE)::text) <= 250));


CREATE DOMAIN public.i16_gz_lt1000_d AS public.i16_gz_d
	CONSTRAINT i16_gz_lt1000_d_c_lt1000 CHECK (((VALUE)::smallint < 1000));


CREATE DOMAIN public.i16_gz_lt10_000_d AS public.i16_gz_d
	CONSTRAINT i16_gz_lt10_000_d_c_lt10_000 CHECK (((VALUE)::smallint < 10000));


CREATE DOMAIN public.i16_nz_d AS smallint
	CONSTRAINT i16_nz_d_c_nz CHECK ((VALUE <> 0));


CREATE DOMAIN public.i32_abs_lt2e9_d AS public.i32_lt2e9_d
	CONSTRAINT i32_abs_lt2e9_d_c_gt_m2e9 CHECK (((VALUE)::integer > '-2000000000'::integer));


CREATE DOMAIN public.i32_abs_lt2e9_nz_d AS public.i32_abs_lt2e9_d
	CONSTRAINT i32_abs_lt2e9_nz_d_c_nz CHECK (((VALUE)::integer <> 0));


CREATE DOMAIN public.i32_gez_d AS integer
	CONSTRAINT i32gez_c_gez CHECK ((VALUE >= 0));


CREATE DOMAIN public.i32_gz_lt1000_d AS public.i32_gz_d
	CONSTRAINT i32_gz_lt1000_d_c_lt1000 CHECK (((VALUE)::integer < 1000));


CREATE DOMAIN public.i32_gz_lt1024_d AS public.i32_gz_d
	CONSTRAINT i32_gz_lt1024_d_c_lt1024 CHECK (((VALUE)::integer < 1024));


CREATE DOMAIN public.i32_gz_lt10_000_d AS public.i32_gz_d
	CONSTRAINT i32_gz_lt10_000_d_c_lt10_000 CHECK (((VALUE)::integer < 10000));


CREATE DOMAIN public.i32_gz_lt128_d AS public.i32_gz_d
	CONSTRAINT i32_gz_lt128_d_c_lt128 CHECK (((VALUE)::integer < 128));


CREATE DOMAIN public.i32_lt2e9_gt1000_d AS public.i32_lt2e9_d
	CONSTRAINT i32_lt2e9_gt1000_d_c_gt1000 CHECK (((VALUE)::integer > 1000));


CREATE DOMAIN public.i64_abs_lt2e9_d AS public.i64_lt2e9_d
	CONSTRAINT i64_abs_lt2e9_d_c_gt_m2e9 CHECK (((VALUE)::bigint > '-2000000000'::integer));


CREATE DOMAIN public.i64_abs_lt2e9_nz_d AS public.i64_abs_lt2e9_d
	CONSTRAINT i64_abs_lt2e9_nz_d_c_nz CHECK (((VALUE)::bigint <> 0));


CREATE DOMAIN public.i64_gez_d AS bigint
	CONSTRAINT i64gez_c_gez CHECK ((VALUE >= 0));


CREATE DOMAIN public.i64_gz_d AS bigint
	CONSTRAINT i64gz_c_gz CHECK ((VALUE > 0));


CREATE DOMAIN public.i64_lt2e9_gt1000_d AS public.i64_lt2e9_d
	CONSTRAINT i64_lt2e9_gt1000_d_c_gt1000 CHECK (((VALUE)::bigint > 1000));


CREATE DOMAIN public.i64_nz_d AS bigint
	CONSTRAINT i64_nz_d_c_nz CHECK ((VALUE <> 0));


CREATE DOMAIN public.index_prio_d AS public.i16_nz_d
	CONSTRAINT index_prio_d_c_eq102 CHECK (((VALUE)::smallint = 102));


CREATE DOMAIN public.jsonb_ste1000_d AS jsonb
	CONSTRAINT jsonb_ste1000_d_c_ste1000 CHECK ((pg_column_size(VALUE) <= 1000));


CREATE DOMAIN public.jsonb_ste100_000_d AS jsonb
	CONSTRAINT jsonb_ste100_000_d_c_ste100_000 CHECK ((pg_column_size(VALUE) <= 100000));


CREATE DOMAIN public.jsonb_ste16000_d AS jsonb
	CONSTRAINT jsonb_ste16000_d_c_ste16000 CHECK ((pg_column_size(VALUE) <= 16000));


CREATE DOMAIN public.jsonb_ste2000_d AS jsonb
	CONSTRAINT jsonb_ste2000_d_c_ste2000 CHECK ((pg_column_size(VALUE) <= 2000));


CREATE DOMAIN public.jsonb_ste250_000_d AS jsonb
	CONSTRAINT jsonb_ste250_000_d_c_ste250_000 CHECK ((pg_column_size(VALUE) <= 250000));


CREATE DOMAIN public.jsonb_ste4000_d AS jsonb
	CONSTRAINT jsonb_ste4000_d_c_ste4000 CHECK ((pg_column_size(VALUE) <= 4000));


CREATE DOMAIN public.jsonb_ste500_000_d AS jsonb
	CONSTRAINT jsonb_ste500_000_d_c_ste500_000 CHECK ((pg_column_size(VALUE) <= 500000));


CREATE DOMAIN public.jsonb_ste500_d AS jsonb
	CONSTRAINT jsonb_ste500_d_c_ste500 CHECK ((pg_column_size(VALUE) <= 500));


CREATE DOMAIN public.jsonb_ste8000_d AS jsonb
	CONSTRAINT jsonb_ste8000_d_c_ste8000 CHECK ((pg_column_size(VALUE) <= 8000));


CREATE DOMAIN public.key_hex_b64us_d AS text
	CONSTRAINT key_hex_b64us_d_c_maxlen CHECK ((length(VALUE) < 250))
	CONSTRAINT key_hex_b64us_d_c_minlen CHECK ((length(VALUE) >= 24))
	CONSTRAINT key_hex_b64us_d_c_prefix CHECK ((VALUE ~ '^(base64:|hex:).*$'::text))
	CONSTRAINT key_hex_b64us_d_c_regex CHECK ((VALUE ~ '^([a-z0-9]+:)?[a-zA-Z0-9_=-]*$'::text));


CREATE DOMAIN public.max_nesting_d AS public.i16_d
	CONSTRAINT max_nesting_d_c_eq_m1_or_gtz CHECK ((((VALUE)::smallint = '-1'::integer) OR ((VALUE)::smallint >= 1)))
	CONSTRAINT max_nesting_d_c_lte100 CHECK (((VALUE)::smallint <= 100));


CREATE DOMAIN public.pat_id_d AS public.i32_abs_lt2e9_nz_d;


CREATE DOMAIN public.member_id_d AS public.pat_id_d
	CONSTRAINT member_id_d_c_gtz CHECK (((VALUE)::integer > 0));


CREATE DOMAIN public.never_always_d AS public.i16_d
	CONSTRAINT never_always_d_c_in_2_3_7_8 CHECK (((VALUE)::smallint = ANY (ARRAY[2, 3, 7, 8])));


CREATE DOMAIN public.page_id_d__later AS public.i64_lt2e9_gz_d;


CREATE DOMAIN public.page_id_st_d AS public.text_nonempty_ste60_d
	CONSTRAINT page_id_st_d_c_chars CHECK (((VALUE)::text ~ '^[a-zA-Z0-9_]*$'::text));


CREATE DOMAIN public.page_sort_order_d AS public.i16_gz_d
	CONSTRAINT page_sort_order_d_c_lt100 CHECK (((VALUE)::smallint < 100));


CREATE DOMAIN public.page_type_d AS public.i16_gz_lt1000_d;


CREATE DOMAIN public.pat_rel_type_d AS public.i16_gz_lt1000_d;


COMMENT ON DOMAIN public.pat_rel_type_d IS '
Says what a relationship from a pat to a post (or sth else) means. Ex:
PatRelType.AssignedTo or VotedOn, from a pat to a post.
Is a thing_type_d.
';


CREATE DOMAIN public.pic_url_d AS character varying
	CONSTRAINT picurl_c_len_gz CHECK ((length((VALUE)::text) > 0))
	CONSTRAINT picurl_c_len_max CHECK ((length((VALUE)::text) <= 2100));


CREATE DOMAIN public.post_id_d AS public.i32_lt2e9_gz_d;


CREATE DOMAIN public.post_nr_d AS public.i32_abs_lt2e9_d;


COMMENT ON DOMAIN public.post_nr_d IS '
On each page, the Orig Post is nr 1, the first reply is nr 2, and so on.
Title posts currently have nr = 0. Comments in private sub threads will have nrs < 0?
';


CREATE DOMAIN public.post_rel_type_d AS public.i16_gz_lt1000_d;


COMMENT ON DOMAIN public.post_rel_type_d IS '
Says what a relationship from a post to somehting means, e.g.
PostRelType.AnswerTo (other post) / FlagOf (posts or pats) / DuplicateOf (other post).
Is a thing_type_d.
';


CREATE DOMAIN public.post_type_d AS public.i16_gz_lt1000_d;


CREATE DOMAIN public.postponed_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.private_status_d AS public.i16_gz_lt1024_d
	CONSTRAINT private_status_d_c_null_1 CHECK (((VALUE IS NULL) OR ((VALUE)::smallint = 1)));


COMMENT ON DOMAIN public.private_status_d IS '
If not null, the page or post and all descendants, are private.
The value will show if more private pats can bee added, but for now, always 1.
';


CREATE DOMAIN public.pseudonym_status_d AS public.i32_d
	CONSTRAINT pseudonym_status_d_c_null CHECK ((VALUE IS NULL));


CREATE FUNCTION public.is_valid_ext_id(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
  -- No start or end whitespace. No tabs or newlines inside (spaces = ok, so can incl names). [05970KF5]
  -- Max 128 chars (SHA-512 in hex).
  return text ~ '^[[:graph:]]([[:graph:] ]*[[:graph:]])?$' and length(text) between 1 and 128;
end;
$_$;


CREATE DOMAIN public.ref_id_d AS text
	CONSTRAINT ref_id_d_c_valid CHECK (public.is_valid_ext_id((VALUE)::character varying));


COMMENT ON DOMAIN public.ref_id_d IS '
Reference id. Can be provided by API clients, when they create posts, users, tag types,
categories, whatever, via the API. Talkyard remembers the ref id, and in subsequent
API requests, the clients can reference the reference id, use it as a stable identifier
— it stays the same, also if the-referenced-thing gets renamed or gets a new URL path.

Previously called "external id", but "reference id" is a more precise name? And
used by lots of other software.
';


CREATE DOMAIN public.retry_nr_d AS public.i16_d
	CONSTRAINT retry_nr_d_c_m1_gte1 CHECK ((((VALUE)::smallint = '-1'::integer) OR ((VALUE)::smallint >= 1)));


COMMENT ON DOMAIN public.retry_nr_d IS '-1 = manual extra retry; 1, 2, 3 ... = automatic retry nr, null = not a retry.';


CREATE DOMAIN public.rev_nr_d AS public.i32_lt2e9_gz_d;


COMMENT ON DOMAIN public.rev_nr_d IS '
Post revision number (if it''s been edited).
 ';


CREATE DOMAIN public.review_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.secret_alnum_d AS text
	CONSTRAINT secret_alnum_d_c_alnum CHECK ((VALUE ~ '^[a-zA-Z0-9]*$'::text))
	CONSTRAINT secret_alnum_d_c_maxlen CHECK ((length(VALUE) <= 200))
	CONSTRAINT secret_alnum_d_c_minlen CHECK ((length(VALUE) >= 20));


CREATE DOMAIN public.secret_status_d AS public.i16_gz_d
	CONSTRAINT secret_status_d_c_lte6 CHECK (((VALUE)::smallint <= 6));


CREATE DOMAIN public.site_id_d AS public.i32_abs_lt2e9_nz_d;


CREATE DOMAIN public.text_nonempty_ste250_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste250_d_c_ste250 CHECK ((length((VALUE)::text) <= 250));


CREATE FUNCTION public.is_trimmed(value text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    return value ~ '^(\S(.*\S)?)?$';
end;
$_$;


CREATE DOMAIN public.text_nonempty_ste250_trimmed_d AS public.text_nonempty_ste250_d
	CONSTRAINT text_nonempty_ste250_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.smtp_msg_id_out_d AS public.text_nonempty_ste250_trimmed_d
	CONSTRAINT smtp_msg_id_out_d_c_chars CHECK (((VALUE)::text ~ '^([a-zA-Z0-9_.+-]+@[a-z0-9_.-]+(:[0-9]+)?)?$'::text));


COMMENT ON DOMAIN public.smtp_msg_id_out_d IS 'A Talkyard generated SMTP Message-ID, e.g. "abcd-123-456+hmm@forum.example.com".';


CREATE DOMAIN public.text_nonempty_ste60_trimmed_d AS public.text_nonempty_ste60_d
	CONSTRAINT text_nonempty_ste60_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.smtp_msg_id_out_prefix_d AS public.text_nonempty_ste60_trimmed_d
	CONSTRAINT smtp_msg_id_out_prefix_d_c_chars CHECK (((VALUE)::text ~ '^[a-zA-Z0-9_.+-]*$'::text));


COMMENT ON DOMAIN public.smtp_msg_id_out_prefix_d IS 'The start of a Talkyard generated SMTP Message-ID to the left of the "@".';


CREATE DOMAIN public.smtp_msg_ids_out_d AS text[]
	CONSTRAINT smtp_msg_ids_out_d_c_chars CHECK (((array_to_string(VALUE, ' '::text) || ' '::text) ~ '^([a-zA-Z0-9_.+-]+@[a-z0-9_.-]+(:[0-9]+)? )* ?$'::text))
	CONSTRAINT smtp_msg_ids_out_d_c_nonempty CHECK ((length(array_to_string(VALUE, ''::text)) > 0))
	CONSTRAINT smtp_msg_ids_out_d_c_size_lt_8000 CHECK ((pg_column_size(VALUE) < 8000));


COMMENT ON DOMAIN public.smtp_msg_ids_out_d IS '
Talkyard generated SMTP Message-IDs, e.g. ["aa@b.c", "dd-11+22@ff.gg"].
 ';


CREATE DOMAIN public.sub_type_d AS public.i32_gz_d;


COMMENT ON DOMAIN public.sub_type_d IS '
Clarifies what this thing is, in more detail. E.g. for a PostType.Flag thing,
the sub type clarifies why the post was flagged — e.g. FlagType.Spam.
Or if the type of a relationship is PatRelType.AssignedTo, then, the sub type
can mean assigned-to-do-what. See Scala PatRelType.
';


CREATE DOMAIN public.tag_id_d AS public.i32_lt2e9_gz_d;


CREATE DOMAIN public.text_nonempty_ste120_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste120_d_c_ste120 CHECK ((length((VALUE)::text) <= 120));


CREATE DOMAIN public.text_nonempty_ste120_trimmed_d AS public.text_nonempty_ste120_d
	CONSTRAINT text_nonempty_ste120_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE FUNCTION public.is_ok_tag_chars(txt text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    -- No separators like semicolon and commas, '(){}[]' etcetera.
    -- Sync with Scala [ok_tag_chars]
    return txt ~ '^[[:alnum:] ''!?&#%_.:=/^~+*-]*$';
end;
$_$;


CREATE DOMAIN public.tag_name_120_d AS public.text_nonempty_ste120_trimmed_d
	CONSTRAINT tag_name_120_d_c_chars CHECK (public.is_ok_tag_chars((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste15_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste15_d_c_ste15 CHECK ((length((VALUE)::text) <= 15));


COMMENT ON DOMAIN public.text_nonempty_ste15_d IS 'Non-empty text, shorter than or equal to 15 chars long.';


CREATE DOMAIN public.text_nonempty_ste15_trimmed_d AS public.text_nonempty_ste15_d
	CONSTRAINT text_nonempty_ste15_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


COMMENT ON DOMAIN public.text_nonempty_ste15_trimmed_d IS 'Like text_nonempty_ste15_d, but does not start or end with spaces, tabs, newlines.';


CREATE DOMAIN public.tag_name_15_d AS public.text_nonempty_ste15_trimmed_d
	CONSTRAINT tag_name_15_d_c_chars CHECK (public.is_ok_tag_chars((VALUE)::text));


COMMENT ON DOMAIN public.tag_name_15_d IS 'Like text_nonempty_ste15_trimmed_d, but allows only alnum, space and some punctuation chars.';


CREATE DOMAIN public.tag_name_60_d AS public.text_nonempty_ste60_trimmed_d
	CONSTRAINT tag_name_60_d_c_chars CHECK (public.is_ok_tag_chars((VALUE)::text));


CREATE DOMAIN public.tagtype_id_d AS public.i32_lt2e9_gt1000_d;


CREATE DOMAIN public.text_nonempty_ste1000_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste1000_d_c_ste1000 CHECK ((length((VALUE)::text) <= 1000));


CREATE DOMAIN public.text_nonempty_ste1000_trimmed_d AS public.text_nonempty_ste1000_d
	CONSTRAINT text_nonempty_ste1000_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste16000_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste16000_d_c_ste16000 CHECK ((length((VALUE)::text) <= 16000));


CREATE DOMAIN public.text_nonempty_ste16000_trimmed_d AS public.text_nonempty_ste16000_d
	CONSTRAINT text_nonempty_ste16000_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste2000_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste2000_d_c_ste2000 CHECK ((length((VALUE)::text) <= 2000));


CREATE DOMAIN public.text_nonempty_ste2000_trimmed_d AS public.text_nonempty_ste2000_d
	CONSTRAINT text_nonempty_ste2000_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste2100_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste2100_d_c_ste2100 CHECK ((length((VALUE)::text) <= 2100));


CREATE DOMAIN public.text_nonempty_ste2100_trimmed_d AS public.text_nonempty_ste2100_d
	CONSTRAINT text_nonempty_ste2100_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste30_trimmed_d AS public.text_nonempty_ste30_d
	CONSTRAINT text_nonempty_ste30_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste4000_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste4000_d_c_ste4000 CHECK ((length((VALUE)::text) <= 4000));


CREATE DOMAIN public.text_nonempty_ste4000_trimmed_d AS public.text_nonempty_ste4000_d
	CONSTRAINT text_nonempty_ste4000_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste500_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste500_d_c_ste500 CHECK ((length((VALUE)::text) <= 500));


CREATE DOMAIN public.text_nonempty_ste500_trimmed_d AS public.text_nonempty_ste500_d
	CONSTRAINT text_nonempty_ste500_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_nonempty_ste8000_d AS public.text_nonempty_inf_d
	CONSTRAINT text_nonempty_ste8000_d_c_ste8000 CHECK ((length((VALUE)::text) <= 8000));


CREATE DOMAIN public.text_nonempty_ste8000_trimmed_d AS public.text_nonempty_ste8000_d
	CONSTRAINT text_nonempty_ste8000_trimmed_d_c_trimmed CHECK (public.is_trimmed((VALUE)::text));


CREATE DOMAIN public.text_oneline_120_d AS public.text_oneline_d
	CONSTRAINT text_oneline_120_d_c_ste120 CHECK ((length((VALUE)::text) <= 120));


CREATE DOMAIN public.text_oneline_15_d AS public.text_oneline_d
	CONSTRAINT text_oneline_15_d_c_ste15 CHECK ((length((VALUE)::text) <= 15));


COMMENT ON DOMAIN public.text_oneline_15_d IS 'Like text_oneline_d, but at most 15 chars long.';


CREATE DOMAIN public.text_oneline_30_d AS public.text_oneline_d
	CONSTRAINT text_oneline_30_d_c_ste30 CHECK ((length((VALUE)::text) <= 30));


CREATE DOMAIN public.thing_type_d AS public.i16_gz_lt1000_d;


COMMENT ON DOMAIN public.thing_type_d IS '
What is something — e.g. a flag, or a comment, or a Like vote, or a group.
In the types_t table, this is the thing_type_c.
PostType.* and PatRelType.* and PostRelType.* are all thing types
so e.g. PostType and PatRelType ids must not overlap (if they did, in types_t,
they''d try to use the same table row).
';


CREATE DOMAIN public.thing_types_d AS public.i64_d
	CONSTRAINT thing_types_d_c_in_7_56 CHECK (((VALUE)::bigint = ANY (ARRAY[(7)::bigint, (56)::bigint])));


CREATE DOMAIN public.trending_period_d AS public.i16_gz_d
	CONSTRAINT trending_period_d_c_lte7 CHECK (((VALUE)::smallint <= 7));


CREATE DOMAIN public.trust_level_or_staff_d AS public.i16_d
	CONSTRAINT trustlevelstaff_c_0_8 CHECK ((((VALUE)::smallint >= 0) AND ((VALUE)::smallint <= 8)));


COMMENT ON DOMAIN public.trust_level_or_staff_d IS '

Trust levels from Stranger = 0 to Core Member = 6, plus dummy trust levels
for staff, i.e. mods = 7 and admins = 8.
';


CREATE DOMAIN public.unwanted_status_d AS public.i16_gz_lt128_d;


CREATE DOMAIN public.url_slug_d AS public.text_nonempty_ste2100_d
	CONSTRAINT url_slug_d_c_lower CHECK ((lower((VALUE)::text) = (VALUE)::text))
	CONSTRAINT url_slug_d_c_regex CHECK (((VALUE)::text ~ '^[[:alnum:]_-]*$'::text));


COMMENT ON DOMAIN public.url_slug_d IS 'Chars that make sense in an URL slug — lowercase alphanumeric, and "-_".';


CREATE DOMAIN public.url_slug_60_d AS public.url_slug_d
	CONSTRAINT url_slug_60_d_c_ste60 CHECK ((length((VALUE)::text) <= 60));


COMMENT ON DOMAIN public.url_slug_60_d IS 'Like url_slug_d, but at most 60 chars long.';


CREATE DOMAIN public.value_type_d AS public.i16_d
	CONSTRAINT value_type_d_c_gtem3_nz CHECK ((((VALUE)::smallint >= '-3'::integer) AND ((VALUE)::smallint <> 0)))
	CONSTRAINT value_type_d_c_lt3000_for_now CHECK (((VALUE)::smallint < 3000));


CREATE DOMAIN public.webhook_id_d AS public.i16_gz_d;


CREATE DOMAIN public.when_mins_d AS public.i32_gez_d
	CONSTRAINT when_mins_d_c_aft_y2010 CHECK (((VALUE)::integer >= 21050000))
	CONSTRAINT when_mins_d_c_bef_y2100 CHECK (((VALUE)::integer <= 68400000));


COMMENT ON DOMAIN public.when_mins_d IS 'A point in time, in minutes (not seconds) since 1970, so fits in an i32. To catch bugs, must be between year 2010 and 2100.';


CREATE FUNCTION public.contains_blank(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
begin
    return text ~ '\s';
end;
$$;


CREATE FUNCTION public.delete_page(the_site_id character varying, the_page_id character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
delete from post_actions3 where TENANT = the_site_id and PAGE_ID = the_page_id;
delete from page_paths3 where TENANT = the_site_id and PAGE_ID = the_page_id;
delete from posts3 where SITE_ID = the_site_id and PAGE_ID = the_page_id;
delete from pages3 where TENANT = the_site_id and GUID = the_page_id;
end;
$$;


CREATE FUNCTION public.emails3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    begin
        -- Sent emails cannot be made unset, so ignore deletes.
        if (tg_op = 'UPDATE') then
            if (old.sent_on is null and new.sent_on is not null) then
                update sites3
                    set num_emails_sent = num_emails_sent + 1
                    where id = new.site_id;
            end if;
        elsif (tg_op = 'INSERT') then
            if (new.sent_on is not null) then
                update sites3
                    set num_emails_sent = num_emails_sent + 1
                    where id = new.site_id;
            end if;
        end if;
        return null;
    end;
$$;


CREATE FUNCTION public.hex_to_int(hexval character varying) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    result  int;
BEGIN
    EXECUTE 'SELECT x''' || hexval || '''::int' INTO result;
    RETURN result;
END;
$$;


CREATE FUNCTION public.identities3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_identities = num_identities + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.inc_next_page_id(site_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
next_id int;
begin
update sites3
set NEXT_PAGE_ID = NEXT_PAGE_ID + 1
where ID = site_id
returning NEXT_PAGE_ID into next_id;
return next_id - 1;
end;
$$;


CREATE FUNCTION public.index_friendly(value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
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
$$;


CREATE FUNCTION public.is_menu_spec(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
  return text  ~ '^\S+(\|\S+)?$' and text !~ '[!"\#\$\%\&''\(\)\*\+,\.:;\<=\>\?@\[\\\]\^`\{\}~]';
end;
$_$;


CREATE FUNCTION public.is_ok_trust_level(trust_level integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
begin
    return trust_level between 0 and 7;
end;
$$;


CREATE FUNCTION public.is_trimmed(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    if text ~ '^\s+' then
      return false;
    end if;
    if text ~ '\s+$' then
      return false;
    end if;
    return true;
end;
$_$;


CREATE FUNCTION public.is_valid_css_class(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    return text ~ '^[ a-zA-Z0-9_-]+$';
end;
$_$;


CREATE FUNCTION public.is_valid_hash_path(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    return
    text ~ '^[0-9a-z]/[0-9a-z]/[0-9a-z\.]+$' or -- old, deprecated, remove later
    text ~ '^([a-z][a-z0-9]*/)?[0-9][0-9]?/[0-9a-z]/[0-9a-z]{2}/[0-9a-z\.]+$';
end;
$_$;


CREATE FUNCTION public.is_valid_notf_level(notf_level integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
begin
    return notf_level between 1 and 9;  -- sync with Scala code [7KJE0W3]
end;
$$;


CREATE FUNCTION public.is_valid_tag_label(text character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
begin
    -- No whitespace, commas, ';' etcetera. Sync with Scala [7JES4R3]
    return text ~ '^[^\s,;\|''"<>]+$' and length(text) between 1 and 100;
end;
$_$;


CREATE FUNCTION public.notfs3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_notfs = num_notfs + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.now_utc() RETURNS timestamp without time zone
    LANGUAGE plpgsql
    AS $$
begin
  -- Truncate to millis, so can be represented as a Java date.
  return date_trunc('milliseconds', now() at time zone 'utc');
end;
$$;


CREATE FUNCTION public.one_unless_null(anybool boolean) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
begin
  if anyBool is null then
    return 0;
  end if;
  return 1;
end;
$$;


CREATE FUNCTION public.one_unless_null(anyvalue integer) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
begin
  if anyValue is null then
    return 0;
  end if;
  return 1;
end;
$$;


CREATE FUNCTION public.one_unless_null(anyvarchar character varying) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
begin
  if anyVarchar is null then
    return 0;
  end if;
  return 1;
end;
$$;


CREATE FUNCTION public.page_users3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_role_settings = num_role_settings + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.pages3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_pages = num_pages + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.post_actions3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            return null;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_actions = num_actions + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.post_read_stats3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_posts_read = num_posts_read + delta_rows
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.post_revs3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        delta_bytes integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_bytes =
                - coalesce(length(old.source_patch), 0)
                - coalesce(length(old.full_source), 0)
                - coalesce(length(old.title), 0);
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_bytes =
                + coalesce(length(new.source_patch), 0)
                + coalesce(length(new.full_source), 0)
                + coalesce(length(new.title), 0),
                - coalesce(length(old.source_patch), 0)
                - coalesce(length(old.full_source), 0)
                - coalesce(length(old.title), 0);
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_bytes =
                + coalesce(length(new.source_patch), 0)
                + coalesce(length(new.full_source), 0)
                + coalesce(length(new.title), 0);
            site_id = new.site_id;
        end if;
        update sites3
            set num_post_revisions = num_post_revisions + delta_rows,
                num_post_rev_bytes = num_post_rev_bytes + delta_bytes
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.posts3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        delta_text_bytes integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_text_bytes =
                - coalesce(length(old.approved_source), 0)
                - coalesce(length(old.curr_rev_source_patch), 0);
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_text_bytes =
                + coalesce(length(new.approved_source), 0)
                + coalesce(length(new.curr_rev_source_patch), 0)
                - coalesce(length(old.approved_source), 0)
                - coalesce(length(old.curr_rev_source_patch), 0);
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_text_bytes =
                + coalesce(length(new.approved_source), 0)
                + coalesce(length(new.curr_rev_source_patch), 0);
            site_id = new.site_id;
        end if;
        update sites3
            set num_posts = num_posts + delta_rows,
                num_post_text_bytes = num_post_text_bytes + delta_text_bytes
            where id = site_id;
        return null;
    end;
$$;


CREATE FUNCTION public.trim_all(text character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $_$
begin
    -- There's: Related Unicode characters without White_Space property,
    -- but that doesn't make sense at the very the beginning or end of some text.
    -- see:
    --   https://en.wikipedia.org/wiki/Whitespace_character:
    --   https://stackoverflow.com/a/22701212/694469.
    -- E.g. Mongolian vowel separator, zero width space, word joiner.
    -- So, \s to trim all whitespace, plus \u... to trim those extra chars.
    return regexp_replace(text,
            '^[\s\u180e\u200b\u200c\u200d\u2060\ufeff]+' ||
            '|' ||
            '[\s\u180e\u200b\u200c\u200d\u2060\ufeff]+$', '', 'g');
end;
$_$;


CREATE FUNCTION public.update_upload_ref_count(the_base_url character varying, the_hash_path character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
    num_post_refs int;
    num_avatar_refs int;
    num_refs int;
begin
    -- (Don't use site_id here — uploads3 is for all sites)
    select count(*) into num_post_refs
        from upload_refs3 where base_url = the_base_url and hash_path = the_hash_path;
    select count(*) into num_avatar_refs
        from users3
        where (avatar_tiny_base_url = the_base_url and avatar_tiny_hash_path = the_hash_path)
             or (avatar_small_base_url = the_base_url and avatar_small_hash_path = the_hash_path)
             or (avatar_medium_base_url = the_base_url and avatar_medium_hash_path = the_hash_path);
    num_refs = num_post_refs + num_avatar_refs;
    update uploads3 set
        updated_at = now_utc(),
        num_references = num_refs,
        unused_since =
            case when num_refs > 0 then null else
              case
                when unused_since is null then now_utc()
                else unused_since
              end
            end
        where base_url = the_base_url and hash_path = the_hash_path;
end $$;


CREATE FUNCTION public.users3_sum_quota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    declare
        delta_rows integer;
        site_id integer;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.site_id;
        end if;
        update sites3
            set num_roles = num_roles + delta_rows
            where id = site_id;
        return null;
    end;
$$;


SET default_with_oids = false;





CREATE TABLE public.alt_page_ids3 (
    site_id integer NOT NULL,
    alt_page_id character varying NOT NULL,
    real_page_id character varying NOT NULL,
    CONSTRAINT altpageids_altid_c_len CHECK (((length((alt_page_id)::text) >= 1) AND (length((alt_page_id)::text) <= 300)))
);


CREATE TABLE public.api_secrets3 (
    site_id integer NOT NULL,
    secret_nr integer NOT NULL,
    user_id integer,
    created_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone,
    is_deleted boolean DEFAULT false NOT NULL,
    secret_key character varying NOT NULL,
    CONSTRAINT apisecrets_c_createdat_lte_deletedat CHECK ((created_at <= deleted_at)),
    CONSTRAINT apisecrets_c_deleted_has_deletedat CHECK (((NOT is_deleted) OR (deleted_at IS NOT NULL))),
    CONSTRAINT apisecrets_c_nr_not_for_imp CHECK ((secret_nr < 2000000000)),
    CONSTRAINT apisecrets_c_secretkey_alnum CHECK (((secret_key)::text ~ '^[a-zA-Z0-9]+$'::text)),
    CONSTRAINT apisecrets_c_secretkey_len CHECK (((length((secret_key)::text) >= 20) AND (length((secret_key)::text) <= 200)))
);


CREATE TABLE public.audit_log3 (
    site_id integer NOT NULL,
    audit_id bigint NOT NULL,
    doer_id_c integer NOT NULL,
    done_at timestamp without time zone NOT NULL,
    did_what smallint NOT NULL,
    details character varying,
    ip inet,
    browser_id_cookie character varying,
    browser_fingerprint integer,
    anonymity_network character varying,
    country character varying,
    region character varying,
    city character varying,
    page_id character varying,
    page_role smallint,
    post_id integer,
    post_nr integer,
    post_action_type integer,
    post_action_sub_id integer,
    target_page_id character varying,
    target_post_id integer,
    target_post_nr integer,
    target_pat_id_c integer,
    target_site_id integer,
    size_bytes integer,
    upload_hash_path character varying,
    upload_file_name character varying,
    email_address character varying,
    batch_id bigint,
    forgotten smallint DEFAULT 0 NOT NULL,
    doer_true_id_c public.member_id_d,
    target_pat_true_id_c public.member_id_d,
    sess_id_part_1 public.base64us_len16_d,
    CONSTRAINT auditlog_c_didwhat_in CHECK (((did_what >= 1) AND (did_what <= 9999))),
    CONSTRAINT auditlog_c_doer_trueid_null CHECK (((doer_true_id_c IS NULL) OR (doer_id_c IS NOT NULL))),
    CONSTRAINT auditlog_c_id_not_for_imp CHECK ((audit_id < 2000000000)),
    CONSTRAINT auditlog_c_postnr_not_for_imp CHECK ((post_nr < 2000000000)),
    CONSTRAINT auditlog_c_postnr_null CHECK (((post_nr IS NULL) OR (post_id IS NOT NULL))),
    CONSTRAINT auditlog_c_targetpat_trueid_null CHECK (((target_pat_true_id_c IS NULL) OR (target_pat_id_c IS NOT NULL))),
    CONSTRAINT auditlog_c_targetpostid_not_for_imp CHECK ((target_post_id < 2000000000)),
    CONSTRAINT auditlog_c_targetpostnr_not_for_imp CHECK ((target_post_nr < 2000000000)),
    CONSTRAINT auditlog_c_targetuserid_not_for_imp CHECK ((target_pat_id_c < 2000000000)),
    CONSTRAINT dw2_auditlog_batchid_btwn_1_id__c CHECK (((batch_id >= 1) AND (batch_id <= audit_id))),
    CONSTRAINT dw2_auditlog_emailaddr__c_email CHECK (((email_address)::text ~~ '%_@_%'::text)),
    CONSTRAINT dw2_auditlog_emailaddr__c_len CHECK (((length((email_address)::text) >= 3) AND (length((email_address)::text) <= 200))),
    CONSTRAINT dw2_auditlog_hashpath__c CHECK (public.is_valid_hash_path(upload_hash_path)),
    CONSTRAINT dw2_auditlog_hashpathsuffix__c_len CHECK (((length((upload_hash_path)::text) >= 1) AND (length((upload_hash_path)::text) <= 100))),
    CONSTRAINT dw2_auditlog_page_post__c CHECK (((did_what <> 3) OR ((page_id IS NOT NULL) AND (post_id IS NOT NULL)))),
    CONSTRAINT dw2_auditlog_pagerole__c_in CHECK (((page_role >= 1) AND (page_role <= 100))),
    CONSTRAINT dw2_auditlog_pagerole_pageid__c CHECK (((page_role IS NULL) OR (page_id IS NOT NULL))),
    CONSTRAINT dw2_auditlog_postaction__c CHECK (((post_action_type IS NULL) = (post_action_sub_id IS NULL))),
    CONSTRAINT dw2_auditlog_postaction__c2 CHECK (((post_action_type IS NULL) OR (post_id IS NOT NULL))),
    CONSTRAINT dw2_auditlog_size__c_gez CHECK ((size_bytes >= 0)),
    CONSTRAINT dw2_auditlog_tgtpost__c CHECK (((target_post_nr IS NULL) = (target_post_id IS NULL))),
    CONSTRAINT dw2_auditlog_uploadfilename__c CHECK (((upload_file_name)::text !~~ '%/%'::text)),
    CONSTRAINT dw2_auditlog_uploadfilename__c_len CHECK (((length((upload_file_name)::text) >= 1) AND (length((upload_file_name)::text) <= 200)))
);


CREATE TABLE public.backup_test_log3 (
    logged_at timestamp without time zone NOT NULL,
    logged_by character varying NOT NULL,
    backup_of_what character varying NOT NULL,
    random_value character varying NOT NULL,
    got_ok_message_at timestamp without time zone,
    file_name character varying,
    CONSTRAINT backuptestlog_c_filename_len CHECK (((length((file_name)::text) >= 1) AND (length((file_name)::text) <= 200)))
);


CREATE TABLE public.blocks3 (
    site_id integer NOT NULL,
    threat_level smallint,
    blocked_at timestamp without time zone NOT NULL,
    blocked_till timestamp without time zone,
    blocked_by_id integer NOT NULL,
    ip inet,
    browser_id_cookie character varying,
    CONSTRAINT dw2_blocks__c_something_blocked CHECK (((browser_id_cookie IS NOT NULL) OR (ip IS NOT NULL))),
    CONSTRAINT dw2_blocks_blockedat_till__c CHECK ((blocked_at <= blocked_till))
);


CREATE TABLE public.categories3 (
    site_id integer NOT NULL,
    id integer NOT NULL,
    page_id character varying NOT NULL,
    parent_id integer,
    name character varying NOT NULL,
    slug character varying NOT NULL,
    "position" integer NOT NULL,
    description character varying,
    new_topic_types character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    locked_at timestamp without time zone,
    frozen_at timestamp without time zone,
    deleted_at timestamp without time zone,
    unlist_category boolean DEFAULT false NOT NULL,
    staff_only boolean DEFAULT false NOT NULL,
    only_staff_may_create_topics boolean DEFAULT false NOT NULL,
    default_topic_type smallint DEFAULT 12,
    default_category_id integer,
    incl_in_summaries smallint,
    unlist_topics boolean,
    ext_id character varying,
    def_sort_order_c public.page_sort_order_d,
    def_score_alg_c public.i16_gez_d,
    def_score_period_c public.trending_period_d,
    do_vote_style_c public.do_vote_style_d,
    do_vote_in_topic_list_c boolean,
    comt_order_c public.comt_order_d,
    comt_nesting_c public.max_nesting_d,
    comts_start_hidden_c public.never_always_d,
    comts_start_anon_c public.never_always_d,
    op_starts_anon_c public.never_always_d,
    new_anon_status_c public.anonym_status_d,
    CONSTRAINT categories_c_extid_ok CHECK (public.is_valid_ext_id(ext_id)),
    CONSTRAINT categories_c_id_not_for_imp CHECK ((id < 2000000000)),
    CONSTRAINT cats_c_defscorealg_period CHECK (((def_score_alg_c IS NULL) = (def_score_period_c IS NULL))),
    CONSTRAINT cats_default_or_parent__c_nn CHECK (((default_category_id IS NOT NULL) OR (parent_id IS NOT NULL))),
    CONSTRAINT cats_topictype__c_in CHECK (((default_topic_type >= 1) AND (default_topic_type <= 100))),
    CONSTRAINT dw2_cats_created_deleted__c_le CHECK ((created_at <= deleted_at)),
    CONSTRAINT dw2_cats_created_frozen__c_le CHECK ((created_at <= frozen_at)),
    CONSTRAINT dw2_cats_created_locked__c_le CHECK ((created_at <= locked_at)),
    CONSTRAINT dw2_cats_created_updated__c_le CHECK ((created_at <= updated_at)),
    CONSTRAINT dw2_cats_description__c_len CHECK ((length((description)::text) < 1000)),
    CONSTRAINT dw2_cats_name__c_len CHECK (((length((name)::text) >= 1) AND (length((name)::text) <= 100))),
    CONSTRAINT dw2_cats_newtopictypes__c CHECK (((new_topic_types)::text ~ '^([0-9]+,)*[0-9]+$'::text)),
    CONSTRAINT dw2_cats_slug__c_len CHECK (((length((slug)::text) >= 1) AND (length((slug)::text) <= 100)))
);


CREATE TABLE public.drafts3 (
    site_id integer NOT NULL,
    by_user_id integer NOT NULL,
    draft_nr integer NOT NULL,
    draft_type smallint NOT NULL,
    created_at timestamp without time zone NOT NULL,
    last_edited_at timestamp without time zone,
    deleted_at timestamp without time zone,
    category_id integer,
    to_user_id integer,
    topic_type smallint,
    page_id character varying,
    post_nr integer,
    post_id integer,
    post_type smallint,
    title character varying NOT NULL,
    text character varying NOT NULL,
    new_anon_status_c public.anonym_status_d,
    post_as_id_c public.pat_id_d,
    order_c public.f32_d,
    CONSTRAINT drafts_c_createdat_lte_deletedat CHECK ((created_at <= deleted_at)),
    CONSTRAINT drafts_c_createdat_lte_lasteditedat CHECK ((created_at <= last_edited_at)),
    CONSTRAINT drafts_c_lasteditedat_lte_deletedat CHECK ((last_edited_at <= deleted_at)),
    CONSTRAINT drafts_c_nr_gte_1 CHECK ((draft_nr >= 1)),
    CONSTRAINT drafts_c_nr_not_for_imp CHECK ((draft_nr < 2000000000)),
    CONSTRAINT drafts_c_postnr_has_pageid CHECK (((post_nr IS NULL) OR (page_id IS NOT NULL))),
    CONSTRAINT drafts_c_text_len_lte_500k CHECK ((length((text)::text) <= (500 * 1000))),
    CONSTRAINT drafts_c_title_len_lte_500 CHECK ((length((title)::text) <= 500)),
    CONSTRAINT drafts_c_type_direct_message CHECK (((draft_type <> 3) OR ((category_id IS NULL) AND (topic_type IS NOT NULL) AND (page_id IS NULL) AND (post_nr IS NULL) AND (post_id IS NULL) AND (post_type IS NULL) AND (to_user_id IS NOT NULL)))),
    CONSTRAINT drafts_c_type_edit CHECK (((draft_type <> 4) OR ((category_id IS NULL) AND (topic_type IS NULL) AND (page_id IS NOT NULL) AND (post_nr IS NOT NULL) AND (post_id IS NOT NULL) AND (to_user_id IS NULL)))),
    CONSTRAINT drafts_c_type_reply CHECK (((draft_type <> 5) OR ((category_id IS NULL) AND (topic_type IS NULL) AND (page_id IS NOT NULL) AND (post_nr IS NOT NULL) AND (post_id IS NOT NULL) AND (post_type IS NOT NULL) AND (to_user_id IS NULL)))),
    CONSTRAINT drafts_c_type_topic CHECK (((draft_type <> 2) OR ((category_id IS NOT NULL) AND (topic_type IS NOT NULL) AND (page_id IS NOT NULL) AND (post_nr IS NULL) AND (post_id IS NULL) AND (post_type IS NULL) AND (to_user_id IS NULL))))
);


COMMENT ON TABLE public.drafts3 IS '
Should remove, and store drafts in posts_t/nodes_t instead. [drafts3_2_nodes_t]
With negative nrs, to indicate that they''re private (others can''t see
one''s drafts). Then, once published, the nr changes to the next public nr
on the relevant page (i.e. 1, 2, 3, ...).
But what about the `title` column — there''s no title column in posts_t.
Maybe wait until pages are stored in nodes_t, and then create both a
title & a body post that together become the new page draft.
';


COMMENT ON COLUMN public.drafts3.order_c IS '
For sorting drafts in one''s todo list (with tasks, bookmarks, drafts).
Once drafts3 has been merged into posts_t, maybe merge posts_t.pinned_position
into order_c? Then use it both for sorting personal posts
(drafts, bookmarks) and for public post pin order (if any — rarely used).
';


CREATE SEQUENCE public.dw1_tenants_id
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TABLE public.emails_out3 (
    site_id integer NOT NULL,
    email_id_c character varying(32) NOT NULL,
    sent_to character varying NOT NULL,
    sent_on timestamp without time zone,
    subject character varying NOT NULL,
    body_html character varying NOT NULL,
    provider_email_id character varying,
    failure_type character varying(1) DEFAULT NULL::character varying,
    failure_text character varying,
    failure_time timestamp without time zone,
    out_type_c public.i16_gz_lt1000_d NOT NULL,
    created_at timestamp without time zone NOT NULL,
    to_user_id integer,
    can_login_again boolean,
    sent_from_c public.email_d,
    num_replies_back_c public.i16_gez_d,
    secret_value_c public.secret_alnum_d,
    secret_status_c public.secret_status_d,
    smtp_msg_id_c public.smtp_msg_id_out_d,
    smtp_in_reply_to_c public.smtp_msg_id_out_d,
    smtp_in_reply_to_more_c public.smtp_msg_ids_out_d,
    smtp_references_c public.smtp_msg_ids_out_d,
    by_pat_id_c public.pat_id_d,
    about_pat_id_c public.pat_id_d,
    about_cat_id_c public.cat_id_d,
    about_tag_id_c public.tag_id_d,
    about_page_id_str_c public.page_id_st_d,
    about_page_id_int_c public.page_id_d__later,
    about_post_id_c public.post_id_d,
    about_post_nr_c public.post_nr_d,
    about_parent_nr_c public.post_nr_d,
    out_sub_type_c public.i16_gz_lt1000_d,
    CONSTRAINT dw1_emlot_created_sent__c_le CHECK ((created_at <= sent_on)),
    CONSTRAINT dw1_emlot_failtext_type__c CHECK (((failure_text IS NULL) = (failure_type IS NULL))),
    CONSTRAINT dw1_emlot_failtime_type__c CHECK (((failure_time IS NULL) = (failure_type IS NULL))),
    CONSTRAINT dw1_emlot_failtype__c CHECK (((failure_type)::text = ANY (ARRAY[('B'::character varying)::text, ('R'::character varying)::text, ('C'::character varying)::text, ('O'::character varying)::text]))),
    CONSTRAINT dw1_emlot_failuretext__c_len CHECK ((length((failure_text)::text) <= 10000)),
    CONSTRAINT dw1_emlot_provideremailid__c_len CHECK ((length((provider_email_id)::text) <= 200)),
    CONSTRAINT dw1_emlot_sentto__c_len CHECK ((length((sent_to)::text) <= 200)),
    CONSTRAINT dw1_emlot_subject__c_len CHECK (((length((subject)::text) >= 1) AND (length((subject)::text) <= 200))),
    CONSTRAINT emailsout_c_bodyhtml_len CHECK (((length((body_html)::text) >= 1) AND (length((body_html)::text) <= 20000))),
    CONSTRAINT emailsout_c_secretval_status_null CHECK (((secret_value_c IS NULL) OR (secret_status_c IS NOT NULL))),
    CONSTRAINT emailsout_c_senton_sentfrom_null CHECK (((sent_on IS NOT NULL) OR (sent_from_c IS NULL)))
);


CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


CREATE TABLE public.group_participants3 (
    site_id integer NOT NULL,
    group_id integer NOT NULL,
    participant_id integer NOT NULL,
    is_member boolean DEFAULT false NOT NULL,
    is_manager boolean DEFAULT false NOT NULL,
    is_adder boolean DEFAULT false NOT NULL,
    is_bouncer boolean DEFAULT false NOT NULL,
    CONSTRAINT groupparticipants_c_no_built_in_groups CHECK ((group_id >= 100)),
    CONSTRAINT groupparticipants_c_no_guests_or_built_in_users CHECK ((participant_id >= 100)),
    CONSTRAINT groupparticipants_c_pp_does_sth CHECK ((is_member OR is_manager OR is_adder OR is_bouncer))
);


CREATE TABLE public.guest_prefs3 (
    site_id integer NOT NULL,
    ctime timestamp without time zone NOT NULL,
    version character(1) NOT NULL,
    email character varying(100) NOT NULL,
    email_notfs character varying(1) NOT NULL,
    CONSTRAINT dw1_idsmpleml_email__c CHECK (((email)::text ~~ '%@%.%'::text)),
    CONSTRAINT dw1_idsmpleml_notfs__c CHECK (((email_notfs)::text = ANY (ARRAY[('R'::character varying)::text, ('N'::character varying)::text, ('F'::character varying)::text]))),
    CONSTRAINT dw1_idsmpleml_version__c CHECK ((version = ANY (ARRAY['C'::bpchar, 'O'::bpchar])))
);


CREATE TABLE public.hosts3 (
    site_id integer NOT NULL,
    host character varying NOT NULL,
    canonical character varying(1) NOT NULL,
    ctime timestamp without time zone DEFAULT now() NOT NULL,
    mtime timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT dw1_hosts_host__c_len CHECK (((length((host)::text) >= 1) AND (length((host)::text) <= 100))),
    CONSTRAINT hosts_c_role_in CHECK (((canonical)::text = ANY ((ARRAY['C'::character varying, 'R'::character varying, 'L'::character varying, 'D'::character varying, 'X'::character varying])::text[])))
);


CREATE TABLE public.identities3 (
    idty_id_c integer NOT NULL,
    site_id integer NOT NULL,
    user_id_c integer NOT NULL,
    user_id_orig_c integer NOT NULL,
    oid_claimed_id character varying(500),
    oid_op_local_id character varying(500),
    oid_realm character varying(100),
    oid_endpoint character varying(100),
    oid_version character varying(100),
    first_name_c character varying,
    email_adr_c character varying,
    country_c character varying,
    inserted_at_c timestamp without time zone DEFAULT now() NOT NULL,
    last_name_c character varying,
    full_name_c character varying,
    picture_url_c public.pic_url_d,
    conf_file_idp_id_c character varying,
    idp_user_id_c character varying,
    broken_idp_sth_c character varying,
    idp_id_c integer,
    oidc_id_token_str_c character varying,
    oidc_id_token_json_c jsonb,
    idp_user_json_c jsonb,
    pref_username_c character varying,
    idp_realm_id_c character varying,
    idp_realm_user_id_c character varying,
    issuer_c character varying,
    is_email_verified_by_idp_c boolean,
    nickname_c character varying,
    middle_name_c character varying,
    phone_nr_c character varying,
    is_phone_nr_verified_by_idp_c boolean,
    profile_url_c character varying,
    website_url_c character varying,
    gender_c character varying,
    birthdate_c character varying,
    time_zone_info_c character varying,
    locale_c character varying,
    is_realm_guest_c boolean,
    last_updated_at_idp_at_sec_c bigint,
    CONSTRAINT dw1_idsoid_sno_not_0__c CHECK (((idty_id_c)::text <> '0'::text)),
    CONSTRAINT identities_c_id_not_for_imp CHECK ((idty_id_c < 2000000000)),
    CONSTRAINT idtys_c_birthdate_len CHECK (((length((birthdate_c)::text) >= 1) AND (length((birthdate_c)::text) <= 100))),
    CONSTRAINT idtys_c_brokenidpsth_len CHECK (((length((broken_idp_sth_c)::text) >= 1) AND (length((broken_idp_sth_c)::text) <= 1000))),
    CONSTRAINT idtys_c_conffileidpid_len CHECK ((length((conf_file_idp_id_c)::text) < 500)),
    CONSTRAINT idtys_c_country_len CHECK (((length((country_c)::text) >= 1) AND (length((country_c)::text) <= 250))),
    CONSTRAINT idtys_c_email_len CHECK (((length((email_adr_c)::text) >= 1) AND (length((email_adr_c)::text) <= 250))),
    CONSTRAINT idtys_c_emailadr_emailverified_null CHECK (((email_adr_c IS NOT NULL) OR (NOT is_email_verified_by_idp_c))),
    CONSTRAINT idtys_c_firstname_len CHECK (((length((first_name_c)::text) >= 1) AND (length((first_name_c)::text) <= 250))),
    CONSTRAINT idtys_c_fullname_len CHECK (((length((full_name_c)::text) >= 1) AND (length((full_name_c)::text) <= 250))),
    CONSTRAINT idtys_c_gender_len CHECK (((length((gender_c)::text) >= 1) AND (length((gender_c)::text) <= 100))),
    CONSTRAINT idtys_c_idprealmid_len CHECK (((length((idp_realm_id_c)::text) >= 1) AND (length((idp_realm_id_c)::text) <= 500))),
    CONSTRAINT idtys_c_idprealmid_realmuserid_null CHECK (((idp_realm_id_c IS NOT NULL) OR (idp_realm_user_id_c IS NULL))),
    CONSTRAINT idtys_c_idprealmuserid_len CHECK (((length((idp_realm_user_id_c)::text) >= 1) AND (length((idp_realm_user_id_c)::text) <= 500))),
    CONSTRAINT idtys_c_idpuserid_len CHECK (((length((idp_user_id_c)::text) >= 1) AND (length((idp_user_id_c)::text) <= 500))),
    CONSTRAINT idtys_c_idpuserjson_len CHECK (((pg_column_size(idp_user_json_c) >= 1) AND (pg_column_size(idp_user_json_c) <= 7000))),
    CONSTRAINT idtys_c_issuer_len CHECK (((length((issuer_c)::text) >= 1) AND (length((issuer_c)::text) <= 500))),
    CONSTRAINT idtys_c_lastname_len CHECK (((length((last_name_c)::text) >= 1) AND (length((last_name_c)::text) <= 250))),
    CONSTRAINT idtys_c_lastupdatedatidpatsec_len CHECK ((last_updated_at_idp_at_sec_c >= 0)),
    CONSTRAINT idtys_c_locale_len CHECK (((length((locale_c)::text) >= 1) AND (length((locale_c)::text) <= 250))),
    CONSTRAINT idtys_c_middlename_len CHECK (((length((middle_name_c)::text) >= 1) AND (length((middle_name_c)::text) <= 250))),
    CONSTRAINT idtys_c_nickname_len CHECK (((length((nickname_c)::text) >= 1) AND (length((nickname_c)::text) <= 250))),
    CONSTRAINT idtys_c_oidcidtokenjson CHECK (((pg_column_size(oidc_id_token_json_c) >= 1) AND (pg_column_size(oidc_id_token_json_c) <= 7000))),
    CONSTRAINT idtys_c_oidcidtokenstr CHECK (((length((oidc_id_token_str_c)::text) >= 1) AND (length((oidc_id_token_str_c)::text) <= 7000))),
    CONSTRAINT idtys_c_one_type CHECK ((num_nonnulls(oid_claimed_id, idp_id_c, conf_file_idp_id_c, broken_idp_sth_c) = 1)),
    CONSTRAINT idtys_c_phonenr_len CHECK (((length((phone_nr_c)::text) >= 1) AND (length((phone_nr_c)::text) <= 250))),
    CONSTRAINT idtys_c_phonenr_phonenrverified_null CHECK (((phone_nr_c IS NOT NULL) OR (NOT is_phone_nr_verified_by_idp_c))),
    CONSTRAINT idtys_c_prefusername_len CHECK (((length((pref_username_c)::text) >= 1) AND (length((pref_username_c)::text) <= 200))),
    CONSTRAINT idtys_c_profileurl_len CHECK (((length((profile_url_c)::text) >= 1) AND (length((profile_url_c)::text) <= 500))),
    CONSTRAINT idtys_c_timezoneinfo_len CHECK (((length((time_zone_info_c)::text) >= 1) AND (length((time_zone_info_c)::text) <= 250))),
    CONSTRAINT idtys_c_websiteurl_len CHECK (((length((website_url_c)::text) >= 1) AND (length((website_url_c)::text) <= 500)))
);


COMMENT ON COLUMN public.identities3.idp_user_id_c IS '

For OIDC, this is the ''sub'', Subject Identifier.
';


CREATE TABLE public.idps_t (
    site_id_c integer NOT NULL,
    idp_id_c integer NOT NULL,
    protocol_c character varying NOT NULL,
    alias_c character varying NOT NULL,
    enabled_c boolean NOT NULL,
    display_name_c character varying,
    description_c character varying,
    admin_comments_c character varying,
    trust_verified_email_c boolean NOT NULL,
    link_account_no_login_c boolean NOT NULL,
    gui_order_c integer,
    sync_mode_c integer NOT NULL,
    oidc_config_url character varying,
    oidc_config_fetched_at timestamp without time zone,
    oidc_config_json_c jsonb,
    oau_authorization_url_c character varying NOT NULL,
    oau_auth_req_scope_c character varying,
    oau_auth_req_claims_c jsonb,
    oau_auth_req_claims_locales_c character varying,
    oau_auth_req_ui_locales_c character varying,
    oau_auth_req_display_c character varying,
    oau_auth_req_prompt_c character varying,
    oau_auth_req_max_age_c integer,
    oau_auth_req_hosted_domain_c character varying,
    oau_auth_req_access_type_c character varying,
    oau_auth_req_include_granted_scopes_c boolean,
    oau_access_token_url_c character varying NOT NULL,
    oau_access_token_auth_method_c character varying,
    oau_client_id_c character varying NOT NULL,
    oau_client_secret_c character varying NOT NULL,
    oau_issuer_c character varying,
    oidc_user_info_url_c character varying NOT NULL,
    oidc_user_info_fields_map_c jsonb,
    oidc_userinfo_req_send_user_ip_c boolean,
    oidc_logout_url_c character varying,
    email_verified_domains_c character varying,
    CONSTRAINT idps_c_admincomments_len CHECK (((length((admin_comments_c)::text) >= 1) AND (length((admin_comments_c)::text) <= 5000))),
    CONSTRAINT idps_c_alias_chars CHECK (((alias_c)::text ~ '^[a-z0-9_-]+$'::text)),
    CONSTRAINT idps_c_alias_len CHECK (((length((alias_c)::text) >= 1) AND (length((alias_c)::text) <= 50))),
    CONSTRAINT idps_c_description_len CHECK (((length((description_c)::text) >= 1) AND (length((description_c)::text) <= 1000))),
    CONSTRAINT idps_c_displayname_len CHECK (((length((display_name_c)::text) >= 1) AND (length((display_name_c)::text) <= 200))),
    CONSTRAINT idps_c_displayname_trim CHECK (((public.trim_all(display_name_c))::text = (display_name_c)::text)),
    CONSTRAINT idps_c_emailverifieddomains_len CHECK (((length((email_verified_domains_c)::text) >= 1) AND (length((email_verified_domains_c)::text) <= 11000))),
    CONSTRAINT idps_c_id_gtz CHECK ((idp_id_c > 0)),
    CONSTRAINT idps_c_oauaccesstokenauthmethod_in CHECK (((oau_access_token_auth_method_c)::text = ANY ((ARRAY['client_secret_basic'::character varying, 'client_secret_post'::character varying])::text[]))),
    CONSTRAINT idps_c_oauaccesstokenurl_len CHECK (((length((oau_access_token_url_c)::text) >= 1) AND (length((oau_access_token_url_c)::text) <= 500))),
    CONSTRAINT idps_c_oauauthorizationurl_len CHECK (((length((oau_authorization_url_c)::text) >= 1) AND (length((oau_authorization_url_c)::text) <= 500))),
    CONSTRAINT idps_c_oauauthreqaccesstype_in CHECK (((oau_auth_req_access_type_c)::text = ANY ((ARRAY['online'::character varying, 'offline'::character varying])::text[]))),
    CONSTRAINT idps_c_oauauthreqclaims_len CHECK (((pg_column_size(oau_auth_req_claims_c) >= 1) AND (pg_column_size(oau_auth_req_claims_c) <= 5000))),
    CONSTRAINT idps_c_oauauthreqclaimslocales_len CHECK (((length((oau_auth_req_claims_locales_c)::text) >= 1) AND (length((oau_auth_req_claims_locales_c)::text) <= 200))),
    CONSTRAINT idps_c_oauauthreqdisplay_in CHECK (((oau_auth_req_display_c)::text = ANY ((ARRAY['page'::character varying, 'popup'::character varying, 'touch'::character varying, 'wap'::character varying])::text[]))),
    CONSTRAINT idps_c_oauauthreqhosteddomain_len CHECK (((length((oau_auth_req_hosted_domain_c)::text) >= 1) AND (length((oau_auth_req_hosted_domain_c)::text) <= 200))),
    CONSTRAINT idps_c_oauauthreqmaxage_gtz CHECK ((oau_auth_req_max_age_c > 0)),
    CONSTRAINT idps_c_oauauthreqprompt_in CHECK (((oau_auth_req_prompt_c)::text = ANY ((ARRAY['none'::character varying, 'login'::character varying, 'consent'::character varying, 'select_account'::character varying])::text[]))),
    CONSTRAINT idps_c_oauauthreqscope_len CHECK (((length((oau_auth_req_scope_c)::text) >= 1) AND (length((oau_auth_req_scope_c)::text) <= 200))),
    CONSTRAINT idps_c_oauauthrequilocales_len CHECK (((length((oau_auth_req_ui_locales_c)::text) >= 1) AND (length((oau_auth_req_ui_locales_c)::text) <= 200))),
    CONSTRAINT idps_c_oauclientid_len CHECK (((length((oau_client_id_c)::text) >= 1) AND (length((oau_client_id_c)::text) <= 200))),
    CONSTRAINT idps_c_oauclientsecret_len CHECK (((length((oau_client_secret_c)::text) >= 1) AND (length((oau_client_secret_c)::text) <= 200))),
    CONSTRAINT idps_c_oauissuer_len CHECK (((length((oau_issuer_c)::text) >= 1) AND (length((oau_issuer_c)::text) <= 200))),
    CONSTRAINT idps_c_oidcconfigjson_len CHECK (((pg_column_size(oidc_config_json_c) >= 1) AND (pg_column_size(oidc_config_json_c) <= 11000))),
    CONSTRAINT idps_c_oidcconfigurl_len CHECK (((length((oidc_config_url)::text) >= 1) AND (length((oidc_config_url)::text) <= 500))),
    CONSTRAINT idps_c_oidclogouturl_len CHECK (((length((oidc_logout_url_c)::text) >= 1) AND (length((oidc_logout_url_c)::text) <= 500))),
    CONSTRAINT idps_c_oidcuserinfofieldsmap_len CHECK (((pg_column_size(oidc_user_info_fields_map_c) >= 1) AND (pg_column_size(oidc_user_info_fields_map_c) <= 3000))),
    CONSTRAINT idps_c_oidcuserinfourl_len CHECK (((length((oidc_user_info_url_c)::text) >= 1) AND (length((oidc_user_info_url_c)::text) <= 500))),
    CONSTRAINT idps_c_protocol CHECK (((protocol_c)::text = ANY ((ARRAY['oidc'::character varying, 'oauth2'::character varying])::text[]))),
    CONSTRAINT idps_c_syncmode CHECK (((sync_mode_c >= 1) AND (sync_mode_c <= 10)))
);


COMMENT ON TABLE public.idps_t IS '

OIDC and OAuth2 providers, e.g. a company''s private Keycloak server.
';


COMMENT ON COLUMN public.idps_t.protocol_c IS '

Lowercase, because is lowercase in the url path. Is incl in the primary
key, so one can change from say  /-/authn/oauth2/the-alias to
/-/authn/oidc/the-alias  without having to change the alias (or disable
the old authn for a short while).
';


COMMENT ON COLUMN public.idps_t.alias_c IS '

Alnum lowercase, because appears in urls.
';


COMMENT ON COLUMN public.idps_t.gui_order_c IS '

When logging in, identity providers with lower numbers are shown first.
(If one has configured more than one provider.)
';


COMMENT ON COLUMN public.idps_t.sync_mode_c IS '

What to do, when logging in, if there''s already a user in the Ty database
with the same email address, or the same external identity id.
E.g. just login, don''t sync. Or overwrite fields in the Ty database
with values from the IDP, maybe even update the email address.''
';


COMMENT ON COLUMN public.idps_t.oau_access_token_auth_method_c IS '

How the Talkyard server authenticates with the ID provider, when
sending the auth code to get the OAuth2 access token.
Null and ''client_secret_basic'' means
HTTP Basic Auth, whilst ''client_secret_post'' means ''client_id'' and
''client_secret'' in the form-data encoded POST body (not recommended).

OIDC also mentions ''client_secret_jwt'', ''private_key_jwt'' and ''none'',
see https://openid.net/specs/openid-connect-core-1_0.html#ClientAuthentication,
— Talkyard doesn''t support these.

Also see: https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
> ... Client, then it MUST authenticate to the Token Endpoint using
> the authentication method registered for its client_id ...
';


COMMENT ON COLUMN public.idps_t.oidc_user_info_fields_map_c IS '

How to convert custom OAuth2 user json fields to standard OIDC user info fields
— so Talkyard can work together with custom OAuth2 implementations,
as long as the authn flow is similar to OIDC, except for in the last
user info step: the OAuth2 user info endpoint can return its own
non-standard json.
';


CREATE TABLE public.invites3 (
    site_id integer NOT NULL,
    secret_key character varying NOT NULL,
    email_address character varying NOT NULL,
    created_by_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    accepted_at timestamp without time zone,
    user_id integer,
    deleted_at timestamp without time zone,
    deleted_by_id integer,
    invalidated_at timestamp without time zone,
    start_at_url character varying,
    add_to_group_id integer,
    CONSTRAINT dw2_invites_accepted_user__c CHECK (((accepted_at IS NULL) = (user_id IS NULL))),
    CONSTRAINT dw2_invites_deleted__c CHECK (((deleted_at IS NULL) = (deleted_by_id IS NULL))),
    CONSTRAINT dw2_invites_deleted__c2 CHECK (((deleted_at IS NULL) OR (accepted_at IS NULL))),
    CONSTRAINT dw2_invites_deleted__c3 CHECK ((deleted_at >= created_at)),
    CONSTRAINT dw2_invites_email__c CHECK ((((email_address)::text ~~ '%@%'::text) AND (length((email_address)::text) >= 3))),
    CONSTRAINT dw2_invites_invalidated__c CHECK ((invalidated_at >= created_at)),
    CONSTRAINT dw2_invites_invalidated__c2 CHECK (((invalidated_at IS NULL) OR (accepted_at IS NULL))),
    CONSTRAINT dw2_invites_invalidated_deleted__c CHECK (((invalidated_at IS NULL) OR (deleted_at IS NULL))),
    CONSTRAINT dw2_invites_secretkey__c_len CHECK ((length((secret_key)::text) > 20)),
    CONSTRAINT invites_c_startaturl_len CHECK (((length((start_at_url)::text) >= 1) AND (length((start_at_url)::text) <= 100)))
);


CREATE TABLE public.job_queue_t (
    inserted_at timestamp without time zone DEFAULT public.now_utc() NOT NULL,
    action_at timestamp without time zone NOT NULL,
    site_id integer NOT NULL,
    site_version integer NOT NULL,
    page_id character varying,
    page_version integer,
    post_id integer,
    post_rev_nr integer,
    cat_id_c public.i32_nz_d,
    pat_id_c public.i32_nz_d,
    type_id_c public.i32_nz_d,
    time_range_from_c timestamp without time zone,
    time_range_from_ofs_c public.i32_d,
    time_range_to_c timestamp without time zone,
    time_range_to_ofs_c public.i32_d,
    do_what_c public.i64_nz_d DEFAULT 1 NOT NULL,
    CONSTRAINT ixq_page_pageversion__c_nl_eq CHECK (((page_id IS NULL) = (page_version IS NULL))),
    CONSTRAINT ixq_post_postrevnr__c_nl_eq CHECK (((post_id IS NULL) = (post_rev_nr IS NULL))),
    CONSTRAINT jobq_c_0_post_w_timerange CHECK (((post_id IS NULL) OR (time_range_to_c IS NULL))),
    CONSTRAINT jobq_c_one_thing CHECK (((num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, type_id_c) = 1) OR ((num_nonnulls(page_id, post_id, cat_id_c, pat_id_c, type_id_c) = 0) AND (time_range_to_c IS NOT NULL)))),
    CONSTRAINT jobq_c_timerange_for_whole_site_for_now CHECK (((time_range_to_c IS NULL) OR ((post_id IS NULL) AND (page_id IS NULL) AND (cat_id_c IS NULL) AND (pat_id_c IS NULL) AND (type_id_c IS NULL)))),
    CONSTRAINT jobq_c_timerange_from_0_for_now CHECK (((date_part('epoch'::text, time_range_from_c) = (0)::double precision) AND ((time_range_from_ofs_c)::integer = 0))),
    CONSTRAINT jobq_c_timerange_ofs_null CHECK ((((time_range_from_c IS NULL) = (time_range_from_ofs_c IS NULL)) AND ((time_range_from_c IS NULL) = (time_range_to_c IS NULL)) AND ((time_range_from_c IS NULL) = (time_range_to_ofs_c IS NULL))))
);


COMMENT ON TABLE public.job_queue_t IS '

Remembers for example 1) what posts to (re)index, when new posts got posted,
or old got edited.  Or 2) what posts to reindex, after a category got moved
to another parent category.  3) What posts to *rerender* (not reindex),
if e.g. the CDN address has changed, so links to user generated contents
need to get updated, or some other renderer settings changed.

The time_range_from_c and ..._to_c are for (re)indexing parts of, or everything in,
a site — without adding all posts
at once to the index queue and possibly runnign out disk — instead, we add a
time range row, and then we add the most recent say 100 posts in that time range
to the job queue, and decrease the range''s upper bound, handle those 100, pick the
next 100 and so on.

Reindexing everything can be needed, when upgrading to new versions of ElasticSearch,
or if switching to some other search engine (if we''ll support othersearch engines
too), or more fields are to be searchable.

If combining a time range with a category id, then, pages & comments in that
category that got posted during that time, will get processed (e.g. reindexed,
depending on do_what_c).  — Since a page might get moved from one category,
to another category B that is getting reindexed, then, the app server could,
before it starts indexing a page in category B in the time range,
ask ElasticSearch if that page is in fact already up-to-date.

If combining a time range with a tag, then, the cached HTML for pages with that
tag, could be rerendered — maybe the tag name got changed, for example,
so the html is stale. There''s no do_what_c value for rerendering posts or
page html yet though.

If lots of posts were imported simultaneously, they might all have the same
externally generated timestamp. Or if two posts are created at the exact same time
(e.g. page title and body).  Then, to remember where to continue indexing,
a date isn''t enough — we also need a post id offset (combined with a date);
that''s what time_range_from_ofs_c and ...to_ofs_c are for.
(But can''t use just a tsrange.)
';


CREATE TABLE public.link_previews_t (
    site_id_c integer NOT NULL,
    link_url_c character varying NOT NULL,
    fetched_from_url_c character varying NOT NULL,
    fetched_at_c timestamp without time zone NOT NULL,
    cache_max_secs_c integer,
    status_code_c integer NOT NULL,
    preview_type_c integer NOT NULL,
    first_linked_by_id_c integer NOT NULL,
    content_json_c jsonb,
    CONSTRAINT linkpreviews_c_cachemaxsecs CHECK ((cache_max_secs_c >= 0)),
    CONSTRAINT linkpreviews_c_contentjson_len CHECK (((pg_column_size(content_json_c) >= 1) AND (pg_column_size(content_json_c) <= 27000))),
    CONSTRAINT linkpreviews_c_fetchedfromurl_len CHECK (((length((fetched_from_url_c)::text) >= 5) AND (length((fetched_from_url_c)::text) <= 500))),
    CONSTRAINT linkpreviews_c_linkurl_len CHECK (((length((link_url_c)::text) >= 5) AND (length((link_url_c)::text) <= 500))),
    CONSTRAINT linkpreviews_c_previewtype CHECK (((preview_type_c >= 1) AND (preview_type_c <= 9))),
    CONSTRAINT linkpreviews_c_statuscode CHECK ((status_code_c >= 0))
);


COMMENT ON TABLE public.link_previews_t IS '

Caches html <title> and <meta description> tags and any OpenGraph tags,
and/or oEmbed json, for generating html previews of links to external
things, e.g. Twitter tweets.

Sometimes Ty fetches both 1) html and OpenGraph tags directly from
the linked page, and 2) oEmbed json.
Then, there''ll be two rows in this table — one with fetched_from_url_c
= link_url_c, and one with fetched_from_url_c = the oEmbed request url.
The oEmbed data might not include a title, and then,
if the external link is inside a paragraph, so we want to show the
title of the extenal thing only, then it''s good to have any html <title>
tag too.

[defense] [lnpv_t_pk] Both link_url_c and fetched_from_url_c are part of
the primary key — otherwise maybe an attacker could do something weird,
like the following:

    An attacker''s website atkws could hijack a widget from a normal
    website victws, by posting an external link to Talkyard
    that looks like: https://atkws/widget, and then the html at
    https://atkws/widget pretends in a html tag that its oEmbed endpoint is
    VEP = https://victws/oembed?url=https://victws/widget
    and then later when someone tries to link to https://victws/widget,
    whose oEmbed endpoint is VEP for real,
    then, if looking up by fetched_from_url_c = VEP only,
    there''d already be a link_previews_t row for VEP,
    with link_url_c: https//atkws/widget — atkws not victws (!).
    (Because VEP initially got saved via the request to https://atkws/widget.)
    That is, link_url_c would point to the attacker''s site.
    Then, maybe other code in Talkyard adds a "View at: $link_url_c"
    which would send a visitor to the attacker''s website.

But by including both link_url_c and fetched_from_url_c in the primary key,
that cannot happen — when looking up https://victws/widget + VEP,
the attacker''s entry wouldn''t be found (because it''s link_url_c is
https://atkws/..., the wrong website).

There''s an index  linkpreviews_i_g_fetch_err_at  to maybe retry failed fetches
after a while.
';


COMMENT ON COLUMN public.link_previews_t.link_url_c IS '

An extenal link that we want to show a preview for. E.g. a link to a Wikipedia page
or Twitter tweet or YouTube video, or an external image or blog post, whatever.
';


COMMENT ON COLUMN public.link_previews_t.fetched_from_url_c IS '

oEmbed json was fetched from this url. Later: can be empty '''' if
not oEmbed, but instead html <title> or OpenGraph tags — then
fetched_from_url_c would be the same as link_url_c, need not save twice.
';


COMMENT ON COLUMN public.link_previews_t.status_code_c IS '

Is 0 if the request failed completely [ln_pv_netw_err], didn''t get any response.
E.g. TCP RST or timeout. 0 means the same in a browser typically, e.g. request.abort().

However, currently (maybe always?) failed fetches are instead cached temporarily
only, in Redis, so cannot DoS attack the disk storage.  [ln_pv_fetch_errs]
';


COMMENT ON COLUMN public.link_previews_t.content_json_c IS '

Null if the request failed, got no response json. E.g. an error status code,
or a request timeout or TCP RST?   [ln_pv_fetch_errs]
';


CREATE TABLE public.links_t (
    site_id_c integer NOT NULL,
    from_post_id_c integer NOT NULL,
    link_url_c character varying NOT NULL,
    added_at_c timestamp without time zone NOT NULL,
    added_by_id_c integer NOT NULL,
    is_external_c boolean,
    to_staff_space_c boolean,
    to_page_id_c character varying,
    to_post_id_c integer,
    to_pat_id_c integer,
    to_tag_id_c integer,
    to_category_id_c integer,
    CONSTRAINT links_c_isexternal_null_true CHECK ((is_external_c OR (is_external_c IS NULL))),
    CONSTRAINT links_c_linkurl_len CHECK (((length((link_url_c)::text) >= 1) AND (length((link_url_c)::text) <= 500))),
    CONSTRAINT links_c_to_just_one CHECK ((num_nonnulls(is_external_c, to_staff_space_c, to_page_id_c, to_post_id_c, to_pat_id_c, to_tag_id_c, to_category_id_c) = 1)),
    CONSTRAINT links_c_tostaffspace_null_true CHECK ((to_staff_space_c OR (to_staff_space_c IS NULL)))
);


COMMENT ON TABLE public.links_t IS '

The start page id is left out — only the start post id is included,
because otherwise, if moving a post to another page, all links would
have to be updated, easy to forget somewhere. And, performance
wise, on large pages, we wouldn''t want to load all posts anyway, 
only the ones to shown in the browser. (E.g. in a chat we might load
the most recent 100 posts). And to do this, we''d specify
ids of *posts* for which links should get loaded — no need to store any
page id in links_t.

There''s no foreign key to link_previews_t, because maybe no preview has
been fetched yet (or maybe never — maybe broken external link).
';


CREATE TABLE public.notices_t (
    site_id_c integer NOT NULL,
    to_pat_id_c integer NOT NULL,
    notice_id_c public.i32_gz_d NOT NULL,
    first_at_c public.when_mins_d NOT NULL,
    last_at_c public.when_mins_d NOT NULL,
    num_total_c public.i32_gz_d NOT NULL,
    notice_data_c jsonb,
    CONSTRAINT notices_c_firstat_lte_lastat CHECK (((first_at_c)::integer <= (last_at_c)::integer))
);


CREATE TABLE public.notifications3 (
    site_id integer NOT NULL,
    notf_type smallint NOT NULL,
    created_at timestamp without time zone NOT NULL,
    about_page_id_str_c character varying,
    by_user_id integer NOT NULL,
    to_user_id integer NOT NULL,
    email_id character varying,
    email_status smallint DEFAULT 1 NOT NULL,
    seen_at timestamp without time zone,
    about_post_id_c integer,
    action_type smallint,
    action_sub_id smallint,
    notf_id integer NOT NULL,
    smtp_msg_id_prefix_c public.smtp_msg_id_out_prefix_d,
    about_page_id_int_c public.page_id_d__later,
    about_pat_id_c public.pat_id_d,
    about_cat_id_c public.cat_id_d,
    about_tag_id_c public.tag_id_d,
    about_thing_type_c public.thing_type_d,
    about_sub_type_c public.sub_type_d,
    by_true_id_c public.pat_id_d,
    to_true_id_c public.pat_id_d,
    CONSTRAINT dw1_notfs_emailstatus__c_in CHECK (((email_status >= 1) AND (email_status <= 20))),
    CONSTRAINT dw1_notfs_seenat_ge_createdat__c CHECK ((seen_at > created_at)),
    CONSTRAINT dw1_ntfs__c_action CHECK (((action_type IS NOT NULL) = (action_sub_id IS NOT NULL))),
    CONSTRAINT dw1_ntfs_by_to__c_ne CHECK (((by_user_id)::text <> (to_user_id)::text)),
    CONSTRAINT notfs_c_aboutthingtype_subtype_null CHECK (((about_thing_type_c IS NULL) = (about_sub_type_c IS NULL))),
    CONSTRAINT notfs_c_byuserid_ne_bytrueid CHECK ((by_user_id <> (by_true_id_c)::integer)),
    CONSTRAINT notfs_c_notftype_range CHECK (((notf_type >= 101) AND (notf_type <= 999))),
    CONSTRAINT notfs_c_touserid_ne_totrueid CHECK ((to_user_id <> (to_true_id_c)::integer)),
    CONSTRAINT notifications_c_id_not_for_imp CHECK ((notf_id < 2000000000))
);


CREATE TABLE public.page_html_cache_t (
    site_id_c integer NOT NULL,
    page_id_c character varying NOT NULL,
    param_width_layout_c smallint NOT NULL,
    param_is_embedded_c boolean NOT NULL,
    param_origin_or_empty_c character varying NOT NULL,
    param_cdn_origin_or_empty_c character varying NOT NULL,
    cached_site_version_c integer NOT NULL,
    cached_page_version_c integer NOT NULL,
    cached_app_version_c character varying NOT NULL,
    cached_store_json_hash_c character varying NOT NULL,
    updated_at_c timestamp without time zone NOT NULL,
    cached_store_json_c jsonb NOT NULL,
    cached_html_c text NOT NULL,
    param_comt_order_c public.comt_order_d DEFAULT 3 NOT NULL,
    param_comt_nesting_c public.max_nesting_d DEFAULT '-1'::integer NOT NULL,
    param_ugc_origin_or_empty_c text DEFAULT ''::text NOT NULL,
    param_theme_id_c_u public.i16_gz_d DEFAULT 2 NOT NULL,
    CONSTRAINT pagehtmlcache_c_themeid_eq_2 CHECK (((param_theme_id_c_u)::smallint = 2))
);


CREATE TABLE public.page_notf_prefs_t (
    site_id integer NOT NULL,
    pat_id_c integer NOT NULL,
    notf_level integer NOT NULL,
    page_id character varying,
    pages_in_whole_site_c boolean,
    pages_in_cat_id_c integer,
    incl_sub_cats_c boolean,
    pages_pat_created_c boolean,
    pages_pat_replied_to_c boolean,
    CONSTRAINT pagenotfprefs_c_for_sth CHECK ((num_nonnulls(page_id, pages_pat_created_c, pages_pat_replied_to_c, pages_in_cat_id_c, pages_in_whole_site_c) = 1)),
    CONSTRAINT pagenotfprefs_c_inclsubcats CHECK ((incl_sub_cats_c IS NULL)),
    CONSTRAINT pagenotfprefs_c_notf_level CHECK (((notf_level >= 1) AND (notf_level <= 9))),
    CONSTRAINT pagenotfprefs_c_pagespatcreated_true CHECK (pages_pat_created_c),
    CONSTRAINT pagenotfprefs_c_pagespatrepliedto_true CHECK (pages_pat_replied_to_c),
    CONSTRAINT pagenotfprefs_c_wholesite_true CHECK (pages_in_whole_site_c)
);


CREATE TABLE public.page_paths3 (
    site_id integer NOT NULL,
    parent_folder character varying(100) NOT NULL,
    page_id character varying(32) NOT NULL,
    show_id character varying(1) NOT NULL,
    page_slug character varying(100) NOT NULL,
    cdati timestamp without time zone DEFAULT now() NOT NULL,
    canonical_dati timestamp without time zone DEFAULT now() NOT NULL,
    canonical character varying(1) NOT NULL,
    CONSTRAINT dw1_pgpths_cdati_mdati__c_le CHECK ((cdati <= canonical_dati)),
    CONSTRAINT dw1_pgpths_cncl__c CHECK (((canonical)::text = ANY (ARRAY[('C'::character varying)::text, ('R'::character varying)::text]))),
    CONSTRAINT dw1_pgpths_folder__c_dash CHECK (((parent_folder)::text !~~ '%/-%'::text)),
    CONSTRAINT dw1_pgpths_folder__c_start CHECK (((parent_folder)::text ~~ '/%'::text)),
    CONSTRAINT dw1_pgpths_showid__c_in CHECK (((show_id)::text = ANY (ARRAY[('T'::character varying)::text, ('F'::character varying)::text]))),
    CONSTRAINT dw1_pgpths_slug__c_ne CHECK ((btrim((page_slug)::text) <> ''::text))
);


CREATE TABLE public.page_popularity_scores3 (
    site_id integer NOT NULL,
    page_id character varying NOT NULL,
    popular_since timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    score_alg_c public.i16_gz_lt1000_d NOT NULL,
    day_score double precision NOT NULL,
    week_score double precision NOT NULL,
    month_score double precision NOT NULL,
    quarter_score double precision NOT NULL,
    year_score double precision NOT NULL,
    all_score double precision NOT NULL,
    triennial_score_c double precision NOT NULL,
    CONSTRAINT pagepopscores_updat_ge_popsince CHECK ((updated_at >= popular_since))
);


CREATE TABLE public.page_users3 (
    site_id integer NOT NULL,
    page_id character varying NOT NULL,
    user_id integer NOT NULL,
    joined_by_id integer,
    kicked_by_id integer,
    notf_level smallint,
    notf_reason smallint,
    num_seconds_reading integer DEFAULT 0 NOT NULL,
    num_low_posts_read smallint DEFAULT 0 NOT NULL,
    first_visited_at_mins integer,
    last_visited_at_mins integer,
    last_viewed_post_nr integer,
    last_read_at_mins integer,
    last_read_post_nr integer,
    recently_read_nrs bytea,
    low_post_nrs_read bytea,
    incl_in_summary_email_at_mins integer,
    CONSTRAINT pageusers_c_gez CHECK (((num_seconds_reading >= 0) AND (num_low_posts_read >= 0) AND ((last_visited_at_mins >= first_visited_at_mins) OR (last_visited_at_mins IS NULL)) AND ((last_viewed_post_nr >= 0) OR (last_viewed_post_nr IS NULL)) AND ((last_read_at_mins >= first_visited_at_mins) OR (last_read_at_mins IS NULL)) AND ((last_read_post_nr >= 0) OR (last_read_post_nr IS NULL)))),
    CONSTRAINT pageusers_c_lastreadpostnr_not_for_imp CHECK ((last_read_post_nr < 2000000000)),
    CONSTRAINT pageusers_c_lastviewedpostnr_not_for_imp CHECK ((last_viewed_post_nr < 2000000000)),
    CONSTRAINT pageusers_lastreadat_lastreadpostnr_c_null CHECK (((last_read_at_mins IS NOT NULL) OR (last_read_post_nr IS NULL))),
    CONSTRAINT pageusers_lastreadat_low_last_nrs_c_null CHECK (((last_read_at_mins IS NOT NULL) OR ((low_post_nrs_read IS NULL) AND (recently_read_nrs IS NULL)))),
    CONSTRAINT pageusers_lastreadat_numsecondsreading_c_0 CHECK (((last_read_at_mins IS NULL) = (num_seconds_reading = 0))),
    CONSTRAINT pageusers_lastvisited_firstvisited_c_null CHECK (((last_visited_at_mins IS NULL) = (first_visited_at_mins IS NULL))),
    CONSTRAINT pageusers_lastvisited_lastreadat_c_null CHECK (((last_visited_at_mins IS NOT NULL) OR (last_read_at_mins IS NULL))),
    CONSTRAINT pageusers_lastvisited_lastviewedpostnr_c_null CHECK (((last_visited_at_mins IS NOT NULL) OR (last_viewed_post_nr IS NULL))),
    CONSTRAINT pageusers_notflevel_c_in CHECK (((notf_level >= 1) AND (notf_level <= 20))),
    CONSTRAINT pageusers_notfreason_c_in CHECK (((notf_reason >= 1) AND (notf_reason <= 20))),
    CONSTRAINT pageusers_reason_level_c_null CHECK (((notf_reason IS NULL) OR (notf_level IS NOT NULL)))
);


CREATE TABLE public.pages3 (
    site_id integer NOT NULL,
    page_id character varying(32) NOT NULL,
    page_role smallint NOT NULL,
    category_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    published_at timestamp without time zone DEFAULT now(),
    bumped_at timestamp without time zone NOT NULL,
    author_id integer NOT NULL,
    num_child_pages integer DEFAULT 0 NOT NULL,
    embedding_page_url character varying,
    num_likes integer DEFAULT 0 NOT NULL,
    num_wrongs integer DEFAULT 0 NOT NULL,
    deleted_at timestamp without time zone,
    num_replies_visible integer DEFAULT 0 NOT NULL,
    num_replies_to_review integer DEFAULT 0 NOT NULL,
    num_replies_total integer DEFAULT 0 NOT NULL,
    num_bury_votes integer DEFAULT 0 NOT NULL,
    num_unwanted_votes integer DEFAULT 0 NOT NULL,
    last_reply_at timestamp without time zone,
    pin_order smallint,
    pin_where smallint,
    num_op_like_votes integer DEFAULT 0 NOT NULL,
    num_op_wrong_votes integer DEFAULT 0 NOT NULL,
    num_op_bury_votes integer DEFAULT 0 NOT NULL,
    num_op_unwanted_votes integer DEFAULT 0 NOT NULL,
    num_op_replies_visible integer DEFAULT 0 NOT NULL,
    answered_at timestamp without time zone,
    answer_post_id integer,
    done_at timestamp without time zone,
    closed_at timestamp without time zone,
    locked_at timestamp without time zone,
    frozen_at timestamp without time zone,
    unwanted_at timestamp without time zone,
    planned_at timestamp without time zone,
    version integer DEFAULT 1 NOT NULL,
    last_reply_by_id integer,
    frequent_poster_1_id integer,
    frequent_poster_2_id integer,
    frequent_poster_3_id integer,
    frequent_poster_4_id integer,
    html_tag_css_classes character varying,
    html_head_title character varying,
    html_head_description character varying,
    layout bigint DEFAULT 0 NOT NULL,
    hidden_at timestamp without time zone,
    incl_in_summaries smallint,
    started_at timestamp without time zone,
    postponed_til_c timestamp without time zone,
    num_posts_total integer DEFAULT 0 NOT NULL,
    ext_id character varying,
    num_op_do_it_votes_c public.i32_gez_d DEFAULT 0 NOT NULL,
    num_op_do_not_votes_c public.i32_gez_d DEFAULT 0 NOT NULL,
    answered_by_id_c integer,
    published_by_id_c integer,
    postponed_by_id_c integer,
    planned_by_id_c integer,
    started_by_id_c integer,
    paused_by_id_c integer,
    done_by_id_c integer,
    closed_by_id_c integer,
    locked_by_id_c integer,
    frozen_by_id_c integer,
    unwanted_by_id_c integer,
    hidden_by_id_c integer,
    deleted_by_id_c integer,
    forum_search_box_c public.i16_gz_d,
    forum_main_view_c public.i16_gz_d,
    forum_cats_topics_c public.i32_gz_d,
    comt_order_c public.comt_order_d,
    comt_nesting_c public.max_nesting_d,
    comts_start_hidden_c public.never_always_d,
    comts_start_anon_c public.never_always_d,
    new_anon_status_c public.anonym_status_d,
    CONSTRAINT dw1_pages__c_closed_if_done_answered CHECK ((((done_at IS NULL) AND (answered_at IS NULL)) OR (closed_at IS NOT NULL))),
    CONSTRAINT dw1_pages__c_has_category CHECK (((page_role <> ALL (ARRAY[6, 7, 9])) OR (category_id IS NOT NULL))),
    CONSTRAINT dw1_pages__c_votes_gez CHECK (((num_likes >= 0) AND (num_wrongs >= 0) AND (num_bury_votes >= 0) AND (num_unwanted_votes >= 0))),
    CONSTRAINT dw1_pages_answerat_answerpostid__c CHECK (((answered_at IS NULL) = (answer_post_id IS NULL))),
    CONSTRAINT dw1_pages_cdati_mdati__c_le CHECK ((created_at <= updated_at)),
    CONSTRAINT dw1_pages_cdati_publdati__c_le CHECK ((created_at <= published_at)),
    CONSTRAINT dw1_pages_cdati_smdati__c_le CHECK ((created_at <= bumped_at)),
    CONSTRAINT dw1_pages_createdat_closedat__c_lt CHECK ((created_at <= closed_at)),
    CONSTRAINT dw1_pages_createdat_deletedat__c_lt CHECK ((created_at <= deleted_at)),
    CONSTRAINT dw1_pages_createdat_doneat__c_lt CHECK ((created_at <= done_at)),
    CONSTRAINT dw1_pages_createdat_frozenat__c_lt CHECK ((created_at <= frozen_at)),
    CONSTRAINT dw1_pages_createdat_hiddenat__c_le CHECK ((created_at <= hidden_at)),
    CONSTRAINT dw1_pages_createdat_lockedat_at CHECK ((created_at <= locked_at)),
    CONSTRAINT dw1_pages_createdat_plannedat__c_le CHECK ((created_at <= planned_at)),
    CONSTRAINT dw1_pages_createdat_unwantedat__c_lt CHECK ((created_at <= unwanted_at)),
    CONSTRAINT dw1_pages_embpageurl__c_len CHECK (((length((embedding_page_url)::text) >= 1) AND (length((embedding_page_url)::text) <= 200))),
    CONSTRAINT dw1_pages_embpageurl__c_trim CHECK ((btrim((embedding_page_url)::text) = (embedding_page_url)::text)),
    CONSTRAINT dw1_pages_frequentposter1234__c_null CHECK ((((last_reply_by_id IS NOT NULL) OR (frequent_poster_1_id IS NULL)) AND ((frequent_poster_1_id IS NOT NULL) OR (frequent_poster_2_id IS NULL)) AND ((frequent_poster_2_id IS NOT NULL) OR (frequent_poster_3_id IS NULL)) AND ((frequent_poster_3_id IS NOT NULL) OR (frequent_poster_4_id IS NULL)))),
    CONSTRAINT dw1_pages_htmlheaddescr__c_len CHECK (((length((html_head_description)::text) >= 1) AND (length((html_head_description)::text) <= 1000))),
    CONSTRAINT dw1_pages_htmlheadtitle__c_len CHECK (((length((html_head_title)::text) >= 1) AND (length((html_head_title)::text) <= 200))),
    CONSTRAINT dw1_pages_htmltagcssclass__c_len CHECK (((length((html_tag_css_classes)::text) >= 1) AND (length((html_tag_css_classes)::text) <= 100))),
    CONSTRAINT dw1_pages_htmltagcssclass__c_ptrn CHECK (public.is_valid_css_class(html_tag_css_classes)),
    CONSTRAINT dw1_pages_lastreplyat_byid__c_nn CHECK (((last_reply_at IS NULL) = (last_reply_by_id IS NULL))),
    CONSTRAINT dw1_pages_pagerole__c_in CHECK (((page_role >= 1) AND (page_role <= 30))),
    CONSTRAINT dw1_pages_pinorder_where__c_n CHECK (((pin_where IS NULL) = (pin_order IS NULL))),
    CONSTRAINT dw1_pages_pinwhere__c_in CHECK (((pin_where IS NULL) OR ((pin_where >= 1) AND (pin_where <= 3)))),
    CONSTRAINT dw1_pages_plannedat_doneat__c_le CHECK ((planned_at <= done_at)),
    CONSTRAINT dw1_pages_publdat_bumpedat__c_le CHECK ((published_at <= bumped_at)),
    CONSTRAINT dw1_pages_version__c_gz CHECK ((version >= 1)),
    CONSTRAINT pages_c_answpostid_not_for_imp CHECK ((answer_post_id < 2000000000)),
    CONSTRAINT pages_c_createdat_le_startedat CHECK ((created_at <= started_at)),
    CONSTRAINT pages_c_deletedby_at_null CHECK (((deleted_by_id_c IS NULL) OR (deleted_at IS NOT NULL))),
    CONSTRAINT pages_c_extid_ok CHECK (public.is_valid_ext_id(ext_id)),
    CONSTRAINT pages_c_id_not_for_imp CHECK (((page_id)::text !~~ '200???????'::text)),
    CONSTRAINT pages_c_not_todo CHECK ((page_role <> 13)),
    CONSTRAINT pages_c_numpoststotal_ge_numrepliestotal CHECK ((num_posts_total >= num_replies_total)),
    CONSTRAINT pages_c_plannedat_le_startedat CHECK ((planned_at <= started_at)),
    CONSTRAINT pages_c_startedat_le_doneat CHECK ((started_at <= done_at))
);


CREATE TABLE public.perms_on_pages3 (
    site_id integer NOT NULL,
    perm_id integer NOT NULL,
    for_people_id integer NOT NULL,
    on_whole_site boolean,
    on_category_id integer,
    on_page_id character varying,
    on_post_id integer,
    on_tag_id integer,
    may_edit_page boolean,
    may_edit_comment boolean,
    may_edit_wiki boolean,
    may_edit_own boolean,
    may_delete_page boolean,
    may_delete_comment boolean,
    may_create_page boolean,
    may_post_comment boolean,
    may_see boolean,
    may_see_own boolean,
    may_see_private_flagged boolean,
    can_see_others_priv_c boolean,
    can_see_who_can_see_c public.can_see_who_d,
    can_see_priv_aft_c timestamp without time zone,
    can_post_private_c public.never_always_d,
    can_delete_own_c boolean,
    can_alter_c public.i64_gz_d,
    is_owner_c public.i16_gz_d,
    on_pats_id_c public.pat_id_d,
    can_manage_pats_c public.i64_gz_d,
    can_invite_pats_c public.i64_gz_d,
    can_suspend_pats_c public.i64_gz_d,
    can_assign_pats_c boolean,
    can_assign_self_c boolean,
    can_see_assigned_c public.can_see_who_d,
    CONSTRAINT permsonpages_c_id_not_for_imp CHECK ((perm_id < 2000000000)),
    CONSTRAINT permsonpages_c_not_meaningless CHECK (((may_edit_page IS NOT NULL) OR (may_edit_comment IS NOT NULL) OR (may_edit_wiki IS NOT NULL) OR (may_edit_own IS NOT NULL) OR (may_delete_page IS NOT NULL) OR (may_delete_comment IS NOT NULL) OR (may_create_page IS NOT NULL) OR (may_post_comment IS NOT NULL) OR (may_see IS NOT NULL) OR (may_see_own IS NOT NULL) OR (may_see_private_flagged IS NOT NULL))),
    CONSTRAINT permsonpages_c_on_one CHECK ((1 = ((((public.one_unless_null(on_whole_site) + public.one_unless_null(on_category_id)) + public.one_unless_null(on_page_id)) + public.one_unless_null(on_post_id)) + public.one_unless_null(on_tag_id))))
);


COMMENT ON TABLE public.perms_on_pages3 IS '
Permissions on categories and pages.

But not one private comments, except for  may_see_private_flagged,
which says if someone can see a private comment *if it got flagged*
— because then someone needs to have a look.

A future  [can_post_private_c]  setting would apply to both private
comments and private messages, and would be for a pat and *the whole site*.
Maybe it''d be in  pats_t  not  prems_on_pats_t.
Reasoning: Private comments don''t disturb anyone, so, if one may post
private *messages* (on new pages), one might as well be allowed to post
private comments sub threads too, since otherwise one could just
start a new private message page and link to the comments page.

RENAME to perms_on_pages_t.
';


COMMENT ON COLUMN public.perms_on_pages3.can_see_others_priv_c IS '
If one may see a category, or a private message (a page),
or a private comments thread on a not-private page.
';


COMMENT ON COLUMN public.perms_on_pages3.can_see_who_can_see_c IS '
If pat can see which other pats can see a page or comment tree.
null means inherit, and:
   1 = Cannot see if anyone else can see it.
   2 = See if anyone else can see it, but not who.
   3 = See the primary group(s) of those who can see it, e.g. Support Staff.
   4 = See precisely which individuals can see it, e.g. know which
       others are part of a private discussion — which
      can be important to know, depending on what one has in mind to say,
      and is the default.
';


COMMENT ON COLUMN public.perms_on_pages3.can_see_assigned_c IS '
null means inherit, and:
   1 = Can not see if a task is assigned to anyone.
   2 = See if assigned or not (but not to whom).
   3 = See which group(s) assigned to, e.g. Support Staff, but not
       to which person(s) in the group.
   4 = See precisely which individuals are assigned.
';


CREATE TABLE public.post_actions3 (
    site_id integer NOT NULL,
    action_id integer,
    to_post_id_c integer NOT NULL,
    page_id character varying NOT NULL,
    post_nr integer NOT NULL,
    rel_type_c public.pat_rel_type_d NOT NULL,
    sub_type_c smallint NOT NULL,
    from_pat_id_c integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone,
    deleted_at timestamp without time zone,
    deleted_by_id integer,
    to_post_rev_nr_c public.rev_nr_d,
    dormant_status_c public.dormant_status_d,
    val_i32_c public.i32_d,
    from_true_id_c public.pat_id_d,
    added_by_id_c public.member_id_d,
    order_c public.f32_d,
    CONSTRAINT dw2_postacs__c_delat_by CHECK (((deleted_at IS NULL) = (deleted_by_id IS NULL))),
    CONSTRAINT dw2_postacs__c_delat_ge_creat CHECK ((deleted_at >= created_at)),
    CONSTRAINT dw2_postacs__c_updat_ge_creat CHECK ((updated_at >= created_at)),
    CONSTRAINT dw2_postacs__c_updat_ge_delat CHECK ((updated_at >= deleted_at)),
    CONSTRAINT postactions_c_actionid_not_for_imp CHECK ((action_id < 2000000000)),
    CONSTRAINT postactions_c_postnr_not_for_imp CHECK ((post_nr < 2000000000)),
    CONSTRAINT postactions_c_subid_not_for_imp CHECK ((sub_type_c < 2000000000))
);


COMMENT ON TABLE public.post_actions3 IS '
To be renamed to  pat_post_rels_t or pat_node_rels_t. Currently stores votes,
AssignedTo, and flags.  Later, flags will be kept in posts_t instead,
linked to the flagged things via the upcoming table post_rels_t.
Maybe assigned-to could be a post too? So can add a note about what the assignee 
is assigned to do — maybe assigned-to-review for example. [tasks_2_nodes_t]
';


COMMENT ON COLUMN public.post_actions3.from_true_id_c IS '
The true user behind an anonymous vote. Makes it possible to load all
one''s votes, for the current page, also if one voted anonymously.
';


COMMENT ON COLUMN public.post_actions3.added_by_id_c IS '
If one pat assigns another to a task.
';


COMMENT ON COLUMN public.post_actions3.order_c IS '
For the assignee, so han can reorder the task as han wants, in hans
personal todo list (with tasks, bookmarks, drafts).
';


CREATE TABLE public.post_read_stats3 (
    site_id integer NOT NULL,
    page_id character varying(32) NOT NULL,
    post_nr integer NOT NULL,
    ip character varying(39),
    user_id integer,
    read_at timestamp without time zone NOT NULL
);


CREATE TABLE public.post_revisions3 (
    site_id integer NOT NULL,
    post_id integer NOT NULL,
    revision_nr integer NOT NULL,
    previous_nr integer,
    source_patch text,
    full_source text,
    title character varying,
    composed_at timestamp without time zone NOT NULL,
    composed_by_id integer NOT NULL,
    approved_at timestamp without time zone,
    approved_by_id integer,
    hidden_at timestamp without time zone,
    hidden_by_id integer,
    CONSTRAINT dw2_postrevs_approved__c_null CHECK (((approved_at IS NULL) = (approved_by_id IS NULL))),
    CONSTRAINT dw2_postrevs_approvedat_ge_composedat__c CHECK ((approved_at >= composed_at)),
    CONSTRAINT dw2_postrevs_hidden__c_null CHECK (((hidden_at IS NULL) = (hidden_by_id IS NULL))),
    CONSTRAINT dw2_postrevs_hiddenat_ge_composedat__c CHECK ((hidden_at >= composed_at)),
    CONSTRAINT dw2_postrevs_patch_source__c_nn CHECK (((source_patch IS NOT NULL) OR (full_source IS NOT NULL))),
    CONSTRAINT dw2_postrevs_revisionnr_gt_prevnr__c CHECK ((revision_nr > previous_nr)),
    CONSTRAINT dw2_postrevs_revisionnr_prevnr__c_gz CHECK (((revision_nr > 0) AND (previous_nr > 0))),
    CONSTRAINT postrevisions_c_revnr_not_for_imp CHECK ((revision_nr < 2000000000))
);


CREATE TABLE public.post_tags3 (
    site_id integer NOT NULL,
    post_id integer NOT NULL,
    tag character varying NOT NULL,
    is_page boolean NOT NULL,
    CONSTRAINT posttags_tag__c_valid CHECK (public.is_valid_tag_label(tag))
);


CREATE TABLE public.posts3 (
    site_id integer NOT NULL,
    unique_post_id integer NOT NULL,
    page_id character varying NOT NULL,
    post_nr integer NOT NULL,
    parent_nr integer,
    multireply character varying,
    created_at timestamp without time zone NOT NULL,
    created_by_id integer NOT NULL,
    curr_rev_started_at timestamp without time zone NOT NULL,
    curr_rev_last_edited_at timestamp without time zone,
    curr_rev_by_id integer NOT NULL,
    last_approved_edit_at timestamp without time zone,
    last_approved_edit_by_id integer,
    num_distinct_editors integer NOT NULL,
    num_edit_suggestions smallint DEFAULT 0 NOT NULL,
    last_edit_suggestion_at timestamp without time zone,
    safe_rev_nr integer,
    approved_source text,
    approved_html_sanitized text,
    approved_at timestamp without time zone,
    approved_by_id integer,
    approved_rev_nr integer,
    curr_rev_source_patch text,
    curr_rev_nr integer NOT NULL,
    collapsed_status smallint NOT NULL,
    collapsed_at timestamp without time zone,
    collapsed_by_id integer,
    closed_status smallint NOT NULL,
    closed_at timestamp without time zone,
    closed_by_id integer,
    hidden_at timestamp without time zone,
    hidden_by_id integer,
    hidden_reason character varying,
    deleted_status smallint NOT NULL,
    deleted_at timestamp without time zone,
    deleted_by_id integer,
    pinned_position smallint,
    pinned_at timestamp without time zone,
    pinned_by_id integer,
    num_pending_flags smallint DEFAULT 0 NOT NULL,
    num_handled_flags smallint DEFAULT 0 NOT NULL,
    num_like_votes integer DEFAULT 0 NOT NULL,
    num_wrong_votes integer DEFAULT 0 NOT NULL,
    num_times_read integer DEFAULT 0 NOT NULL,
    num_bury_votes integer DEFAULT 0 NOT NULL,
    num_unwanted_votes integer DEFAULT 0 NOT NULL,
    type public.post_type_d,
    prev_rev_nr integer,
    branch_sideways smallint,
    ext_id character varying,
    smtp_msg_id_prefix_c public.smtp_msg_id_out_prefix_d,
    private_pats_id_c public.pat_id_d,
    sub_type_c public.sub_type_d,
    val_i32_c public.i32_d,
    postponed_status_c public.postponed_status_d,
    answered_status_c public.answered_status_d,
    doing_status_c public.doing_status_d,
    review_status_c public.review_status_d,
    unwanted_status_c public.unwanted_status_d,
    flagged_status_c public.flagged_status_d,
    hidden_status_c public.hidden_status_d,
    index_prio_c public.index_prio_d,
    private_status_c public.private_status_d,
    creator_status_c public.creator_status_d,
    order_c public.f32_d,
    CONSTRAINT dw2_posts__c_approved CHECK ((((approved_rev_nr IS NULL) = (approved_at IS NULL)) AND ((approved_rev_nr IS NULL) = (approved_by_id IS NULL)) AND ((approved_rev_nr IS NULL) = (approved_source IS NULL)))),
    CONSTRAINT dw2_posts__c_apr_at_ge_cre CHECK (((approved_at IS NULL) OR (approved_at >= created_at))),
    CONSTRAINT dw2_posts__c_apr_html_ne CHECK (((approved_html_sanitized IS NULL) OR (length(btrim(approved_html_sanitized)) >= 1))),
    CONSTRAINT dw2_posts__c_apr_html_src CHECK (((approved_html_sanitized IS NULL) OR (approved_source IS NOT NULL))),
    CONSTRAINT dw2_posts__c_apr_src_ne CHECK (((approved_source IS NULL) OR (length(btrim(approved_source)) >= 1))),
    CONSTRAINT dw2_posts__c_apr_ver_le_cur CHECK (((approved_rev_nr IS NULL) OR (approved_rev_nr <= curr_rev_nr))),
    CONSTRAINT dw2_posts__c_closed CHECK ((((closed_at IS NULL) OR (closed_at >= created_at)) AND ((closed_status = 0) = (closed_at IS NULL)) AND ((closed_status = 0) = (closed_by_id IS NULL)))),
    CONSTRAINT dw2_posts__c_collapsed CHECK ((((collapsed_at IS NULL) OR (collapsed_at >= created_at)) AND ((collapsed_status = 0) = (collapsed_at IS NULL)) AND ((collapsed_status = 0) = (collapsed_by_id IS NULL)))),
    CONSTRAINT dw2_posts__c_counts_gez CHECK (((num_distinct_editors >= 0) AND (num_edit_suggestions >= 0) AND (num_pending_flags >= 0) AND (num_handled_flags >= 0) AND (num_like_votes >= 0) AND (num_wrong_votes >= 0) AND (num_bury_votes >= 0) AND (num_unwanted_votes >= 0) AND (num_times_read >= 0))),
    CONSTRAINT dw2_posts__c_curpatch_ne CHECK (((curr_rev_source_patch IS NULL) OR (length(btrim(curr_rev_source_patch)) >= 1))),
    CONSTRAINT dw2_posts__c_deleted CHECK ((((deleted_at IS NULL) OR (deleted_at >= created_at)) AND ((deleted_status = 0) = (deleted_at IS NULL)) AND ((deleted_status = 0) = (deleted_by_id IS NULL)))),
    CONSTRAINT dw2_posts__c_first_rev_started_when_created CHECK (((curr_rev_started_at = created_at) OR (curr_rev_nr > 1))),
    CONSTRAINT dw2_posts__c_hidden CHECK ((((hidden_at IS NULL) OR (hidden_at >= created_at)) AND ((hidden_at IS NULL) = (hidden_by_id IS NULL)) AND ((hidden_reason IS NULL) OR (hidden_at IS NOT NULL)))),
    CONSTRAINT dw2_posts__c_last_apr_edit_at_id CHECK (((last_approved_edit_at IS NULL) = (last_approved_edit_by_id IS NULL))),
    CONSTRAINT dw2_posts__c_last_edi_sug CHECK ((((num_edit_suggestions = 0) OR (last_edit_suggestion_at IS NOT NULL)) AND ((last_edit_suggestion_at IS NULL) OR (last_edit_suggestion_at >= created_at)))),
    CONSTRAINT dw2_posts__c_ne CHECK (((approved_source IS NOT NULL) OR (curr_rev_source_patch IS NOT NULL))),
    CONSTRAINT dw2_posts__c_not_its_parent CHECK (((parent_nr IS NULL) OR (post_nr <> parent_nr))),
    CONSTRAINT dw2_posts__c_saf_ver_le_apr CHECK (((safe_rev_nr IS NULL) OR ((safe_rev_nr <= approved_rev_nr) AND (approved_rev_nr IS NOT NULL)))),
    CONSTRAINT dw2_posts__c_up_to_date_no_patch CHECK (((approved_rev_nr IS NULL) OR ((curr_rev_nr = approved_rev_nr) = (curr_rev_source_patch IS NULL)))),
    CONSTRAINT dw2_posts_curreveditedat_ge_lastapprovededitat__c CHECK ((curr_rev_last_edited_at >= last_approved_edit_at)),
    CONSTRAINT dw2_posts_curreveditedat_ge_startedat__c CHECK ((curr_rev_last_edited_at >= curr_rev_started_at)),
    CONSTRAINT dw2_posts_currevisionat_ge_createdat__c CHECK (((curr_rev_started_at IS NULL) OR (curr_rev_started_at >= created_at))),
    CONSTRAINT dw2_posts_multireply__c_num CHECK (((multireply)::text ~ '^([0-9]+,)*[0-9]+$'::text)),
    CONSTRAINT dw2_posts_parent__c_not_title CHECK ((parent_nr <> 0)),
    CONSTRAINT posts__c_first_rev_by_creator CHECK (((curr_rev_by_id = created_by_id) OR (curr_rev_nr > 1))),
    CONSTRAINT posts_c_bookmark_neg_nr CHECK ((((type)::smallint <> 51) OR (post_nr <= '-1001'::integer))),
    CONSTRAINT posts_c_bookmark_not_appr CHECK ((((type)::smallint <> 51) OR (approved_at IS NULL))),
    CONSTRAINT posts_c_currevnr_not_for_imp CHECK ((curr_rev_nr < 2000000000)),
    CONSTRAINT posts_c_extid_ok CHECK (public.is_valid_ext_id(ext_id)),
    CONSTRAINT posts_c_id_not_for_imp CHECK ((unique_post_id < 2000000000)),
    CONSTRAINT posts_c_nr_not_for_imp CHECK ((post_nr < 2000000000)),
    CONSTRAINT posts_c_order_only_bookmarks_for_now CHECK (((order_c IS NULL) OR ((type)::smallint = 51))),
    CONSTRAINT posts_c_parentnr_not_for_imp CHECK ((parent_nr < 2000000000)),
    CONSTRAINT posts_c_privatecomt_neg_nr CHECK (((private_status_c IS NULL) OR (post_nr <= '-1001'::integer)))
);


COMMENT ON TABLE public.posts3 IS '
To be renamed to  posts_t.  No, to nodes_t.  Stores the actuall discussions:
the Original Post, a title post, reply/comment posts, meta posts,
chat messages, any private comments.
Later, categories and pages will be here too. [all_in_nodes_t]

Later, other things too: Flags. Flags are nicely represented as posts of
type PostType.Flag on pages of type PageType.Flag, visible to oneself and mods
— since a text is often needed, to describe the reason one flagged something?
And it''s nice if this text can be edited afterwards, with edit revisions,
hence, storing it, and thereby flags, in posts_t makes sense?
The staff can ask the flagging user for clarifications, and staff can post
private comments if they want to discuss the flag privately (without the flagger).
For flags, posts_t.sub_type_c is the flag types, e.g.
FlagType.Inappropriate/Spam/Astroturfing/... See Scala, PostType.Flag_later.

And bookmarks. Later.
';


COMMENT ON COLUMN public.posts3.created_by_id IS '
If created by an anonym or pseudonym, is the id of that anonym or pseudonym.
And to find the true author, one looks up that anon/pseudonym in pats_t,
and looks at the true_id_c column.
';


COMMENT ON COLUMN public.posts3.closed_status IS '

1: Closed, 2: Locked, 3: Frozen.
';


COMMENT ON COLUMN public.posts3.pinned_position IS '
Rename to  order_c. Use for sorting one''s private posts: bookmarks and drafts.
';


COMMENT ON COLUMN public.posts3.answered_status_c IS '

1: Waiting for solutions. 2: There''s some solutions, still waiting for more.
3: There''s a solution, no more needed (and then page typically closed).
';


COMMENT ON COLUMN public.posts3.doing_status_c IS '

1: Planned, 2: Started, 3: Paused, 4: Done.
';


COMMENT ON COLUMN public.posts3.private_status_c IS '
NO, skip this. Instead, use private pages  [priv_comts_pages] 
for storing private comments? And all comments on such a page, are private,
private_status_c is overkill.

If non-null, the post is private, and all descendants (the whole
comments tree or page if it''s the orig post) are private too. Its
post nr (and those of all its descendants) must be negative, <=
PageParts.MaxPrivateNr.

In  perms_on_pages3.{may_post_comment, may_see}  we see who may
reply to (or only see) the private tree.

The private_status_c value says if it''s ok to add more people to this private
tree, and if someone added, can see already existing private comments
(otherwise they can see new, only).
These things can only be changed in the more-private direction,
once the private tree has been created.  Maybe values could be:

Edit: Isn''t it better to store the below "was previously public" in a separate
field, e.g.  was_public_until_c  — then we''d know for about how long too.
Or don''t store at all in posts3, only in the audit log. [_skip_was_pub]  /Edit

Null: Not private. Edit: Or it can be a bookmark? [bookm_0_priv_status]
4:  Like 5, but was previously public for a while?  EDIT: _skip_was_pub? See above.
5:  Can add more private members, and make it public. The default.
    All other values below, won''t be implemented the nearest ... years?:
8:  Like 9, but previously_public.
9:  Can add more people to the private tree, that is, make it less private, sort of.
    And they get to see the alreday existing comments.
12:  Like 12, but previously_public.
13: Can add more people to a private tree, but they don''t get to see any
    already existing comments; they can see only comments posted after they
    (the new people) got added. Will use  perms_on_posts3.can_see_priv_aft_c
    to remember when?
16:  Like 17, but previously_public.
17: If adding more people to a private page, instead, a new private page
    gets created, with the original people plus the ones now added.
    (And you can keep adding people, until a comment has been posted on this
    new page — thereafter, adding more, cerates yet another page.)
    Then new people won''t see that there was an earlier discussion,
    with fewer participants.
20:  Like 9, but previously_public.
21: Cannot add more private pats (except for by adding to a group who can see).
24:  Like 9, but previously_public.
25: Cannot add more private pats, not even by adding sbd to a group.
    (How''s that going to get implemented? And does it ever make sense)

Since private comments have nr:s <= -1001 (PageParts.MaxPrivateNr), they can be
effectively skipped when loading comments to show by default on a page, *and*
so there won''t be any gaps in the not-private comment nr sequence (> 0).
Comments on private *pages* though, can have nrs > 0? Because anyone who can
see the private page, can see those comments, so we want to load all of them.

It''s not allowed to start new private sub trees inside private trees
or on private pages, because then the permission system would become
unnecessarily complicated? (''New'' here means that a different group of
people could see those private-tree-in-tree.)
';


COMMENT ON COLUMN public.posts3.order_c IS '
For sorting bookmarks in one''s todo list (together with tasks, bookmarks, drafts).
Maybe merge posts_t.pinned_position into order_c, don''t need both?
Can''t have public posts directly in one''s todo list — instead, they''d be
there via bookmarks or assigned-to relationships. So, don''t need both order_c
and pinned_position?
> 0 means place first, ascending?
< 0 means place last (asc or desc? from end?), for less important bookmarks?
null (or 0) means in the middle (after the > 0 but before the < 0), newest first?
';


CREATE TABLE public.review_tasks3 (
    site_id integer NOT NULL,
    id integer NOT NULL,
    reasons bigint NOT NULL,
    created_by_id integer NOT NULL,
    created_at timestamp without time zone NOT NULL,
    created_at_rev_nr integer,
    more_reasons_at timestamp without time zone,
    more_reasons_at_rev_nr integer,
    completed_at timestamp without time zone,
    decided_at_rev_nr integer,
    decided_by_id integer,
    invalidated_at timestamp without time zone,
    decision integer,
    about_pat_id_c integer NOT NULL,
    page_id character varying,
    post_id integer,
    post_nr integer,
    decided_at timestamp without time zone,
    CONSTRAINT reviewtasks_c_decided_compl_match_atrevnr CHECK (((decided_at IS NOT NULL) OR (completed_at IS NOT NULL) OR (decided_at_rev_nr IS NULL))),
    CONSTRAINT reviewtasks_c_decided_compl_match_by CHECK ((((decided_at IS NULL) AND (completed_at IS NULL)) = (decided_by_id IS NULL))),
    CONSTRAINT reviewtasks_c_decided_compl_match_decision CHECK ((((decided_at IS NULL) AND (completed_at IS NULL)) = (decision IS NULL))),
    CONSTRAINT reviewtasks_c_decidedat_ge_createdat CHECK ((decided_at >= created_at)),
    CONSTRAINT reviewtasks_c_id_not_for_imp CHECK ((id < 2000000000)),
    CONSTRAINT reviewtasks_c_postnr_not_for_imp CHECK ((post_nr < 2000000000)),
    CONSTRAINT reviewtasks_completed_or_invalidatedat_null__c CHECK (((completed_at IS NULL) OR (invalidated_at IS NULL))),
    CONSTRAINT reviewtasks_completedat_ge_createdat__c CHECK ((completed_at >= created_at)),
    CONSTRAINT reviewtasks_completedat_ge_morereasonsat__c CHECK ((completed_at >= more_reasons_at)),
    CONSTRAINT reviewtasks_invalidatedat_ge_createdat__c CHECK ((invalidated_at >= created_at)),
    CONSTRAINT reviewtasks_morereasonsat_ge_createdat__c CHECK ((more_reasons_at >= created_at)),
    CONSTRAINT reviewtasks_morereasonsat_revnr__c_n CHECK (((more_reasons_at IS NOT NULL) OR (more_reasons_at_rev_nr IS NULL))),
    CONSTRAINT reviewtasks_morereasonsatrevnr_ge_createdrevnr__c CHECK ((more_reasons_at_rev_nr >= created_at_rev_nr)),
    CONSTRAINT reviewtasks_postid_nr__c_n CHECK (((post_id IS NULL) = (post_nr IS NULL))),
    CONSTRAINT reviewtasks_thing__c_nn CHECK (((post_id IS NOT NULL) OR (about_pat_id_c IS NOT NULL) OR (page_id IS NOT NULL)))
);


CREATE TABLE public.sessions_t (
    site_id_c public.i32_d NOT NULL,
    pat_id_c public.i32_d NOT NULL,
    created_at_c timestamp without time zone NOT NULL,
    deleted_at_c timestamp without time zone,
    expired_at_c timestamp without time zone,
    version_c public.i16_gz_d NOT NULL,
    start_ip_c inet,
    start_browser_id_c public.browser_id_d,
    start_headers_c jsonb,
    part_1_comp_id_c public.base64us_len16_d NOT NULL,
    hash_2_for_embg_storage_c public.bytea_len32_d NOT NULL,
    hash_3_for_dir_js_c public.bytea_len32_d NOT NULL,
    hash_4_http_only_c public.bytea_len32_d NOT NULL,
    hash_5_strict_c public.bytea_len32_d NOT NULL,
    CONSTRAINT sessions_c_createdat_lte_deletedat CHECK ((created_at_c <= deleted_at_c)),
    CONSTRAINT sessions_c_createdat_lte_expiredat CHECK ((created_at_c <= expired_at_c)),
    CONSTRAINT settings_c_startheaders_len CHECK ((pg_column_size(start_headers_c) <= 1000))
);


CREATE TABLE public.settings3 (
    site_id integer NOT NULL,
    category_id integer,
    page_id character varying,
    user_must_be_auth boolean,
    user_must_be_approved boolean,
    allow_guest_login boolean,
    num_first_posts_to_review smallint,
    num_first_posts_to_approve smallint,
    max_posts_pend_appr_before smallint,
    head_styles_html character varying,
    head_scripts_html character varying,
    end_of_body_html character varying,
    header_html character varying,
    footer_html character varying,
    horizontal_comments boolean,
    social_links_html character varying,
    logo_url_or_html character varying,
    org_domain character varying,
    org_full_name character varying,
    org_short_name character varying,
    contrib_agreement smallint,
    content_license smallint,
    google_analytics_id character varying,
    experimental boolean,
    many_sections boolean,
    html_tag_css_classes character varying,
    num_flags_to_hide_post integer,
    cooldown_minutes_after_flagged_hidden integer,
    num_flags_to_block_new_user integer,
    num_flaggers_to_block_new_user integer,
    notify_mods_if_user_blocked boolean,
    regular_member_flag_weight real,
    core_member_flag_weight real,
    invite_only boolean,
    allow_signup boolean,
    allow_local_signup boolean,
    show_categories boolean,
    show_topic_filter boolean,
    show_topic_types boolean,
    select_topic_type boolean,
    forum_main_view character varying,
    forum_topics_sort_buttons character varying,
    forum_category_links character varying,
    forum_topics_layout integer,
    forum_categories_layout integer,
    require_verified_email boolean,
    may_compose_before_signup boolean,
    may_login_before_email_verified boolean,
    double_type_email_address boolean,
    double_type_password boolean,
    beg_for_email_address boolean,
    allow_embedding_from character varying,
    show_sub_communities boolean,
    language_code character varying,
    enable_google_login boolean,
    enable_facebook_login boolean,
    enable_twitter_login boolean,
    enable_github_login boolean,
    email_domain_blacklist character varying,
    email_domain_whitelist character varying,
    show_author_how smallint,
    watchbar_starts_open boolean,
    favicon_url character varying,
    enable_chat boolean,
    enable_direct_messages boolean,
    feature_flags character varying,
    enable_sso boolean,
    sso_url character varying,
    sso_not_approved_url character varying,
    expire_idle_after_mins integer,
    enable_gitlab_login boolean,
    enable_linkedin_login boolean,
    enable_vk_login boolean,
    enable_instagram_login boolean,
    enable_forum boolean,
    enable_api boolean,
    enable_tags boolean,
    embedded_comments_category_id integer,
    terms_of_use_url character varying,
    privacy_url character varying,
    rules_url character varying,
    contact_email_addr character varying,
    contact_url character varying,
    enable_stop_forum_spam boolean,
    send_email_to_stop_forum_spam boolean,
    enable_akismet boolean,
    send_email_to_akismet boolean,
    akismet_api_key character varying,
    enable_similar_topics boolean,
    sso_login_required_logout_url character varying,
    discussion_layout integer,
    disc_post_nesting integer,
    disc_post_sort_order integer,
    progress_layout integer,
    progr_post_nesting integer,
    progr_post_sort_order integer,
    orig_post_reply_btn_title character varying,
    orig_post_votes integer,
    enable_cors boolean,
    allow_cors_from character varying,
    allow_cors_creds boolean,
    cache_cors_prefl_secs integer,
    nav_conf jsonb,
    start_of_body_html character varying,
    appr_before_if_trust_lte smallint,
    review_after_if_trust_lte smallint,
    max_posts_pend_revw_aftr smallint,
    enable_custom_idps boolean,
    use_only_custom_idps boolean,
    emb_com_sort_order_c integer,
    emb_com_nesting_c integer,
    enable_disagree_vote_c boolean,
    sso_logout_redir_url_c public.http_url_d,
    sso_show_emb_authn_btns_c public.i16_gez_d,
    sso_paseto_v2_loc_secret_c public.key_hex_b64us_d,
    sso_paseto_v2_pub_pub_key_c public.key_hex_b64us_d,
    sso_refresh_authn_token_url_c public.http_url_d,
    remember_emb_sess_c public.i16_gez_d,
    expire_idle_emb_sess_after_mins_c public.i32_gez_d,
    outbound_emails_from_name_c public.email_name_d,
    outbound_emails_from_addr_c public.email_d,
    outbound_emails_reply_to_c public.email_d,
    outbound_emails_smtp_conf_c jsonb,
    commonmark_conf_c public.jsonb_ste4000_d,
    can_remove_mod_reqmts_c public.i32_gz_d,
    enable_anon_posts_c boolean,
    ai_conf_c public.jsonb_ste16000_d,
    enable_online_status_c boolean,
    follow_links_to_c public.text_nonempty_ste2000_d,
    own_domains_c public.text_nonempty_ste2000_d,
    authn_diag_conf_c public.jsonb_ste8000_d,
    CONSTRAINT settings3_c_akismetapikey_len CHECK (((length((akismet_api_key)::text) >= 1) AND (length((akismet_api_key)::text) <= 200))),
    CONSTRAINT settings3_c_langcode_len CHECK (((length((language_code)::text) >= 2) AND (length((language_code)::text) <= 10))),
    CONSTRAINT settings3_compose_before_c CHECK (((NOT may_compose_before_signup) OR may_login_before_email_verified)),
    CONSTRAINT settings3_contentlicense__c_in CHECK (((content_license >= 1) AND (content_license <= 100))),
    CONSTRAINT settings3_contrib_agr_and_license__c_null CHECK (((contrib_agreement IS NULL) OR (contrib_agreement = 10) OR ((content_license IS NOT NULL) AND (content_license = contrib_agreement)))),
    CONSTRAINT settings3_contribagr__c_in CHECK (((contrib_agreement >= 1) AND (contrib_agreement <= 100))),
    CONSTRAINT settings3_flag_weight__c_ge CHECK (((regular_member_flag_weight >= (1.0)::double precision) AND (core_member_flag_weight >= regular_member_flag_weight))),
    CONSTRAINT settings3_flags__c_gez CHECK (((num_flags_to_hide_post >= 0) AND (cooldown_minutes_after_flagged_hidden >= 0) AND (num_flags_to_block_new_user >= 0) AND (num_flaggers_to_block_new_user >= 0))),
    CONSTRAINT settings3_googleanalyticsid__c_len CHECK (((length((google_analytics_id)::text) >= 1) AND (length((google_analytics_id)::text) <= 100))),
    CONSTRAINT settings3_htmltagcssclasses__c_len CHECK (((length((html_tag_css_classes)::text) >= 1) AND (length((html_tag_css_classes)::text) <= 100))),
    CONSTRAINT settings3_htmltagcssclasses__c_valid CHECK (public.is_valid_css_class(html_tag_css_classes)),
    CONSTRAINT settings3_numfirst_allow_ge_approve CHECK ((max_posts_pend_appr_before >= num_first_posts_to_approve)),
    CONSTRAINT settings3_numfirsttoallow_0_to_10 CHECK (((max_posts_pend_appr_before >= 0) AND (max_posts_pend_appr_before <= 10))),
    CONSTRAINT settings3_numfirsttoapprove_0_to_10 CHECK (((num_first_posts_to_approve >= 0) AND (num_first_posts_to_approve <= 10))),
    CONSTRAINT settings3_numfirsttoreview_0_to_10 CHECK (((num_first_posts_to_review >= 0) AND (num_first_posts_to_review <= 10))),
    CONSTRAINT settings3_only_for_site__c CHECK ((((category_id IS NULL) AND (page_id IS NULL)) OR ((user_must_be_auth IS NULL) AND (user_must_be_approved IS NULL) AND (allow_guest_login IS NULL) AND (require_verified_email IS NULL) AND (may_compose_before_signup IS NULL) AND (may_login_before_email_verified IS NULL) AND (double_type_email_address IS NULL) AND (double_type_password IS NULL) AND (beg_for_email_address IS NULL) AND (num_first_posts_to_review IS NULL) AND (num_first_posts_to_approve IS NULL) AND (max_posts_pend_appr_before IS NULL) AND (org_domain IS NULL) AND (org_full_name IS NULL) AND (org_short_name IS NULL) AND (contrib_agreement IS NULL) AND (content_license IS NULL) AND (google_analytics_id IS NULL) AND (experimental IS NULL) AND (many_sections IS NULL) AND (num_flags_to_hide_post IS NULL) AND (cooldown_minutes_after_flagged_hidden IS NULL) AND (num_flags_to_block_new_user IS NULL) AND (num_flaggers_to_block_new_user IS NULL) AND (notify_mods_if_user_blocked IS NULL) AND (regular_member_flag_weight IS NULL) AND (core_member_flag_weight IS NULL)))),
    CONSTRAINT settings3_orgdomain__c_len CHECK (((length((org_domain)::text) >= 1) AND (length((org_domain)::text) <= 100))),
    CONSTRAINT settings3_orgfullname__c_len CHECK (((length((org_full_name)::text) >= 1) AND (length((org_full_name)::text) <= 100))),
    CONSTRAINT settings3_orgfullname__c_trim CHECK ((btrim((org_full_name)::text) = (org_full_name)::text)),
    CONSTRAINT settings3_orgshortname__c_len CHECK (((length((org_short_name)::text) >= 1) AND (length((org_short_name)::text) <= 100))),
    CONSTRAINT settings3_page_or_cat_null__c CHECK (((category_id IS NULL) OR (page_id IS NULL))),
    CONSTRAINT settings3_signup__c CHECK ((allow_signup OR (NOT allow_local_signup))),
    CONSTRAINT settings3_signup_email_verif_c CHECK ((NOT (require_verified_email AND (may_compose_before_signup OR may_login_before_email_verified OR allow_guest_login)))),
    CONSTRAINT settings_c_allowcorsfrom_len CHECK (((length((allow_cors_from)::text) >= 1) AND (length((allow_cors_from)::text) <= 1000))),
    CONSTRAINT settings_c_allowembeddingfrom_btw_5_300 CHECK (((length((allow_embedding_from)::text) >= 5) AND (length((allow_embedding_from)::text) <= 300))),
    CONSTRAINT settings_c_apprbeforeiftrustlte CHECK (public.is_ok_trust_level((appr_before_if_trust_lte)::integer)),
    CONSTRAINT settings_c_contactemailaddr_len CHECK (((length((contact_email_addr)::text) >= 1) AND (length((contact_email_addr)::text) <= 200))),
    CONSTRAINT settings_c_contacturl_len CHECK (((length((contact_url)::text) >= 1) AND (length((contact_url)::text) <= 200))),
    CONSTRAINT settings_c_custom_idps_xor_sso CHECK (((NOT enable_custom_idps) OR (NOT enable_sso))),
    CONSTRAINT settings_c_discpostnesting CHECK (((disc_post_nesting >= '-1'::integer) AND (disc_post_nesting <= 100))),
    CONSTRAINT settings_c_discpostsortorder CHECK (((disc_post_sort_order >= 0) AND (disc_post_sort_order <= 1000))),
    CONSTRAINT settings_c_discussionlayout CHECK (((discussion_layout >= 0) AND (discussion_layout <= 100))),
    CONSTRAINT settings_c_emailallowlist_len CHECK (((length((email_domain_whitelist)::text) >= 1) AND (length((email_domain_whitelist)::text) <= 50000))),
    CONSTRAINT settings_c_emailblocklist_len CHECK (((length((email_domain_blacklist)::text) >= 1) AND (length((email_domain_blacklist)::text) <= 50000))),
    CONSTRAINT settings_c_embcomnesting CHECK (((emb_com_nesting_c >= '-1'::integer) AND (emb_com_nesting_c <= 100))),
    CONSTRAINT settings_c_embcomsortorder CHECK (((emb_com_sort_order_c >= 0) AND (emb_com_sort_order_c <= 1000))),
    CONSTRAINT settings_c_enable_use_only_custom_idps CHECK ((((enable_custom_idps IS NOT NULL) AND enable_custom_idps) OR (NOT use_only_custom_idps))),
    CONSTRAINT settings_c_enablesso_ssourl CHECK (((NOT enable_sso) OR (sso_url IS NOT NULL))),
    CONSTRAINT settings_c_endofbodyhtml_len CHECK (((length((end_of_body_html)::text) >= 1) AND (length((end_of_body_html)::text) <= 50000))),
    CONSTRAINT settings_c_faviconurl_len CHECK (((length((favicon_url)::text) >= 1) AND (length((favicon_url)::text) <= 200))),
    CONSTRAINT settings_c_featureflags_len CHECK ((length((feature_flags)::text) < 10000)),
    CONSTRAINT settings_c_footerhtml_len CHECK (((length((footer_html)::text) >= 1) AND (length((footer_html)::text) <= 50000))),
    CONSTRAINT settings_c_guestlogin_auth CHECK ((NOT (allow_guest_login AND (user_must_be_auth OR user_must_be_approved OR invite_only)))),
    CONSTRAINT settings_c_headerhtml_len CHECK (((length((header_html)::text) >= 1) AND (length((header_html)::text) <= 50000))),
    CONSTRAINT settings_c_headscriptshtml_len CHECK (((length((head_scripts_html)::text) >= 1) AND (length((head_scripts_html)::text) <= 50000))),
    CONSTRAINT settings_c_headstyleshtml_len CHECK (((length((head_styles_html)::text) >= 1) AND (length((head_styles_html)::text) <= 50000))),
    CONSTRAINT settings_c_logourlorhtml_len CHECK (((length((logo_url_or_html)::text) >= 1) AND (length((logo_url_or_html)::text) <= 50000))),
    CONSTRAINT settings_c_maxpostspendrevwaftr CHECK (((max_posts_pend_revw_aftr >= 0) AND (max_posts_pend_revw_aftr <= 10))),
    CONSTRAINT settings_c_navconf_len CHECK (((pg_column_size(nav_conf) >= 1) AND (pg_column_size(nav_conf) <= 50000))),
    CONSTRAINT settings_c_origpostreplybtntitle CHECK (((length((orig_post_reply_btn_title)::text) >= 1) AND (length((orig_post_reply_btn_title)::text) <= 100))),
    CONSTRAINT settings_c_origpostvotes CHECK (((orig_post_votes >= 0) AND (orig_post_votes <= 100))),
    CONSTRAINT settings_c_privacyurl_len CHECK (((length((privacy_url)::text) >= 1) AND (length((privacy_url)::text) <= 200))),
    CONSTRAINT settings_c_progresslayout CHECK (((progress_layout >= 0) AND (progress_layout <= 100))),
    CONSTRAINT settings_c_progrpostnesting CHECK (((progr_post_nesting >= '-1'::integer) AND (progr_post_nesting <= 100))),
    CONSTRAINT settings_c_progrpostsortorder CHECK (((progr_post_sort_order >= 0) AND (progr_post_sort_order <= 1000))),
    CONSTRAINT settings_c_reviewafteriftrustlte CHECK (public.is_ok_trust_level((review_after_if_trust_lte)::integer)),
    CONSTRAINT settings_c_rulesurl_len CHECK (((length((rules_url)::text) >= 1) AND (length((rules_url)::text) <= 200))),
    CONSTRAINT settings_c_sociallinkshtml_len CHECK (((length((social_links_html)::text) >= 1) AND (length((social_links_html)::text) <= 50000))),
    CONSTRAINT settings_c_ssologinrequiredlogouturl_len CHECK (((length((sso_login_required_logout_url)::text) >= 1) AND (length((sso_login_required_logout_url)::text) <= 200))),
    CONSTRAINT settings_c_ssonotappr_len CHECK ((length((sso_not_approved_url)::text) < 200)),
    CONSTRAINT settings_c_ssourl_len CHECK ((length((sso_url)::text) < 200)),
    CONSTRAINT settings_c_startofbodyhtml_len CHECK (((length((start_of_body_html)::text) >= 1) AND (length((start_of_body_html)::text) <= 50000))),
    CONSTRAINT settings_c_termsofuseurl_len CHECK (((length((terms_of_use_url)::text) >= 1) AND (length((terms_of_use_url)::text) <= 200))),
    CONSTRAINT settings_forum_features CHECK (((enable_forum IS NOT FALSE) OR ((show_categories = false) AND (enable_tags = false) AND (enable_chat = false) AND (enable_direct_messages = false) AND (show_sub_communities IS NOT TRUE) AND (show_topic_filter = false) AND (show_topic_types = false) AND (select_topic_type = false) AND (embedded_comments_category_id IS NULL)))),
    CONSTRAINT settings_forumcatlinks_c_in CHECK ((public.is_menu_spec(forum_category_links) AND ((length((forum_category_links)::text) >= 1) AND (length((forum_category_links)::text) <= 300)))),
    CONSTRAINT settings_forumcatslayout_c_in CHECK (((forum_categories_layout >= 0) AND (forum_categories_layout <= 20))),
    CONSTRAINT settings_forummainview_c_in CHECK ((public.is_menu_spec(forum_main_view) AND ((length((forum_main_view)::text) >= 1) AND (length((forum_main_view)::text) <= 100)))),
    CONSTRAINT settings_forumtopicslayout_c_in CHECK (((forum_topics_layout >= 0) AND (forum_topics_layout <= 20))),
    CONSTRAINT settings_forumtopicssort_c_in CHECK ((public.is_menu_spec(forum_topics_sort_buttons) AND ((length((forum_topics_sort_buttons)::text) >= 1) AND (length((forum_topics_sort_buttons)::text) <= 200))))
);


COMMENT ON COLUMN public.settings3.ai_conf_c IS '
AI configuration. Can be long, if includes custom prompts.
';


COMMENT ON COLUMN public.settings3.enable_online_status_c IS '
If there should be any sidebar users-online list.
';


COMMENT ON COLUMN public.settings3.follow_links_to_c IS '
List of domains for which links should be rel=follow.
';


CREATE TABLE public.sites3 (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    ctime timestamp without time zone DEFAULT now() NOT NULL,
    creator_ip character varying(39),
    next_page_id integer DEFAULT 1 NOT NULL,
    creator_email_address character varying,
    rdb_quota_mibs_c integer,
    num_guests integer DEFAULT 0 NOT NULL,
    num_identities integer DEFAULT 0 NOT NULL,
    num_roles integer DEFAULT 0 NOT NULL,
    num_role_settings integer DEFAULT 0 NOT NULL,
    num_pages integer DEFAULT 0 NOT NULL,
    num_posts integer DEFAULT 0 NOT NULL,
    num_post_text_bytes bigint DEFAULT 0 NOT NULL,
    num_posts_read bigint DEFAULT 0 NOT NULL,
    num_actions integer DEFAULT 0 NOT NULL,
    num_notfs integer DEFAULT 0 NOT NULL,
    num_emails_sent integer DEFAULT 0 NOT NULL,
    num_audit_rows integer DEFAULT 0 NOT NULL,
    num_uploads integer DEFAULT 0 NOT NULL,
    num_upload_bytes bigint DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    num_post_revisions integer DEFAULT 0 NOT NULL,
    num_post_rev_bytes bigint DEFAULT 0 NOT NULL,
    status integer DEFAULT 1 NOT NULL,
    publ_id character varying NOT NULL,
    super_staff_notes character varying,
    feature_flags_c character varying,
    deleted_at_c timestamp without time zone,
    auto_purge_at_c timestamp without time zone,
    purged_at_c timestamp without time zone,
    file_quota_mibs_c public.i32_gez_d,
    max_upl_size_kibs_c public.i32_gez_d,
    may_upl_pub_media_min_tr_lv_c public.trust_level_or_staff_d,
    may_upl_pub_risky_min_tr_lv_c public.trust_level_or_staff_d,
    may_upl_pub_safer_min_tr_lv_c public.trust_level_or_staff_d,
    may_upl_priv_media_min_tr_lv_c public.trust_level_or_staff_d,
    may_upl_priv_risky_min_tr_lv_c public.trust_level_or_staff_d,
    may_upl_priv_safer_min_tr_lv_c public.trust_level_or_staff_d,
    read_lims_mult_c public.f32_gez_d,
    log_lims_mult_c public.f32_gez_d,
    create_lims_mult_c public.f32_gez_d,
    CONSTRAINT dw1_sites_version__c_gz CHECK ((version >= 1)),
    CONSTRAINT dw1_tnt_creatoremail__c CHECK (((creator_email_address)::text ~~ '%@%.%'::text)),
    CONSTRAINT dw1_tnt_id__c_n0 CHECK (((id)::text <> '0'::text)),
    CONSTRAINT dw1_tnt_id__c_ne CHECK ((btrim((id)::text) <> ''::text)),
    CONSTRAINT dw1_tnt_name__c_len CHECK (((length((name)::text) >= 1) AND (length((name)::text) <= 100))),
    CONSTRAINT dw1_tnt_name__c_trim CHECK ((btrim((name)::text) = (name)::text)),
    CONSTRAINT sites3_c_featureflags_len CHECK (((length((feature_flags_c)::text) >= 1) AND (length((feature_flags_c)::text) <= 500))),
    CONSTRAINT sites3_c_superstaffnotes_len CHECK (((length((super_staff_notes)::text) >= 1) AND (length((super_staff_notes)::text) <= 2000))),
    CONSTRAINT sites_c_autopurgeat_status CHECK (((auto_purge_at_c IS NULL) OR (status >= 6))),
    CONSTRAINT sites_c_deletedat_status CHECK (((deleted_at_c IS NOT NULL) = (status >= 6))),
    CONSTRAINT sites_c_id_not_for_imp CHECK ((id < 2000000000)),
    CONSTRAINT sites_c_purgedat_status CHECK (((purged_at_c IS NOT NULL) = (status >= 7))),
    CONSTRAINT sites_c_rdbquotamibs_gez CHECK ((rdb_quota_mibs_c >= 0)),
    CONSTRAINT sites_c_status CHECK (((status >= 1) AND (status <= 7)))
);


CREATE TABLE public.spam_check_queue3 (
    created_at timestamp without time zone NOT NULL,
    site_id integer NOT NULL,
    post_id integer NOT NULL,
    post_rev_nr integer NOT NULL,
    author_id_c integer NOT NULL,
    browser_id_cookie character varying,
    browser_fingerprint integer NOT NULL,
    req_uri character varying NOT NULL,
    req_ip character varying NOT NULL,
    req_user_agent character varying,
    req_referer character varying,
    post_nr integer,
    page_id character varying,
    page_type integer,
    page_available_at timestamp without time zone,
    author_name character varying,
    author_email_addr character varying,
    author_trust_level integer,
    author_url character varying,
    html_to_spam_check character varying,
    language character varying,
    results_at timestamp without time zone,
    results_json jsonb,
    results_text character varying,
    num_is_spam_results integer,
    num_not_spam_results integer,
    human_says_is_spam boolean,
    is_misclassified boolean,
    misclassifications_reported_at timestamp without time zone,
    CONSTRAINT spamcheckqueue_c_authoremailaddr_len CHECK (((length((author_email_addr)::text) >= 1) AND (length((author_email_addr)::text) <= 200))),
    CONSTRAINT spamcheckqueue_c_authorid_not_for_imp CHECK ((author_id_c < 2000000000)),
    CONSTRAINT spamcheckqueue_c_authorname_len CHECK (((length((author_name)::text) >= 1) AND (length((author_name)::text) <= 200))),
    CONSTRAINT spamcheckqueue_c_authorurl_len CHECK (((length((author_url)::text) >= 1) AND (length((author_url)::text) <= 200))),
    CONSTRAINT spamcheckqueue_c_htmltospamcheck_len CHECK (((length((html_to_spam_check)::text) >= 1) AND (length((html_to_spam_check)::text) <= 20200))),
    CONSTRAINT spamcheckqueue_c_ismiscl_null CHECK ((((results_at IS NOT NULL) AND (human_says_is_spam IS NOT NULL)) = (is_misclassified IS NOT NULL))),
    CONSTRAINT spamcheckqueue_c_language_len CHECK (((length((language)::text) >= 1) AND (length((language)::text) <= 200))),
    CONSTRAINT spamcheckqueue_c_pageid_not_for_imp CHECK (((page_id)::text !~~ '200???????'::text)),
    CONSTRAINT spamcheckqueue_c_post_html_null CHECK (((post_id IS NULL) OR (html_to_spam_check IS NOT NULL))),
    CONSTRAINT spamcheckqueue_c_post_null_eq CHECK ((((post_id IS NULL) = (post_nr IS NULL)) AND ((post_id IS NULL) = (post_rev_nr IS NULL)) AND ((post_id IS NULL) = (page_id IS NULL)) AND ((post_id IS NULL) = (page_type IS NULL)) AND ((post_id IS NULL) = (page_available_at IS NULL)) AND ((post_id IS NULL) = (language IS NULL)))),
    CONSTRAINT spamcheckqueue_c_postid_not_for_imp CHECK ((post_id < 2000000000)),
    CONSTRAINT spamcheckqueue_c_postnr_not_for_imp CHECK ((post_nr < 2000000000)),
    CONSTRAINT spamcheckqueue_c_postrevnr_not_for_imp CHECK ((post_rev_nr < 2000000000)),
    CONSTRAINT spamcheckqueue_c_results_before_report_miscl CHECK ((((results_json IS NOT NULL) AND (human_says_is_spam IS NOT NULL)) OR (misclassifications_reported_at IS NULL))),
    CONSTRAINT spamcheckqueue_c_results_null_eq CHECK ((((results_at IS NULL) = (results_json IS NULL)) AND ((results_at IS NULL) = (num_is_spam_results IS NULL)) AND ((results_at IS NULL) = (num_not_spam_results IS NULL)))),
    CONSTRAINT spamcheckqueue_c_resultsjson_len CHECK (((pg_column_size(results_json) >= 2) AND (pg_column_size(results_json) <= 40400))),
    CONSTRAINT spamcheckqueue_c_resultstext_len CHECK (((length((results_text)::text) >= 0) AND (length((results_text)::text) <= 40400))),
    CONSTRAINT spamcheckqueue_c_resultstext_null CHECK (((results_at IS NOT NULL) OR (results_text IS NULL))),
    CONSTRAINT spamcheckqueue_c_trustlevel_betw CHECK (((author_trust_level >= 1) AND (author_trust_level <= 6)))
);


CREATE TABLE public.system_settings_t (
    maintenance_until_unix_secs_c public.i64_gz_d,
    maint_words_html_unsafe_c public.text_nonempty_ste500_d,
    maint_msg_html_unsafe_c public.text_nonempty_ste2000_d
);


CREATE TABLE public.tag_notf_levels3 (
    site_id integer NOT NULL,
    user_id integer NOT NULL,
    tag character varying NOT NULL,
    notf_level integer NOT NULL,
    CONSTRAINT tagnotflvl_notf_lvl CHECK (public.is_valid_notf_level(notf_level))
);


CREATE TABLE public.tags_t (
    site_id_c integer NOT NULL,
    id_c public.i32_gz_d NOT NULL,
    tagtype_id_c integer NOT NULL,
    parent_tag_id_c integer,
    on_pat_id_c integer,
    on_post_id_c integer,
    val_type_c public.value_type_d,
    val_i32_c public.i32_d,
    val_f64_c public.f64_d,
    val_str_c public.text_nonempty_ste250_trimmed_d,
    val_url_c public.http_url_ste_250_d,
    val_jsonb_c public.jsonb_ste1000_d,
    val_i32_b_c public.i32_d,
    val_f64_b_c public.f64_d,
    CONSTRAINT tags_c_id_gt1000 CHECK (((id_c)::integer > 1000)),
    CONSTRAINT tags_c_tags_one_thing CHECK (((on_pat_id_c IS NOT NULL) <> (on_post_id_c IS NOT NULL))),
    CONSTRAINT tags_c_valf64_b_null CHECK (((val_f64_c IS NOT NULL) OR (val_f64_b_c IS NULL))),
    CONSTRAINT tags_c_vali32_b_null CHECK (((val_i32_c IS NOT NULL) OR (val_i32_b_c IS NULL))),
    CONSTRAINT tags_c_valtype_has_val CHECK ((((val_type_c IS NULL) OR ((val_type_c)::smallint < 0)) = (num_nonnulls(val_i32_c, val_i32_b_c, val_f64_c, val_f64_b_c, val_str_c, val_url_c, val_jsonb_c) = 0)))
);


COMMENT ON TABLE public.tags_t IS '
Stores tags and user badges. The tag / badge titles, colors etc are
in types_t (currently named tagtypes_t)

Tags can have values, e.g. ''Version: 1.23.4'', ''Event-Location: Some-Where'',
''Event-Date: Aug 22 20:00 to Aug 23 03:00'', ''Published-Year: 1990''.

Use val_i32_c, val_f64_c etc primarily, and val_*_b_c only if two fields
are needed e.g. to store a location (long & lat).
';


COMMENT ON COLUMN public.tags_t.val_type_c IS '

1 (one) means it''s a "simple" value, meaning, it''s just what''s stored:
if val_i32_c is not null, the value is an integer, if val_f64_c is
not null, it''s a decimal value and so on.

Later there might be more complex values, e.g. val_f64_c might be
used to instead store a date (Unix time), or val_f64_c and val_i32_c
to store the start and duration (seconds) of an event.

The url in val_url_c can be combined with any other value, and makes
it a link?  However, disabled for now.

Or if the type is html, then val_str_c would be interpreted as
unsanitized unsafe html. But if type is simple, then it''s plain text.

Later, could allow jsonb together with other vals too? Could display
a ''{}'' after any numeric or text value, to indicate that there''s json.

For now, urls and jsonb aren''t allowed — only numbers and plain text.
';


CREATE TABLE public.tagtypes_t (
    site_id_c integer NOT NULL,
    id_c public.i32_gz_d NOT NULL,
    can_tag_what_c public.thing_types_d NOT NULL,
    scoped_to_pat_id_c integer,
    is_personal boolean,
    url_slug_c public.url_slug_60_d,
    disp_name_c public.tag_name_60_d NOT NULL,
    long_name_c public.tag_name_120_d,
    abbr_name_c public.tag_name_15_d,
    descr_page_id_c text,
    descr_url_c public.http_url_d,
    text_color_c public.color_d,
    handle_color_c public.color_d,
    background_color_c public.color_d,
    css_class_suffix_c public.html_class_suffix_30_d,
    sort_order_c public.i16_d,
    created_by_id_c integer NOT NULL,
    deleted_by_id_c integer,
    merged_into_tagtype_id_c integer,
    merged_by_id_c integer,
    ref_id_c public.ref_id_d,
    wants_value_c public.never_always_d,
    value_type_c public.value_type_d,
    CONSTRAINT tagtypes_c_id_gt1000 CHECK (((id_c)::integer > 1000)),
    CONSTRAINT types_c_wantsval_valtype_null CHECK (((wants_value_c IS NULL) OR ((wants_value_c)::smallint <= 2) OR (value_type_c IS NOT NULL)))
);


COMMENT ON TABLE public.tagtypes_t IS '
(Will rename to types_t.)
Types, for 1) content tags. Content tags: E.g. issue tracking tags,
or blog article content tags. And 2) for user badges.

Also 3) for plugins who want their own types and sub types. Example:
Ty has Vote relationship and Vote sub types Like, Disagree, Do-It etc.
And in types_t, plugins can store their own Vote sub types, which would
correspond to custom "reactions" in other software. — Or a plugin
can create a new base type, and use for who knows what.

Why support sub types (or "enumerations", if you want), not just types?
Sub types are used often in Ty: Votes, and what type of vote.
Or flags, and what type of flag. Or assigned-to, and assigned-to-
-do-what.  *Sub sub*  types have never been needed though.
So, types and sub types, will be good enough for future plugins, too?

(Note that there''s (will be) custom values too: each post, participant,
tag, relationship, etc can have its own custom integer or jsonb value.)
';


COMMENT ON CONSTRAINT types_c_wantsval_valtype_null ON public.tagtypes_t IS '
It''s ok to remember any value type this type wanted, previously, so
value_type_c != null, when wants_value_c is null or <= NeverButCanContinue = 2,
is ok.
';


CREATE TABLE public.upload_refs3 (
    site_id integer NOT NULL,
    post_id integer NOT NULL,
    base_url character varying NOT NULL,
    hash_path character varying NOT NULL,
    added_by_id integer NOT NULL,
    added_at timestamp without time zone NOT NULL,
    uploaded_file_name_c public.text_trimmed_not_empty_d,
    CONSTRAINT dw2_uploadrefs_baseurl__c_len CHECK (((length((base_url)::text) >= 1) AND (length((base_url)::text) <= 100))),
    CONSTRAINT dw2_uploadrefs_hashpath__c CHECK (public.is_valid_hash_path(hash_path)),
    CONSTRAINT dw2_uploadrefs_hashpathsuffix__c_len CHECK (((length((hash_path)::text) >= 1) AND (length((hash_path)::text) <= 100)))
);


CREATE TABLE public.uploads3 (
    base_url character varying NOT NULL,
    hash_path character varying NOT NULL,
    original_hash_path character varying NOT NULL,
    size_bytes integer NOT NULL,
    mime_type character varying NOT NULL,
    width integer,
    height integer,
    uploaded_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    num_references integer NOT NULL,
    verified_present_at timestamp without time zone,
    verified_absent_at timestamp without time zone,
    unused_since timestamp without time zone,
    CONSTRAINT dw2_uploads_0refs_unusedsince__c CHECK (((num_references = 0) = (unused_since IS NOT NULL))),
    CONSTRAINT dw2_uploads__c_dates CHECK (((verified_present_at > uploaded_at) AND (verified_absent_at > uploaded_at))),
    CONSTRAINT dw2_uploads__c_numbers CHECK (((num_references >= 0) AND (size_bytes > 0) AND (width > 0) AND (height > 0))),
    CONSTRAINT dw2_uploads_baseurl__c CHECK (((base_url)::text ~~ '%/'::text)),
    CONSTRAINT dw2_uploads_baseurl__c_len CHECK (((length((base_url)::text) >= 1) AND (length((base_url)::text) <= 100))),
    CONSTRAINT dw2_uploads_hashpath__c CHECK (public.is_valid_hash_path(hash_path)),
    CONSTRAINT dw2_uploads_hashpathsuffix__c_len CHECK (((length((hash_path)::text) >= 1) AND (length((hash_path)::text) <= 100))),
    CONSTRAINT dw2_uploads_mimetype__c_len CHECK (((length((mime_type)::text) >= 1) AND (length((mime_type)::text) <= 100))),
    CONSTRAINT dw2_uploads_orighashpathsuffix__c_len CHECK (((length((original_hash_path)::text) >= 1) AND (length((original_hash_path)::text) <= 100))),
    CONSTRAINT dw2_uploads_originalhashpath__c CHECK (public.is_valid_hash_path(original_hash_path))
);


CREATE TABLE public.user_emails3 (
    site_id integer NOT NULL,
    user_id integer NOT NULL,
    email_address character varying NOT NULL,
    added_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    CONSTRAINT useremails_c_email_ok CHECK (public.email_seems_ok(email_address))
);


CREATE TABLE public.user_stats3 (
    site_id integer NOT NULL,
    user_id integer NOT NULL,
    last_seen_at timestamp without time zone NOT NULL,
    last_posted_at timestamp without time zone,
    last_emailed_at timestamp without time zone,
    last_emaill_link_clicked_at timestamp without time zone,
    last_emaill_failed_at timestamp without time zone,
    email_bounce_sum real DEFAULT 0 NOT NULL,
    first_seen_at timestamp without time zone NOT NULL,
    first_new_topic_at timestamp without time zone,
    first_discourse_reply_at timestamp without time zone,
    first_chat_message_at timestamp without time zone,
    topics_new_since timestamp without time zone NOT NULL,
    notfs_new_since_id integer DEFAULT 0 NOT NULL,
    num_days_visited integer DEFAULT 0 NOT NULL,
    num_seconds_reading integer DEFAULT 0 NOT NULL,
    num_discourse_replies_read integer DEFAULT 0 NOT NULL,
    num_discourse_replies_posted integer DEFAULT 0 NOT NULL,
    num_discourse_topics_entered integer DEFAULT 0 NOT NULL,
    num_discourse_topics_replied_in integer DEFAULT 0 NOT NULL,
    num_discourse_topics_created integer DEFAULT 0 NOT NULL,
    num_chat_messages_read integer DEFAULT 0 NOT NULL,
    num_chat_messages_posted integer DEFAULT 0 NOT NULL,
    num_chat_topics_entered integer DEFAULT 0 NOT NULL,
    num_chat_topics_replied_in integer DEFAULT 0 NOT NULL,
    num_chat_topics_created integer DEFAULT 0 NOT NULL,
    num_likes_given integer DEFAULT 0 NOT NULL,
    num_likes_received integer DEFAULT 0 NOT NULL,
    num_solutions_provided integer DEFAULT 0 NOT NULL,
    last_summary_email_at timestamp without time zone,
    next_summary_maybe_at timestamp without time zone,
    tour_tips_seen character varying[],
    snooze_notfs_until timestamp without time zone,
    after_snooze_then integer,
    CONSTRAINT ppstats_c_notfsnewsinceid_not_for_imp CHECK ((notfs_new_since_id < 2000000000)),
    CONSTRAINT userstats_c_firstseen_gz CHECK ((date_part('epoch'::text, first_seen_at) > (0)::double precision)),
    CONSTRAINT userstats_c_firstseen_smallest CHECK ((((first_seen_at <= last_posted_at) OR (last_posted_at IS NULL)) AND ((first_seen_at <= first_new_topic_at) OR (first_new_topic_at IS NULL)) AND ((first_seen_at <= first_discourse_reply_at) OR (first_discourse_reply_at IS NULL)) AND ((first_seen_at <= first_chat_message_at) OR (first_chat_message_at IS NULL)))),
    CONSTRAINT userstats_c_gez CHECK (((email_bounce_sum >= (0)::double precision) AND (notfs_new_since_id >= 0) AND (num_days_visited >= 0) AND (num_seconds_reading >= 0) AND (num_discourse_replies_read >= 0) AND (num_discourse_replies_posted >= 0) AND (num_discourse_topics_entered >= 0) AND (num_discourse_topics_replied_in >= 0) AND (num_discourse_topics_created >= 0) AND (num_chat_messages_read >= 0) AND (num_chat_messages_posted >= 0) AND (num_chat_topics_entered >= 0) AND (num_chat_topics_replied_in >= 0) AND (num_chat_topics_created >= 0) AND (num_likes_given >= 0) AND (num_likes_received >= 0) AND (num_solutions_provided >= 0))),
    CONSTRAINT userstats_c_lastseen_greatest CHECK ((((last_seen_at >= last_posted_at) OR (last_posted_at IS NULL)) AND (last_seen_at >= first_seen_at) AND ((last_seen_at >= first_new_topic_at) OR (first_new_topic_at IS NULL)) AND ((last_seen_at >= first_discourse_reply_at) OR (first_discourse_reply_at IS NULL)) AND ((last_seen_at >= first_chat_message_at) OR (first_chat_message_at IS NULL)) AND (last_seen_at >= topics_new_since))),
    CONSTRAINT userstats_c_tourtipsseen_len CHECK ((pg_column_size(tour_tips_seen) <= 400))
);


CREATE TABLE public.user_visit_stats3 (
    site_id integer NOT NULL,
    user_id integer NOT NULL,
    visit_date date NOT NULL,
    num_seconds_reading integer DEFAULT 0 NOT NULL,
    num_discourse_replies_read integer DEFAULT 0 NOT NULL,
    num_discourse_topics_entered integer DEFAULT 0 NOT NULL,
    num_chat_messages_read integer DEFAULT 0 NOT NULL,
    num_chat_topics_entered integer DEFAULT 0 NOT NULL,
    CONSTRAINT uservisitstats_c_gez CHECK (((num_seconds_reading >= 0) AND (num_discourse_replies_read >= 0) AND (num_discourse_topics_entered >= 0) AND (num_chat_messages_read >= 0) AND (num_chat_topics_entered >= 0)))
);


CREATE TABLE public.usernames3 (
    site_id integer NOT NULL,
    username_lowercase character varying NOT NULL,
    in_use_from timestamp without time zone NOT NULL,
    in_use_to timestamp without time zone,
    user_id integer NOT NULL,
    first_mention_at timestamp without time zone,
    CONSTRAINT usernames_c_from_le_mention CHECK ((in_use_from <= first_mention_at)),
    CONSTRAINT usernames_c_from_lt_to CHECK ((in_use_from < in_use_to)),
    CONSTRAINT usernames_c_mention_le_to CHECK ((first_mention_at <= in_use_to)),
    CONSTRAINT usernames_c_username_len CHECK (((length((username_lowercase)::text) >= 2) AND (length((username_lowercase)::text) <= 50)))
);


CREATE TABLE public.users3 (
    site_id integer NOT NULL,
    user_id integer NOT NULL,
    full_name character varying(100),
    primary_email_addr character varying(100),
    country character varying(100),
    website character varying(100),
    is_admin boolean,
    email_notfs character varying(1),
    is_owner boolean,
    username character varying,
    email_verified_at timestamp without time zone,
    created_at timestamp without time zone,
    password_hash character varying,
    email_for_every_new_post boolean,
    guest_browser_id character varying,
    is_approved boolean,
    approved_at timestamp without time zone,
    approved_by_id integer,
    suspended_at timestamp without time zone,
    suspended_till timestamp without time zone,
    suspended_by_id integer,
    suspended_reason character varying,
    updated_at timestamp without time zone,
    is_moderator boolean,
    avatar_tiny_base_url character varying,
    avatar_tiny_hash_path character varying,
    avatar_small_base_url character varying,
    avatar_small_hash_path character varying,
    avatar_medium_base_url character varying,
    avatar_medium_hash_path character varying,
    trust_level smallint,
    locked_trust_level smallint,
    threat_level smallint,
    locked_threat_level smallint,
    is_superadmin boolean,
    about character varying,
    summary_email_interval_mins integer,
    summary_email_if_active boolean,
    guest_email_addr character varying,
    deactivated_at timestamp without time zone,
    deleted_at timestamp without time zone,
    may_see_my_activity_tr_lv_c integer,
    sso_id character varying,
    ui_prefs jsonb,
    is_group boolean DEFAULT false NOT NULL,
    ext_id character varying,
    max_upload_bytes_c integer,
    allowed_upload_extensions_c character varying,
    may_search_engines_index_me_c boolean,
    may_see_my_username_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_full_name_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_tiny_avatar_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_medium_avatar_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_brief_bio_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_full_bio_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_memberships_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_profile_tr_lv_c public.trust_level_or_staff_d,
    may_see_me_in_lists_tr_lv_c public.trust_level_or_staff_d,
    may_see_if_im_online_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_visit_stats_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_post_stats_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_approx_stats_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_exact_stats_tr_lv_c public.trust_level_or_staff_d,
    may_find_me_by_email_tr_lv_c public.trust_level_or_staff_d,
    may_follow_me_tr_lv_c public.trust_level_or_staff_d,
    may_mention_me_tr_lv_c public.trust_level_or_staff_d,
    may_mention_me_same_disc_tr_lv_c public.trust_level_or_staff_d,
    may_dir_msg_me_tr_lv_c public.trust_level_or_staff_d,
    why_may_not_mention_msg_me_html_c public.text_nonempty_ste500_trimmed_d,
    may_see_my_account_email_adrs_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_contact_email_adrs_tr_lv_c public.trust_level_or_staff_d,
    may_assign_me_tr_lv_c public.trust_level_or_staff_d,
    may_see_my_assignments_tr_lv_c public.trust_level_or_staff_d,
    email_threading_c public.i16_gz_lt1024_d,
    email_notf_details_c public.i16_gz_lt1024_d,
    tech_level_c public.i16_gz_lt1024_d,
    can_see_others_email_adrs_c boolean,
    true_id_c public.member_id_d,
    pseudonym_status_c public.pseudonym_status_d,
    anonym_status_c public.anonym_status_d,
    anon_on_page_id_st_c public.page_id_st_d,
    anon_in_tree_id__later_c public.post_id_d,
    mod_conf_c public.jsonb_ste500_d,
    may_set_rel_follow_c boolean,
    CONSTRAINT dw1_users_approved__c_null CHECK ((((approved_by_id IS NULL) = (approved_at IS NULL)) AND ((is_approved IS NULL) OR (approved_by_id IS NOT NULL)))),
    CONSTRAINT dw1_users_avatarmediumbaseurl__c_len CHECK (((length((avatar_medium_base_url)::text) >= 1) AND (length((avatar_medium_base_url)::text) <= 100))),
    CONSTRAINT dw1_users_avatarmediumhashpath__c CHECK (public.is_valid_hash_path(avatar_medium_hash_path)),
    CONSTRAINT dw1_users_avatars_none_or_all__c CHECK ((((avatar_tiny_base_url IS NULL) AND (avatar_tiny_hash_path IS NULL) AND (avatar_small_base_url IS NULL) AND (avatar_small_hash_path IS NULL) AND (avatar_medium_base_url IS NULL) AND (avatar_medium_hash_path IS NULL)) OR ((avatar_tiny_base_url IS NOT NULL) AND (avatar_tiny_hash_path IS NOT NULL) AND (avatar_small_base_url IS NOT NULL) AND (avatar_small_hash_path IS NOT NULL) AND (avatar_medium_base_url IS NOT NULL) AND (avatar_medium_hash_path IS NOT NULL)))),
    CONSTRAINT dw1_users_avatarsmallbaseurl__c_len CHECK (((length((avatar_small_base_url)::text) >= 1) AND (length((avatar_small_base_url)::text) <= 100))),
    CONSTRAINT dw1_users_avatarsmallhashpath__c CHECK (public.is_valid_hash_path(avatar_small_hash_path)),
    CONSTRAINT dw1_users_avatartinybaseurl__c_len CHECK (((length((avatar_tiny_base_url)::text) >= 1) AND (length((avatar_tiny_base_url)::text) <= 100))),
    CONSTRAINT dw1_users_avatartinyhashpath__c CHECK (public.is_valid_hash_path(avatar_tiny_hash_path)),
    CONSTRAINT dw1_users_country__c CHECK (((country)::text <> ''::text)),
    CONSTRAINT dw1_users_dname__c CHECK (((full_name)::text <> ''::text)),
    CONSTRAINT dw1_users_passwordhash__c_len CHECK (((length((password_hash)::text) >= 8) AND (length((password_hash)::text) <= 150))),
    CONSTRAINT dw1_users_suspended__c_null CHECK ((((suspended_by_id IS NULL) = (suspended_at IS NULL)) AND ((suspended_by_id IS NULL) = (suspended_till IS NULL)) AND ((suspended_by_id IS NULL) = (suspended_reason IS NULL)))),
    CONSTRAINT dw1_users_suspreason__c_len CHECK ((length((suspended_reason)::text) <= 255)),
    CONSTRAINT dw1_users_username__c_at CHECK (((username)::text !~~ '%@%'::text)),
    CONSTRAINT dw1_users_username__c_len CHECK ((length(btrim((username)::text)) >= 2)),
    CONSTRAINT dw1_users_website__c CHECK (((website)::text <> ''::text)),
    CONSTRAINT participants_c_group_id_gz CHECK (((NOT is_group) OR (user_id > 0))),
    CONSTRAINT participants_c_group_no_password CHECK (((NOT is_group) OR (password_hash IS NULL))),
    CONSTRAINT participants_c_group_no_trust_threat_lvl CHECK (((NOT is_group) OR ((trust_level IS NULL) AND (threat_level IS NULL)))),
    CONSTRAINT participants_c_group_not_adm_mod_ownr CHECK (((NOT is_group) OR (((is_admin IS NOT TRUE) OR (user_id = 19)) AND ((is_moderator IS NOT TRUE) OR (user_id = ANY (ARRAY[17, 18]))) AND (is_owner IS NOT TRUE) AND (is_superadmin IS NOT TRUE)))),
    CONSTRAINT participants_c_group_not_approved CHECK (((NOT is_group) OR ((is_approved IS NULL) AND (approved_at IS NULL) AND (approved_by_id IS NULL)))),
    CONSTRAINT participants_c_group_not_deactivated CHECK (((NOT is_group) OR (deactivated_at IS NULL))),
    CONSTRAINT participants_c_group_not_suspended CHECK (((NOT is_group) OR ((suspended_at IS NULL) AND (suspended_till IS NULL) AND (suspended_by_id IS NULL) AND (suspended_reason IS NULL)))),
    CONSTRAINT participants_c_guest_no_username CHECK (((user_id > 0) OR (username IS NULL))),
    CONSTRAINT participants_c_member_no_guest_email CHECK (((user_id < 0) OR (guest_email_addr IS NULL))),
    CONSTRAINT participants_c_user_has_trust_threat_lvl CHECK ((is_group OR (user_id < 0) OR ((trust_level IS NOT NULL) AND (threat_level IS NOT NULL)))),
    CONSTRAINT participants_c_username_len_active CHECK (((deleted_at IS NOT NULL) OR (length((username)::text) <= 40))),
    CONSTRAINT participants_c_username_len_deleted CHECK (((deleted_at IS NULL) OR (length((username)::text) <= 80))),
    CONSTRAINT pats_c_alloweduploadexts_alnum CHECK (((allowed_upload_extensions_c)::text ~ '^[a-z0-9 _.*-]+$'::text)),
    CONSTRAINT pats_c_alloweduploadexts_len CHECK (((length((allowed_upload_extensions_c)::text) >= 1) AND (length((allowed_upload_extensions_c)::text) <= 2000))),
    CONSTRAINT pats_c_alloweduploads_is_group CHECK ((is_group OR ((allowed_upload_extensions_c IS NULL) AND (max_upload_bytes_c IS NULL)))),
    CONSTRAINT pats_c_anon_no_avatar CHECK (((anonym_status_c IS NULL) OR ((avatar_tiny_base_url IS NULL) AND (avatar_tiny_hash_path IS NULL) AND (avatar_small_base_url IS NULL) AND (avatar_small_hash_path IS NULL) AND (avatar_medium_base_url IS NULL) AND (avatar_medium_hash_path IS NULL)))),
    CONSTRAINT pats_c_anon_no_email CHECK ((((anonym_status_c IS NULL) AND (pseudonym_status_c IS NULL)) OR ((guest_email_addr IS NULL) AND (primary_email_addr IS NULL) AND (email_notfs IS NULL) AND (email_verified_at IS NULL) AND (email_for_every_new_post IS NULL) AND (summary_email_interval_mins IS NULL) AND (summary_email_if_active IS NULL)))),
    CONSTRAINT pats_c_anon_no_levels CHECK (((anonym_status_c IS NULL) OR ((trust_level IS NULL) AND (locked_trust_level IS NULL) AND (threat_level IS NULL) AND (locked_threat_level IS NULL) AND (tech_level_c IS NULL)))),
    CONSTRAINT pats_c_anon_null_same CHECK ((((true_id_c IS NULL) AND (anonym_status_c IS NULL) AND (anon_on_page_id_st_c IS NULL) AND (pseudonym_status_c IS NULL)) OR ((true_id_c IS NOT NULL) AND (((anonym_status_c IS NOT NULL) AND (anon_on_page_id_st_c IS NOT NULL) AND (pseudonym_status_c IS NULL)) OR ((anonym_status_c IS NULL) AND (anon_on_page_id_st_c IS NULL) AND (pseudonym_status_c IS NOT NULL)))))),
    CONSTRAINT pats_c_anon_nulls CHECK (((anonym_status_c IS NULL) OR ((guest_browser_id IS NULL) AND (sso_id IS NULL) AND (ext_id IS NULL) AND (username IS NULL) AND (password_hash IS NULL) AND (full_name IS NULL) AND (country IS NULL) AND (website IS NULL) AND (about IS NULL) AND (is_moderator IS NULL) AND (is_admin IS NULL) AND (is_superadmin IS NULL) AND (is_owner IS NULL) AND (is_group = false) AND (ui_prefs IS NULL) AND (max_upload_bytes_c IS NULL) AND (allowed_upload_extensions_c IS NULL) AND (may_search_engines_index_me_c IS NULL) AND (may_see_my_activity_tr_lv_c IS NULL) AND (may_see_my_username_tr_lv_c IS NULL) AND (may_see_my_full_name_tr_lv_c IS NULL) AND (may_see_my_tiny_avatar_tr_lv_c IS NULL) AND (may_see_my_medium_avatar_tr_lv_c IS NULL) AND (may_see_my_brief_bio_tr_lv_c IS NULL) AND (may_see_my_full_bio_tr_lv_c IS NULL) AND (may_see_my_memberships_tr_lv_c IS NULL) AND (may_see_my_profile_tr_lv_c IS NULL) AND (may_see_me_in_lists_tr_lv_c IS NULL) AND (may_see_if_im_online_tr_lv_c IS NULL) AND (may_see_my_visit_stats_tr_lv_c IS NULL) AND (may_see_my_post_stats_tr_lv_c IS NULL) AND (may_see_my_approx_stats_tr_lv_c IS NULL) AND (may_see_my_exact_stats_tr_lv_c IS NULL) AND (may_find_me_by_email_tr_lv_c IS NULL) AND (may_follow_me_tr_lv_c IS NULL) AND (may_mention_me_tr_lv_c IS NULL) AND (may_mention_me_same_disc_tr_lv_c IS NULL) AND (may_dir_msg_me_tr_lv_c IS NULL) AND (why_may_not_mention_msg_me_html_c IS NULL) AND (may_see_my_account_email_adrs_tr_lv_c IS NULL) AND (may_see_my_contact_email_adrs_tr_lv_c IS NULL) AND (can_see_others_email_adrs_c IS NULL) AND (may_assign_me_tr_lv_c IS NULL) AND (may_see_my_assignments_tr_lv_c IS NULL) AND (email_threading_c IS NULL) AND (email_notf_details_c IS NULL)))),
    CONSTRAINT pats_c_anonid_ltem10 CHECK (((anonym_status_c IS NULL) OR (user_id <= '-10'::integer))),
    CONSTRAINT pats_c_anons_need_no_approval CHECK (((anonym_status_c IS NULL) OR ((created_at IS NOT NULL) AND (is_approved IS NULL) AND (approved_at IS NULL) AND (approved_by_id IS NULL)))),
    CONSTRAINT pats_c_contactemailadr_lte_accountadr_trlv CHECK (((may_see_my_contact_email_adrs_tr_lv_c)::smallint <= (may_see_my_account_email_adrs_tr_lv_c)::smallint)),
    CONSTRAINT pats_c_guest_non_nulls CHECK (((user_id > '-10'::integer) OR (anonym_status_c IS NOT NULL) OR ((created_at IS NOT NULL) AND (full_name IS NOT NULL) AND (guest_email_addr IS NOT NULL)))),
    CONSTRAINT pats_c_guest_nulls CHECK (((user_id > '-10'::integer) OR (anonym_status_c IS NOT NULL) OR (can_see_others_email_adrs_c IS NULL))),
    CONSTRAINT pats_c_guest_w_no_browserid_has_extid CHECK (((user_id > '-10'::integer) OR (anonym_status_c IS NOT NULL) OR (guest_browser_id IS NOT NULL) OR (ext_id IS NOT NULL))),
    CONSTRAINT pats_c_maxuploadbytes_gez CHECK ((max_upload_bytes_c >= 0)),
    CONSTRAINT pats_c_maymentionme_gte_samedisc CHECK (((may_mention_me_tr_lv_c)::smallint >= (may_mention_me_same_disc_tr_lv_c)::smallint)),
    CONSTRAINT pats_c_mayseemyassignments_lte_mayassign_trlv CHECK (((may_see_my_assignments_tr_lv_c)::smallint <= (may_assign_me_tr_lv_c)::smallint)),
    CONSTRAINT pats_c_mayseemyfullbio_gte_briefbio CHECK (((may_see_my_full_bio_tr_lv_c)::smallint >= (may_see_my_brief_bio_tr_lv_c)::smallint)),
    CONSTRAINT pats_c_mayseemymediumavatar_gte_tiny CHECK (((may_see_my_medium_avatar_tr_lv_c)::smallint >= (may_see_my_tiny_avatar_tr_lv_c)::smallint)),
    CONSTRAINT pats_c_not_both_anon_pseudo CHECK ((num_nonnulls(pseudonym_status_c, anonym_status_c) <= 1)),
    CONSTRAINT pats_c_pseudonymid_gte100 CHECK (((pseudonym_status_c IS NULL) OR (user_id >= 100))),
    CONSTRAINT people_c_not_both_admin_mod CHECK (((NOT is_admin) OR (NOT is_moderator))),
    CONSTRAINT people_member_c_nn CHECK (((user_id < 0) OR ((created_at IS NOT NULL) AND (username IS NOT NULL)))),
    CONSTRAINT pps_c_extid_not_builtin CHECK (((ext_id IS NULL) OR (NOT ((user_id >= '-9'::integer) AND (user_id <= 99))))),
    CONSTRAINT pps_c_extid_ok CHECK (public.is_valid_ext_id(ext_id)),
    CONSTRAINT pps_c_group_no_sso_id CHECK (((NOT is_group) OR (sso_id IS NULL))),
    CONSTRAINT pps_c_guest_id_not_for_imp CHECK ((user_id > '-2000000000'::integer)),
    CONSTRAINT pps_c_guest_no_avatar CHECK (((user_id > 0) OR (avatar_tiny_base_url IS NULL))),
    CONSTRAINT pps_c_guest_no_email_pwd CHECK (((user_id > 0) OR ((primary_email_addr IS NULL) AND (password_hash IS NULL)))),
    CONSTRAINT pps_c_guest_no_trust_level CHECK (((user_id > 0) OR (trust_level IS NULL))),
    CONSTRAINT pps_c_guest_not_staff CHECK (((user_id > 0) OR ((is_admin IS NOT TRUE) AND (is_moderator IS NOT TRUE) AND (is_owner IS NOT TRUE) AND (is_superadmin IS NOT TRUE)))),
    CONSTRAINT pps_c_member_id_not_for_imp CHECK ((user_id < 2000000000)),
    CONSTRAINT pps_c_ssoid_max_len CHECK ((length((sso_id)::text) <= 200)),
    CONSTRAINT pps_c_ssoid_min_len CHECK ((1 <= length((sso_id)::text))),
    CONSTRAINT users3_country_c_trim CHECK (public.is_trimmed(country)),
    CONSTRAINT users3_fullname_c_trim CHECK (public.is_trimmed(full_name)),
    CONSTRAINT users3_lockedthreatlevel__c_betw CHECK (((locked_threat_level >= 1) AND (locked_threat_level <= 6))),
    CONSTRAINT users3_threatlevel__c_betw CHECK (((threat_level >= 1) AND (threat_level <= 6))),
    CONSTRAINT users3_username_c_blank CHECK ((NOT public.contains_blank(username))),
    CONSTRAINT users3_website_c_trim CHECK ((NOT public.contains_blank(website))),
    CONSTRAINT users_about__c_len CHECK (((length((about)::text) >= 1) AND (length((about)::text) <= 2000))),
    CONSTRAINT users_c_deact_bef_delete CHECK (((deactivated_at IS NULL) OR (deleted_at IS NULL) OR (deactivated_at <= deleted_at))),
    CONSTRAINT users_c_email_ok CHECK (public.email_seems_ok(primary_email_addr)),
    CONSTRAINT users_c_guestbrowserid_len CHECK (((length((guest_browser_id)::text) >= 2) AND (length((guest_browser_id)::text) <= 100))),
    CONSTRAINT users_c_uiprefs_len CHECK ((pg_column_size(ui_prefs) <= 400)),
    CONSTRAINT users_id__c CHECK ((user_id <> 0)),
    CONSTRAINT users_lockedtrustlevel_c_betw CHECK (((locked_trust_level >= 1) AND (locked_trust_level <= 6))),
    CONSTRAINT users_member__c_nulls CHECK (((user_id < 0) OR (guest_browser_id IS NULL))),
    CONSTRAINT users_member_email__c CHECK (((user_id < 0) OR ((primary_email_addr)::text ~~ '%@%.%'::text))),
    CONSTRAINT users_trustlevel_c_betw CHECK (((trust_level >= 1) AND (trust_level <= 6)))
);


COMMENT ON COLUMN public.users3.why_may_not_mention_msg_me_html_c IS '
A help text explaining why this user or group cannot be @mentioned or DM:d,
and who to contact instead.
';


COMMENT ON COLUMN public.users3.mod_conf_c IS '
Moderation settings for this group (or user), e.g. max posts per week
before they get a "You''re creating a lot of posts" soft warning.
';


COMMENT ON COLUMN public.users3.may_set_rel_follow_c IS '
If this group (or user) can set rel=follow for all links (even if not in
settings_t.follow_links_to_c).
';


CREATE TABLE public.webhook_reqs_out_t (
    site_id_c public.site_id_d NOT NULL,
    webhook_id_c public.webhook_id_d NOT NULL,
    req_nr_c public.i64_gz_d NOT NULL,
    sent_at_c timestamp without time zone NOT NULL,
    sent_as_id_c public.pat_id_d,
    sent_to_url_c public.http_url_d NOT NULL,
    sent_by_app_ver_c public.text_nonempty_ste120_d NOT NULL,
    sent_api_version_c public.api_version_d NOT NULL,
    sent_to_ext_app_ver_c public.text_nonempty_ste120_d,
    sent_event_types_c integer[] NOT NULL,
    sent_event_subtypes_c integer[],
    sent_event_ids_c integer[] NOT NULL,
    sent_json_c public.jsonb_ste500_000_d NOT NULL,
    sent_headers_c public.jsonb_ste8000_d,
    retry_nr_c public.retry_nr_d,
    failed_at_c timestamp without time zone,
    failed_how_c public.i16_gz_d,
    failed_msg_c public.text_nonempty_ste16000_d,
    resp_at_c timestamp without time zone,
    resp_status_c public.i32_d,
    resp_status_text_c public.text_nonempty_ste250_trimmed_d,
    resp_body_c public.text_nonempty_ste16000_d,
    resp_headers_c public.jsonb_ste8000_d,
    CONSTRAINT webhookreqsout_c_failed_at_how_null CHECK (((failed_at_c IS NULL) = (failed_how_c IS NULL))),
    CONSTRAINT webhookreqsout_c_failed_at_msg_null CHECK (((failed_at_c IS NOT NULL) OR (failed_msg_c IS NULL))),
    CONSTRAINT webhookreqsout_c_not_yet_any_subtypes CHECK ((sent_event_subtypes_c IS NULL)),
    CONSTRAINT webhookreqsout_c_num_ev_subtypes_gte1 CHECK ((cardinality(sent_event_subtypes_c) >= 1)),
    CONSTRAINT webhookreqsout_c_num_ev_types_gte1 CHECK ((cardinality(sent_event_types_c) >= 1)),
    CONSTRAINT webhookreqsout_c_num_ev_types_lte_num_evs CHECK ((cardinality(sent_event_types_c) <= cardinality(sent_event_ids_c))),
    CONSTRAINT webhookreqsout_c_num_events_gte1 CHECK ((cardinality(sent_event_ids_c) >= 1)),
    CONSTRAINT webhookreqsout_c_resp_at_body_null CHECK (((resp_at_c IS NOT NULL) OR (resp_body_c IS NULL))),
    CONSTRAINT webhookreqsout_c_resp_at_headers_null CHECK (((resp_at_c IS NOT NULL) OR (resp_headers_c IS NULL))),
    CONSTRAINT webhookreqsout_c_resp_at_status_null CHECK (((resp_at_c IS NOT NULL) OR (resp_status_c IS NULL))),
    CONSTRAINT webhookreqsout_c_resp_at_statustext_null CHECK (((resp_at_c IS NOT NULL) OR (resp_status_text_c IS NULL))),
    CONSTRAINT webhookreqsout_c_sent_bef_failed CHECK ((sent_at_c <= failed_at_c)),
    CONSTRAINT webhookreqsout_c_sent_bef_resp CHECK ((sent_at_c <= resp_at_c))
);


CREATE TABLE public.webhooks_t (
    site_id_c public.site_id_d NOT NULL,
    webhook_id_c public.webhook_id_d NOT NULL,
    owner_id_c public.pat_id_d NOT NULL,
    run_as_id_c public.pat_id_d,
    enabled_c boolean NOT NULL,
    deleted_c boolean NOT NULL,
    descr_c public.text_nonempty_ste500_trimmed_d,
    send_to_url_c public.http_url_d NOT NULL,
    check_dest_cert_c boolean,
    send_event_types_c integer[],
    send_event_subtypes_c integer[],
    api_version_c public.api_version_d,
    to_ext_app_ver_c public.text_nonempty_ste120_d,
    send_max_reqs_per_sec_c public.f32_gz_d,
    send_max_events_per_req_c public.i16_gz_d,
    send_max_delay_secs_c public.i16_gz_d,
    send_custom_headers_c public.jsonb_ste4000_d,
    retry_max_secs_c public.i32_gez_d,
    retry_extra_times_c public.i16_gz_d,
    failed_since_c timestamp without time zone,
    last_failed_how_c public.i16_gz_d,
    last_err_msg_or_resp_c public.text_nonempty_ste16000_d,
    retried_num_times_c public.i16_gez_d,
    retried_num_secs_c public.i32_gez_d,
    broken_reason_c public.i16_gz_d,
    sent_up_to_when_c timestamp without time zone,
    sent_up_to_event_id_c public.event_id_d,
    num_pending_maybe_c public.i16_gez_d,
    done_for_now_c boolean,
    CONSTRAINT webhooks_c_failed_brokenreason CHECK (((failed_since_c IS NOT NULL) OR (broken_reason_c IS NULL))),
    CONSTRAINT webhooks_c_failed_errmsgresp CHECK (((failed_since_c IS NOT NULL) OR (last_err_msg_or_resp_c IS NULL))),
    CONSTRAINT webhooks_c_failed_retriednumsecs CHECK (((failed_since_c IS NOT NULL) OR (retried_num_secs_c IS NULL))),
    CONSTRAINT webhooks_c_failed_retriednumtimes CHECK (((failed_since_c IS NOT NULL) OR (retried_num_times_c IS NULL))),
    CONSTRAINT webhooks_c_failed_since_how CHECK (((failed_since_c IS NULL) = (last_failed_how_c IS NULL))),
    CONSTRAINT webhooks_c_retry_eq1 CHECK (((retry_extra_times_c)::smallint = 1)),
    CONSTRAINT webhooks_c_retry_failed CHECK (((retry_extra_times_c IS NULL) OR (failed_since_c IS NOT NULL)))
);


ALTER TABLE ONLY public.alt_page_ids3
    ADD CONSTRAINT altpageids_p PRIMARY KEY (site_id, alt_page_id);


ALTER TABLE ONLY public.api_secrets3
    ADD CONSTRAINT apisecrets_nr_p PRIMARY KEY (site_id, secret_nr);


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_byuser_nr_p PRIMARY KEY (site_id, by_user_id, draft_nr);


ALTER TABLE ONLY public.guest_prefs3
    ADD CONSTRAINT dw1_idsmpleml__p PRIMARY KEY (site_id, email, ctime);


ALTER TABLE ONLY public.identities3
    ADD CONSTRAINT dw1_idsoid_tnt_oid__u UNIQUE (site_id, oid_claimed_id);


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT dw1_pages__u UNIQUE (site_id, page_id);


ALTER TABLE ONLY public.sites3
    ADD CONSTRAINT dw1_tenants_id__p PRIMARY KEY (id);


ALTER TABLE ONLY public.sites3
    ADD CONSTRAINT dw1_tenants_name__u UNIQUE (name);


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT dw1_users_tnt_sno__p PRIMARY KEY (site_id, user_id);


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT dw2_auditlog__p PRIMARY KEY (site_id, audit_id);


ALTER TABLE ONLY public.categories3
    ADD CONSTRAINT dw2_cats_id__p PRIMARY KEY (site_id, id);


ALTER TABLE ONLY public.invites3
    ADD CONSTRAINT dw2_invites__p PRIMARY KEY (site_id, secret_key);


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT dw2_postacs__p PRIMARY KEY (site_id, to_post_id_c, rel_type_c, from_pat_id_c, sub_type_c);


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT dw2_postrevs_postid_revnr__p PRIMARY KEY (site_id, post_id, revision_nr);


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT dw2_posts_id__p PRIMARY KEY (site_id, unique_post_id);


ALTER TABLE ONLY public.upload_refs3
    ADD CONSTRAINT dw2_uploadrefs__p PRIMARY KEY (site_id, post_id, base_url, hash_path);


ALTER TABLE ONLY public.uploads3
    ADD CONSTRAINT dw2_uploads__p PRIMARY KEY (base_url, hash_path);


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_p_id PRIMARY KEY (site_id, email_id_c);


ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


ALTER TABLE ONLY public.group_participants3
    ADD CONSTRAINT groupparticipants_groupid_ppid_p PRIMARY KEY (site_id, group_id, participant_id);


ALTER TABLE ONLY public.idps_t
    ADD CONSTRAINT idps_p_id PRIMARY KEY (site_id_c, idp_id_c);


ALTER TABLE ONLY public.identities3
    ADD CONSTRAINT idtys_p_idtyid PRIMARY KEY (site_id, idty_id_c);


ALTER TABLE ONLY public.link_previews_t
    ADD CONSTRAINT linkpreviews_p_linkurl_fetchurl PRIMARY KEY (site_id_c, link_url_c, fetched_from_url_c);


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_p_postid_url PRIMARY KEY (site_id_c, from_post_id_c, link_url_c);


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_p_notfid PRIMARY KEY (site_id, notf_id);


ALTER TABLE ONLY public.notices_t
    ADD CONSTRAINT notices_p_patid_noticeid PRIMARY KEY (site_id_c, to_pat_id_c, notice_id_c);


ALTER TABLE ONLY public.page_html_cache_t
    ADD CONSTRAINT pagehtmlcache_p PRIMARY KEY (site_id_c, page_id_c, param_comt_order_c, param_comt_nesting_c, param_width_layout_c, param_theme_id_c_u, param_is_embedded_c, param_origin_or_empty_c, param_cdn_origin_or_empty_c, param_ugc_origin_or_empty_c);


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_category_people_u UNIQUE (site_id, pages_in_cat_id_c, pat_id_c);


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_pageid_people_u UNIQUE (site_id, page_id, pat_id_c);


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_wholesite_people_u UNIQUE (site_id, pages_in_whole_site_c, pat_id_c);


ALTER TABLE ONLY public.page_popularity_scores3
    ADD CONSTRAINT pagepopscores_p_pageid_algid PRIMARY KEY (site_id, page_id, score_alg_c);


ALTER TABLE ONLY public.page_users3
    ADD CONSTRAINT pageusers_page_user_p PRIMARY KEY (site_id, page_id, user_id);


ALTER TABLE ONLY public.perms_on_pages3
    ADD CONSTRAINT permsonpages_p PRIMARY KEY (site_id, perm_id);


ALTER TABLE ONLY public.post_tags3
    ADD CONSTRAINT posttags_site_post__p PRIMARY KEY (site_id, post_id, tag);


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks__p PRIMARY KEY (site_id, id);


ALTER TABLE ONLY public.spam_check_queue3
    ADD CONSTRAINT scq_site_postid_revnr__p PRIMARY KEY (site_id, post_id, post_rev_nr);


ALTER TABLE ONLY public.sessions_t
    ADD CONSTRAINT sessions_p_patid_createdat PRIMARY KEY (site_id_c, pat_id_c, created_at_c);


ALTER TABLE ONLY public.sessions_t
    ADD CONSTRAINT sessions_u_hash4 UNIQUE (site_id_c, hash_4_http_only_c);


ALTER TABLE ONLY public.sessions_t
    ADD CONSTRAINT sessions_u_part1 UNIQUE (site_id_c, part_1_comp_id_c);


ALTER TABLE ONLY public.tag_notf_levels3
    ADD CONSTRAINT tagnotflvl_site_user_tag__p PRIMARY KEY (site_id, user_id, tag);


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_p_id PRIMARY KEY (site_id_c, id_c);


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_u_id_patid UNIQUE (site_id_c, id_c, on_pat_id_c);


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_u_id_postid UNIQUE (site_id_c, id_c, on_post_id_c);


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_p_id PRIMARY KEY (site_id_c, id_c);


ALTER TABLE ONLY public.user_emails3
    ADD CONSTRAINT useremails_p PRIMARY KEY (site_id, user_id, email_address);


ALTER TABLE ONLY public.usernames3
    ADD CONSTRAINT usernames_p PRIMARY KEY (site_id, username_lowercase, in_use_from);


ALTER TABLE ONLY public.user_stats3
    ADD CONSTRAINT userstats_p PRIMARY KEY (site_id, user_id);


ALTER TABLE ONLY public.user_visit_stats3
    ADD CONSTRAINT uservisitstats_p PRIMARY KEY (site_id, user_id, visit_date);


ALTER TABLE ONLY public.webhook_reqs_out_t
    ADD CONSTRAINT webhookreqsout_p_webhookid_reqnr PRIMARY KEY (site_id_c, webhook_id_c, req_nr_c);


ALTER TABLE ONLY public.webhooks_t
    ADD CONSTRAINT webhooks_p_id PRIMARY KEY (site_id_c, webhook_id_c);


CREATE INDEX auditlog_forgotten_ix ON public.audit_log3 USING btree (forgotten, done_at DESC);


CREATE INDEX auditlog_i_doertrueid ON public.audit_log3 USING btree (site_id, doer_true_id_c);


CREATE INDEX auditlog_i_sid_part1 ON public.audit_log3 USING btree (site_id, sess_id_part_1);


CREATE INDEX auditlog_i_targetpattrueid ON public.audit_log3 USING btree (site_id, target_pat_true_id_c);


CREATE INDEX backup_test_log_i ON public.backup_test_log3 USING btree (logged_at DESC);


CREATE UNIQUE INDEX categories_u_extid ON public.categories3 USING btree (site_id, ext_id);


CREATE INDEX drafts_byuser_deldat_i ON public.drafts3 USING btree (site_id, by_user_id, deleted_at DESC) WHERE (deleted_at IS NOT NULL);


CREATE INDEX drafts_byuser_editedat_i ON public.drafts3 USING btree (site_id, by_user_id, COALESCE(last_edited_at, created_at)) WHERE (deleted_at IS NULL);


CREATE INDEX drafts_category_i ON public.drafts3 USING btree (site_id, category_id);


CREATE INDEX drafts_i_postasid ON public.drafts3 USING btree (site_id, post_as_id_c) WHERE (post_as_id_c IS NOT NULL);


CREATE INDEX drafts_pageid_postnr_i ON public.drafts3 USING btree (site_id, page_id, post_nr);


CREATE INDEX drafts_postid_i ON public.drafts3 USING btree (site_id, post_id);


CREATE INDEX drafts_touser_i ON public.drafts3 USING btree (site_id, to_user_id);


CREATE UNIQUE INDEX dw1_idsmpleml_version__u ON public.guest_prefs3 USING btree (site_id, email, version) WHERE (version = 'C'::bpchar);


CREATE INDEX dw1_pages_bumpedat__i ON public.pages3 USING btree (site_id, bumped_at DESC);


CREATE UNIQUE INDEX dw1_pages_category_about__u ON public.pages3 USING btree (site_id, category_id, page_role) WHERE (page_role = 9);


CREATE INDEX dw1_pages_frequentposter1id__i ON public.pages3 USING btree (site_id, frequent_poster_1_id) WHERE (frequent_poster_1_id IS NOT NULL);


CREATE INDEX dw1_pages_frequentposter2id__i ON public.pages3 USING btree (site_id, frequent_poster_2_id) WHERE (frequent_poster_2_id IS NOT NULL);


CREATE INDEX dw1_pages_frequentposter3id__i ON public.pages3 USING btree (site_id, frequent_poster_3_id) WHERE (frequent_poster_3_id IS NOT NULL);


CREATE INDEX dw1_pages_frequentposter4id__i ON public.pages3 USING btree (site_id, frequent_poster_4_id) WHERE (frequent_poster_4_id IS NOT NULL);


CREATE INDEX dw1_pages_lastreplybyid__i ON public.pages3 USING btree (site_id, last_reply_by_id) WHERE (last_reply_by_id IS NOT NULL);


CREATE INDEX dw1_pages_likes_bump__i ON public.pages3 USING btree (site_id, num_likes DESC, bumped_at DESC);


CREATE INDEX dw1_pages_pinorder__i ON public.pages3 USING btree (site_id, pin_order) WHERE (pin_order IS NOT NULL);


CREATE INDEX dw1_pages_publishedat__i ON public.pages3 USING btree (site_id, published_at);


CREATE UNIQUE INDEX dw1_pgpths_path__u ON public.page_paths3 USING btree (site_id, page_id, parent_folder, page_slug, show_id);


CREATE UNIQUE INDEX dw1_pgpths_path_noid_cncl__u ON public.page_paths3 USING btree (site_id, parent_folder, page_slug) WHERE (((show_id)::text = 'F'::text) AND ((canonical)::text = 'C'::text));


CREATE INDEX dw1_pgpths_tnt_fldr_slg_cncl ON public.page_paths3 USING btree (site_id, parent_folder, page_slug, canonical);


CREATE INDEX dw1_pgpths_tnt_pgid_cncl ON public.page_paths3 USING btree (site_id, page_id, canonical);


CREATE UNIQUE INDEX dw1_pgpths_tnt_pgid_cncl__u ON public.page_paths3 USING btree (site_id, page_id) WHERE ((canonical)::text = 'C'::text);


CREATE UNIQUE INDEX dw1_pstsrd_guest_ip__u ON public.post_read_stats3 USING btree (site_id, page_id, post_nr, ip) WHERE ((user_id IS NULL) OR ((user_id)::text ~~ '-%'::text));


CREATE UNIQUE INDEX dw1_pstsrd_role__u ON public.post_read_stats3 USING btree (site_id, page_id, post_nr, user_id);


CREATE INDEX dw1_tenants_creatoremail ON public.sites3 USING btree (creator_email_address);


CREATE INDEX dw1_tenants_creatorip ON public.sites3 USING btree (creator_ip);


CREATE INDEX dw1_user_guestcookie__i ON public.users3 USING btree (site_id, guest_browser_id) WHERE (user_id < '-1'::integer);


CREATE INDEX dw1_user_guestemail__i ON public.users3 USING btree (site_id, primary_email_addr) WHERE (user_id < '-1'::integer);


CREATE INDEX dw1_users_approvedbyid__i ON public.users3 USING btree (site_id, approved_by_id) WHERE (approved_by_id IS NOT NULL);


CREATE INDEX dw1_users_avatarmediumbaseurl__i ON public.users3 USING btree (avatar_medium_base_url);


CREATE INDEX dw1_users_avatarmediumhashpath__i ON public.users3 USING btree (avatar_medium_hash_path);


CREATE INDEX dw1_users_avatarsmallbaseurl__i ON public.users3 USING btree (avatar_small_base_url);


CREATE INDEX dw1_users_avatarsmallhashpath__i ON public.users3 USING btree (avatar_small_hash_path);


CREATE INDEX dw1_users_avatartinybaseurl__i ON public.users3 USING btree (avatar_tiny_base_url);


CREATE INDEX dw1_users_avatartinyhashpath__i ON public.users3 USING btree (avatar_tiny_hash_path);


CREATE UNIQUE INDEX dw1_users_site_usernamelower__u ON public.users3 USING btree (site_id, lower((username)::text));


CREATE INDEX dw1_users_suspendebyid__i ON public.users3 USING btree (site_id, suspended_by_id) WHERE (suspended_by_id IS NOT NULL);


CREATE INDEX dw2_auditlog_doer_doneat__i ON public.audit_log3 USING btree (site_id, doer_id_c, done_at);


CREATE INDEX dw2_auditlog_doneat__i ON public.audit_log3 USING btree (site_id, done_at);


CREATE INDEX dw2_auditlog_fingerprint_doneat__i ON public.audit_log3 USING btree (site_id, browser_fingerprint, done_at);


CREATE INDEX dw2_auditlog_idcookie_doneat__i ON public.audit_log3 USING btree (site_id, browser_id_cookie, done_at);


CREATE INDEX dw2_auditlog_ip_doneat__i ON public.audit_log3 USING btree (site_id, ip, done_at);


CREATE INDEX dw2_auditlog_page_doneat__i ON public.audit_log3 USING btree (site_id, page_id, done_at) WHERE (page_id IS NOT NULL);


CREATE INDEX dw2_auditlog_post_doneat__i ON public.audit_log3 USING btree (site_id, post_id, done_at) WHERE (post_id IS NOT NULL);


CREATE INDEX dw2_auditlog_uploadhashpathsuffix__i ON public.audit_log3 USING btree (upload_hash_path) WHERE (upload_hash_path IS NOT NULL);


CREATE INDEX dw2_blocks_blockedby__i ON public.blocks3 USING btree (site_id, blocked_by_id);


CREATE UNIQUE INDEX dw2_blocks_browseridcookie__u ON public.blocks3 USING btree (site_id, browser_id_cookie) WHERE ((browser_id_cookie IS NOT NULL) AND (ip IS NULL));


CREATE UNIQUE INDEX dw2_blocks_ip__u ON public.blocks3 USING btree (site_id, ip) WHERE (ip IS NOT NULL);


CREATE INDEX dw2_cats_page__i ON public.categories3 USING btree (site_id, page_id);


CREATE UNIQUE INDEX dw2_cats_page_slug__u ON public.categories3 USING btree (site_id, page_id, slug);


CREATE UNIQUE INDEX dw2_cats_parent_slug__u ON public.categories3 USING btree (site_id, parent_id, slug);


CREATE INDEX dw2_cats_slug__i ON public.categories3 USING btree (site_id, slug);


CREATE INDEX dw2_invites_createdby_at__i ON public.invites3 USING btree (site_id, created_by_id, created_at);


CREATE INDEX dw2_invites_deletedby__i ON public.invites3 USING btree (site_id, deleted_by_id) WHERE (deleted_by_id IS NOT NULL);


CREATE INDEX dw2_invites_user__i ON public.invites3 USING btree (site_id, user_id) WHERE (user_id IS NOT NULL);


CREATE INDEX dw2_pages_createdby__i ON public.pages3 USING btree (site_id, author_id);


CREATE INDEX dw2_postacs_deletedby__i ON public.post_actions3 USING btree (site_id, deleted_by_id) WHERE (deleted_by_id IS NOT NULL);


CREATE INDEX dw2_postrevs_approvedby__i ON public.post_revisions3 USING btree (site_id, approved_by_id) WHERE (approved_by_id IS NOT NULL);


CREATE INDEX dw2_postrevs_composedby__i ON public.post_revisions3 USING btree (site_id, composed_by_id);


CREATE INDEX dw2_postrevs_hiddenby__i ON public.post_revisions3 USING btree (site_id, hidden_by_id) WHERE (hidden_by_id IS NOT NULL);


CREATE INDEX dw2_postrevs_postid_prevnr__i ON public.post_revisions3 USING btree (site_id, post_id, previous_nr) WHERE (previous_nr IS NOT NULL);


CREATE INDEX dw2_posts_approvedbyid__i ON public.posts3 USING btree (site_id, approved_by_id) WHERE (approved_by_id IS NOT NULL);


CREATE INDEX dw2_posts_closedbyid__i ON public.posts3 USING btree (site_id, closed_by_id) WHERE (closed_by_id IS NOT NULL);


CREATE INDEX dw2_posts_collapsedbyid__i ON public.posts3 USING btree (site_id, collapsed_by_id) WHERE (collapsed_by_id IS NOT NULL);


CREATE INDEX dw2_posts_deletedbyid__i ON public.posts3 USING btree (site_id, deleted_by_id) WHERE (deleted_by_id IS NOT NULL);


CREATE INDEX dw2_posts_hiddenbyid__i ON public.posts3 USING btree (site_id, hidden_by_id) WHERE (hidden_by_id IS NOT NULL);


CREATE INDEX dw2_posts_lastapprovededitbyid__i ON public.posts3 USING btree (site_id, last_approved_edit_by_id) WHERE (last_approved_edit_by_id IS NOT NULL);


CREATE INDEX dw2_posts_lasteditedbyid__i ON public.posts3 USING btree (site_id, curr_rev_by_id) WHERE (curr_rev_by_id IS NOT NULL);


CREATE INDEX dw2_posts_numflags__i ON public.posts3 USING btree (site_id, num_pending_flags) WHERE ((deleted_status = 0) AND (num_pending_flags > 0));


CREATE INDEX dw2_posts_page_parentnr__i ON public.posts3 USING btree (site_id, page_id, parent_nr);


CREATE UNIQUE INDEX dw2_posts_page_postnr__u ON public.posts3 USING btree (site_id, page_id, post_nr);


CREATE INDEX dw2_posts_pendingedits__i ON public.posts3 USING btree (site_id, last_edit_suggestion_at) WHERE ((deleted_status = 0) AND (num_pending_flags = 0) AND (approved_rev_nr = curr_rev_nr) AND (num_edit_suggestions > 0));


CREATE INDEX dw2_posts_pinnedbyid__i ON public.posts3 USING btree (site_id, pinned_by_id) WHERE (pinned_by_id IS NOT NULL);


CREATE INDEX dw2_posts_unapproved__i ON public.posts3 USING btree (site_id, curr_rev_last_edited_at) WHERE ((deleted_status = 0) AND (num_pending_flags = 0) AND ((approved_rev_nr IS NULL) OR (approved_rev_nr < curr_rev_nr)));


CREATE INDEX dw2_uploadrefs_addedby__i ON public.upload_refs3 USING btree (site_id, added_by_id);


CREATE INDEX dw2_uploadrefs_baseurl__i ON public.upload_refs3 USING btree (base_url);


CREATE INDEX dw2_uploadrefs_hashpathsuffix__i ON public.upload_refs3 USING btree (hash_path);


CREATE INDEX dw2_uploads_hashpathsuffix__i ON public.uploads3 USING btree (hash_path);


CREATE INDEX dw2_uploads_unusedsince__i ON public.uploads3 USING btree (unused_since) WHERE (num_references = 0);


CREATE INDEX emailsout_gi_createdat ON public.emails_out3 USING btree (created_at);


CREATE INDEX emailsout_gi_secretstatus ON public.emails_out3 USING btree (secret_status_c) WHERE ((secret_status_c)::smallint = ANY (ARRAY[1, 2, 3]));


CREATE INDEX emailsout_gi_sentfrom ON public.emails_out3 USING btree (sent_from_c) WHERE (sent_from_c IS NOT NULL);


CREATE INDEX emailsout_i_aboutcat ON public.emails_out3 USING btree (site_id, about_cat_id_c) WHERE (about_cat_id_c IS NOT NULL);


CREATE INDEX emailsout_i_aboutpagestr ON public.emails_out3 USING btree (site_id, about_page_id_str_c) WHERE (about_page_id_str_c IS NOT NULL);


CREATE INDEX emailsout_i_aboutpat ON public.emails_out3 USING btree (site_id, about_pat_id_c) WHERE (about_pat_id_c IS NOT NULL);


CREATE INDEX emailsout_i_aboutpostid ON public.emails_out3 USING btree (site_id, about_post_id_c) WHERE (about_post_id_c IS NOT NULL);


CREATE INDEX emailsout_i_abouttag ON public.emails_out3 USING btree (site_id, about_tag_id_c) WHERE (about_tag_id_c IS NOT NULL);


CREATE INDEX emailsout_i_bypat ON public.emails_out3 USING btree (site_id, by_pat_id_c) WHERE (by_pat_id_c IS NOT NULL);


CREATE INDEX emailsout_i_createdat ON public.emails_out3 USING btree (site_id, created_at);


CREATE INDEX emailsout_i_secretstatus ON public.emails_out3 USING btree (site_id, secret_status_c) WHERE ((secret_status_c)::smallint = ANY (ARRAY[1, 2, 3]));


CREATE INDEX emailsout_i_sentfrom ON public.emails_out3 USING btree (site_id, sent_from_c) WHERE (sent_from_c IS NOT NULL);


CREATE INDEX emailsout_i_topat ON public.emails_out3 USING btree (site_id, to_user_id);


CREATE UNIQUE INDEX emailsout_u_secretvalue ON public.emails_out3 USING btree (site_id, secret_value_c) WHERE (secret_value_c IS NOT NULL);


CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


CREATE INDEX groupparticipants_ppid_i ON public.group_participants3 USING btree (site_id, participant_id);


CREATE UNIQUE INDEX hosts_u_canonical ON public.hosts3 USING btree (site_id) WHERE ((canonical)::text = 'C'::text);


CREATE UNIQUE INDEX hosts_u_g_hostname ON public.hosts3 USING btree (host) WHERE ((canonical)::text <> 'X'::text);


CREATE UNIQUE INDEX idps_u_displayname ON public.idps_t USING btree (site_id_c, display_name_c) WHERE enabled_c;


CREATE UNIQUE INDEX idps_u_protocol_alias ON public.idps_t USING btree (site_id_c, protocol_c, alias_c);


CREATE INDEX idtys_i_g_email ON public.identities3 USING btree (email_adr_c);


CREATE INDEX idtys_i_patid ON public.identities3 USING btree (site_id, user_id_c);


CREATE UNIQUE INDEX idtys_u_conffileidpid_idpusrid ON public.identities3 USING btree (site_id, conf_file_idp_id_c, idp_user_id_c) WHERE (conf_file_idp_id_c IS NOT NULL);


CREATE UNIQUE INDEX idtys_u_idpid_idpuserid ON public.identities3 USING btree (site_id, idp_id_c, idp_user_id_c) WHERE (idp_id_c IS NOT NULL);


CREATE UNIQUE INDEX idtys_u_idprealmid_idprealmuserid ON public.identities3 USING btree (site_id, idp_realm_id_c, idp_realm_user_id_c) WHERE (idp_realm_id_c IS NOT NULL);


CREATE INDEX invites_emailaddr_invby_i ON public.invites3 USING btree (site_id, email_address, created_by_id);


CREATE INDEX invites_i_addtogroupid ON public.invites3 USING btree (site_id, add_to_group_id) WHERE (add_to_group_id IS NOT NULL);


CREATE INDEX invites_invat_i ON public.invites3 USING btree (site_id, created_at DESC);


CREATE INDEX ixq_actionat__i ON public.job_queue_t USING btree (action_at DESC);


CREATE UNIQUE INDEX jobq_u_dowhat_cat ON public.job_queue_t USING btree (site_id, do_what_c, cat_id_c) WHERE (cat_id_c IS NOT NULL);


CREATE UNIQUE INDEX jobq_u_dowhat_page ON public.job_queue_t USING btree (site_id, do_what_c, page_id) WHERE (page_id IS NOT NULL);


CREATE UNIQUE INDEX jobq_u_dowhat_pat ON public.job_queue_t USING btree (site_id, do_what_c, pat_id_c) WHERE (pat_id_c IS NOT NULL);


CREATE UNIQUE INDEX jobq_u_dowhat_post ON public.job_queue_t USING btree (site_id, do_what_c, post_id) WHERE (post_id IS NOT NULL);


CREATE UNIQUE INDEX jobq_u_dowhat_site_timerange ON public.job_queue_t USING btree (site_id, do_what_c) WHERE ((time_range_to_c IS NOT NULL) AND (page_id IS NULL) AND (post_id IS NULL) AND (cat_id_c IS NULL) AND (pat_id_c IS NULL) AND (type_id_c IS NULL));


CREATE UNIQUE INDEX jobq_u_dowhat_timerange_for_now ON public.job_queue_t USING btree (site_id, do_what_c) WHERE (time_range_to_c IS NOT NULL);


CREATE UNIQUE INDEX jobq_u_dowhat_type ON public.job_queue_t USING btree (site_id, do_what_c, type_id_c) WHERE (type_id_c IS NOT NULL);


CREATE INDEX linkpreviews_i_fetch_err_at ON public.link_previews_t USING btree (site_id_c, fetched_at_c) WHERE (status_code_c <> 200);


CREATE INDEX linkpreviews_i_fetchedat ON public.link_previews_t USING btree (site_id_c, fetched_at_c);


CREATE INDEX linkpreviews_i_firstlinkedby ON public.link_previews_t USING btree (site_id_c, first_linked_by_id_c);


CREATE INDEX linkpreviews_i_g_fetch_err_at ON public.link_previews_t USING btree (fetched_at_c) WHERE (status_code_c <> 200);


CREATE INDEX linkpreviews_i_g_fetchedat ON public.link_previews_t USING btree (fetched_at_c);


CREATE INDEX linkpreviews_i_g_linkurl ON public.link_previews_t USING btree (link_url_c);


CREATE INDEX links_i_addedbyid ON public.links_t USING btree (site_id_c, added_by_id_c);


CREATE INDEX links_i_linkurl ON public.links_t USING btree (site_id_c, link_url_c);


CREATE INDEX links_i_tocategoryid ON public.links_t USING btree (site_id_c, to_category_id_c);


CREATE INDEX links_i_topageid ON public.links_t USING btree (site_id_c, to_page_id_c);


CREATE INDEX links_i_topostid ON public.links_t USING btree (site_id_c, to_post_id_c);


CREATE INDEX links_i_toppid ON public.links_t USING btree (site_id_c, to_pat_id_c);


CREATE INDEX links_i_totagid ON public.links_t USING btree (site_id_c, to_tag_id_c);


CREATE INDEX notfs_i_aboutcat_topat ON public.notifications3 USING btree (site_id, about_cat_id_c, to_user_id) WHERE (about_cat_id_c IS NOT NULL);


CREATE INDEX notfs_i_aboutpage_topat ON public.notifications3 USING btree (site_id, about_page_id_str_c, to_user_id) WHERE (about_page_id_str_c IS NOT NULL);


CREATE INDEX notfs_i_aboutpat_topat ON public.notifications3 USING btree (site_id, about_pat_id_c, to_user_id) WHERE (about_pat_id_c IS NOT NULL);


CREATE INDEX notfs_i_aboutpost_patreltype_frompat_subtype ON public.notifications3 USING btree (site_id, about_post_id_c, action_type, by_user_id, action_sub_id) WHERE (about_post_id_c IS NOT NULL);


CREATE INDEX notfs_i_aboutpostid ON public.notifications3 USING btree (site_id, about_post_id_c) WHERE (about_post_id_c IS NOT NULL);


CREATE INDEX notfs_i_abouttag_topat ON public.notifications3 USING btree (site_id, about_tag_id_c, to_user_id) WHERE (about_tag_id_c IS NOT NULL);


CREATE INDEX notfs_i_aboutthingtype_subtype ON public.notifications3 USING btree (site_id, about_thing_type_c, about_sub_type_c) WHERE (about_thing_type_c IS NOT NULL);


CREATE INDEX notfs_i_bypat ON public.notifications3 USING btree (site_id, by_user_id) WHERE (by_user_id IS NOT NULL);


CREATE INDEX notfs_i_bytrueid ON public.notifications3 USING btree (site_id, by_true_id_c) WHERE (by_true_id_c IS NOT NULL);


CREATE INDEX notfs_i_createdat_but_unseen_first ON public.notifications3 USING btree ((
CASE
    WHEN (seen_at IS NULL) THEN (created_at + '100 years'::interval)
    ELSE created_at
END) DESC);


CREATE INDEX notfs_i_createdat_if_undecided ON public.notifications3 USING btree (created_at) WHERE (email_status = 1);


CREATE INDEX notfs_i_emailid ON public.notifications3 USING btree (site_id, email_id);


CREATE INDEX notfs_i_totrueid_createdat ON public.notifications3 USING btree (site_id, to_true_id_c, created_at DESC) WHERE (to_true_id_c IS NOT NULL);


COMMENT ON INDEX public.notfs_i_totrueid_createdat IS '
For listing notifications to one''s aliases.
';


CREATE INDEX notfs_i_touserid_aboutpostid ON public.notifications3 USING btree (site_id, to_user_id, about_post_id_c);


CREATE INDEX notfs_i_touserid_createdat ON public.notifications3 USING btree (site_id, to_user_id, created_at DESC);


CREATE INDEX notices_ig_noticeid ON public.notices_t USING btree (notice_id_c);


CREATE INDEX pagehtmlcache_gi_updatedat ON public.page_html_cache_t USING btree (updated_at_c);


CREATE INDEX pagenotfprefs_people_i ON public.page_notf_prefs_t USING btree (site_id, pat_id_c);


CREATE UNIQUE INDEX pagenotfprefs_u_pagespatcreated_patid ON public.page_notf_prefs_t USING btree (site_id, pages_pat_created_c, pat_id_c);


CREATE UNIQUE INDEX pagenotfprefs_u_pagespatrepliedto_patid ON public.page_notf_prefs_t USING btree (site_id, pages_pat_replied_to_c, pat_id_c);


CREATE INDEX pagepopscores_i_algid_allscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, all_score);


CREATE INDEX pagepopscores_i_algid_dayscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, day_score);


CREATE INDEX pagepopscores_i_algid_monthscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, month_score);


CREATE INDEX pagepopscores_i_algid_quarterscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, quarter_score);


CREATE INDEX pagepopscores_i_algid_triennialscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, triennial_score_c);


CREATE INDEX pagepopscores_i_algid_weekscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, week_score);


CREATE INDEX pagepopscores_i_algid_yearscore ON public.page_popularity_scores3 USING btree (site_id, score_alg_c, year_score);


CREATE INDEX pages_i_answeredby ON public.pages3 USING btree (site_id, answered_by_id_c) WHERE (answered_by_id_c IS NOT NULL);


CREATE INDEX pages_i_cat_bumpedat_id ON public.pages3 USING btree (site_id, category_id, bumped_at DESC, page_id DESC);


CREATE INDEX pages_i_cat_createdat_id ON public.pages3 USING btree (site_id, category_id, created_at DESC, page_id DESC);


CREATE INDEX pages_i_cat_publishedat_id ON public.pages3 USING btree (site_id, category_id, published_at DESC, page_id DESC);


CREATE INDEX pages_i_closedby ON public.pages3 USING btree (site_id, closed_by_id_c) WHERE (closed_by_id_c IS NOT NULL);


CREATE INDEX pages_i_deletedby ON public.pages3 USING btree (site_id, deleted_by_id_c) WHERE (deleted_by_id_c IS NOT NULL);


CREATE INDEX pages_i_doneby ON public.pages3 USING btree (site_id, done_by_id_c) WHERE (done_by_id_c IS NOT NULL);


CREATE INDEX pages_i_frozenby ON public.pages3 USING btree (site_id, frozen_by_id_c) WHERE (frozen_by_id_c IS NOT NULL);


CREATE INDEX pages_i_hiddenby ON public.pages3 USING btree (site_id, hidden_by_id_c) WHERE (hidden_by_id_c IS NOT NULL);


CREATE INDEX pages_i_lockedby ON public.pages3 USING btree (site_id, locked_by_id_c) WHERE (locked_by_id_c IS NOT NULL);


CREATE INDEX pages_i_pausedby ON public.pages3 USING btree (site_id, paused_by_id_c) WHERE (paused_by_id_c IS NOT NULL);


CREATE INDEX pages_i_plannedby ON public.pages3 USING btree (site_id, planned_by_id_c) WHERE (planned_by_id_c IS NOT NULL);


CREATE INDEX pages_i_postponedby ON public.pages3 USING btree (site_id, postponed_by_id_c) WHERE (postponed_by_id_c IS NOT NULL);


CREATE INDEX pages_i_publishedby ON public.pages3 USING btree (site_id, published_by_id_c) WHERE (published_by_id_c IS NOT NULL);


CREATE INDEX pages_i_startedby ON public.pages3 USING btree (site_id, started_by_id_c) WHERE (started_by_id_c IS NOT NULL);


CREATE INDEX pages_i_unwantedby ON public.pages3 USING btree (site_id, unwanted_by_id_c) WHERE (unwanted_by_id_c IS NOT NULL);


CREATE UNIQUE INDEX pages_u_extid ON public.pages3 USING btree (site_id, ext_id);


CREATE INDEX pageusers_joinedby_i ON public.page_users3 USING btree (site_id, joined_by_id);


CREATE INDEX pageusers_kickedby_i ON public.page_users3 USING btree (site_id, kicked_by_id);


CREATE INDEX pageusers_user_i ON public.page_users3 USING btree (site_id, user_id);


CREATE INDEX participants_groupid_i ON public.users3 USING btree (site_id, user_id) WHERE is_group;


CREATE INDEX patnoderels_i_pageid_frompatid ON public.post_actions3 USING btree (site_id, page_id, from_pat_id_c);


CREATE INDEX patnoderels_i_pageid_fromtrueid ON public.post_actions3 USING btree (site_id, page_id, from_true_id_c) WHERE (from_true_id_c IS NOT NULL);


COMMENT ON INDEX public.patnoderels_i_pageid_fromtrueid IS '
For finding one''s Like votes etc done anonymously on the current page.
';


CREATE INDEX patnodesinrels_i_addedbyid ON public.post_actions3 USING btree (site_id, added_by_id_c) WHERE (added_by_id_c IS NOT NULL);


CREATE INDEX patnodesinrels_i_aspatid ON public.post_actions3 USING btree (site_id, from_true_id_c) WHERE (from_true_id_c IS NOT NULL);


CREATE INDEX patrels_i_frompat_reltype_addedat ON public.post_actions3 USING btree (site_id, from_pat_id_c, rel_type_c, created_at DESC);


CREATE INDEX patrels_i_frompat_reltype_addedat_0dormant ON public.post_actions3 USING btree (site_id, from_pat_id_c, rel_type_c, created_at DESC) WHERE (dormant_status_c IS NULL);


CREATE INDEX pats_i_anonintreeid ON public.users3 USING btree (site_id, anon_in_tree_id__later_c);


CREATE INDEX pats_i_anononpageid ON public.users3 USING btree (site_id, anon_on_page_id_st_c);


CREATE INDEX pats_i_trueid_anonintreeid ON public.users3 USING btree (site_id, true_id_c, anon_in_tree_id__later_c);


CREATE INDEX pats_i_trueid_anononpageid ON public.users3 USING btree (site_id, true_id_c, anon_on_page_id_st_c);


CREATE UNIQUE INDEX permsonpages_on_cat_u ON public.perms_on_pages3 USING btree (site_id, on_category_id, for_people_id) WHERE (on_category_id IS NOT NULL);


CREATE UNIQUE INDEX permsonpages_on_page_u ON public.perms_on_pages3 USING btree (site_id, on_page_id, for_people_id) WHERE (on_page_id IS NOT NULL);


CREATE UNIQUE INDEX permsonpages_on_post_u ON public.perms_on_pages3 USING btree (site_id, on_post_id, for_people_id) WHERE (on_post_id IS NOT NULL);


CREATE UNIQUE INDEX permsonpages_on_site_u ON public.perms_on_pages3 USING btree (site_id, for_people_id) WHERE (on_whole_site IS NOT NULL);


CREATE INDEX permsonpages_people_i ON public.perms_on_pages3 USING btree (site_id, for_people_id);


CREATE INDEX posts_i_createdat_id ON public.posts3 USING btree (site_id, created_at DESC, unique_post_id DESC);


CREATE INDEX posts_i_createdby_createdat_id ON public.posts3 USING btree (site_id, created_by_id, created_at DESC, unique_post_id DESC);


CREATE INDEX posts_i_lastapprovedat_0deld ON public.posts3 USING btree (site_id, GREATEST(approved_at, last_approved_edit_at)) WHERE ((approved_at IS NOT NULL) AND (deleted_status = 0));


CREATE INDEX posts_i_patid_createdat_postid_if_bookmark_0deld ON public.posts3 USING btree (site_id, created_by_id, created_at, unique_post_id) WHERE (((type)::smallint = 51) AND (deleted_status = 0));


CREATE INDEX posts_i_patid_createdat_postid_if_bookmark_deld ON public.posts3 USING btree (site_id, created_by_id, created_at, unique_post_id) WHERE (((type)::smallint = 51) AND (deleted_status <> 0));


CREATE INDEX posts_i_privatepatsid ON public.posts3 USING btree (site_id, private_pats_id_c) WHERE (private_pats_id_c IS NOT NULL);


CREATE UNIQUE INDEX posts_u_extid ON public.posts3 USING btree (site_id, ext_id);


CREATE UNIQUE INDEX posts_u_patid_pageid_parentnr_if_bookmark_0deld ON public.posts3 USING btree (site_id, created_by_id, page_id, parent_nr) WHERE (((type)::smallint = 51) AND (deleted_status = 0));


CREATE INDEX postsread_i_readbyid ON public.post_read_stats3 USING btree (site_id, user_id);


CREATE UNIQUE INDEX pps_u_extid ON public.users3 USING btree (site_id, ext_id);


CREATE UNIQUE INDEX pps_u_site_guest_w_browser_id ON public.users3 USING btree (site_id, full_name, guest_email_addr, guest_browser_id) WHERE (guest_browser_id IS NOT NULL);


CREATE UNIQUE INDEX pps_u_ssoid ON public.users3 USING btree (site_id, sso_id);


CREATE INDEX reviewtasks_completedbyid__i ON public.review_tasks3 USING btree (site_id, decided_by_id) WHERE (decided_by_id IS NOT NULL);


CREATE INDEX reviewtasks_createdat__i ON public.review_tasks3 USING btree (site_id, created_at DESC);


CREATE INDEX reviewtasks_createdbyid__i ON public.review_tasks3 USING btree (site_id, created_by_id);


CREATE INDEX reviewtasks_decided_do_soon_i ON public.review_tasks3 USING btree (decided_at) WHERE ((decided_at IS NOT NULL) AND (completed_at IS NULL) AND (invalidated_at IS NULL));


CREATE INDEX reviewtasks_open_createdat__i ON public.review_tasks3 USING btree (site_id, created_at DESC) WHERE (decision IS NULL);


CREATE UNIQUE INDEX reviewtasks_open_createdby_postid__u ON public.review_tasks3 USING btree (site_id, created_by_id, post_id) WHERE ((post_id IS NOT NULL) AND (decision IS NULL));


CREATE UNIQUE INDEX reviewtasks_open_createdby_userid__u ON public.review_tasks3 USING btree (site_id, created_by_id, about_pat_id_c) WHERE ((post_id IS NULL) AND (decision IS NULL));


CREATE INDEX reviewtasks_pageid__i ON public.review_tasks3 USING btree (site_id, page_id) WHERE (page_id IS NOT NULL);


CREATE INDEX reviewtasks_postid__i ON public.review_tasks3 USING btree (site_id, post_id) WHERE (post_id IS NOT NULL);


CREATE INDEX reviewtasks_undecided_i ON public.review_tasks3 USING btree (site_id, created_at DESC) WHERE ((decision IS NULL) AND (completed_at IS NULL) AND (invalidated_at IS NULL));


CREATE INDEX reviewtasks_userid__i ON public.review_tasks3 USING btree (site_id, about_pat_id_c) WHERE (about_pat_id_c IS NOT NULL);


CREATE INDEX scq_actionat__i ON public.spam_check_queue3 USING btree (created_at DESC);


CREATE INDEX secrets_user_i ON public.api_secrets3 USING btree (site_id, user_id);


CREATE INDEX sessions_i_patid_createdat_active ON public.sessions_t USING btree (site_id_c, pat_id_c, created_at_c DESC) WHERE ((deleted_at_c IS NULL) AND (expired_at_c IS NULL));


CREATE INDEX settings3_site__i ON public.settings3 USING btree (site_id);


CREATE UNIQUE INDEX settings3_site_category ON public.settings3 USING btree (site_id, category_id) WHERE (category_id IS NOT NULL);


CREATE UNIQUE INDEX settings3_site_page ON public.settings3 USING btree (site_id, page_id) WHERE (page_id IS NOT NULL);


CREATE UNIQUE INDEX settings3_siteid__u ON public.settings3 USING btree (site_id) WHERE ((page_id IS NULL) AND (category_id IS NULL));


CREATE UNIQUE INDEX sites_publid_u ON public.sites3 USING btree (publ_id);


CREATE INDEX spamcheckqueue_next_miscl_i ON public.spam_check_queue3 USING btree (results_at) WHERE (is_misclassified AND (misclassifications_reported_at IS NULL));


CREATE INDEX tags_i_onpatid ON public.tags_t USING btree (site_id_c, on_pat_id_c) WHERE (on_pat_id_c IS NOT NULL);


CREATE INDEX tags_i_onpostid ON public.tags_t USING btree (site_id_c, on_post_id_c) WHERE (on_post_id_c IS NOT NULL);


CREATE INDEX tags_i_parentid ON public.tags_t USING btree (site_id_c, parent_tag_id_c) WHERE (parent_tag_id_c IS NOT NULL);


CREATE INDEX tags_i_parentid_patid ON public.tags_t USING btree (site_id_c, parent_tag_id_c, on_pat_id_c) WHERE ((parent_tag_id_c IS NOT NULL) AND (on_pat_id_c IS NOT NULL));


CREATE INDEX tags_i_parentid_postid ON public.tags_t USING btree (site_id_c, parent_tag_id_c, on_post_id_c) WHERE ((parent_tag_id_c IS NOT NULL) AND (on_post_id_c IS NOT NULL));


CREATE INDEX tags_i_tagtypeid ON public.tags_t USING btree (site_id_c, tagtype_id_c);


CREATE INDEX tagtypes_i_createdby ON public.tagtypes_t USING btree (site_id_c, created_by_id_c);


CREATE INDEX tagtypes_i_deletedby ON public.tagtypes_t USING btree (site_id_c, deleted_by_id_c);


CREATE INDEX tagtypes_i_descrpage ON public.tagtypes_t USING btree (site_id_c, descr_page_id_c);


CREATE INDEX tagtypes_i_mergedby ON public.tagtypes_t USING btree (site_id_c, merged_by_id_c);


CREATE INDEX tagtypes_i_mergedinto ON public.tagtypes_t USING btree (site_id_c, merged_into_tagtype_id_c);


CREATE INDEX tagtypes_i_scopedto ON public.tagtypes_t USING btree (site_id_c, scoped_to_pat_id_c);


CREATE UNIQUE INDEX tagtypes_u_anypat_abbrname ON public.tagtypes_t USING btree (site_id_c, COALESCE(scoped_to_pat_id_c, 0), public.index_friendly((abbr_name_c)::text));


CREATE UNIQUE INDEX tagtypes_u_anypat_dispname ON public.tagtypes_t USING btree (site_id_c, COALESCE(scoped_to_pat_id_c, 0), public.index_friendly((disp_name_c)::text));


CREATE UNIQUE INDEX tagtypes_u_anypat_longname ON public.tagtypes_t USING btree (site_id_c, COALESCE(scoped_to_pat_id_c, 0), public.index_friendly((long_name_c)::text));


CREATE UNIQUE INDEX tagtypes_u_anypat_urlslug ON public.tagtypes_t USING btree (site_id_c, COALESCE(scoped_to_pat_id_c, 0), url_slug_c);


CREATE UNIQUE INDEX types_u_refid ON public.tagtypes_t USING btree (site_id_c, ref_id_c) WHERE (ref_id_c IS NOT NULL);


CREATE UNIQUE INDEX useremails_email_verified_u ON public.user_emails3 USING btree (site_id, email_address) WHERE (verified_at IS NOT NULL);


CREATE UNIQUE INDEX users_site_primaryemail_u ON public.users3 USING btree (site_id, primary_email_addr);


CREATE INDEX userstats_lastseen_i ON public.user_stats3 USING btree (site_id, last_seen_at DESC);


CREATE INDEX userstats_nextsummary_i ON public.user_stats3 USING btree (next_summary_maybe_at);


CREATE INDEX webhookreqsout_i_sentasid ON public.webhook_reqs_out_t USING btree (site_id_c, sent_as_id_c);


CREATE INDEX webhookreqsout_i_sentat ON public.webhook_reqs_out_t USING btree (site_id_c, sent_at_c);


CREATE INDEX webhooks_i_ownerid ON public.webhooks_t USING btree (site_id_c, owner_id_c);


CREATE INDEX webhooks_i_runasid ON public.webhooks_t USING btree (site_id_c, run_as_id_c);


CREATE INDEX webhooks_ig_sendtourl ON public.webhooks_t USING btree (send_to_url_c);


CREATE INDEX webhooks_ig_sentuptowhen ON public.webhooks_t USING btree (sent_up_to_when_c);


CREATE INDEX webhooks_ig_sentuptowhen_more ON public.webhooks_t USING btree (sent_up_to_when_c) WHERE (enabled_c AND (deleted_c IS NOT TRUE) AND (done_for_now_c IS NOT TRUE) AND ((broken_reason_c IS NULL) OR ((retry_extra_times_c)::smallint >= 1)));


CREATE TRIGGER emails3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.emails_out3 FOR EACH ROW EXECUTE PROCEDURE public.emails3_sum_quota();


CREATE TRIGGER identities3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.identities3 FOR EACH ROW EXECUTE PROCEDURE public.identities3_sum_quota();


CREATE TRIGGER notfs3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.notifications3 FOR EACH ROW EXECUTE PROCEDURE public.notfs3_sum_quota();


CREATE TRIGGER page_users3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.page_users3 FOR EACH ROW EXECUTE PROCEDURE public.page_users3_sum_quota();


CREATE TRIGGER pages3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.pages3 FOR EACH ROW EXECUTE PROCEDURE public.pages3_sum_quota();


CREATE TRIGGER post_actions3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.post_actions3 FOR EACH ROW EXECUTE PROCEDURE public.post_actions3_sum_quota();


CREATE TRIGGER post_read_stats3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.post_read_stats3 FOR EACH ROW EXECUTE PROCEDURE public.post_read_stats3_sum_quota();


CREATE TRIGGER post_revs3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.post_revisions3 FOR EACH ROW EXECUTE PROCEDURE public.post_revs3_sum_quota();


CREATE TRIGGER posts3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.posts3 FOR EACH ROW EXECUTE PROCEDURE public.posts3_sum_quota();


CREATE TRIGGER users3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON public.users3 FOR EACH ROW EXECUTE PROCEDURE public.users3_sum_quota();


ALTER TABLE ONLY public.alt_page_ids3
    ADD CONSTRAINT altpageids_r_pages FOREIGN KEY (site_id, real_page_id) REFERENCES public.pages3(site_id, page_id);


ALTER TABLE ONLY public.api_secrets3
    ADD CONSTRAINT apisecrets_user_r_users FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_doer_r_people FOREIGN KEY (site_id, doer_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_doertrueid_r_pats FOREIGN KEY (site_id, doer_true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_sid_part1_r_sessions FOREIGN KEY (site_id, sess_id_part_1) REFERENCES public.sessions_t(site_id_c, part_1_comp_id_c) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_targetpattrueid_r_pats FOREIGN KEY (site_id, target_pat_true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.audit_log3
    ADD CONSTRAINT auditlog_targetuser_r_people FOREIGN KEY (site_id, target_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.blocks3
    ADD CONSTRAINT blocks_blockedby_r_people FOREIGN KEY (site_id, blocked_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.categories3
    ADD CONSTRAINT cats_defaultcat_r_cats FOREIGN KEY (site_id, default_category_id) REFERENCES public.categories3(site_id, id) ON UPDATE CASCADE ON DELETE CASCADE DEFERRABLE;


ALTER TABLE ONLY public.categories3
    ADD CONSTRAINT cats_page_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.categories3
    ADD CONSTRAINT cats_r_cats FOREIGN KEY (site_id, parent_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_byuser_r_users FOREIGN KEY (site_id, by_user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_category_r_cats FOREIGN KEY (site_id, category_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_pageid_postnr_r_posts FOREIGN KEY (site_id, page_id, post_nr) REFERENCES public.posts3(site_id, page_id, post_nr) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_pageid_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_postasid_r_pats FOREIGN KEY (site_id, post_as_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_postid_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.drafts3
    ADD CONSTRAINT drafts_touser_r_users FOREIGN KEY (site_id, to_user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_aboutcat_r_cats FOREIGN KEY (site_id, about_cat_id_c) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_aboutpagestr_r_pages FOREIGN KEY (site_id, about_page_id_str_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_aboutpat_r_pats FOREIGN KEY (site_id, about_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_aboutpostid_r_posts FOREIGN KEY (site_id, about_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_abouttag_r_tags FOREIGN KEY (site_id, about_tag_id_c) REFERENCES public.tags_t(site_id_c, id_c) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_bypat_r_pats FOREIGN KEY (site_id, by_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.emails_out3
    ADD CONSTRAINT emailsout_topat_r_pats FOREIGN KEY (site_id, to_user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.group_participants3
    ADD CONSTRAINT groupparticipants_group_r_pps FOREIGN KEY (site_id, group_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.group_participants3
    ADD CONSTRAINT groupparticipants_pp_r_pps FOREIGN KEY (site_id, participant_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.hosts3
    ADD CONSTRAINT hosts_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.idps_t
    ADD CONSTRAINT idps_r_sites FOREIGN KEY (site_id_c) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.identities3
    ADD CONSTRAINT ids_user_users FOREIGN KEY (site_id, user_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.identities3
    ADD CONSTRAINT ids_useridorig_r_people FOREIGN KEY (site_id, user_id_orig_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.identities3
    ADD CONSTRAINT idtys_r_idps FOREIGN KEY (site_id, idp_id_c) REFERENCES public.idps_t(site_id_c, idp_id_c) DEFERRABLE;


ALTER TABLE ONLY public.invites3
    ADD CONSTRAINT invites_addtogroup_r_pps FOREIGN KEY (site_id, add_to_group_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.invites3
    ADD CONSTRAINT invites_inviter_r_people FOREIGN KEY (site_id, created_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.invites3
    ADD CONSTRAINT invites_user_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.link_previews_t
    ADD CONSTRAINT linkpreviews_firstlinkedby_r_pps FOREIGN KEY (site_id_c, first_linked_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_addedby_r_pps FOREIGN KEY (site_id_c, added_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_frompostid_r_posts FOREIGN KEY (site_id_c, from_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_tocatid_r_categories FOREIGN KEY (site_id_c, to_category_id_c) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_topageid_r_pages FOREIGN KEY (site_id_c, to_page_id_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_topostid_r_posts FOREIGN KEY (site_id_c, to_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.links_t
    ADD CONSTRAINT links_toppid_r_pps FOREIGN KEY (site_id_c, to_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_aboutcat_r_cats FOREIGN KEY (site_id, about_cat_id_c) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_aboutpage_r_pages FOREIGN KEY (site_id, about_page_id_str_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_aboutpat_r_pats FOREIGN KEY (site_id, about_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_aboutpost_reltype_frompat_subtype_r_patrels FOREIGN KEY (site_id, about_post_id_c, action_type, by_user_id, action_sub_id) REFERENCES public.post_actions3(site_id, to_post_id_c, rel_type_c, from_pat_id_c, sub_type_c) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_abouttag_r_tags FOREIGN KEY (site_id, about_tag_id_c) REFERENCES public.tags_t(site_id_c, id_c) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_bypat_r_pats FOREIGN KEY (site_id, by_user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_bytrueid_r_pats FOREIGN KEY (site_id, by_true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT notfs_totrueid_r_pats FOREIGN KEY (site_id, to_true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notices_t
    ADD CONSTRAINT notices_r_pats FOREIGN KEY (site_id_c, to_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT ntfs_post_r_posts FOREIGN KEY (site_id, about_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT ntfs_r_emails FOREIGN KEY (site_id, email_id) REFERENCES public.emails_out3(site_id, email_id_c) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT ntfs_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.notifications3
    ADD CONSTRAINT ntfs_touser_r_people FOREIGN KEY (site_id, to_user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.page_html_cache_t
    ADD CONSTRAINT pagehtml_r_pages FOREIGN KEY (site_id_c, page_id_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_r_cats FOREIGN KEY (site_id, pages_in_cat_id_c) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.page_notf_prefs_t
    ADD CONSTRAINT pagenotfprefs_r_people FOREIGN KEY (site_id, pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.page_popularity_scores3
    ADD CONSTRAINT pagepopscores_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_answeredby_r_pats FOREIGN KEY (site_id, answered_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_category_r_categories FOREIGN KEY (site_id, category_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_closedby_r_pats FOREIGN KEY (site_id, closed_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_createdby_r_people FOREIGN KEY (site_id, author_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_deletedby_r_pats FOREIGN KEY (site_id, deleted_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_doneby_r_pats FOREIGN KEY (site_id, done_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_frequentposter1_r_people FOREIGN KEY (site_id, frequent_poster_1_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_frequentposter2_r_people FOREIGN KEY (site_id, frequent_poster_2_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_frequentposter3_r_people FOREIGN KEY (site_id, frequent_poster_3_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_frequentposter4_r_people FOREIGN KEY (site_id, frequent_poster_4_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_frozenby_r_pats FOREIGN KEY (site_id, frozen_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_hiddenby_r_pats FOREIGN KEY (site_id, hidden_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_lastreplyby_r_people FOREIGN KEY (site_id, last_reply_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_lockedby_r_pats FOREIGN KEY (site_id, locked_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_pausedby_r_pats FOREIGN KEY (site_id, paused_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_plannedby_r_pats FOREIGN KEY (site_id, planned_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_postponedby_r_pats FOREIGN KEY (site_id, postponed_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_publishedby_r_pats FOREIGN KEY (site_id, published_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_startedby_r_pats FOREIGN KEY (site_id, started_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.pages3
    ADD CONSTRAINT pages_unwantedby_r_pats FOREIGN KEY (site_id, unwanted_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.page_users3
    ADD CONSTRAINT pageusers_joinedby_r_people FOREIGN KEY (site_id, joined_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.page_users3
    ADD CONSTRAINT pageusers_kickedby_r_people FOREIGN KEY (site_id, kicked_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.page_users3
    ADD CONSTRAINT pageusers_page_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.page_users3
    ADD CONSTRAINT pageusers_user_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT patnoderels_fromtrueid_r_pats FOREIGN KEY (site_id, from_true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT patnodesinrels_addedbyid_r_pats FOREIGN KEY (site_id, added_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT pats_anonintree_r_nodes FOREIGN KEY (site_id, anon_in_tree_id__later_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT pats_anononpage_r_pages FOREIGN KEY (site_id, anon_on_page_id_st_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT pats_trueid_r_pats FOREIGN KEY (site_id, true_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.perms_on_pages3
    ADD CONSTRAINT permsonpages_r_cats FOREIGN KEY (site_id, on_category_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.perms_on_pages3
    ADD CONSTRAINT permsonpages_r_pages FOREIGN KEY (site_id, on_page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.perms_on_pages3
    ADD CONSTRAINT permsonpages_r_people FOREIGN KEY (site_id, for_people_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.perms_on_pages3
    ADD CONSTRAINT permsonpages_r_posts FOREIGN KEY (site_id, on_post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.page_paths3
    ADD CONSTRAINT pgpths_page_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT postacs_createdby_r_people FOREIGN KEY (site_id, from_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT postacs_deletedby_r_people FOREIGN KEY (site_id, deleted_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_actions3
    ADD CONSTRAINT postacs_r_posts FOREIGN KEY (site_id, to_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT postrevs_approvedby_r_people FOREIGN KEY (site_id, approved_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT postrevs_composedby_r_people FOREIGN KEY (site_id, composed_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT postrevs_hiddenby_r_people FOREIGN KEY (site_id, hidden_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT postrevs_post_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.post_revisions3
    ADD CONSTRAINT postrevs_prevnr_r__postrevs FOREIGN KEY (site_id, post_id, previous_nr) REFERENCES public.post_revisions3(site_id, post_id, revision_nr) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_approvedby_r_people FOREIGN KEY (site_id, approved_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_closedby_r_people FOREIGN KEY (site_id, closed_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_collapsedby_r_people FOREIGN KEY (site_id, collapsed_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_createdby_r_people FOREIGN KEY (site_id, created_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_deletedby_r_people FOREIGN KEY (site_id, deleted_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_hiddenby_r_people FOREIGN KEY (site_id, hidden_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_lastapprovededitby_r_people FOREIGN KEY (site_id, last_approved_edit_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_lasteditedby_r_people FOREIGN KEY (site_id, curr_rev_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_pinnedby_r_people FOREIGN KEY (site_id, pinned_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_privatepatsid_r_pats FOREIGN KEY (site_id, private_pats_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.posts3
    ADD CONSTRAINT posts_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.post_tags3
    ADD CONSTRAINT posttags_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.post_read_stats3
    ADD CONSTRAINT pstsrd_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.post_read_stats3
    ADD CONSTRAINT pstsrd_r_posts FOREIGN KEY (site_id, page_id, post_nr) REFERENCES public.posts3(site_id, page_id, post_nr) DEFERRABLE;


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks_causedby_r_people FOREIGN KEY (site_id, created_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks_complby_r_people FOREIGN KEY (site_id, decided_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.review_tasks3
    ADD CONSTRAINT reviewtasks_user_r_people FOREIGN KEY (site_id, about_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.sessions_t
    ADD CONSTRAINT sessions_r_pats FOREIGN KEY (site_id_c, pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.settings3
    ADD CONSTRAINT settings_cat_r_cats FOREIGN KEY (site_id, category_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.settings3
    ADD CONSTRAINT settings_embcmtscatid_r_categories FOREIGN KEY (site_id, embedded_comments_category_id) REFERENCES public.categories3(site_id, id) DEFERRABLE;


ALTER TABLE ONLY public.settings3
    ADD CONSTRAINT settings_page_r_pages FOREIGN KEY (site_id, page_id) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.settings3
    ADD CONSTRAINT settings_site_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.spam_check_queue3
    ADD CONSTRAINT spamcheckqueue_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.tag_notf_levels3
    ADD CONSTRAINT tagnotflvl_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_onpat_r_pats FOREIGN KEY (site_id_c, on_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_onpost_r_posts FOREIGN KEY (site_id_c, on_post_id_c) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_parenttagid_onpatid_r_tags_id_onpatid FOREIGN KEY (site_id_c, parent_tag_id_c, on_pat_id_c) REFERENCES public.tags_t(site_id_c, id_c, on_pat_id_c) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_parenttagid_onpostid_r_tags_id_onpostid FOREIGN KEY (site_id_c, parent_tag_id_c, on_post_id_c) REFERENCES public.tags_t(site_id_c, id_c, on_post_id_c) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_parenttagid_r_tags_id FOREIGN KEY (site_id_c, parent_tag_id_c) REFERENCES public.tags_t(site_id_c, id_c) DEFERRABLE;


ALTER TABLE ONLY public.tags_t
    ADD CONSTRAINT tags_r_tagtypes FOREIGN KEY (site_id_c, tagtype_id_c) REFERENCES public.tagtypes_t(site_id_c, id_c) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_createdby_r_pats FOREIGN KEY (site_id_c, created_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_deleteby_r_pats FOREIGN KEY (site_id_c, deleted_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_descrpage_r_pages FOREIGN KEY (site_id_c, descr_page_id_c) REFERENCES public.pages3(site_id, page_id) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_mergedby_r_pats FOREIGN KEY (site_id_c, merged_by_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_mergedinto_r_tagtypes FOREIGN KEY (site_id_c, merged_into_tagtype_id_c) REFERENCES public.tagtypes_t(site_id_c, id_c) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_r_sites FOREIGN KEY (site_id_c) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.tagtypes_t
    ADD CONSTRAINT tagtypes_scopedtopat_r_pats FOREIGN KEY (site_id_c, scoped_to_pat_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.upload_refs3
    ADD CONSTRAINT uploadrefs_r_people FOREIGN KEY (site_id, added_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.upload_refs3
    ADD CONSTRAINT uploadrefs_r_posts FOREIGN KEY (site_id, post_id) REFERENCES public.posts3(site_id, unique_post_id) DEFERRABLE;


ALTER TABLE ONLY public.user_emails3
    ADD CONSTRAINT useremails_r_users FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.usernames3
    ADD CONSTRAINT usernames_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT users_approvedby_r_people FOREIGN KEY (site_id, approved_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT users_primaryemail_r_useremails FOREIGN KEY (site_id, user_id, primary_email_addr) REFERENCES public.user_emails3(site_id, user_id, email_address) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT users_r_sites FOREIGN KEY (site_id) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.users3
    ADD CONSTRAINT users_suspendeby_r_people FOREIGN KEY (site_id, suspended_by_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.user_stats3
    ADD CONSTRAINT userstats_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.user_visit_stats3
    ADD CONSTRAINT uservisitstats_r_people FOREIGN KEY (site_id, user_id) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.webhook_reqs_out_t
    ADD CONSTRAINT webhookreqsout_sentasid_r_pats FOREIGN KEY (site_id_c, sent_as_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.webhook_reqs_out_t
    ADD CONSTRAINT webhookreqsout_webhookid_r_webhooks FOREIGN KEY (site_id_c, webhook_id_c) REFERENCES public.webhooks_t(site_id_c, webhook_id_c) DEFERRABLE;


ALTER TABLE ONLY public.webhooks_t
    ADD CONSTRAINT webhooks_ownerid_r_pats FOREIGN KEY (site_id_c, owner_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


ALTER TABLE ONLY public.webhooks_t
    ADD CONSTRAINT webhooks_r_sites FOREIGN KEY (site_id_c) REFERENCES public.sites3(id) DEFERRABLE;


ALTER TABLE ONLY public.webhooks_t
    ADD CONSTRAINT webhooks_runasid_r_pats FOREIGN KEY (site_id_c, run_as_id_c) REFERENCES public.users3(site_id, user_id) DEFERRABLE;


--
-- PostgreSQL database dump complete
--

