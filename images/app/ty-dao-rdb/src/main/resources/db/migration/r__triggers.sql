
CREATE or replace FUNCTION emails3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION identities3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION notfs3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION pages3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION post_read_stats3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION page_users3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION users3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION post_actions3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION posts3_sum_quota() RETURNS trigger
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


CREATE or replace FUNCTION post_revs3_sum_quota() RETURNS trigger
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


drop trigger if exists emails3_sum_quota on emails_out3;
CREATE TRIGGER emails3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON emails_out3 FOR EACH ROW EXECUTE PROCEDURE emails3_sum_quota();


drop trigger if exists identities3_sum_quota on identities3;
CREATE TRIGGER identities3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON identities3 FOR EACH ROW EXECUTE PROCEDURE identities3_sum_quota();


drop trigger if exists notfs3_sum_quota on notifications3;
CREATE TRIGGER notfs3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON notifications3 FOR EACH ROW EXECUTE PROCEDURE notfs3_sum_quota();


drop trigger if exists pages3_sum_quota on pages3;
CREATE TRIGGER pages3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON pages3 FOR EACH ROW EXECUTE PROCEDURE pages3_sum_quota();


drop trigger if exists post_read_stats3_sum_quota on post_read_stats3;
CREATE TRIGGER post_read_stats3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON post_read_stats3 FOR EACH ROW EXECUTE PROCEDURE post_read_stats3_sum_quota();


drop trigger if exists page_users3_sum_quota on page_users3;
CREATE TRIGGER page_users3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON page_users3 FOR EACH ROW EXECUTE PROCEDURE page_users3_sum_quota();


drop trigger if exists users3_sum_quota on users3;
CREATE TRIGGER users3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON users3 FOR EACH ROW EXECUTE PROCEDURE users3_sum_quota();


drop trigger if exists post_actions3_sum_quota on post_actions3;
CREATE TRIGGER post_actions3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON post_actions3 FOR EACH ROW EXECUTE PROCEDURE post_actions3_sum_quota();


drop trigger if exists posts3_sum_quota on posts3;
CREATE TRIGGER posts3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON posts3 FOR EACH ROW EXECUTE PROCEDURE posts3_sum_quota();


drop trigger if exists post_revs3_sum_quota on post_revisions3;
CREATE TRIGGER post_revs3_sum_quota AFTER INSERT OR DELETE OR UPDATE ON post_revisions3 FOR EACH ROW EXECUTE PROCEDURE post_revs3_sum_quota();


