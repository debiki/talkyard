#!/bin/bash

# Cd to the project directory (the parent of scripts/).
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $script_dir
cd ..

# Start the server, quickly, without starting ElasticSearch (which takes
# some time).
scripts/activator  -jvm-debug 9999  -DcrazyFastStartSkipSearch=true

