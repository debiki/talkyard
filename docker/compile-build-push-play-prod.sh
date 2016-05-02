#!/bin/bash

cat <<EOF
# Do something like:

# Build Play Docker image:
s/s.sh clean
gulp release
s/s.sh dist
docker/build-play-prod.sh 

# Build other images:
docker-compose stop
docker-compose down
docker-compose build

# Push:
docker push debiki/ed-play
docker push debiki/ed-nginx
docker push debiki/ed-postgres
EOF
