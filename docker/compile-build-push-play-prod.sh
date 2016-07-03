#!/bin/bash

cat <<EOF
# Do something like:

# Build the app server Docker image:
s/s.sh clean
gulp release
s/s.sh dist
sudo docker/build-app-prod.sh

# Build other images:
sudo docker-compose down
sudo docker-compose build

# Push:
sudo docker push debiki/ed-app
sudo docker push debiki/ed-web
sudo docker push debiki/ed-rdb
EOF
