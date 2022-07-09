#!/usr/bin/env bash

# Run from the project root directory.

set -e # exit on any error.
set -x

version="`cat version.txt | sed s/WIP/SNAPSHOT/`"
repo=`sed -nr 's/DOCKER_REPOSITORY=([a-zA-Z0-9\._-]*).*/\1/p' .env`

rm -fr target/docker-app-prod
mkdir -p target/docker-app-prod
cp -a images/app/{Dockerfile.prod,assets} target/docker-app-prod/
cp version.txt target/docker-app-prod/
cd target/docker-app-prod
cp ../universal/talkyard-server-$version.zip ./
unzip -q talkyard-server-$version.zip
mv talkyard-server-$version app

# ( &> redirects both stderr and stdout.)
mkdir build-info
date --utc --iso-8601=seconds | tee build-info/docker-image-build-date.txt
git rev-parse HEAD | tee build-info/git-revision.txt
git log --oneline -n100 | tee build-info/git-log-oneline.txt
git status | tee build-info/git-status.txt
git diff | tee -a build-info/git-diff.txt
git describe --tags | tee build-info/git-describe-tags.txt
# This fails if there is no tag, so disable exit-on-error.
set +e
git describe --exact-match --tags | tee build-info/git-describe-exact-tags.txt
set -e

# Move our own JARs do a separate folder, so they can be copied in a separate Dockerfile
# COPY step, so that when pushing/pulling to/from Docker Hub, only the very last COPY will
# usually have to be pushed (and pulled by others).
mkdir app-lib-talkyard
mv app/lib/*debiki* app-lib-talkyard/
mv app/lib/*talkyard-server* app-lib-talkyard/
mv app/bin app-bin
mv app/conf app-conf

# This readme is for the development repo. Create another one, if any, for prod.
rm app/README.md

docker build --tag=$repo/talkyard-app:latest --file Dockerfile.prod .

echo "Image tag: $repo/talkyard-app:latest"
