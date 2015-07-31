#!/bin/bash

rm -fr target/universal/debiki-server-1.0-SNAPSHOT
pushd .
cd target/universal
unzip -q debiki-server-1.0-SNAPSHOT.zip
cd debiki-server-1.0-SNAPSHOT
JAVA_HOME=~/Downloads/jdk1.8.0_60 bin/debiki-server -Dconfig.file=../../../../conf/debiki.conf -Dhttps.port=9443
popd

# vim: list
