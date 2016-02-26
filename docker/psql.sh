#!/bin/bash

docker ps >> /dev/null
if [ $? -eq 1 ] ; then
  echo "If the Docker daemon *is* running — then you can try with 'sudo'?"
  exit 1
fi

container='server_db_1'

docker inspect -f '{{.State.Running}}' $container >> /dev/null
if [ $? -ne 0 ]; then
  echo "Error: The database Docker container $container is not running."
  echo "You can start it:"
  echo "  docker-compose start db"
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Error: I didn't get exactly 2 parameters"
  echo "Usage: docker/psql.sh database username"
  exit 1
fi

docker exec -it $container psql $1 $2

