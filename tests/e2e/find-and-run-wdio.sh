#!/bin/bash


# ===== Forum tests

find specs/ -type f  \
    | egrep -v '[23]browsers|embedded-|UNIMPL|imp-exp-imp-exp-site'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js


find specs/ -type f  \
    | egrep '2browsers'  \
    | egrep -v 'embedded-|UNIMPL'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --only 2browsers


find specs/ -type f  \
    | egrep '3browsers'  \
    | egrep -v 'embedded-|UNIMPL'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --only 3browsers



# ===== Embedded comments tests


# Start a http server, for the embedding html pages.
# There's a wdio-static-server-service, but I couldn't get it working,
# and there's this bug report: https://github.com/webdriverio/webdriverio/issues/5240
#
server_port_8080=$(netstat -nl | grep ':8080.*LISTEN')
server_port_8080_pid=''
if [ -z "$server_port_8080" ]; then
  echo "Starting a http server for embedded comments html pages..."
  ./node_modules/.bin/http-server -p8080 target/ &
  # Field 2 is the process id.
  server_port_8080_pid=$(jobs -l | grep p8080 | awk '{ printf $2; }')
fi
# else: a server already running — hopefully the one we need? Do nothing.

# Todo: Gatsby server too, port 8000.


# With cookies tests.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep -v 'no-cookies'  \
    | egrep -v 'embedded-forum'  \
    | egrep -v '[23]browsers|UNIMPL'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js


# Cookies blocked tests.
find specs/ -type f  \
    | egrep 'embedded-'  \
    | egrep 'no-cookies'  \
    | egrep -v 'embedded-forum'  \
    | egrep -v '[23]browsers|UNIMPL'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --b3c


# (There are no 2browsers tests witout cookies.)
find specs/ -type f  \
    | egrep '2browsers'  \
    | egrep 'embedded-'  \
    | ../../node_modules/.bin/wdio  wdio.conf.js  --only 2browsers


