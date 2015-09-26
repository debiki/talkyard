#!/bin/bash

rm -fr target/universal/debiki-server-1.0-SNAPSHOT
pushd .
cd target/universal
unzip -q debiki-server-1.0-SNAPSHOT.zip
cd debiki-server-1.0-SNAPSHOT
cmd="bin/debiki-server -jvm-debug 9999 -Dconfig.file=../../../../conf/debiki.conf -Dhttps.port=9443"
echo Running: $cmd
$cmd
popd

# vim: list
