#!/bin/bash


if [ -z "`docker images | egrep 'debiki-dev-gulp\s+v0\s+'`" ]; then
  echo 'Building debiki-dev-gulp image...'
  docker build -t debiki-dev-gulp:v0 scripts/docker/debiki-dev-gulp/
  echo '... Done building debiki-dev-gulp image.'
  sleep 1
  echo ''
fi


echo ',---------------------------------------------------------.'
echo '| Run:  gulp watch                                        |'
echo '| But first, if not already done, run:                    |'
echo '|   npm install                                           |'
echo '|   GIT_WORK_TREE=/opt/debiki bower --allow-root install  |'
echo '`--------------------------------------------------------'"'"

# About the Bash command below:
# 1. `useradd ...` adds a user with the same id as the directory owner (i.e. you), named 'owner'.
# 2. `ls -adn | cut -f 3 -d ' '` finds the user id of the above-mentioned directory owner.
# 3. `su owner` drops into a shell as 'owner'.
# Result: When you inside Docker create files via `npm install` or `gulp watch`, these
# files will be owned by the directory owner (i.e. you). Otherwise, from outside
# the container, they'd be onwed by root.
docker run \
  --rm \
  -it \
  --name debiki-dev-gulp \
  -v="`pwd`/../:/opt/debiki/" \
  debiki-dev-gulp:v0 \
  /bin/bash -c \
    'useradd -u `ls -adn | cut -f 3 -d " "` owner ; su owner'


# vim: fdm=marker et ts=2 sw=2 tw=0 list
