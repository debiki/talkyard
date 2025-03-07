
-- Not using Flyway any more. We're using sqlx instead. But new installations
-- haven't been using Flyway ever (they started instead with sqlx migration 0001),
-- so these tables might not exist.
--
drop table if exists flyway_schema_history;
drop table if exists schema_version;

