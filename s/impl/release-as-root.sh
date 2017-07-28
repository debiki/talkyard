#!/bin/bash

# Abort on any error
set -e

my_username="$1"
version_tag="$2"
shift
shift

if [ -z "$version_tag" ]; then
  echo "No version_tag parameter. Usage:  $0 your-username version-tag"
  echo "Bye."
  exit 1
fi

# Docker-compose will mount $HOME/.ivy2 and $HOME/.m2, and we want to mount
# $my_username's Ivy and Maven cache dirs, so change $HOME from /root/ to:
export HOME=/home/$my_username

echo "
Building: $version_tag
With username: $my_username
And HOME: $HOME
Other args: $@
"


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


# Check everything is OK
# ----------------------

s/d kill web app
s/d down

if [ -n "`docker ps -q`" ]; then
  echo "Docker containers are running, please stop them. Look:"
  docker ps
  echo
  die_if_in_script
fi



# Build Docker images
# ----------------------

s/d build

# Optimize assets, run unit & integration tests and build the Play Framework image
# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
s/d-gulp release

# Delete unminified files, so Docker diffs a few MB smaller.
find public/res/ -type f -name '*\.js' -not -name '*\.min\.js' -not -name 'zxcvbn\.js' | xargs rm
find public/res/ -type f -name '*\.css' -not -name '*\.min\.css' | xargs rm
# COULD add tests that verifies the wrong css & js haven't been deleted?
# One at a time, or out-of-memory:

s/d-cli clean compile
s/d-cli test dist

s/d kill web app
s/d down
docker/build-app-prod.sh



# Run End-to-End tests
# ----------------------

s/d-gulp build-e2e

# Run the 'latest' tag — it's for the images we just built above.
# '-p edt' = EffectiveDiscussions Test project.
# Use the -no-limits.yml file, because we'll run performance tests.
export VERSION_TAG=latest
export POSTGRES_PASSWORD=public
test_containers='docker-compose -p edt -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test/debug.yml -f modules/ed-prod-one-test-override.yml -f docker-compose-no-limits.yml'
$test_containers down
rm -fr modules/ed-prod-one-test/data
$test_containers up -d

if [ -n "`jobs`" ]; then
  echo 'Other jobs running:'
  jobs
  echo 'Please stop them.'
  die_if_in_script
fi


# Run e2e tests, but not as root.
# To stop these e2e tests, you need to 'sudo -i' in another shell, then 'ps aux | grep e2e'
# and then kill the right stuff.
su $my_username -c "s/run-e2e-tests.sh --prod $@ ; echo \$? > ./target/e2e-tests-exit-code"

e2e_tests_exit_code=`cat ./target/e2e-tests-exit-code`

if [ "$e2e_tests_exit_code" != '0' ]; then
  echo
  echo E2E tests failed. Aborting.
  echo
  die_if_in_script
fi



# # Test performance
# # -----------------
# 
# # (The perf test repo is currenty private)
# 
# pushd .
# cd ../ed-perf-test/
# ./test-performance.sh
# perf_test_result=$?
# 
# popd
# 
# if [ $perf_test_result -ne 0 ]; then
#   die_if_in_script
# fi



# # Test rate & bandwidth limits
# # ----------------------
# 
# # Start the containers, but *with* rate limits this time.
# sudo $test_containers kill web
# sudo $test_containers down
# 
# # Run tests ... ensure gets 503 Service Unavailable ...
# # To do ...



# All done
# ----------------------

$test_containers kill web app
$test_containers down

# If any Docker container is running now, something is amiss.
if [ -n "`docker ps -q`" ]; then
  echo
  echo "Some Docker stuff is still running. Why? Weird. Aborting."
  echo
  die_if_in_script
fi

echo
echo "Done building and testing $version_tag."
echo
exit 0


# vim: et ts=2 sw=2 tw=0 list
