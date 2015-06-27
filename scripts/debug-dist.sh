#!/bin/bash

# Add to 
#  -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=9999 \
# to bin/debiki-server exec:
#
# vi target/universal/debiki-server-1.0-SNAPSHOT/bin/debiki-server
# pushd . ; cd target/universal/debiki-server-1.0-SNAPSHOT; bin/debiki-server -Dconfig.file=../../../../conf/debiki.conf ; popd
#
# activator is BUGGY, -jvm-debug 9999 does NOT WORK

rm -fr target/universal/debiki-server-1.0-SNAPSHOT
pushd .
cd target/universal
unzip -q debiki-server-1.0-SNAPSHOT.zip
cd debiki-server-1.0-SNAPSHOT
cmd="bin/debiki-server -Dconfig.file=../../../../conf/debiki.conf -Dhttps.port=9443 -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=9999"
echo Running: $cmd
$cmd
popd

# vim: list
