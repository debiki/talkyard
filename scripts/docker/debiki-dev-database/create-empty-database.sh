#!/bin/bash

# Don't konw why this is needed, but otherwise PostgreSQL logs 99999 messages like:
#   """could not open temporary statistics file "/var/run/postgresql/9.3-main.pg_stat_tmp/global.tmp": No such file or directory"""
mkdir /var/run/postgresql/9.3-main.pg_stat_tmp/
touch /var/run/postgresql/9.3-main.pg_stat_tmp/global.tmp

usr/lib/postgresql/9.3/bin/postgres -D /var/lib/postgresql/9.3/main -c config_file=/etc/postgresql/9.3/main/postgresql.conf &

cd /opt/debiki/database/

while [ -z "`netstat -tlpn | grep 5432`" ]; do
  echo 'Waiting for PostgreSQL to start ...'
  sleep 1
done
echo 'PostgreSQL started.'
sleep 2

echo 'Creating a dev and a test database...'

psql -c 'create user debiki_dev;'
psql -c 'create database debiki_dev owner debiki_dev;'

psql -c 'create user debiki_test;'
psql -c 'create database debiki_test owner debiki_test;'

echo '...Done.'

# Done. Once we've exited, 'docker-create-dev-database.sh' will continue with
# committing this container to an image, which will have an empty database.
# The script 'docker-start-dev-database.sh' will start a container based on that image.
