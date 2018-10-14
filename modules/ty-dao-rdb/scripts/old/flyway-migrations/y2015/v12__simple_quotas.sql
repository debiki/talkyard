-- Replaces dw1_quotas with dw1_tenants summary columns, updated via triggers.

drop table dw1_quotas;

alter table dw1_tenants add column quota_limit_mbs integer;
alter table dw1_tenants add column num_guests integer default 0 not null;
alter table dw1_tenants add column num_identities integer default 0 not null;
alter table dw1_tenants add column num_roles integer default 0 not null;
alter table dw1_tenants add column num_role_settings integer default 0 not null;
alter table dw1_tenants add column num_pages integer default 0 not null;
alter table dw1_tenants add column num_posts integer default 0 not null;
alter table dw1_tenants add column num_post_text_bytes bigint default 0 not null;
alter table dw1_tenants add column num_posts_read bigint default 0 not null;
alter table dw1_tenants add column num_actions integer default 0 not null;
alter table dw1_tenants add column num_action_text_bytes bigint default 0 not null;
alter table dw1_tenants add column num_notfs integer default 0 not null;
alter table dw1_tenants add column num_emails_sent integer default 0 not null;

update dw1_tenants set num_guests = (select count(*) from dw1_guests where dw1_tenants.id = dw1_guests.site_id);
update dw1_tenants set num_identities = (select count(*) from dw1_ids_openid where dw1_tenants.id = dw1_ids_openid.tenant);
update dw1_tenants set num_roles = (select count(*) from dw1_users where dw1_tenants.id = dw1_users.tenant);
update dw1_tenants set num_role_settings = (select count(*) from dw1_role_page_settings where dw1_tenants.id = dw1_role_page_settings.site_id);
update dw1_tenants set num_pages = (select count(*) from dw1_pages where dw1_tenants.id = dw1_pages.tenant);
update dw1_tenants set num_posts = (select count(*) from dw1_posts where dw1_tenants.id = dw1_posts.site_id);
update dw1_tenants set num_post_text_bytes = (select coalesce(sum(coalesce(length(approved_text), 0)) + sum(coalesce(length(unapproved_text_diff), 0)), 0) from dw1_posts where dw1_tenants.id = dw1_posts.site_id);
update dw1_tenants set num_posts_read = (select count(*) from dw1_posts_read_stats where dw1_tenants.id = dw1_posts_read_stats.site_id);
update dw1_tenants set num_actions = (select count(*) from dw1_page_actions where dw1_tenants.id = dw1_page_actions.tenant);
update dw1_tenants set num_action_text_bytes = (select coalesce(sum(coalesce(length(text), 0)), 0) from dw1_page_actions where dw1_tenants.id = dw1_page_actions.tenant);
update dw1_tenants set num_notfs = (select count(*) from dw1_notifications where dw1_tenants.id = dw1_notifications.site_id);
update dw1_tenants set num_emails_sent = (select count(*) from dw1_emails_out where dw1_tenants.id = dw1_emails_out.tenant and dw1_emails_out.sent_on is not null);


--
-- Updates the num guests summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_guests_summary() returns trigger as $dw1_guests_summary$
    declare
        delta_rows integer;
        site_id varchar;
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
        update dw1_tenants
            set num_guests = num_guests + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_guests_summary$ language plpgsql;

create trigger dw1_guests_summary
after insert or update or delete on dw1_guests
    for each row execute procedure dw1_guests_summary();


--
-- Updates the num identities summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_identities_summary() returns trigger as $dw1_identities_summary$
    declare
        delta_rows integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.tenant;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.tenant;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.tenant;
        end if;
        update dw1_tenants
            set num_identities = num_identities + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_identities_summary$ language plpgsql;

create trigger dw1_identities_summary
after insert or update or delete on dw1_ids_openid
    for each row execute procedure dw1_identities_summary();


--
-- Updates the num roles summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_roles_summary() returns trigger as $dw1_roles_summary$
    declare
        delta_rows integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.tenant;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.tenant;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.tenant;
        end if;
        update dw1_tenants
            set num_roles = num_roles + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_roles_summary$ language plpgsql;

create trigger dw1_roles_summary
after insert or update or delete on dw1_users
    for each row execute procedure dw1_roles_summary();


--
-- Updates the num role settings summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_role_page_settings_summary() returns trigger as $dw1_role_page_settings_summary$
    declare
        delta_rows integer;
        site_id varchar;
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
        update dw1_tenants
            set num_role_settings = num_role_settings + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_role_page_settings_summary$ language plpgsql;

create trigger dw1_role_page_settings_summary
after insert or update or delete on dw1_role_page_settings
    for each row execute procedure dw1_role_page_settings_summary();


--
-- Updates the num pages summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_pages_summary() returns trigger as $dw1_pages_summary$
    declare
        delta_rows integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            site_id = old.tenant;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            site_id = new.tenant;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            site_id = new.tenant;
        end if;
        update dw1_tenants
            set num_pages = num_pages + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_pages_summary$ language plpgsql;

create trigger dw1_pages_summary
after insert or update or delete on dw1_pages
    for each row execute procedure dw1_pages_summary();


--
-- Updates the num posts summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_posts_summary() returns trigger as $dw1_posts_summary$
    declare
        delta_rows integer;
        delta_text_bytes integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_text_bytes =
                - coalesce(length(old.approved_text), 0)
                - coalesce(length(old.unapproved_text_diff), 0);
            site_id = old.site_id;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_text_bytes =
                + coalesce(length(new.approved_text), 0)
                + coalesce(length(new.unapproved_text_diff), 0)
                - coalesce(length(old.approved_text), 0)
                - coalesce(length(old.unapproved_text_diff), 0);
            site_id = new.site_id;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_text_bytes =
                + coalesce(length(new.approved_text), 0)
                + coalesce(length(new.unapproved_text_diff), 0);
            site_id = new.site_id;
        end if;
        update dw1_tenants
            set num_posts = num_posts + delta_rows,
                num_post_text_bytes = num_post_text_bytes + delta_text_bytes
            where id = site_id;
        return null;
    end;
$dw1_posts_summary$ language plpgsql;

create trigger dw1_posts_summary
after insert or update or delete on dw1_posts
    for each row execute procedure dw1_posts_summary();


--
-- Updates the num posts read summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_posts_read_summary() returns trigger as $dw1_posts_read_summary$
    declare
        delta_rows integer;
        site_id varchar;
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
        update dw1_tenants
            set num_posts_read = num_posts_read + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_posts_read_summary$ language plpgsql;

create trigger dw1_posts_read_summary
after insert or update or delete on dw1_posts_read_stats
    for each row execute procedure dw1_posts_read_summary();


--
-- Updates the num actions summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_actions_summary() returns trigger as $dw1_actions_summary$
    declare
        delta_rows integer;
        delta_text_bytes integer;
        site_id varchar;
    begin
        if (tg_op = 'DELETE') then
            delta_rows = -1;
            delta_text_bytes = - coalesce(length(old.text), 0);
            site_id = old.tenant;
        elsif (tg_op = 'UPDATE') then
            delta_rows = 0;
            delta_text_bytes = coalesce(length(new.text), 0) - coalesce(length(old.text), 0);
            site_id = new.tenant;
        elsif (tg_op = 'INSERT') then
            delta_rows = 1;
            delta_text_bytes = coalesce(length(new.text), 0);
            site_id = new.tenant;
        end if;
        update dw1_tenants
            set num_actions = num_actions + delta_rows,
                num_action_text_bytes = num_action_text_bytes + delta_text_bytes
            where id = site_id;
        return null;
    end;
$dw1_actions_summary$ language plpgsql;

create trigger dw1_actions_summary
after insert or update or delete on dw1_page_actions
    for each row execute procedure dw1_actions_summary();


--
-- Updates the num notfs summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_notfs_summary() returns trigger as $dw1_notfs_summary$
    declare
        delta_rows integer;
        site_id varchar;
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
        update dw1_tenants
            set num_notfs = num_notfs + delta_rows
            where id = site_id;
        return null;
    end;
$dw1_notfs_summary$ language plpgsql;

create trigger dw1_notfs_summary
after insert or update or delete on dw1_notifications
    for each row execute procedure dw1_notfs_summary();


--
-- Updates the num emails sent summary in dw1_tenants on UPDATE, INSERT, DELETE.
--
create or replace function dw1_emails_summary() returns trigger as $dw1_emails_summary$
    begin
        -- Sent emails cannot be made unset, so ignore deletes.
        if (tg_op = 'UPDATE') then
            if (old.sent_on is null and new.sent_on is not null) then
                update dw1_tenants
                    set num_emails_sent = num_emails_sent + 1
                    where id = new.tenant;
            end if;
        elsif (tg_op = 'INSERT') then
            if (new.sent_on is not null) then
                update dw1_tenants
                    set num_emails_sent = num_emails_sent + 1
                    where id = new.tenant;
            end if;
        end if;
        return null;
    end;
$dw1_emails_summary$ language plpgsql;

create trigger dw1_emails_summary
after insert or update or delete on dw1_emails_out
    for each row execute procedure dw1_emails_summary();

