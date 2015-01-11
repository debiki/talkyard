#!/bin/bash

echo "===== Starting Debiki Server, `date '+%F %H:%M:%S'` ====="

# Wait until PostgreSQL started.
while [ -z "`netstat -tln | grep 5432`" ]; do
  echo 'Waiting for PostgreSQL to start...'
  sleep 1
done
echo 'PostgreSQL has started.'
sleep 1

# Wait until database created.
while [ -z "`psql postgres postgres -c '\l' | grep debiki_prod`" ]; do
  echo 'Waiting for database to be created...'
  sleep 1
done
echo 'Database has been created.'
sleep 1

# Start server.
echo 'Starting Debiki server...'
/opt/debiki/server/bin/debiki-server \
  -Dhttp.port=80 \
  -Dconfig.file=/opt/debiki/server/conf/application.conf \
  -Dlogger.file=/opt/debiki/server/conf/prod-logger.xml

