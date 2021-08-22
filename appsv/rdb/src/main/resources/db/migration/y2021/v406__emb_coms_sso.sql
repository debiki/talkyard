create domain http_url_d text;
alter domain http_url_d add constraint http_url_d_c_regex check (
    value ~ 'https?:\/\/[a-z0-9_.-]+(/.*)?');
alter domain http_url_d add constraint http_url_d_c_no_blanks check (value !~ '\s');
alter domain http_url_d add constraint http_url_d_c_maxlen check (length(value) <= 2100);


-- Symmetric and asymmetric keys in hex or Base64-url-safe.
create domain key_hex_b64us_d text;
-- Base64 url safe uses [-_] not [+/]. Let's check format and length in other regexs.
alter domain key_hex_b64us_d add constraint key_hex_b64us_d_c_regex check (
    value ~ '^([a-z0-9]+:)?[a-zA-Z0-9_=-]*$');
-- The encoding type, hex or base64 url encoded — so Ty admins can use whatever
-- encoding works with the software libs available in the languages they use.
alter domain key_hex_b64us_d add constraint key_hex_b64us_d_c_prefix check (
    value ~ '^(base64:|hex:).*$');
alter domain key_hex_b64us_d add constraint key_hex_b64us_d_c_minlen check (
    length(value) >= 24);
-- E.g. a PASETO v2.local symmetric key is 32 bytes, needs 64 hex chars,
-- plus a 'hex:' prefix. Let's allow a bit more, so more bytes will work too.
alter domain key_hex_b64us_d add constraint key_hex_b64us_d_c_maxlen check (
    length(value) < 250);


alter table settings3 add column sso_logout_redir_url_c http_url_d;
alter table settings3 add column sso_show_emb_authn_btns_c i16_gez_d;
alter table settings3 add column sso_paseto_v2_loc_secret_c key_hex_b64us_d;
alter table settings3 add column sso_paseto_v2_pub_pub_key_c key_hex_b64us_d;
alter table settings3 add column sso_refresh_authn_token_url_c http_url_d;
alter table settings3 add column remember_emb_sess_c i16_gez_d;
alter table settings3 add column expire_idle_emb_sess_after_mins_c i32_gez_d;
