
-- In Talkyard v1, we'll use sqlx for database migrations. See decisions.adoc.
--
-- But we don't want to run sqlx migration 0001 in an already existing Talkyard
-- database.  That migration creates all as of today existing Talkyard tables,
-- triggers, domains, etc.  But in an already existing database, all that stuff
-- has been created already (and contains data).
--
-- So, we'll make sqlx believe we've run migration 0001 already, by creating
-- the sqlx migrations table ourselves (in this Flyway migration). And, further
-- below, insert a row that tells sqlx that we've run that migration already.

create table _sqlx_migrations (
    version bigint not null,
    description text not null,
    installed_on timestamp with time zone default now() not null,
    success boolean not null,
    checksum bytea not null,
    execution_time bigint not null,

    constraint _sqlx_migrations_pkey primary key (version)
);


-- Add a row that tells sqlx that migration 0001 has been run already.
--
-- (The checksum was calculated by sqlx, for the future 0001_base_schema.up.sql migration
-- file — I ran sqlx on an empty database, to find out what values incl checksum it'd
-- insert into the table.  I edited the date and execution time.)
--
insert into _sqlx_migrations (
    version, description, installed_on, success, checksum, execution_time)
values (
    1,
    'base schema',
    '2025-01-01 00:00:01.00000+00',
    true,
    '\x1df69b9e14798ec3c2b787a101200104a4e19f2ec6f590db230eba270761e696c87a8beca9b566d4c7259335ac1020ef'::bytea,
    123454321);

