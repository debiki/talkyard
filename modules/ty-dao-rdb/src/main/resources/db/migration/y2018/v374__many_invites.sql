
-- Drop unique index, replace with non-unique. So one can re-send invites.
drop index dw2_invites_email__u;
create index invites_emailaddr_invby_i on invites3 (site_id, email_address, created_by_id);

