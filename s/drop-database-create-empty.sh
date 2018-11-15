#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

up_line=`docker-compose ps rdb | egrep '\<Up\>'`
if [ -z "$up_line" ]; then
  echo "Error: The database container is not running."
  echo "You can start it:"
  echo "  docker-compose start rdb"
  exit 1
fi

read -r -p "This drops talkyard and talkyard_test from Docker database container, okay? [Y/n] " response
response=${response,,}    # tolower
if [[ $response =~ ^(no|n)$ ]] ; then
  echo "I'll do nothing then. Bye."
  exit 0
fi

psql="docker-compose exec rdb psql postgres postgres"

echo 'Dropping dev and test databases...'

$psql -c 'drop database if exists talkyard_test;'
$psql -c 'drop user if exists talkyard_test;'

$psql -c 'drop database if exists talkyard;'
$psql -c 'drop user if exists talkyard;'

echo 'Creating a dev and a test database...'

$psql -c "create user talkyard with password 'public';"
$psql -c 'create database talkyard owner talkyard;'

$psql -c "create user talkyard_test with password 'public';"
$psql -c 'create database talkyard_test owner talkyard_test;'

echo '...Done.'

