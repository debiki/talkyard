#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

up_line=`docker-compose ps db | egrep '\<Up\>'`
if [ -z "$up_line" ]; then
  echo "Error: The database container is not running."
  echo "You can start it:"
  echo "  docker-compose start db"
  exit 1
fi

read -r -p "This drops debiki_dev, and debiki_test, from Docker database container, okay? [Y/n] " response
response=${response,,}    # tolower
if [[ $response =~ ^(no|n)$ ]] ; then
  echo "Oh well, I'll do nothing, bye."
  exit 0
fi

psql="docker-compose exec db psql postgres postgres"

echo 'Dropping dev and test databases...'

$psql -c 'drop database if exists debiki_test;'
$psql -c 'drop user if exists debiki_test;'

$psql -c 'drop database if exists debiki_dev;'
$psql -c 'drop user if exists debiki_dev;'

echo 'Creating a dev and a test database...'

$psql -c "create user debiki_dev with password 'public';"
$psql -c 'create database debiki_dev owner debiki_dev;'

$psql -c "create user debiki_test with password 'public';"
$psql -c 'create database debiki_test owner debiki_test;'

echo '...Done.'

