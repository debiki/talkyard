#!/bin/bash

# Make the password readable by 'postgres'. Later, [ty_v2] [dc_start_hook].
/ty/chown-postgres_password.sh

exec /usr/local/bin/docker-entrypoint.sh "$@"

