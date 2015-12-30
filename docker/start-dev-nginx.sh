#!/bin/bash


if [ -z "`docker images | egrep 'debiki-dev-nginx\s+v0\s+'`" ]; then
  echo 'Building debiki-dev-nginx image...'
  docker build -t debiki-dev-nginx:v0 docker/debiki-dev-nginx/
  echo '... Done building debiki-dev-nginx image.'
  sleep 1
  echo ''
fi


echo ',---------------------------------------------------------.'
echo '| Run:  nginx ?????                                       |'
echo '`--------------------------------------------------------'"'"


docker -D run \
  --name debiki-dev-nginx \
  --rm \
  -it \
  -p 80:80  \
  -p 443:443  \
  -v="`pwd`/docker/debiki-dev-nginx/nginx.conf:/etc/nginx/nginx.conf" \
  -v ~/.bash_history:/.bash_history \
  -v ~/.bashrc:/.bashrc \
  debiki-dev-nginx:v0 \
  bash

