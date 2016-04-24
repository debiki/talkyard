#!/bin/bash
# After the PostgreSQL Docker entrypoint has called initdb to create
# the postgres user and database, it runs .sh and .sql files in
# docker-entrypoint-initdb.d/, i.e. this file.
# See: https://github.com/docker-library/docs/tree/master/postgres#how-to-extend-this-image

set -e


# Create an Effective Discussions user, and a replication user.
# ------------------------

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<EOF
create user ed password '$POSTGRES_PASSWORD';
create database ed;
grant all privileges on database ed to ed;

create user repl replication login connection limit 1 encrypted password '$POSTGRES_PASSWORD';
EOF


# Let the replication user connect and replicate
# ------------------------

# `sed -i '/pattern/i...` inserts before the pattern. If inserted after
# "host all all" then apparently it'd have no effect.
sed -i '/host all all 0.0.0.0/i \
host replication repl 0.0.0.0/0 md5' $PGDATA/pg_hba.conf


# Enables streaming replication from this server
# ------------------------

cat << EOF >> $PGDATA/postgresql.conf

#======================================================================
# EDITED SETTINGS
#======================================================================

wal_level = hot_standby

# Each is 16 MB, this means almost 1 GB in total.
wal_keep_segments = 60

# More than 1 in case a connection gets orphaned until wal_sender_timeout
max_wal_senders = 4

# Not needed; we keep & copy WAL segments in pg_xlog instead.
# archive_mode = on
# archive_command = ...

hot_standby = on
EOF


# Help file about how to rsync to slave
# ------------------------

cat << EOF > $PGDATA/enslave-peer.txt
# Docs:
# - https://wiki.postgresql.org/wiki/Binary_Replication_Tutorial
# - https://wiki.postgresql.org/wiki/Streaming_Replication#How_to_Use

# rsync to the standby like so:
# 1) Stop Postgres on the going-to-become standby.
# 2) Rename recovery.conf.disabled or recovery.done to recovery.conf, on the standby.

# 3) rsync:
psql postgres postgres -c "SELECT pg_start_backup('rsync to slave ' || now(), true)"
rsync -acv $PGDATA/ $PEER_HOST:$PGDATA/ --exclude pg_xlog --exclude postmaster.pid --exclude recovery* --exclude failover_trigger_file --exclude backup_label
psql postgres postgres -c "SELECT pg_stop_backup()"

# 4) Optionally: (if too much data has been written to the db during the start-stop-backup above)
rsync -acv $PGDATA/pg_xlog $PEER_HOST:$PGDATA/

# 5) Start the standby.
EOF


# Configure streaming replication *to* this server
# ------------------------
# But don't enable it.

cat << EOF >> $PGDATA/recovery.conf.disabled
# See https://wiki.postgresql.org/wiki/Streaming_Replication, step 10.
# Don't forget to edit the primary_conninfo.

standby_mode   = 'on'
primary_conninfo = 'host=$PEER_HOST port=$PEER_PORT user=repl password=$PEER_PASSWORD'
trigger_file = '$PGDATA/failover_trigger_file'
EOF

