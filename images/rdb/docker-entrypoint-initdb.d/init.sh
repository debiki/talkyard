#!/bin/bash

# After the PostgreSQL Docker entrypoint has called initdb to create
# the postgres user and database, it runs .sh and .sql files in
# docker-entrypoint-initdb.d/, i.e. this file — but only if the data directory
# is empty on container startup; any pre-existing database is left untouched.
# See: https://github.com/docker-library/docs/tree/master/postgres#how-to-extend-this-image


# [ty_v1] Maybe store db files in .../data/pgdata/ ?, see:
# https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata
#   -e PGDATA=/var/lib/postgresql/data/pgdata \
#   -v /custom/mount:/var/lib/postgresql/data \
# (Also reinvestigate if better using the official images? e.g.: postgres:13.1)

set -e


# Create a Talkyard user, and a replication user.
# ------------------------

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
create user talkyard password '$POSTGRES_PASSWORD';
create database talkyard;
grant all privileges on database talkyard to talkyard;

create user repl replication login connection limit 1 encrypted password '$POSTGRES_PASSWORD';
EOF


# Create test users: talkyard_test,  keycloak_test
# ------------------------

if [ -n "$CREATE_TEST_USER" ]; then
  # For running Talkyard's integration tests.
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
  create user talkyard_test password 'public';
  create database talkyard_test;
  grant all privileges on database talkyard_test to talkyard_test;
EOF

  # For testing OIDC login via Keycloak — seems importing a Keycloak realm
  # won't work with the h2 database; needs sth like Postgres. [ty_kc_db]
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
  create user keycloak_test password 'public';
  create database keycloak_test owner keycloak_test;
  grant all privileges on database keycloak_test to keycloak_test;
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


# Help file about how to rsync to standby  [ty_v1] move to (ty-prod-one)/docs/
# ------------------------

cat << EOF > $PGDATA/how-rsync-to-standby.txt
# Docs:
# - https://wiki.postgresql.org/wiki/Binary_Replication_Tutorial
# - https://wiki.postgresql.org/wiki/Streaming_Replication#How_to_Use

# rsync to the standby like so:
# 1) Stop Postgres on the going-to-become standby.
# 2) Rename recovery.conf.disabled or recovery.done to recovery.conf, on the standby.

# 3) rsync:
psql postgres postgres -c "SELECT pg_start_backup('rsync to standby ' || now(), true)"
rsync -acv $PGDATA/ $PEER_HOST:$PGDATA/ --exclude pg_xlog --exclude postmaster.pid --exclude recovery* --exclude failover_trigger_file --exclude backup_label
psql postgres postgres -c "SELECT pg_stop_backup()"

# 4) Optionally: (if too much data has been written to the db during the start-stop-backup above)
rsync -acv $PGDATA/pg_xlog $PEER_HOST:$PGDATA/

# 5) Start the standby.
EOF


# Configure streaming replication *to* this server
# ------------------------
# But don't enable it.

# [ty_v1] Postgres v12+: recovery.conf is gone
# now recovery params are in postgresql.conf instead, ignored until in recovery mode.
# standby_mode param deleted.
# Instead, files  recovery.signal  and  standby.signal clarifies what pg should do.
#
# So, move this config to (ty-prod-one)/conf/rdb/postgresql.conf,
# w/o standby_mode, and maybe some fields commented out?

cat << EOF >> $PGDATA/recovery.conf.disabled
# See https://wiki.postgresql.org/wiki/Streaming_Replication, step 10.
# Don't forget to edit the primary_conninfo.

standby_mode   = 'on'
primary_conninfo = 'host=$PEER_HOST port=$PEER_PORT user=repl password=$PEER_PASSWORD'
trigger_file = '$PGDATA/failover_trigger_file'
EOF

