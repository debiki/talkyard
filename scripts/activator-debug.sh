#!/bin/bash

# Cd to the project directory (the parent of scripts/).
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $script_dir
cd ..

# Use a debiki.conf file in a supposed parent Git repo in the parent directory.
scripts/activator \
  -jvm-debug 9999 \
  -Dconfig.file=../conf/debiki.conf

