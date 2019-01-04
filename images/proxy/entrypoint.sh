#!/bin/sh
set -e

touch /acme.json
chown 600 /acme.json

exec /entrypoint-original.sh