#!/bin/bash

# Don't konw why this is needed, but otherwise PostgreSQL logs 99999 messages like:
#   """could not open temporary statistics file "/var/run/postgresql/9.3-main.pg_stat_tmp/global.tmp": No such file or directory"""
# and then dies.
mkdir /var/run/postgresql/9.3-main.pg_stat_tmp/
touch /var/run/postgresql/9.3-main.pg_stat_tmp/global.tmp

/usr/lib/postgresql/9.3/bin/postgres -D /var/lib/postgresql/9.3/main -c config_file=/etc/postgresql/9.3/main/postgresql.conf &

cd /opt/debiki/database/

while [ -z "`netstat -tlpn | grep 5432`" ]; do
  echo 'Waiting for PostgreSQL to start ...'
  sleep 1
done
echo 'PostgreSQL started.'
sleep 2

echo 'The most recent dumps, we will import the latest one:'
echo "`ls -hlt dumps/ | head -n5`"

latest_dump=`ls -t dumps/ | head -n1`

echo "Importing: $latest_dump..."
zcat dumps/$latest_dump | psql
echo '... Done importing.'

# If we happened to import a prod database, rename it to debiki_dev; the config
# files expect that name.
any_prod_row=`psql -c '\l' | grep debiki_prod`
if [ -n "$any_prod_row" ]; then
  echo 'Renaming debiki_prod to debiki_dev...'
  psql -c 'alter database debiki_prod rename to debiki_dev;'
  psql -c 'alter user debiki_prod rename to debiki_dev;'
fi

# We need a test database.
psql -c 'create user debiki_test;'
psql -c 'create database debiki_test owner debiki_test;'
psql -c 'alter role debiki_test set search_path to "$user",public;'


# Done. Once we've exited, 'docker-import-dev-database.sh' will continue with
# committing this container to an image, which will have the database dump imported.
# The script 'docker-start-dev-database.sh' will start a container based on that image.
