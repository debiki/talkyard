#!/bin/bash

# Don't chown on elasticsearch/ because then elasticsearch would get read-write access to its
# own executable code — that'd be a security risk?
chown -R elasticsearch /usr/share/elasticsearch/data
chown -R elasticsearch /usr/share/elasticsearch/logs

exec su -c "$*" elasticsearch

