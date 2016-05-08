#!/bin/bash

# Go to the project directory (whih is the parent directory).
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $script_dir
cd ..

# cli = comman line interface. That is, starts a prompt where you can type
# things like 'clean', 'test', 'compile', 'run', 'dist', 'console'.

sudo docker-compose run --rm --service-ports play /opt/typesafe-activator/activator \
  -jvm-debug 9999 \
  -Dcom.sun.management.jmxremote.port=3333 \
  -Dcom.sun.management.jmxremote.ssl=false \
  -Dcom.sun.management.jmxremote.authenticate=false \
  -Dhttp.port=9000 \
  -Dhttps.port=9443 \
  "$@"

