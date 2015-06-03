#!/bin/bash

# Cd to the project directory (the parent of scripts/).
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $script_dir
cd ..

# Start the server, quickly, without starting ElasticSearch (which takes
# some time). Use a debiki.conf file in a supposed parent Git repo
# in the parent directory.
scripts/activator \
  -jvm-debug 9999 \
  -Dcom.sun.management.jmxremote.port=3333 \
  -Dcom.sun.management.jmxremote.ssl=false \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dconfig.file=../conf/debiki.conf \
  -Dhttps.port=9443 \
  -DcrazyFastStartSkipSearch=true

