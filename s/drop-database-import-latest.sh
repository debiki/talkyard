#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "Error: I didn't get exactly one parameter"
  echo "Usage: docker/drop-database-import-latest.sh path/to/directory"
  exit 1
fi

if [ ! -d "$1" ]; then
  echo "Error: No such directory: $1"
  exit 1
fi

latest_dump=`ls -t $1 2>/dev/null | grep '.*postgres.*\.gz' | head -n1`
if [ -z "$latest_dump" ]; then
  echo 'Error: No database dump files (*.gz) found in: '"$1"
  exit 1
fi

echo
echo "Looking at: $1 ..."
echo
echo "The most recent database and config dumps are:"
echo "`ls -hlt $1 | grep '\.gz' | head`"
echo

latest_uploads_dump=`ls -t $1 2>/dev/null | grep 'uploads-up-to-incl-.*\.d' | head -n1`
echo "The most recent uploaded files dump dirs:"
echo "`ls -hlt $1 | grep 'uploads-up-to-incl-.*\.d' | head`"
echo

echo "Shall I import:
   $latest_dump
   $latest_uploads_dump"
read -r -p "into the Docker database container, and uploads directory? [Y/n]" response
response=${response,,}    # tolower
if [[ $response =~ ^(no|n)$ ]] ; then
  echo "I'll do nothing then, bye."
  exit 0
fi

up_line=`docker-compose ps rdb | egrep '\<Up\>'`
if [ -z "$up_line" ]; then
  echo "Error: The database container is not running."
  echo "You can start it:"
  echo "  docker-compose start rdb"
  exit 1
fi


# Create a psql command that runs in the container.
# But 'docker-compose exec ...' apparently doesn't read from stdin. Instead use 'docker exec ...':
container=`sudo docker-compose ps rdb | grep ' Up ' | awk '{print $1}'`
if [ -z "$container" ]; then
  echo "Error: Database container not found."
  exit 1
fi
psql="docker exec -i $container psql postgres postgres"


echo
echo "Importing database:"
echo
echo "    zcat ${1}$latest_dump | $psql"
echo

zcat ${1}$latest_dump | $psql

echo '... Done importing.'


echo 'Creating (or recreating) talkyard_test...'
$psql -c 'drop database if exists talkyard_test;'
$psql -c 'drop user if exists talkyard_test;'
$psql -c "create user talkyard_test with password 'public';"
$psql -c 'create database talkyard_test owner talkyard_test;'
echo '... Done recreating talkyard_test.'
echo

if [ -z "$latest_uploads_dump" ]; then
  echo "Didn't find any uploads dir to import."
else
  echo "Rsyncing uploads:"
  echo
  cmd="rsync -av ${1}$latest_uploads_dump/ volumes/uploads/"
  echo "    $cmd"
  echo

  $cmd

  echo "... Done rsyncing uploads."
fi

echo
echo "Done. You can start the web and application servers like so:"
echo
echo "    make up"
echo
echo "But first you need to change the database password? For example:"
echo
echo "    sql> alter user talkyard password 'public';"
echo
echo "So, let's start psql, the PostgreSQL database command line client:"
echo
echo "make db-cli"

make db-cli

