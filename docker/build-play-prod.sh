#!/usr/bin/env bash

# Run from the docker/ parent dir.

# Exit on any error.
set -e

rm -fr target/docker-play-prod
cp -a docker/play-prod target/docker-play-prod
cd target/docker-play-prod
cp ../universal/debiki-server-1.0-SNAPSHOT.zip ./
unzip -q debiki-server-1.0-SNAPSHOT.zip
mv debiki-server-1.0-SNAPSHOT play

# (&> redirects both stderr and stdout.)
mkdir build-info
git rev-parse HEAD &> build-info/git-revision.txt
git log --oneline -n100 &> build-info/git-log-oneline.txt
git status &> build-info/git-status.txt
git diff &> build-info/git-diff.txt
git describe --tags &> build-info/git-describe-tags.txt

# This fails if there is no tag, so disable exit-on-error.
set +e
git describe --exact-match --tags &> build-info/git-describe-exact-tags.txt
set -e

date --utc --iso-8601=seconds > build-info/docker-image-build-date.txt

# Move our own JARs do a separate folder, so they can be copied in a separate COPY step,
# so that when pushing/pulling to/from Docker Hub, only this very last COPY will
# usually be pushed/pulled.
mkdir play-lib-debiki
mv play/lib/*debiki* play-lib-debiki/

docker build --tag=debiki/ed-play:latest .

echo "Image tag: debiki/ed-play:latest"
