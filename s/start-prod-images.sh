#!/bin/bash

# Abort on any error
set -e

if [ `id -u` -eq 0 ]; then
  echo "You are root. Don't run this as root please. Instead, you'll be asked for the root password only when needed."
  exit 1
fi

my_username=$(whoami)



# Derive version number
# ----------------------

# See this section in: ./build-prod-images.sh

version="$(cat version.txt)-WIP"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala and gulpfile.js [8GKB4W2]

# COULD: verify the year in the version number is the current year (calendar versioning)
# COULD: verify version nr incremented since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD: verify has git-pushed to origin
# COULD: verify is rlease branch
# COULD: verify branch is clean



# Check version number and repo
# ----------------------

last_prod_v=$(tail -n1 relchans/tyse-v0-regular/version-tags.log)
last_dev_v=$( tail -n1 relchans/tyse-v0-dev/version-tags.log)

echo
echo "I'll start wich Talkyard version?"
echo "  [1]  $last_prod_v  (see relchans/tyse-v0-regular/version-tags.log)"
echo "  [2]  $last_dev_v  (see relchans/tyse-v0-dev/version-tags.log)"
#echo "                 or version:  $REPO    (see .env),"
#echo "            release channel:  tyse-v0-dev  (always)"
echo
# dupl code [bashutils]
read -p "Pick one [1/2]?  " choice
case "$choice" in
  1 ) version_tag="$last_prod_v" ;;
  2 ) version_tag="$last_dev_v" ;;
  * ) echo "What? Bye."; exit 1 ;;
esac


echo "Ok, starting version $version_tag"

# Start containers
# ----------------------

export VERSION_TAG=$version_tag
export POSTGRES_PASSWORD=public
export DOCKER_REPOSITORY=debiki

# Dupl line [prod_test_docker_conf], also see ./impl/build-prod-images.sh.
test_containers='docker-compose -p edt -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test/debug.yml -f modules/ed-prod-one-test-override.yml -f docker-compose-no-limits.yml'

echo "Starting:"
echo "$test_containers up -d"

$test_containers up -d

echo ""
echo "Started, containers running. Stop like so:"
echo ""
echo "    export VERSION_TAG=$version_tag"
echo "    $test_containers kill web app search cache rdb"
echo "    $test_containers down"
echo ""


# vim: et ts=2 sw=2 tw=0 list
