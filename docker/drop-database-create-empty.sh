#!/bin/bash

container='server_db_1'

docker inspect -f '{{.State.Running}}' $container >> /dev/null
if [ $? -ne 0 ]; then
  echo "Error: The database Docker container $container is not running."
  echo "You can start it:"
  echo "  docker-compose start db"
  exit 1
fi

read -r -p "This drops debiki_dev, and debiki_test, from Docker database container $container, okay? [Y/n] " response
response=${response,,}    # tolower
if [[ $response =~ ^(no|n)$ ]] ; then
  echo "Oh well, I'll do nothing, bye."
  exit 0
fi

psql="docker exec -i $container psql postgres postgres"

echo 'Dropping dev and test databases...'

$psql -c 'drop database if exists debiki_test;'
$psql -c 'drop user if exists debiki_test;'

$psql -c 'drop database if exists debiki_dev;'
$psql -c 'drop user if exists debiki_dev;'

echo 'Creating a dev and a test database...'

$psql -c 'create user debiki_dev;'
$psql -c 'create database debiki_dev owner debiki_dev;'

$psql -c 'create user debiki_test;'
$psql -c 'create database debiki_test owner debiki_test;'

echo '...Done.'

