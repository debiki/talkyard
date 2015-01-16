#!/bin/bash

usage="
Usage: $0 version-number

This program builds a Docker image with all databases and programs
and stuff that Debiki needs to run. Everything in one single image, which
later runs in one single conotainer (+ any data-only containers), that's
why the image is named -solo-.
"

version=$1

if [ -z "$version" ] || [ $# != 1 ]; then
  echo "$usage"
  exit 1
fi

rm -rf target/client/
rm -rf target/universal/

# Should do this via the docker dev containers instead, so becomes portable:
gulp release
activator=/mnt/tmp/dev/activator-1.2.10/activator  # for now
$activator dist

zip_file=target/universal/debiki-server-1.0-SNAPSHOT.zip
dockerfile_dir=scripts/docker/debiki-prod-solo

rm -rf $dockerfile_dir/debiki-server-unzipped
rm -rf $dockerfile_dir/debiki-server

unzip $zip_file -d $dockerfile_dir/debiki-server-unzipped
mv $dockerfile_dir/debiki-server-unzipped/* $dockerfile_dir/debiki-server
rmdir $dockerfile_dir/debiki-server-unzipped

docker build -t debiki/debiki-solo-test $dockerfile_dir
docker tag debiki/debiki-solo-test:latest debiki/debiki-solo-test:$version

