#!/bin/bash

# This entrypoint makes this:
#
#     psql --host rdb --username postgres
#
# automatically use the right password, by creating a .pgpass file.


# See 'secrets:' in docker-compose.yml.
secret_file="/run/secrets/postgres_password"   # [backup_pg_client_secret]

if [ ! -f "$secret_file" ]; then
  echo "ERROR: Postgres password file missing: $secret_file"
  echo "Check the 'secrets: ...' section in your docker-compose.yml. Aborting. Bye."
  exit 1
fi

# `pgclient` looks up the password by finding the row in this file with a
# matching host, port, etc. (All other fields are only used for finding the
# row with the correct password.)
#
# Format is:  hostname:port:database:username:password
#
# (Placing it in /tmp/ is a good habbit, won't persist across restart.)
#
pgpass_file="/tmp/.pgpass"

# Use '*' as database and user, so we can connect to all, when running pg_dumpall.
# We use the same Postgres password for all users [same_pg_pw], except for
# any test dataase, which uses 'public'. [test_db_pwd]
cat << EOF > "$pgpass_file"
rdb:5432:*:talkyard_test:public
rdb:5432:*:*:$(cat "$secret_file")
EOF

chmod 0600 "$pgpass_file"

echo "Created Postgres password file: $pgpass_file."

export PGPASSFILE="$pgpass_file"  # default is ~/.pgpass


echo "Now running CMD:  $@"
exec "$@"

