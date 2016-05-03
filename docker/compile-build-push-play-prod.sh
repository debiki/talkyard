#!/bin/bash

cat <<EOF
# Do something like:

# Build Play Docker image:
s/s.sh clean
gulp release
s/s.sh dist
sudo docker/build-play-prod.sh

# Build other images:
sudo docker-compose down
sudo docker-compose build

# Push:
sudo docker push debiki/ed-play
sudo docker push debiki/ed-nginx
sudo docker push debiki/ed-postgres
EOF
