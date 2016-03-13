#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

container='server_db_1'

if [ "$#" -ne 1 ]; then
  echo "Error: I didn't get exactly one parameter"
  echo "Usage: docker/drop-database-import-latest.sh path/to/directory"
  exit 1
fi

echo "The most recent dumps in $1 are:"
echo "`ls -hlt $1 | head -n5`"
echo

latest_dump=`ls -t $1 | head -n1`

read -r -p "Shall I import $latest_dump into container $container? [Y/n]" response
response=${response,,}    # tolower
if [[ $response =~ ^(no|n)$ ]] ; then
  echo "I'll do nothing then, bye."
  exit 0
fi

docker inspect -f '{{.State.Running}}' $container >> /dev/null
if [ $? -ne 0 ]; then
  echo "Error: The database Docker container $container is not running."
  echo "You can start it:"
  echo "  docker-compose start db"
  exit 1
fi

psql="docker exec -i $container psql postgres postgres"

zcat $1/$latest_dump | $psql

echo '... Done importing.'

echo 'Creating (or recreating) debiki_test...'
$psql -c 'drop database if exists debiki_test;'
$psql -c 'drop user if exists debiki_test;'
$psql -c 'create user debiki_test;'
$psql -c 'create database debiki_test owner debiki_test;'
echo '... Done recreating debiki_test.'

# If we happened to import a prod database, rename it to debiki_dev; the config
# files expect that name.
any_prod_row=`$psql -c '\l' | grep debiki_prod`
if [ -n "$any_prod_row" ]; then
  read -r -p "Shall I rename debiki_prod to debiki_dev, and drop any current debiki_dev? [Y/n]" response
  response=${response,,}    # tolower
  if [[ $response =~ ^(no|n)$ ]] ; then
    echo "I won't rename it then. Bye."
    exit 0
  fi
  echo 'Renaming debiki_prod to debiki_dev...'
  $psql -c 'drop database if exists debiki_dev;'
  $psql -c 'drop user if exists debiki_dev;'
  $psql -c 'alter database debiki_prod rename to debiki_dev;'
  $psql -c 'alter user debiki_prod rename to debiki_dev;'
fi

echo "Done. If the Play server isn't running, you can start it now:"
echo "  docker-compose start play"
