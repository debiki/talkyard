#!/bin/bash
# ideas about what to do:  https://github.com/sbt/sbt-release

# Abort on any error
set -e

if [ `id -u` -eq 0 ]; then
  echo "You are root. Don't run this as root please. Instead, you'll be asked for the root password only when needed."
  exit 1
fi

my_username=$(whoami)


# This'll make us call `exit 1` if there's an error, and we're running all this via a script.
is_in_script=true

# Won't exit if we're doing stuff manually on the command line (because it's annoying
# if the terminal suddenly disappears).
function die_if_in_script {
  if [ -n "$is_in_script" ]; then
    echo "Bye."
    exit 1
  fi
}


# Check preconditions
# ----------------------

# COULD: Check is in project root, & is git repository, & no outstanding changes.
# COULD: Check all required ports open: 80, 443, 900, 9443, 9999, 3333

# Docker installed?
#
if [ -z "$(which docker)" ]; then
  echo
  echo "Docker not installed? Please have a look in docs/getting-started.md."
  echo
  die_if_in_script
fi

# Yarn? [build_needs_yarn]
#
if [ -z "$(which yarn)" ]; then
  echo
  echo "Yarn not installed. Please run this script using Nix-shell,"
  echo "then, Nix will download Yarn for you."
  echo
  die_if_in_script
fi

# Disk full?
#
# This: 'df .' prints sth like:
# >  Filesystem     1K-blocks     Used Available Use% Mounted on
# >  /dev/xvdb       35935776 29687256   6232136  83% /home
#
disk_almost_full=$( df . | tail -n1 | awk '{ print $5 }' \
    | sed -n 's/9[3-9]%/DISK_ALMOST_FULL/p' )
if [ -n "$disk_almost_full" ]; then
  echo
  echo "Disk almost full,  'df .' reports:"
  echo
  df .
  echo
  echo "More than 93% in use, and ElasticSearch will stop working, if >= 95%."
  echo "It'll log errors like: \"flood stage disk watermark [95%] exceeded"
  echo "[...] all indices on this node will marked read-only\"."
  echo "And the build will fail."
  echo
  echo "Free up some disk, please."
  echo
  die_if_in_script
fi

# Other things going on that could mess up the build?
if [ -n "`jobs`" ]; then
  echo 'Other jobs running:'
  jobs
  echo 'Please stop them.'
  die_if_in_script
fi



# Push to which Docker repository?
# ----------------------

REPO=`sed -nr 's/^DOCKER_REPOSITORY=([a-zA-Z0-9\._-]*).*/\1/p' .env`

# # The registry is running?
# nc my.example.com 80 < /dev/null
#
# if [ $?  is error status 1,  or if   -z "$REPO" ]; then
if [ -z "$REPO" ]; then
  echo
  echo "DOCKER_REPOSITORY line missing in .env file?"
  echo
  echo "To which Docker repository do you want to push?"
  echo "Edit the file .env in this directory, and specify a repository, e.g.:"
  echo
  echo "    DOCKER_REPOSITORY=debiki"
  echo
#   echo "You can start a test Docker registry at localhost:5000 like so:"
#   echo
#   echo "  sudo docker run -d -p 5000:5000 --name myregistry registry:2"
#   echo
#   echo "See docs/testing-images-in-vagrant.md, and"
#   echo "https://docs.docker.com/registry/deploying/ for details."
#   echo
  die_if_in_script
fi



# Start Selenium server
# ----------------------

#if [ -z "`which xvfb-run`" ]; then
#  echo
#  echo 'Note:'
#  echo 'xvfb not installed, cannot run tests headlessly. To install it:'
#  echo 'run:  sudo apt-get install xvfb'
#  echo '(works on Linux only, perhaps Mac)'
#  echo
#fi
#
#chromedrivers="$(ls -1 node_modules/selenium-standalone/.selenium/chromedriver/)"
#if [ -z "$chromedrivers" ]; then
#  echo 'You need to install browser drivers for End-to-End tests. Do in another shell:
#
#  s/selenium-install
#'
#  die_if_in_script
#fi


test_selenium_up='curl --output /dev/null --silent --fail http://127.0.0.1:4444'
if $($test_selenium_up) ; then
  echo
  echo 'Selenium already running, fine.'
  echo
else
  echo "Do in another shell: (so I can run end-to-end tests)"
  echo
  echo "    d/selenium"
  echo
  echo "Waiting for you ..."
  until $($test_selenium_up); do
    printf '.'
    sleep 2
  done
  echo
  echo 'Selenium running, thanks.'
  echo
fi



# Derive version number
# ----------------------

version="$(cat version.txt)"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala and gulpfile.js [8GKB4W2]

# COULD: verify the year in the version number is the current year (calendar versioning)
# COULD: verify version nr incremented since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD: verify has git-pushed to origin
# COULD: verify is rlease branch
# COULD: verify branch is clean



# Check version number and repo
# ----------------------

echo
echo "I'll build Talkyard version:  $version_tag   (see version.txt),"
echo "    and push to Docker repo:  $REPO    (see .env),"
echo "            release channel:  tyse-v0-dev  (always)"
echo
# dupl code [bashutils]
read -p "Continue [y/n]?  " choice
case "$choice" in
  y|Y|yes|Yes|YES ) echo "Ok, continuing."; echo ;;
  n|N|no|No|NO ) echo "Bye then. Doing nothing."; exit 1;;
  * ) echo "What? Bye."; exit 1;;
esac



# Build and run tests
# ----------------------

rm -f ./target/build-exit-status

set -x
nix-shell --run "./s/impl/build-prod-images.sh $version_tag $*"
echo $? | tee ./target/build-exit-code
set +x

build_exit_status=`cat ./target/build-exit-status`
#build_exit_code=`cat ./target/build-exit-code`

echo
echo "Build result: $build_exit_status, exit code: $build_exit_code"

if [ "$build_exit_status" != 'BUILD_OK' ]; then
  echo
  echo Build failed. Aborting.
  echo
  die_if_in_script
fi

echo 'Buid completed.'



# Publish images to Docker repo
# ----------------------


echo "You can now tag and publish the images to the '$REPO' Docker repository:"
echo ""
echo "    make  tag-and-push-latest-images  tag=$version_tag"
echo "    make  push-tag-to-git  tag=$version_tag"
echo "    s/bump-versions.sh"
echo ""


# vim: et ts=2 sw=2 tw=0 list
