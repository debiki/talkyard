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

latest_dump=`ls -t $1 2>/dev/null | grep '\.gz' | head -n1`
if [ -z "$latest_dump" ]; then
  echo 'Error: No database dump files (*.gz) found in: '"$1"
  exit 1
fi

echo "The most recent dumps in $1 are:"
echo "`ls -hlt $1 | grep '\.gz' | head -n5`"
echo

read -r -p "Shall I import $latest_dump into the Docker database container? [Y/n]" response
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


zcat $1/$latest_dump | $psql

echo '... Done importing.'

echo 'Creating (or recreating) debiki_test...'
$psql -c 'drop database if exists debiki_test;'
$psql -c 'drop user if exists debiki_test;'
$psql -c "create user debiki_test with password 'public';"
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
  $psql -c "alter user debiki_dev with password 'public';"
fi

echo "Done. If the web and application servers aren't running, you can start them now:"
echo "  docker-compose start web app"
