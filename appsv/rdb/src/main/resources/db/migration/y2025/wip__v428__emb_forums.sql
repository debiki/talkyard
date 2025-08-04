-- drop domain http_url_or_empty_ste_250_d;
-- drop domain http_url_or_empty_d;
-- 
-- alter table page_html_cache_t
--     drop column  param_emb_path_param_c,
--     drop column  param_embg_url_or_empty_c,
--     drop column  cached_priv_settings_json_c;


--=============================================================================
--  New domains
--=============================================================================


-- Dupl url regex, oh well.
create domain http_url_or_empty_d text;
alter domain http_url_or_empty_d add constraint http_url_d_c_regex check (
    value ~ 'https?:\/\/[a-z0-9_.-]+(/.*)?' or value = '');
alter domain http_url_or_empty_d add constraint http_url_d_c_no_blanks check (value !~ '\s');
alter domain http_url_or_empty_d add constraint http_url_d_c_maxlen check (length(value) <= 2100);

create domain http_url_or_empty_ste_250_d http_url_or_empty_d;
 alter domain http_url_or_empty_ste_250_d add
   constraint http_url_or_empty_ste_250_d_c_ste250 check (length(value) <= 250);



create domain text_oneline_or_empty_d text;
alter domain text_oneline_or_empty_d add constraint text_oneline_or_empty_d_c_print_chars check (
    value ~ '^[[:print:]]*$');

create domain text_oneline_or_empty_120_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_120_d add constraint text_oneline_120_or_empty_d_c_ste120 check (
    length(value) <= 120);

create domain text_oneline_or_empty_60_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_60_d add constraint text_oneline_60_or_empty_d_c_ste60 check (
    length(value) <= 60);

create domain text_oneline_or_empty_30_d text_oneline_or_empty_d;
alter domain text_oneline_or_empty_30_d add constraint text_oneline_or_empty_30_d_c_ste30 check (
    length(value) <= 30);

create domain text_oneline_or_empty_15_d text_oneline_d;
alter domain text_oneline_or_empty_15_d add constraint text_oneline_or_empty_15_d_c_ste15 check (
    length(value) <= 15);
comment on domain text_oneline_or_empty_15_d is
    'Like text_oneline_d, but at most 15 chars long.';


--=============================================================================
--  Embeddd forum cache params
--=============================================================================


alter table page_html_cache_t
    -- rename column param_origin_or_empty_c to param_embd_origin_or_empty_c
    add column  param_emb_path_param_c          text_oneline_or_empty_60_d   default '',
    -- [cache_embg_url]
    -- Not needed? [maybe_need_only_embUrlParam] To deep link, it's enough to just:
    --    '#/-123/some-page'
    add column  param_embg_url_or_empty_c   http_url_or_empty_ste_250_d  default '',
    -- These:
    -- cached_site_version_c cached_page_version_c cached_app_version_c
    -- and  follow-links,  and what more, later?
    -- could instead be in a single json array or obj. Storing each one in
    -- its own column is inflexible — requires a data migration, to change
    -- anything, but are never used for looking things up, so, don't really
    -- need to be in their own columns.
    -- Follow-links isn't visible client-site — can be semi private, known to
    -- admins only (so hackers can't see to which sites links are followed) — so
    -- shouldn't be included in the  cached_store_json_c,
    -- instead, incl in  cached_priv_settings_json_c.
    add column  cached_priv_settings_json_c   jsonb_ste8000_d;


-- Append  param_embg_url_or_empty_c  and  param_emb_path_param_c  to the lookup params.
alter table page_html_cache_t drop constraint pagehtmlcache_p;

alter table page_html_cache_t add constraint pagehtmlcache_p primary key (
    site_id_c,
    page_id_c,
    param_comt_order_c,
    param_comt_nesting_c,
    param_width_layout_c,
    param_theme_id_c_u,
    param_is_embedded_c,
    param_origin_or_empty_c,
    param_cdn_origin_or_empty_c,
    param_ugc_origin_or_empty_c,
    param_emb_path_param_c,
    param_embg_url_or_empty_c);


--=============================================================================
--  Upload refs
--=============================================================================

-- From drafts and users (their avatars).

-- alter table upload_refs3 rename column post_id to from_post_id_c;

alter table upload_refs3
    -- There'll be unique indexes instead.
    drop constraint dw2_uploadrefs__p,

    alter column post_id drop not null;

    add column from_pat_id_c   i32_d,
    add column from_draft_nr_c i32_lt2e9_gt1000_d,

    add constraint uploadrefs_c_from_draft_or_post_or_avatar check (
        num_nonnulls(post_id, from_draft_nr_c, from_pat_id_c) = 1), -- from_post_id_c

    -- fk ix: uploadrefs_u_draftnr_ref
    add constraint uploadrefs_frompat_draftnr_r_drafts
        foreign key (site_id, from_pat_id_c, from_draft_nr_c)
        references drafts3(site_id, by_user_id, draft_nr) deferrable,

    -- fk ix: uploadrefs_u_patid_ref
    add constraint uploadrefs_frompat_r_pats
        foreign key (site_id, from_pat_id_c)
        references users3(site_id, user_id) deferrable;

create unique index uploadrefs_u_postid_ref on upload_refs3 (
        site_id, post_id, base_url, hash_path)
    where post_id is not null;  -- from_post_id_c

create unique index uploadrefs_u_draftnr_ref on upload_refs3 (
        site_id, from_pat_id_c, from_draft_nr_c, base_url, hash_path)
    where from_draft_nr_c is not null;

create unique index uploadrefs_u_patid_ref on upload_refs3 (
        site_id, from_pat_id_c, base_url, hash_path)
    where from_pat_id_c is not null and from_draft_nr_c is null;


create table uploads_state_t (
  site_id_c             int                 not null, -- pk
  base_url_c            text_oneline_30_d   not null, -- pk
  hash_path_c           text_oneline_120_d  not null, -- pk
  num_refs_c            i32_gez_d           not null,
  unused_since_c        timestamptz,

  deleted_status_c      i32_d,
  deleted_reasons_c     i64_d, -- bitfield? Can be > 1 reasons
  deleted_by_id_c       i32_d,
  cdn_status_c          i32_d,

  constraint uploadsstatus_p primary key (site_id_c, base_url_c, hash_path_c),

  -- fk ix: uploadsstatus_gi_hashpath
  constraint uploadsstatus_r_uploads
    foreign key (base_url_c, hash_path_c)
    references uploads3 (base_url, hash_path) deferrable,

  -- fk ix: uploadsstatus_i_deletedby
  constraint uploadsstatus_deletedby_r_pats
    foreign key (site_id_c, deleted_by_id_c)
    references users3 (site_id, user_id) deferrable
);

create index uploadsstatus_gi_hashpath on uploads_state_t (base_url_c, hash_path_c);
create index uploadsstatus_i_deletedby on uploads_state_t (site_id_c, deleted_by_id_c);

-- Don't know which indexes we'll need. Let's create these, should cover everything.
-- And then drop the index(es) that weren't needed. Performance & disk wise, doesn't matter.
create index uploadsstatus_i_deleted_cdn_status on uploads_state_t (site_id_c, deleted_status_c, cdn_status_c);
create index uploadsstatus_i_cdn_deleted_status on uploads_state_t (site_id_c, cdn_status_c, deleted_status_c);


-- Virus scan & content flags. 53 bits bitflag so ok w js.
-- Hmm, upper 11 bits can be a bitflag version number, so future compat.
-- ChatGPT:  https://platform.openai.com/docs/guides/moderation?lang=node.js
--       "categories": {
--         "sexual": false,
--         "sexual/minors": false,
--         "harassment": false,
--         "harassment/threatening": false,
--         "hate": false,
--         "hate/threatening": false,
--         "illicit": false,
--         "illicit/violent": false,
--         "self-harm": false,
--         "self-harm/intent": false,
--         "self-harm/instructions": false,
--         "violence": true,
--         "violence/graphic": false
--       },
-- Gemini:  https://ai.google.dev/gemini-api/docs/safety-settings#safety-filters
--         Category 	Description
--         Harassment 	Negative or harmful comments targeting identity and/or protected attributes.
--         Hate speech 	Content that is rude, disrespectful, or profane.
--         Sexually explicit 	Contains references to sexual acts or other lewd content.
--         Dangerous 	Promotes, facilitates, or encourages harmful acts.
--         Civic integrity 	Election-related queries.

-- + Spam, fraud, scam (phishing = incl in scam).
-- + Misinformation for e.g. anti-vax stuff.


alter table uploads3 add column file_scan_results_c i64_d; -- bitfield?

-- ChatGPT suggests:
-- 
-- 
-- ## Deletion-related
-- deletion_reason: Enum/text (e.g. illegal, duplicate, too_large, unused, manual)
-- 
-- deleted_by_user_id: Admin or automated process?
-- 
-- deleted_at: When it was deleted
-- 
-- deleted_comment: Optional notes (e.g. abuse report ID)
-- 
-- unused_since: Last known use date (if you're tracking references)
-- 
-- verified_present_at: Last time the file was confirmed to exist
-- 
-- verified_absent_at: When you noticed it was missing
-- 
-- deletion_status: Enum (active, pending_deletion, deleted)
-- 
-- ## Optional extras
-- virus_scan_status: Enum (e.g. clean, infected, skipped)
-- 
-- content_flags: JSONB for future-proof tagging (e.g. "nudity": true)
-- 
-- retention_policy: e.g. keep for 30 days after last use





-- For videos and music.
alter table uploads3 add column duration_secs_c i32_gez_d;

-- create table uploads_t (
--   site_id_c             int                 not null, -- pk
--   base_url_c            text_oneline_30_d   not null, -- pk
--   hash_path_c           text_oneline_120_d  not null, -- pk
--   original_hash_path_c  text_oneline_120_d  not null,
--   size_bytes            i32_gez_d           not null,
--   mime_type             text_oneline_120_d  not null,
--   width                 i32_gez_d,
--   height                i32_gez_d,
--   uploaded_at           timestamp not null,
--   updated_at            timestamp not null,
--   num_references        i32_gez_d not null,
--   verified_present_at   timestamp,
--   verified_absent_at    timestamp,
--   unused_since          timestamp,
--   deleted_status_c      timestamp,
--   deleted_by_id_c       timestamp,
-- 
--   constraint uploads_p primary key (base_url, hash_path),
-- 
--   constraint uploads_c_0refs_unusedsince check ((num_references = 0) = (unused_since is not null)),
--   constraint uploads_c_dates check (
--     verified_present_at > uploaded_at and verified_absent_at > uploaded_at
--   ),
--   constraint uploads_c_numbers check (
--     num_references >= 0 and size_bytes > 0 and width > 0 and height > 0
--   ),
--   constraint uploads_c_baseurl check (base_url::text like '%/'),
--   constraint uploads_c_baseurl_len check (
--     length(base_url::text) >= 1 and length(base_url::text) <= 100
--   ),
--   constraint uploads_c_hashpath check (is_valid_hash_path(hash_path)),
--   constraint uploads_c_hashpath_len check (
--     length(hash_path::text) >= 1 and length(hash_path::text) <= 100
--   ),
--   constraint uploads_c_mimetype_len check (
--     length(mime_type::text) >= 1 and length(mime_type::text) <= 100
--   ),
--   constraint uploads_c_orighashpath_len check (
--     length(original_hash_path::text) >= 1 and length(original_hash_path::text) <= 100
--   ),
--   constraint uploads_c_originalhashpath check (is_valid_hash_path(original_hash_path))
-- );
-- 
-- create index uploads_i_hashpath on uploads_t (hash_path);
-- 
-- create index uploads_i_unusedsince on uploads_t (unused_since)
--   where num_references = 0;

