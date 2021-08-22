# This script creates empty Debiki database tables, for the database
# structure that was in use as of 2013-05-22.
#
# It was generated like so:
#   pg_dump --host 127.0.0.1 -p 55432 --username=debiki_prod --schema-only --no-tablespaces --use-set-session-authorization > debiki-dao-pgsql/evolutions/1.sql
# where port 55432 is a SSH tunnel to dw0azirdbpv11danny (i.e. my production
# server, located in the Amazon EC2 datacenter on Ireland).
#
# Then manually processed like so:
#
#   Duplicate ';' (to ';;') inside procedures, since Play splits on single ';'.
#
#   Remove some  SET ...  commands, and
#   also some "REVOKE ..." and "GRANT ..." commands.
#
#   And then, in Vim, remove comment lines and empty lines:
#     '<,'>s/^--.*$//g
#     %s/\n\n\n\n\n\n\n/\r\r\r/g
#
#   And also add "Ups".


# --- !Ups


CREATE FUNCTION hex_to_int(hexval character varying) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    result  int;;
BEGIN
    EXECUTE 'SELECT x''' || hexval || '''::int' INTO result;;
    RETURN result;;
END;;
$$;


CREATE FUNCTION inc_next_per_page_reply_id(site_id character varying, page_id character varying, step integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
declare
  next_id int;;
begin
  update DW1_PAGES
    set NEXT_REPLY_ID = NEXT_REPLY_ID + step
    where TENANT = site_id and GUID = page_id
    returning NEXT_REPLY_ID into next_id;;
  return next_id;;
end;;
$$;


CREATE FUNCTION string_id_to_int(string_id character varying) RETURNS character varying
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$
DECLARE
    result  int;;
BEGIN
    SELECT 
      case
        when string_id ~ '^[0-9]+$' then string_id
        else case string_id
          when '0t' then '65501'
          when '0b' then '65502'
          when '0c' then '65503'
          -- I used `7` in test & dev though, but shorter ids = better, I hope 5 will do:
          else '' || substring('' || hex_to_int(substring(md5(string_id) from 1 for 7)) from 1 for 6)
        end
      end
      INTO result;;
    RETURN result;;
END;;
$_$;


CREATE TABLE dw0_version (
    version character varying(100) NOT NULL
);


CREATE TABLE dw1_emails_out (
    tenant character varying(32) NOT NULL,
    id character varying(32) NOT NULL,
    sent_to character varying(100) NOT NULL,
    sent_on timestamp without time zone,
    subject character varying(200) NOT NULL,
    body_html character varying(2000) NOT NULL,
    provider_email_id character varying(100),
    failure_type character varying(1) DEFAULT NULL::character varying,
    failure_text character varying(2000) DEFAULT NULL::character varying,
    failure_time timestamp without time zone,
    CONSTRAINT dw1_emlot_failtext_type__c CHECK (((failure_text IS NULL) = (failure_type IS NULL))),
    CONSTRAINT dw1_emlot_failtime_type__c CHECK (((failure_time IS NULL) = (failure_type IS NULL))),
    CONSTRAINT dw1_emlot_failtype__c CHECK (((failure_type)::text = ANY ((ARRAY['B'::character varying, 'R'::character varying, 'C'::character varying, 'O'::character varying])::text[])))
);


CREATE TABLE dw1_guests (
    site_id character varying(32) NOT NULL,
    id character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    email_addr character varying(100) NOT NULL,
    location character varying(100) NOT NULL,
    url character varying(100) NOT NULL
);


CREATE TABLE dw1_ids_openid (
    sno character varying(32) NOT NULL,
    tenant character varying(32) NOT NULL,
    usr character varying(32) NOT NULL,
    usr_orig character varying(32) NOT NULL,
    oid_claimed_id character varying(500) NOT NULL,
    oid_op_local_id character varying(500) NOT NULL,
    oid_realm character varying(100) NOT NULL,
    oid_endpoint character varying(100) NOT NULL,
    oid_version character varying(100) NOT NULL,
    first_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    country character varying(100) NOT NULL,
    cdati timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT dw1_idsoid_sno_not_0__c CHECK (((sno)::text <> '0'::text))
);


CREATE TABLE dw1_ids_simple (
    sno character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    location character varying(100) NOT NULL,
    website character varying(100) NOT NULL,
    CONSTRAINT dw1_idssimple_sno_not_0__c CHECK (((sno)::text <> '0'::text))
);


CREATE TABLE dw1_ids_simple_email (
    tenant character varying(32) NOT NULL,
    login character varying(32),
    ctime timestamp without time zone NOT NULL,
    version character(1) NOT NULL,
    email character varying(100) NOT NULL,
    email_notfs character varying(1) NOT NULL,
    CONSTRAINT dw1_idsmpleml_email__c CHECK (((email)::text ~~ '%@%.%'::text)),
    CONSTRAINT dw1_idsmpleml_notfs__c CHECK (((email_notfs)::text = ANY ((ARRAY['R'::character varying, 'N'::character varying, 'F'::character varying])::text[]))),
    CONSTRAINT dw1_idsmpleml_version__c CHECK ((version = ANY (ARRAY['C'::bpchar, 'O'::bpchar])))
);


CREATE SEQUENCE dw1_ids_sno
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TABLE dw1_logins (
    sno character varying(32) NOT NULL,
    tenant character varying(32) NOT NULL,
    prev_login character varying(32),
    id_type character varying(10) NOT NULL,
    id_sno character varying(32) NOT NULL,
    login_ip character varying(39) NOT NULL,
    login_time timestamp without time zone NOT NULL,
    logout_ip character varying(39),
    logout_time timestamp without time zone,
    CONSTRAINT dw1_logins_idtype__c CHECK (((id_type)::text = ANY ((ARRAY['Simple'::character varying, 'Unau'::character varying, 'OpenID'::character varying, 'EmailID'::character varying])::text[]))),
    CONSTRAINT dw1_logins_sno_not_0__c CHECK (((sno)::text <> '0'::text))
);


CREATE SEQUENCE dw1_logins_sno
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TABLE dw1_notfs_page_actions (
    tenant character varying(32) NOT NULL,
    ctime timestamp without time zone NOT NULL,
    page_id character varying(32) NOT NULL,
    page_title character varying(100) NOT NULL,
    rcpt_id_simple character varying(32),
    rcpt_role_id character varying(32),
    event_type character varying(20) NOT NULL,
    event_pga integer NOT NULL,
    target_pga integer,
    rcpt_pga integer NOT NULL,
    rcpt_user_disp_name character varying(100) NOT NULL,
    event_user_disp_name character varying(100) NOT NULL,
    target_user_disp_name character varying(100),
    status character varying(1) DEFAULT 'N'::character varying NOT NULL,
    email_sent character varying(32) DEFAULT NULL::character varying,
    email_link_clicked timestamp without time zone,
    mtime timestamp without time zone,
    email_status character varying(1),
    debug character varying(200) DEFAULT NULL::character varying,
    CONSTRAINT dw1_ntfpga_emailclkd__c CHECK (CASE WHEN (email_link_clicked IS NULL) THEN true ELSE (email_sent IS NOT NULL) END),
    CONSTRAINT dw1_ntfpga_emlst__c_in CHECK (((email_status)::text = 'P'::text)),
    CONSTRAINT dw1_ntfpga_idsmpl_role__c CHECK (((rcpt_role_id IS NULL) <> (rcpt_id_simple IS NULL))),
    CONSTRAINT dw1_ntfpga_status__c CHECK (((status)::text = ANY ((ARRAY['N'::character varying, 'O'::character varying])::text[])))
);


CREATE TABLE dw1_page_actions (
    page character varying(32),
    paid integer NOT NULL,
    login character varying(32),
    "time" timestamp without time zone NOT NULL,
    type character varying(20) NOT NULL,
    relpa integer,
    text text,
    markup character varying(30),
    wheere character varying(150),
    new_ip character varying(39),
    tenant character varying(32) NOT NULL,
    page_id character varying(32) NOT NULL,
    approval character varying(1),
    auto_application character varying(1),
    guest_id character varying(32),
    role_id character varying(32),
    post_id integer NOT NULL,
    CONSTRAINT dw1_pactions_paid_not_0__c CHECK (((paid)::text <> '0'::text)),
    CONSTRAINT dw1_pgas_appr_autoappl__c CHECK (CASE WHEN (approval IS NOT NULL) THEN (((type)::text <> 'Edit'::text) OR (auto_application IS NOT NULL)) ELSE true END),
    CONSTRAINT dw1_pgas_approval__c_in CHECK (((approval)::text = ANY ((ARRAY['P'::character varying, 'W'::character varying, 'A'::character varying, 'M'::character varying])::text[]))),
    CONSTRAINT dw1_pgas_autoappl__c_in CHECK (((auto_application)::text = 'A'::text)),
    CONSTRAINT dw1_pgas_autoappl_type__c CHECK (CASE WHEN (auto_application IS NOT NULL) THEN ((type)::text = 'Edit'::text) ELSE true END),
    CONSTRAINT dw1_pgas_login_guest_role__c CHECK (((((login IS NULL) AND (guest_id IS NULL)) AND (role_id IS NULL)) OR ((login IS NOT NULL) AND ((guest_id IS NULL) <> (role_id IS NULL))))),
    CONSTRAINT dw1_pgas_magic_id_parents__c CHECK ((relpa = CASE WHEN (paid = 65501) THEN 65501 WHEN (paid = 65502) THEN 65502 WHEN (paid = 65503) THEN 65503 ELSE relpa END)),
    CONSTRAINT dw1_pgas_magic_id_types__c CHECK (((type)::text = (CASE WHEN ((paid)::text = ANY (ARRAY[('0t'::character varying)::text, ('0b'::character varying)::text, ('0c'::character varying)::text])) THEN 'Post'::character varying ELSE type END)::text)),
    CONSTRAINT dw1_pgas_markup__c_ne CHECK ((btrim((markup)::text) <> ''::text)),
    CONSTRAINT dw1_pgas_newip__c_ne CHECK ((btrim((new_ip)::text) <> ''::text)),
    CONSTRAINT dw1_pgas_paid__c_ne CHECK ((btrim((paid)::text) <> ''::text)),
    CONSTRAINT dw1_pgas_post_markup__c_nn CHECK (CASE type WHEN 'Post'::text THEN (markup IS NOT NULL) ELSE true END),
    CONSTRAINT dw1_pgas_text__c_ne CHECK ((btrim(text) <> ''::text)),
    CONSTRAINT dw1_pgas_type__c_in CHECK (((type)::text = ANY ((ARRAY['Post'::character varying, 'Edit'::character varying, 'EditApp'::character varying, 'Aprv'::character varying, 'Rjct'::character varying, 'Rating'::character varying, 'MoveTree'::character varying, 'CollapsePost'::character varying, 'CollapseTree'::character varying, 'DelPost'::character varying, 'DelTree'::character varying, 'FlagSpam'::character varying, 'FlagIllegal'::character varying, 'FlagCopyVio'::character varying, 'FlagOther'::character varying, 'Undo'::character varying, 'VoteUp'::character varying, 'VoteDown'::character varying])::text[]))),
    CONSTRAINT dw1_pgas_type_approval__c CHECK (CASE type WHEN 'Aprv'::text THEN (approval IS NOT NULL) WHEN 'Rjct'::text THEN (approval IS NULL) ELSE true END),
    CONSTRAINT dw1_pgas_where__c_ne CHECK ((btrim((wheere)::text) <> ''::text))
);


CREATE TABLE dw1_page_paths (
    tenant character varying(32) NOT NULL,
    parent_folder character varying(100) NOT NULL,
    page_id character varying(32) NOT NULL,
    show_id character varying(1) NOT NULL,
    page_slug character varying(100) NOT NULL,
    cdati timestamp without time zone DEFAULT now() NOT NULL,
    canonical_dati timestamp without time zone DEFAULT now() NOT NULL,
    canonical character varying(1) NOT NULL,
    CONSTRAINT dw1_pgpths_cdati_mdati__c_le CHECK ((cdati <= canonical_dati)),
    CONSTRAINT dw1_pgpths_cncl__c CHECK (((canonical)::text = ANY ((ARRAY['C'::character varying, 'R'::character varying])::text[]))),
    CONSTRAINT dw1_pgpths_folder__c_dash CHECK (((parent_folder)::text !~~ '%/-%'::text)),
    CONSTRAINT dw1_pgpths_folder__c_start CHECK (((parent_folder)::text ~~ '/%'::text)),
    CONSTRAINT dw1_pgpths_showid__c_in CHECK (((show_id)::text = ANY ((ARRAY['T'::character varying, 'F'::character varying])::text[]))),
    CONSTRAINT dw1_pgpths_slug__c_ne CHECK ((btrim((page_slug)::text) <> ''::text))
);


CREATE TABLE dw1_page_ratings (
    page character varying(32),
    paid integer NOT NULL,
    tag character varying(30) NOT NULL,
    tenant character varying(32) NOT NULL,
    page_id character varying(32) NOT NULL
);


CREATE TABLE dw1_pages (
    sno character varying(32) NOT NULL,
    tenant character varying(32) NOT NULL,
    guid character varying(32) NOT NULL,
    page_role character varying(10) NOT NULL,
    parent_page_id character varying(32),
    cdati timestamp without time zone DEFAULT now() NOT NULL,
    mdati timestamp without time zone DEFAULT now() NOT NULL,
    publ_dati timestamp without time zone DEFAULT now(),
    cached_title character varying(100) DEFAULT NULL::character varying,
    sgfnt_mdati timestamp without time zone,
    next_reply_id integer DEFAULT 1 NOT NULL,
    cached_author_display_name character varying(100),
    cached_author_user_id character varying(32),
    cached_num_posters integer DEFAULT 0 NOT NULL,
    cached_num_actions integer DEFAULT 0 NOT NULL,
    cached_num_posts_to_review integer DEFAULT 0 NOT NULL,
    cached_num_posts_deleted integer DEFAULT 0 NOT NULL,
    cached_num_replies_visible integer DEFAULT 0 NOT NULL,
    cached_last_visible_post_dati timestamp without time zone,
    cached_num_child_pages integer DEFAULT 0 NOT NULL,
    CONSTRAINT dw1_pages_cachedtitle__c_ne CHECK ((btrim((cached_title)::text) <> ''::text)),
    CONSTRAINT dw1_pages_cdati_mdati__c_le CHECK ((cdati <= mdati)),
    CONSTRAINT dw1_pages_cdati_publdati__c_le CHECK ((cdati <= publ_dati)),
    CONSTRAINT dw1_pages_cdati_smdati__c_le CHECK ((cdati <= sgfnt_mdati)),
    CONSTRAINT dw1_pages_pagerole__c_in CHECK (((page_role)::text = ANY ((ARRAY['G'::character varying, 'B'::character varying, 'BP'::character varying, 'FG'::character varying, 'F'::character varying, 'FT'::character varying, 'W'::character varying, 'WP'::character varying, 'C'::character varying])::text[]))),
    CONSTRAINT dw1_pages_sno_not_0__c CHECK (((sno)::text <> '0'::text))
);


CREATE SEQUENCE dw1_pages_sno
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TABLE dw1_paths (
    tenant character varying(32) NOT NULL,
    folder character varying(100) NOT NULL,
    page_guid character varying(32) NOT NULL,
    page_name character varying(100) NOT NULL,
    guid_in_path character varying(1) NOT NULL,
    CONSTRAINT dw1_paths_folder__c CHECK (((folder)::text !~~ '%/-%'::text)),
    CONSTRAINT dw1_paths_guidinpath__c CHECK (((guid_in_path)::text = ANY ((ARRAY['T'::character varying, 'F'::character varying])::text[])))
);


CREATE TABLE dw1_posts (
    site_id character varying(32) NOT NULL,
    page_id character varying(32) NOT NULL,
    post_id integer NOT NULL,
    parent_post_id integer NOT NULL,
    markup character varying(30),
    wheere character varying(150),
    created_at timestamp without time zone NOT NULL,
    last_acted_upon_at timestamp without time zone,
    last_reviewed_at timestamp without time zone,
    last_authly_reviewed_at timestamp without time zone,
    last_approved_at timestamp without time zone,
    last_approval_type character varying(1),
    last_permanently_approved_at timestamp without time zone,
    last_manually_approved_at timestamp without time zone,
    author_id character varying(32),
    last_edit_applied_at timestamp without time zone,
    last_edit_reverted_at timestamp without time zone,
    last_editor_id character varying(32),
    post_collapsed_at timestamp without time zone,
    tree_collapsed_at timestamp without time zone,
    post_deleted_at timestamp without time zone,
    tree_deleted_at timestamp without time zone,
    num_edit_suggestions smallint DEFAULT 0 NOT NULL,
    num_edits_appld_unreviewed smallint DEFAULT 0 NOT NULL,
    num_edits_appld_prel_approved smallint DEFAULT 0 NOT NULL,
    num_edits_to_review smallint DEFAULT 0 NOT NULL,
    num_distinct_editors smallint DEFAULT 0 NOT NULL,
    num_collapse_post_votes_pro smallint DEFAULT 0 NOT NULL,
    num_collapse_post_votes_con smallint DEFAULT 0 NOT NULL,
    num_uncollapse_post_votes_pro smallint DEFAULT 0 NOT NULL,
    num_uncollapse_post_votes_con smallint DEFAULT 0 NOT NULL,
    num_collapse_tree_votes_pro smallint DEFAULT 0 NOT NULL,
    num_collapse_tree_votes_con smallint DEFAULT 0 NOT NULL,
    num_uncollapse_tree_votes_pro smallint DEFAULT 0 NOT NULL,
    num_uncollapse_tree_votes_con smallint DEFAULT 0 NOT NULL,
    num_collapses_to_review smallint DEFAULT 0 NOT NULL,
    num_uncollapses_to_review smallint DEFAULT 0 NOT NULL,
    num_delete_post_votes_pro smallint DEFAULT 0 NOT NULL,
    num_delete_post_votes_con smallint DEFAULT 0 NOT NULL,
    num_undelete_post_votes_pro smallint DEFAULT 0 NOT NULL,
    num_undelete_post_votes_con smallint DEFAULT 0 NOT NULL,
    num_delete_tree_votes_pro smallint DEFAULT 0 NOT NULL,
    num_delete_tree_votes_con smallint DEFAULT 0 NOT NULL,
    num_undelete_tree_votes_pro smallint DEFAULT 0 NOT NULL,
    num_undelete_tree_votes_con smallint DEFAULT 0 NOT NULL,
    num_deletes_to_review smallint DEFAULT 0 NOT NULL,
    num_undeletes_to_review smallint DEFAULT 0 NOT NULL,
    num_pending_flags smallint DEFAULT 0 NOT NULL,
    num_handled_flags smallint DEFAULT 0 NOT NULL,
    flags character varying(100),
    ratings character varying(100),
    approved_text text,
    unapproved_text_diff text,
    CONSTRAINT dw1_posts_approval__c_in CHECK (((last_approval_type)::text = ANY ((ARRAY['P'::character varying, 'W'::character varying, 'A'::character varying, 'M'::character varying])::text[])))
);


CREATE TABLE dw1_quotas (
    tenant character varying(32),
    ip character varying(32),
    role_id character varying(32),
    version character varying(1) NOT NULL,
    ctime timestamp without time zone NOT NULL,
    mtime timestamp without time zone NOT NULL,
    quota_used_paid bigint DEFAULT 0 NOT NULL,
    quota_used_free bigint DEFAULT 0 NOT NULL,
    quota_used_freeloaded bigint DEFAULT 0 NOT NULL,
    quota_limit_paid bigint DEFAULT 0 NOT NULL,
    quota_limit_free bigint DEFAULT 0 NOT NULL,
    quota_limit_freeload bigint DEFAULT 0 NOT NULL,
    quota_daily_free bigint DEFAULT 0 NOT NULL,
    quota_daily_freeload bigint DEFAULT 0 NOT NULL,
    num_logins integer DEFAULT 0 NOT NULL,
    num_ids_unau integer DEFAULT 0 NOT NULL,
    num_ids_au integer DEFAULT 0 NOT NULL,
    num_roles integer DEFAULT 0 NOT NULL,
    num_pages integer DEFAULT 0 NOT NULL,
    num_actions integer DEFAULT 0 NOT NULL,
    num_action_text_bytes bigint DEFAULT 0 NOT NULL,
    num_notfs integer DEFAULT 0 NOT NULL,
    num_emails_out integer DEFAULT 0 NOT NULL,
    num_db_reqs_read bigint DEFAULT 0 NOT NULL,
    num_db_reqs_write bigint DEFAULT 0 NOT NULL,
    CONSTRAINT dw1_qtas_time__c CHECK ((mtime >= ctime)),
    CONSTRAINT dw1_qtas_tnt_ip_role__c CHECK (CASE WHEN ((ip)::text <> '-'::text) THEN ((role_id)::text = '-'::text) ELSE ((tenant)::text <> '-'::text) END),
    CONSTRAINT dw1_qtas_version__c_in CHECK (((version)::text = ANY ((ARRAY['C'::character varying, 'O'::character varying])::text[])))
);


CREATE TABLE dw1_tenant_hosts (
    tenant character varying(32) NOT NULL,
    host character varying(50) NOT NULL,
    canonical character varying(1) NOT NULL,
    https character varying(1) DEFAULT 'N'::character varying NOT NULL,
    ctime timestamp without time zone DEFAULT now() NOT NULL,
    mtime timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT dw1_tnthsts_cncl__c CHECK (((canonical)::text = ANY ((ARRAY['C'::character varying, 'R'::character varying, 'L'::character varying, 'D'::character varying])::text[]))),
    CONSTRAINT dw1_tnthsts_https__c CHECK (((https)::text = ANY (ARRAY[('R'::character varying)::text, ('A'::character varying)::text, ('N'::character varying)::text])))
);


CREATE TABLE dw1_tenants (
    id character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    ctime timestamp without time zone DEFAULT now() NOT NULL,
    creator_ip character varying(39),
    creator_tenant_id character varying(32),
    creator_login_id character varying(32),
    creator_role_id character varying(32),
    CONSTRAINT dw1_tnt_id__c_n0 CHECK (((id)::text <> '0'::text)),
    CONSTRAINT dw1_tnt_id__c_ne CHECK ((btrim((id)::text) <> ''::text)),
    CONSTRAINT dw1_tnt_name__c_ne CHECK ((btrim((name)::text) <> ''::text))
);


CREATE SEQUENCE dw1_tenants_id
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


CREATE TABLE dw1_users (
    tenant character varying(32) NOT NULL,
    sno character varying(32) NOT NULL,
    display_name character varying(100),
    email character varying(100),
    country character varying(100),
    website character varying(100),
    superadmin character varying(1),
    email_notfs character varying(1),
    is_owner character varying(1),
    CONSTRAINT dw1_users_country__c CHECK (((country)::text <> ''::text)),
    CONSTRAINT dw1_users_dname__c CHECK (((display_name)::text <> ''::text)),
    CONSTRAINT dw1_users_email__c CHECK (((email)::text ~~ '%@%.%'::text)),
    CONSTRAINT dw1_users_emlntf__c CHECK (((email_notfs)::text = ANY ((ARRAY['R'::character varying, 'N'::character varying, 'F'::character varying])::text[]))),
    CONSTRAINT dw1_users_isowner__c_b CHECK (((is_owner)::text = 'T'::text)),
    CONSTRAINT dw1_users_sno_not_0__c CHECK (((sno)::text <> '0'::text)),
    CONSTRAINT dw1_users_superadm__c CHECK (((superadmin)::text = 'T'::text)),
    CONSTRAINT dw1_users_website__c CHECK (((website)::text <> ''::text))
);


CREATE SEQUENCE dw1_users_sno
    START WITH 10
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE ONLY dw1_page_ratings
    ADD CONSTRAINT dw1_arts__p PRIMARY KEY (tenant, page_id, paid, tag);


ALTER TABLE ONLY dw1_emails_out
    ADD CONSTRAINT dw1_emlot_tnt_id__p PRIMARY KEY (tenant, id);


ALTER TABLE ONLY dw1_guests
    ADD CONSTRAINT dw1_guests__u UNIQUE (site_id, name, email_addr, location, url);


ALTER TABLE ONLY dw1_guests
    ADD CONSTRAINT dw1_guests_site_id__p PRIMARY KEY (site_id, id);


ALTER TABLE ONLY dw1_ids_simple_email
    ADD CONSTRAINT dw1_idsmpleml__p PRIMARY KEY (tenant, email, ctime);


ALTER TABLE ONLY dw1_ids_openid
    ADD CONSTRAINT dw1_idsoid_sno__p PRIMARY KEY (sno);


ALTER TABLE ONLY dw1_ids_openid
    ADD CONSTRAINT dw1_idsoid_tnt_oid__u UNIQUE (tenant, oid_claimed_id);


ALTER TABLE ONLY dw1_ids_simple
    ADD CONSTRAINT dw1_idssimple__u UNIQUE (name, email, location, website);


ALTER TABLE ONLY dw1_ids_simple
    ADD CONSTRAINT dw1_idssimple_sno__p PRIMARY KEY (sno);


ALTER TABLE ONLY dw1_logins
    ADD CONSTRAINT dw1_logins_sno__p PRIMARY KEY (sno);


ALTER TABLE ONLY dw1_notfs_page_actions
    ADD CONSTRAINT dw1_ntfpga_t_pg_evt_rcpt__p PRIMARY KEY (tenant, page_id, event_pga, rcpt_pga);


ALTER TABLE ONLY dw1_pages
    ADD CONSTRAINT dw1_pages__u UNIQUE (tenant, guid);


ALTER TABLE ONLY dw1_pages
    ADD CONSTRAINT dw1_pages_sno__p PRIMARY KEY (sno);


ALTER TABLE ONLY dw1_paths
    ADD CONSTRAINT dw1_paths_tnt_page__p PRIMARY KEY (tenant, page_guid);


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pgas_tnt_pgid_id__p PRIMARY KEY (tenant, page_id, paid);


ALTER TABLE ONLY dw1_posts
    ADD CONSTRAINT dw1_posts_site_page_post__p PRIMARY KEY (site_id, page_id, post_id);


ALTER TABLE ONLY dw1_tenants
    ADD CONSTRAINT dw1_tenants_id__p PRIMARY KEY (id);


ALTER TABLE ONLY dw1_tenants
    ADD CONSTRAINT dw1_tenants_name__u UNIQUE (name);


ALTER TABLE ONLY dw1_tenant_hosts
    ADD CONSTRAINT dw1_tnthsts_host__u UNIQUE (host);


ALTER TABLE ONLY dw1_users
    ADD CONSTRAINT dw1_users_tnt_sno__p PRIMARY KEY (tenant, sno);


CREATE INDEX dw1_idsmpleml_login ON dw1_ids_simple_email USING btree (login);


CREATE UNIQUE INDEX dw1_idsmpleml_version__u ON dw1_ids_simple_email USING btree (tenant, email, version) WHERE (version = 'C'::bpchar);


CREATE INDEX dw1_idsoid_email ON dw1_ids_openid USING btree (email);


CREATE UNIQUE INDEX dw1_idsoid_tnt_email__u ON dw1_ids_openid USING btree (tenant, email) WHERE ((oid_endpoint)::text = 'https://www.google.com/accounts/o8/ud'::text);


CREATE INDEX dw1_idsoid_tnt_usr ON dw1_ids_openid USING btree (tenant, usr);


CREATE INDEX dw1_logins_prevl ON dw1_logins USING btree (prev_login);


CREATE INDEX dw1_logins_tnt ON dw1_logins USING btree (tenant);


CREATE INDEX dw1_ntfpga_emlpndng_ctime ON dw1_notfs_page_actions USING btree (email_status, ctime) WHERE ((email_status)::text = 'P'::text);


CREATE UNIQUE INDEX dw1_ntfpga_t_idsmpl_pg_evt__u ON dw1_notfs_page_actions USING btree (tenant, rcpt_id_simple, page_id, event_pga) WHERE (rcpt_id_simple IS NOT NULL);


CREATE INDEX dw1_ntfpga_tnt_emailsent ON dw1_notfs_page_actions USING btree (tenant, email_sent);


CREATE INDEX dw1_ntfpga_tnt_idsmpl_ctime ON dw1_notfs_page_actions USING btree (tenant, rcpt_id_simple, ctime);


CREATE UNIQUE INDEX dw1_ntfpga_tnt_rl_pg_evt__u ON dw1_notfs_page_actions USING btree (tenant, rcpt_role_id, page_id, event_pga) WHERE (rcpt_role_id IS NOT NULL);


CREATE INDEX dw1_ntfpga_tnt_role_ctime ON dw1_notfs_page_actions USING btree (tenant, rcpt_role_id, ctime);


CREATE INDEX dw1_ntfpga_tnt_status_ctime ON dw1_notfs_page_actions USING btree (tenant, status, ctime);


CREATE INDEX dw1_pactions_login ON dw1_page_actions USING btree (login);


CREATE INDEX dw1_pages_tnt_parent_publdati ON dw1_pages USING btree (tenant, parent_page_id, publ_dati);


CREATE INDEX dw1_pages_tnt_parentpage ON dw1_pages USING btree (tenant, parent_page_id);


CREATE INDEX dw1_pages_tnt_prnt_cdati_nopub ON dw1_pages USING btree (tenant, parent_page_id, cdati) WHERE (publ_dati IS NULL);


CREATE UNIQUE INDEX dw1_paths__u ON dw1_paths USING btree (tenant, folder, page_name, page_guid) WHERE ((guid_in_path)::text = 'T'::text);


CREATE INDEX dw1_paths_all ON dw1_paths USING btree (tenant, folder, page_name, page_guid);


CREATE INDEX dw1_pgas_tenant_page_post ON dw1_page_actions USING btree (tenant, page_id, post_id);


CREATE INDEX dw1_pgas_tnt_guestid ON dw1_page_actions USING btree (tenant, guest_id);


CREATE INDEX dw1_pgas_tnt_roleid ON dw1_page_actions USING btree (tenant, role_id);


CREATE UNIQUE INDEX dw1_pgpths_path__u ON dw1_page_paths USING btree (tenant, page_id, parent_folder, page_slug, show_id);


CREATE UNIQUE INDEX dw1_pgpths_path_noid_cncl__u ON dw1_page_paths USING btree (tenant, parent_folder, page_slug) WHERE (((show_id)::text = 'F'::text) AND ((canonical)::text = 'C'::text));


CREATE INDEX dw1_pgpths_tnt_fldr_slg_cncl ON dw1_page_paths USING btree (tenant, parent_folder, page_slug, canonical);


CREATE INDEX dw1_pgpths_tnt_pgid_cncl ON dw1_page_paths USING btree (tenant, page_id, canonical);


CREATE UNIQUE INDEX dw1_pgpths_tnt_pgid_cncl__u ON dw1_page_paths USING btree (tenant, page_id) WHERE ((canonical)::text = 'C'::text);


CREATE INDEX dw1_posts_pending_edit_suggs ON dw1_posts USING btree (site_id, last_acted_upon_at) WHERE ((((((((num_pending_flags = 0) AND ((last_approval_type)::text = ANY ((ARRAY['W'::character varying, 'A'::character varying, 'M'::character varying])::text[]))) AND (num_edits_to_review = 0)) AND (num_collapses_to_review = 0)) AND (num_uncollapses_to_review = 0)) AND (num_deletes_to_review = 0)) AND (num_undeletes_to_review = 0)) AND (((((((((num_edit_suggestions > 0) OR ((num_collapse_post_votes_pro > 0) AND (post_collapsed_at IS NULL))) OR ((num_uncollapse_post_votes_pro > 0) AND (post_collapsed_at IS NOT NULL))) OR ((num_collapse_tree_votes_pro > 0) AND (tree_collapsed_at IS NULL))) OR ((num_uncollapse_tree_votes_pro > 0) AND (tree_collapsed_at IS NOT NULL))) OR ((num_delete_post_votes_pro > 0) AND (post_deleted_at IS NULL))) OR ((num_undelete_post_votes_pro > 0) AND (post_deleted_at IS NOT NULL))) OR ((num_delete_tree_votes_pro > 0) AND (tree_deleted_at IS NULL))) OR ((num_undelete_tree_votes_pro > 0) AND (tree_deleted_at IS NOT NULL))));


CREATE INDEX dw1_posts_pending_flags ON dw1_posts USING btree (site_id, num_pending_flags) WHERE (num_pending_flags > 0);


CREATE INDEX dw1_posts_pending_nothing ON dw1_posts USING btree (site_id, last_acted_upon_at) WHERE (((((((((num_pending_flags = 0) AND ((last_approval_type)::text = ANY ((ARRAY['W'::character varying, 'A'::character varying, 'M'::character varying])::text[]))) AND (num_edits_to_review = 0)) AND (num_collapses_to_review = 0)) AND (num_uncollapses_to_review = 0)) AND (num_deletes_to_review = 0)) AND (num_undeletes_to_review = 0)) AND (num_edit_suggestions = 0)) AND (NOT (((((((((num_edit_suggestions > 0) OR ((num_collapse_post_votes_pro > 0) AND (post_collapsed_at IS NULL))) OR ((num_uncollapse_post_votes_pro > 0) AND (post_collapsed_at IS NOT NULL))) OR ((num_collapse_tree_votes_pro > 0) AND (tree_collapsed_at IS NULL))) OR ((num_uncollapse_tree_votes_pro > 0) AND (tree_collapsed_at IS NOT NULL))) OR ((num_delete_post_votes_pro > 0) AND (post_deleted_at IS NULL))) OR ((num_undelete_post_votes_pro > 0) AND (post_deleted_at IS NOT NULL))) OR ((num_delete_tree_votes_pro > 0) AND (tree_deleted_at IS NULL))) OR ((num_undelete_tree_votes_pro > 0) AND (tree_deleted_at IS NOT NULL)))));


CREATE INDEX dw1_posts_pending_sth ON dw1_posts USING btree (site_id, last_acted_upon_at) WHERE ((num_pending_flags = 0) AND (((((((last_approval_type IS NULL) OR ((last_approval_type)::text = 'P'::text)) OR (num_edits_to_review > 0)) OR (num_collapses_to_review > 0)) OR (num_uncollapses_to_review > 0)) OR (num_deletes_to_review > 0)) OR (num_undeletes_to_review > 0)));


CREATE UNIQUE INDEX dw1_qtas_tnt_ip_role__u ON dw1_quotas USING btree ((COALESCE(tenant, '-'::character varying)), (COALESCE(ip, '-'::character varying)), (COALESCE(role_id, '-'::character varying)));


CREATE INDEX dw1_tenants_creatorip ON dw1_tenants USING btree (creator_ip);


CREATE INDEX dw1_tenants_creatorlogin ON dw1_tenants USING btree (creator_tenant_id, creator_login_id);


CREATE INDEX dw1_tenants_creatorrole ON dw1_tenants USING btree (creator_tenant_id, creator_role_id);


CREATE UNIQUE INDEX dw1_tnthsts_tnt_cncl__u ON dw1_tenant_hosts USING btree (tenant) WHERE ((canonical)::text = 'C'::text);


ALTER TABLE ONLY dw1_page_ratings
    ADD CONSTRAINT dw1_arts__r__pgas FOREIGN KEY (tenant, page_id, paid) REFERENCES dw1_page_actions(tenant, page_id, paid) DEFERRABLE;


ALTER TABLE ONLY dw1_emails_out
    ADD CONSTRAINT dw1_emlot__r__tnts FOREIGN KEY (tenant) REFERENCES dw1_tenants(id);


ALTER TABLE ONLY dw1_ids_simple_email
    ADD CONSTRAINT dw1_idsmpleml__r__logins FOREIGN KEY (login) REFERENCES dw1_logins(sno);


ALTER TABLE ONLY dw1_ids_openid
    ADD CONSTRAINT dw1_idsoid_usr_tnt__r__users FOREIGN KEY (tenant, usr) REFERENCES dw1_users(tenant, sno) DEFERRABLE;


ALTER TABLE ONLY dw1_logins
    ADD CONSTRAINT dw1_logins__r__logins FOREIGN KEY (prev_login) REFERENCES dw1_logins(sno) DEFERRABLE;


ALTER TABLE ONLY dw1_logins
    ADD CONSTRAINT dw1_logins_tnt__r__tenants FOREIGN KEY (tenant) REFERENCES dw1_tenants(id) DEFERRABLE;


ALTER TABLE ONLY dw1_notfs_page_actions
    ADD CONSTRAINT dw1_ntfpga__r__emlot FOREIGN KEY (tenant, email_sent) REFERENCES dw1_emails_out(tenant, id);


ALTER TABLE ONLY dw1_notfs_page_actions
    ADD CONSTRAINT dw1_ntfpga__r__guests FOREIGN KEY (tenant, rcpt_id_simple) REFERENCES dw1_guests(site_id, id) DEFERRABLE;


ALTER TABLE ONLY dw1_notfs_page_actions
    ADD CONSTRAINT dw1_ntfpga__r__rls FOREIGN KEY (tenant, rcpt_role_id) REFERENCES dw1_users(tenant, sno) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pactions__r__logins FOREIGN KEY (login) REFERENCES dw1_logins(sno) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pactions__r__pages FOREIGN KEY (page) REFERENCES dw1_pages(sno) DEFERRABLE;


ALTER TABLE ONLY dw1_pages
    ADD CONSTRAINT dw1_pages__r__tenant FOREIGN KEY (tenant) REFERENCES dw1_tenants(id) DEFERRABLE;


ALTER TABLE ONLY dw1_pages
    ADD CONSTRAINT dw1_pages_parentpage__r__pages FOREIGN KEY (tenant, parent_page_id) REFERENCES dw1_pages(tenant, guid) DEFERRABLE;


ALTER TABLE ONLY dw1_paths
    ADD CONSTRAINT dw1_paths_tnt_page__r__pages FOREIGN KEY (tenant, page_guid) REFERENCES dw1_pages(tenant, guid) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pgas__r__guests FOREIGN KEY (tenant, guest_id) REFERENCES dw1_guests(site_id, id) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pgas__r__pgas FOREIGN KEY (tenant, page_id, relpa) REFERENCES dw1_page_actions(tenant, page_id, paid) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pgas__r__roles FOREIGN KEY (tenant, role_id) REFERENCES dw1_users(tenant, sno) DEFERRABLE;


ALTER TABLE ONLY dw1_page_actions
    ADD CONSTRAINT dw1_pgas_tnt_pgid__r__pages FOREIGN KEY (tenant, page_id) REFERENCES dw1_pages(tenant, guid) DEFERRABLE;


ALTER TABLE ONLY dw1_page_paths
    ADD CONSTRAINT dw1_pgpths_tnt_pgid__r__pages FOREIGN KEY (tenant, page_id) REFERENCES dw1_pages(tenant, guid) DEFERRABLE;


ALTER TABLE ONLY dw1_quotas
    ADD CONSTRAINT dw1_qtas_tnt__r__tenants FOREIGN KEY (tenant) REFERENCES dw1_tenants(id) DEFERRABLE;


ALTER TABLE ONLY dw1_quotas
    ADD CONSTRAINT dw1_qtas_tnt_role__r__roles FOREIGN KEY (tenant, role_id) REFERENCES dw1_users(tenant, sno) DEFERRABLE;


ALTER TABLE ONLY dw1_tenants
    ADD CONSTRAINT dw1_tenants_creator__r__roles FOREIGN KEY (creator_tenant_id, creator_role_id) REFERENCES dw1_users(tenant, sno) DEFERRABLE;


ALTER TABLE ONLY dw1_tenants
    ADD CONSTRAINT dw1_tenants_creator__r__tnts FOREIGN KEY (creator_tenant_id) REFERENCES dw1_tenants(id) DEFERRABLE;


ALTER TABLE ONLY dw1_tenant_hosts
    ADD CONSTRAINT dw1_tnthsts__r__tenants FOREIGN KEY (tenant) REFERENCES dw1_tenants(id);


ALTER TABLE ONLY dw1_users
    ADD CONSTRAINT dw1_users__r__tenant FOREIGN KEY (tenant) REFERENCES dw1_tenants(id) DEFERRABLE;



