
-- Here's how Diesel's migration support table looks. Let's create the table, via a
-- Flyway migration. Then, when running Diesel on an already existing Talkyard
-- database, Diesel will know that it shouldn't run the initial migration that
-- creates all tables etc — it'll see that that's been done, already.
--
-- => \d __diesel_schema_migrations
--                     Table "public.__diesel_schema_migrations"
--  Column  |            Type             | Collation | Nullable |      Default
-- ---------+-----------------------------+-----------+----------+-------------------
--  version | character varying(50)       |           | not null |
--  run_on  | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
-- Indexes:
--     "__diesel_schema_migrations_pkey" PRIMARY KEY, btree (version)
--
-- => select * from __diesel_schema_migrations;
--     version     |           run_on
-- ----------------+----------------------------
--  00000000000000 | 2024-03-19 06:54:07.719415
--  20231116155817 | 2024-03-19 06:54:07.723353
--  20240401110732 | 2024-04-07 07:31:58.360909
-- (3 rows)

-- create table __diesel_schema_migrations (
--   version  character varying(50)        not null,
--   run_on   timestamp without time zone  not null   default CURRENT_TIMESTAMP,
--   constraint __diesel_schema_migrations_pkey primary key (version)
-- );

-- To do:
-- insert into __diesel_schema_migrations (version, run_on) values ( ....);
-- First need to generate a new Ty schema, to see what the values should be.
--


-- Better: This is if generating a new database using `diesel setup`, with
-- Diesel v2.2.7 (latest as of 2025-03-02).

-- But these are in the ...000000.sql migration:
-- CREATE FUNCTION public.diesel_manage_updated_at(_tbl regclass) RETURNS void
--     LANGUAGE plpgsql
--     AS $$
-- BEGIN
--     EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
--                     FOR EACH ROW EXECUTE PROCEDURE diesel_set_updated_at()', _tbl);
-- END;
-- $$;
--
-- CREATE FUNCTION public.diesel_set_updated_at() RETURNS trigger
--     LANGUAGE plpgsql
--     AS $$
-- BEGIN
--     IF (
--         NEW IS DISTINCT FROM OLD AND
--         NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at
--     ) THEN
--         NEW.updated_at := current_timestamp;
--     END IF;
--     RETURN NEW;
-- END;
-- $$;
--
-- SET default_table_access_method = heap;


create table public.__diesel_schema_migrations (
    version character varying(50) not null,
    run_on timestamp without time zone default current_timestamp not null
);

alter table only public.__diesel_schema_migrations
    add constraint __diesel_schema_migrations_pkey primary key (version);

insert into __diesel_schema_migrations (version, run_on) values (
     '00000000000000', '2025-01-01 00:00:01.000000');


-- And  images/app/migrations/00000000000000_diesel_initial_setup/up.sql:

CREATE OR REPLACE FUNCTION diesel_manage_updated_at(_tbl regclass) RETURNS VOID AS $$
BEGIN
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %s
                    FOR EACH ROW EXECUTE PROCEDURE diesel_set_updated_at()', _tbl);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION diesel_set_updated_at() RETURNS trigger AS $$
BEGIN
    IF (
        NEW IS DISTINCT FROM OLD AND
        NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at
    ) THEN
        NEW.updated_at := current_timestamp;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
