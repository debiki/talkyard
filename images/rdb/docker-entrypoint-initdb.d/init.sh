#!/bin/bash

# After the PostgreSQL Docker entrypoint has called initdb to create
# the postgres user and database, it runs .sh and .sql files in
# docker-entrypoint-initdb.d/, i.e. this file — but only if the data directory
# is empty on container startup; any pre-existing database is left untouched.
# See: https://github.com/docker-library/docs/tree/master/postgres#how-to-extend-this-image

echo "Running /docker-entrypoint-initdb.d/init.sh as user:  $(id)"

pg_pwd_file=/tmp/postgres_password   # [same_pg_pw]

if [ -s $pg_pwd_file ]; then
  echo "Picking Postgres password from Docker secrets file: $pg_pwd_file"
  pg_pwd="$(cat $pg_pwd_file)"
else
  echo "ERROR: Postgres password file missing or empty: $secret_file"
  echo "Check the 'secrets: ...' section in your docker-compose.yml. Aborting. Bye."
  exit 1
fi

# So ':pg_pwd' works in psql commands.
export pg_pwd

set -e


# Create a Talkyard user, and a replication user.
# ------------------------

psql -v pg_pwd="$pg_pwd" -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
create user repl replication login connection limit 1 encrypted password :'pg_pwd';

create user talkyard password :'pg_pwd';
create database talkyard;
grant all privileges on database talkyard to talkyard;
-- Grant 'create' to user 'talkyard' so it can run database migrations. (Otherwise,
-- only the database owner (postgres) can run DDL, e.g. create and alter tables.)
\c talkyard
grant create on schema public to talkyard;
EOF


# Create test users: talkyard_test,  keycloak_test
# ------------------------

if [ -n "$CREATE_TEST_USER" ]; then
  # For running Talkyard's integration tests.
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
  create user talkyard_test password 'public';  -- [test_db_pwd]
  create database talkyard_test;
  grant all privileges on database talkyard_test to talkyard_test;
  \c talkyard_test
  grant create on schema public to talkyard_test;
EOF

  # For testing OIDC login via Keycloak — seems importing a Keycloak realm
  # won't work with the h2 database; needs sth like Postgres. [ty_kc_db]
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
  create user keycloak_test password 'public';  -- [test_db_pwd]
  create database keycloak_test owner keycloak_test;
  grant all privileges on database keycloak_test to keycloak_test;
  \c keycloak_test
  grant create on schema public to keycloak_test;
EOF
fi


# Let the replication user connect and replicate
# ------------------------

# `sed -i '/pattern/i...` inserts before the pattern. If inserted after
# "host all all" then apparently it'd have no effect.
sed -i '/host all all 0.0.0.0/i \
host replication repl 0.0.0.0/0 md5' $PGDATA/pg_hba.conf


# Config file
# ------------------------

# This makes: /var/lib/postgresql/data/postgresql.conf
# include:    /var/lib/postgresql/conf/postgresql.conf  (note: conf/ not data/)
# which is:   (ty-prod-one-git-repo)/conf/rdb/postgresql.conf

mv $PGDATA/postgresql.conf $PGDATA/postgresql.conf.orig

cat << EOF >> $PGDATA/postgresql.conf
include '/var/lib/postgresql/conf/postgresql.conf'
EOF


