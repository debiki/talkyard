#!/bin/bash

# The post_start hook copies the password and makes it readable to the app server,
# but the hook doesn't run immediately. [appuser_id_1000]
pw_file=/tmp/postgres_password
echo "Entrypoint: Waiting for Postgres password in $pw_file..."
while [ ! -s $pw_file ]; do
  sleep 0.2
done
echo "Entrypoint: Postgres password found. Starting ..."

exec "$@"

