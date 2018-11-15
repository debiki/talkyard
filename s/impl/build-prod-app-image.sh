#!/usr/bin/env bash

# Run from the project root directory.

set -e # exit on any error.
set -x

version="`cat version.txt | sed s/WIP/SNAPSHOT/`"

rm -fr target/docker-app-prod
cp -a docker/app/Dockerfile.prod target/docker-app-prod/
cd target/docker-app-prod
cp ../universal/talkyard-server-$version.zip ./
unzip -q talkyard-server-$version.zip
mv talkyard-server-$version app

# ( &> redirects both stderr and stdout.)
mkdir build-info
date --utc --iso-8601=seconds > build-info/docker-image-build-date.txt
git rev-parse HEAD &> build-info/git-revision.txt
git log --oneline -n100 &> build-info/git-log-oneline.txt
git status &> build-info/git-status.txt
git diff &> build-info/git-diff.txt
git describe --tags &> build-info/git-describe-tags.txt
# This fails if there is no tag, so disable exit-on-error.
set +e
git describe --exact-match --tags &> build-info/git-describe-exact-tags.txt
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

docker build --tag=debiki/talkyard-app:latest --file Dockerfile.prod .

echo "Image tag: debiki/talkyard-app:latest"
