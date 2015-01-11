#!/bin/bash

echo "===== Perhaps creating database, `date '+%F %H:%M:%S'` ====="

# Wait until PostgreSQL started.
while [ -z "`netstat -tln | grep 5432`" ]; do
  echo 'Waiting for PostgreSQL to start...'
  sleep 1
done
echo 'PostgreSQL has started.'
sleep 1

if [ -n "`psql postgres postgres -c '\l' | grep debiki_prod`" ]; then
  echo 'Database has already been created, doing nothing.'
  exit
fi

echo 'Creating database...'

psql postgres postgres -c 'create user debiki_test;'
psql postgres postgres -c 'create database debiki_test owner debiki_test;'

psql postgres postgres -c 'create user debiki_prod;'
psql postgres postgres -c 'create database debiki_prod owner debiki_prod;'

echo '...Database created.'

