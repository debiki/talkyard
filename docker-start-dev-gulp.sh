#!/bin/bash

echo ',---------------------------------------------------------.'
echo '| Run:  gulp watch                                        |'
echo '| But first, if not already done, run:                    |'
echo '|   npm install                                           |'
echo '|   GIT_WORK_TREE=/opt/debiki bower --allow-root install  |'
echo '`--------------------------------------------------------'"'"

docker run \
  --rm \
  -it \
  --name debiki-dev-gulp \
  -v="`pwd`/../:/opt/debiki/" \
  debiki-dev-gulp:v0 \
  /bin/bash


# vim: fdm=marker et ts=2 sw=2 tw=0 list
