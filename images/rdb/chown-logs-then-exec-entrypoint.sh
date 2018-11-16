#!/usr/bin/env bash

# Let user postgresql write log files. The log directory is mounted in docker-compose.yml
# and is created as & owned by 'root'. — We chown here, because here we're root, but
# /docker-entrypoint.sh called below will su-exec to 'postgres' (then, not allowed to chown).
chown -R postgres /var/log/postgresql/

# Now continue with the "real" entrypoint, namely
# https://github.com/docker-library/postgres/blob/master/10/alpine/docker-entrypoint.sh:
exec /docker-entrypoint.sh $*

