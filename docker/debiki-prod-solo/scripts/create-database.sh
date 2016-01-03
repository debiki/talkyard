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
  echo 'Database has already been created.'
else
  echo 'Creating database...'

  psql postgres postgres -c 'create user debiki_prod'
  psql postgres postgres -c 'create database debiki_prod owner debiki_prod;'

  echo '...Database created.'
fi

# In case the PostgreSQL password has been changed:
psql postgres postgres -c "alter user postgres encrypted password '$DEBIKI_POSTGRESQL_PASSWORD';"
psql postgres postgres -c "alter user debiki_prod encrypted password '$DEBIKI_POSTGRESQL_PASSWORD';"

