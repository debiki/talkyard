#!/bin/bash

set -x

echo '' > `docker inspect --format='{{.LogPath}}' $1`

