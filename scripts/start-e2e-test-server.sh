#!/bin/bash

port=9000

listening=`netstat -tlpn 2> /dev/null | grep ":$port"`
if [ -n "$listening" ]; then
  echo "Server already running (listening on $port), nothing to do."
  exit 0
fi

echo "Starting server, port $port..."
s/s.sh run


# vim: et ts=2 sw=2 list fo=r
