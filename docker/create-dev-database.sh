#!/bin/bash

if [ "$#" != "1" ] || [ $1 = "-h" ] || [ $1 = "--help" ]; then
  echo "Usage: $0 /path/to/dumps/ | --empty-database"
  echo ""
  echo " - If you specify a directory path: the most recent dump in that directory"
  echo "   will be imported. The path must be absolute."
  echo " - If you specify --empty-database: an empty database will be created."
  echo ""
  echo "In either case, any already existing database will be deleted and gone."
  exit 1
fi

dump_path="$1"
version=v0

# Stop and delete any old dev database container.
any_row=`docker ps | grep debiki-dev-database-container`
if [ -n "$any_row" ]; then
  echo 'Stopping old debiki-dev-database container...'
  docker stop debiki-dev-database-container
fi
any_row=`docker ps -a | grep debiki-dev-database-container`
if [ -n "$any_row" ]; then
  echo 'Deleting old debiki-dev-database container...'
  docker rm debiki-dev-database-container
fi

# Delete any old temporary container used when importing the dump.
any_row=`docker ps -a | grep debiki-dev-database-temp`
if [ -n "$any_row" ]; then
  echo 'Deleting debiki-dev-database-temp container...'
  docker rm debiki-dev-database-temp
fi

# Create empty database image if not already done.
any_row=`docker images | grep debiki-dev-database-empty | grep $version`
if [ -z "$any_row" ]; then
  echo 'Building debiki-dev-database image...'
  docker build -t debiki-dev-database-empty:$version docker/debiki-dev-database/
fi

# But delete any old image with a dump already imported -- we're going to
# create it again with a new dump imported.
any_row=`docker images | grep debiki-dev-database-data | grep $version`
if [ -n "$any_row" ]; then
  echo 'Deleting old debiki-dev-database-data image...'
  docker rmi debiki-dev-database-data:$version
fi

if [ "$dump_path" = "--empty-database" ]; then
  echo 'Creating temporary container and an empty database...'
  docker run \
    --name debiki-dev-database-temp \
    -p 5432:5432 \
    debiki-dev-database-empty:$version \
    bash /opt/debiki/database/create-empty-database.sh
else
  echo 'Creating temporary container and importing database dump...'
  docker run \
    --name debiki-dev-database-temp \
    -p 5432:5432 \
    -v $dump_path:/opt/debiki/database/dumps/ \
    debiki-dev-database-empty:$version \
    bash /opt/debiki/database/import-latest-dump.sh
fi

echo 'Committing temporary container to image...'
docker commit -m 'Import data.' -a 'Bash script' debiki-dev-database-temp debiki-dev-database-data:$version
docker rm debiki-dev-database-temp

echo 'Done. You can now run ./docker-start-dev-database.sh'
# vim: fdm=marker et ts=2 sw=2 tw=0 list
