
create domain text_oneline_d text_trimmed_not_empty_d;
alter domain text_oneline_d add constraint text_oneline_d_c_ste2100 check (
    length(value) <= 2100);
alter domain text_oneline_d add constraint text_oneline_d_c_print_chars check (
    value ~ '^[[:print:]]*$');
comment on domain text_oneline_d is
    'A one line string — alphanumeric chars, punctuation and space are ok '
    'but not tabs or newlines or control chars. At most 2100 chars — '
    'there has to be some limit. And old IE11 had a max URL length of '
    '2083 chars so 2100 seems nice (in case is a URL). '
    'Also, the Sitemaps protocol supports only up to 2048 chars, '
    'https://www.sitemaps.org/protocol.html.';

create domain text_oneline_120_d text_oneline_d;
alter domain text_oneline_120_d add constraint text_oneline_120_d_c_ste120 check (
    length(value) <= 120);

create domain text_oneline_60_d text_oneline_d;
alter domain text_oneline_60_d add constraint text_oneline_60_d_c_ste60 check (
    length(value) <= 60);

create domain text_oneline_30_d text_oneline_d;
alter domain text_oneline_30_d add constraint text_oneline_30_d_c_ste30 check (
    length(value) <= 30);

create domain text_oneline_15_d text_oneline_d;
alter domain text_oneline_15_d add constraint text_oneline_15_d_c_ste15 check (
    length(value) <= 15);
comment on domain text_oneline_15_d is
    'Like text_oneline_d, but at most 15 chars long.';


-- Sync w findEmailNameProblem().
create domain email_name_d text_oneline_60_d;
alter domain email_name_d add constraint email_name_d_c_regex check (
    value !~ '[!"#$%&();<=>?@[\]^`{|}]|//|https?:|script:');

alter table settings3 add column outbound_emails_from_name_c email_name_d;
alter table settings3 add column outbound_emails_from_addr_c email_d;
alter table settings3 add column outbound_emails_reply_to_c email_d;
alter table settings3 add column outbound_emails_smtp_conf_c jsonb;

