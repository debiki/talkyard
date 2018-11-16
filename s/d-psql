#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

up_line=`docker-compose ps rdb | egrep '\<Up\>'`
if [ -z "$up_line" ]; then
  echo "Error: The database Docker container 'rdb' is not running."
  echo "You can start it:"
  echo "  docker-compose start rdb"
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Error: I didn't get exactly 2 parameters"
  echo "Usage: docker/psql.sh database username"
  exit 1
fi

docker-compose exec rdb psql $1 $2

