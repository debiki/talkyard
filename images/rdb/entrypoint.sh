#!/bin/bash

# Make the password readable by 'postgres'. Later, [ty_v2] [dc_start_hook].
# Abort on any no-password error.
set -e
/ty/chown-postgres_password.sh
set +e

exec /usr/local/bin/docker-entrypoint.sh "$@"

