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

if [ -n "`jobs`" ]; then
  echo 'Other jobs running:'
  jobs
  echo 'Please stop them.'
  die_if_in_script
fi



# Push to which Docker repository?
# ----------------------

REPO=`sed -nr 's/DOCKER_REPOSITORY=([a-zA-Z0-9\._-]*).*/\1/p' .env`

# # The registry is running?
# nc my.example.com 80 < /dev/null
#
# if [ $?  is error status 1,  or if   -z "$REPO" ]; then
#   echo
#   echo "To which Docker repository do you want to push?"
#   echo "Edit the file .env in this directory, and specify a repository."
#   echo
#   echo "You can start a test Docker registry at localhost:5000 like so:"
#   echo
#   echo "  sudo docker run -d -p 5000:5000 --name myregistry registry:2"
#   echo
#   echo "See docs/testing-images-in-vagrant.md, and"
#   echo "https://docs.docker.com/registry/deploying/ for details."
#   echo
#   die_if_in_script
# fi



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


test_selenium_up='curl --output /dev/null --silent --head --fail http://127.0.0.1:4444'
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

version="`cat version.txt`"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala and gulpfile.js [8GKB4W2]

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD: verify has git-pushed to origin
# COULD: verify is master branch?
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr



# Check version number and repo
# ----------------------

echo
echo "About to build version:  $version_tag   (see version.txt),"
echo "for pushing to Docker repository:  $REPO  (see .env)."
echo
echo "Press Enter to continue, or CTRL+C to exit"
read -s -p ''



# Build and run tests
# ----------------------

current_dir=`pwd`

sudo -i bash << EOF_SUDO

cd $current_dir
rm -f ./target/build-exit-status

./s/impl/build-prod-images.sh $my_username $version_tag $@
echo "\$?" | tee ./target/build-exit-code

EOF_SUDO

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
