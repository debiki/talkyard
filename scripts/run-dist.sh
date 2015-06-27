#!/bin/bash

rm -fr target/universal/debiki-server-1.0-SNAPSHOT
pushd .
cd target/universal
unzip -q debiki-server-1.0-SNAPSHOT.zip
cd debiki-server-1.0-SNAPSHOT
bin/debiki-server -Dconfig.file=../../../../conf/debiki.conf -Dhttps.port=9443
popd

# vim: list
