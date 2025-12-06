#!/bin/bash

# This entrypoint makes this:
#
#     psql --host rdb --username postgres
#
# automatically use the right password, by creating a .pgpass file.


# See 'secrets:' in docker-compose.yml.
secret_file="/run/secrets/postgres_password"   # [backup_pg_client_secret]

# `pgclient` looks up the password by finding the row in this file with a
# matching host, port, etc. (All other fields are only used for finding the
# row with the correct password.)
#
# Format is:  hostname:port:database:username:password
#
# (Placing it in /tmp/ is a good habbit, won't persist across restart.)
#
pgpass_file="/tmp/.pgpass"

# Use '*' as database, so we can connect to all, when running pg_dumpall.
echo "rdb:5432:*:postgres:$(cat "$secret_file")" > "$pgpass_file"
chmod 0600 "$pgpass_file"

echo "Created Postgres password file: $pgpass_file."

export PGPASSFILE="$pgpass_file"  # default is ~/.pgpass


echo "Now running CMD:  $@"
exec "$@"

