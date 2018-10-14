
-- Is now a settings3 column instead.
alter table sites3 drop column embedding_site_url;

-- These should be removed too, later: (use audit_log3 instead)
alter table sites3 alter column creator_email_address drop not null;
alter table sites3 alter column creator_ip drop not null;

