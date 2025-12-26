#!/bin/bash

# Make the password readable by 'appuser'. [ty_v2] [dc_start_hook]
/ty/chown-postgres_password.sh
#------------------
# Later, when 'post_start' is guaranteed to be supported by
# the Docker Compose plugin everywhere:
if [ -z "commented out" ]; then
# The post_start hook copies the password and makes it readable to the app server,
# but the hook doesn't run immediately. [appuser_id_1000]
pw_file=/tmp/postgres_password
echo "Entrypoint: Waiting for Postgres password in $pw_file..."
while [ ! -s $pw_file ]; do
  sleep 0.2
done
echo "Entrypoint: Postgres password found. Starting ..."
fi
#------------------

exec gosu appuser "$@"

