#!/bin/bash

# Bump from v0.2020.X to v0.2020.X+1:

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true

old_v=$(cat version.txt)

old_patch_nr=$(  \
    echo $old_v | sed -nr 's/^v[0-9]+\.[0-9]+\.([0-9]+).*$/\1/p')

next_patch_nr=`printf '%d' $(($old_patch_nr + 1))`

next_v=$(echo $old_v  \
    | sed -nr "s/^(v[0-9]+\.[0-9]+\.)([0-9]+)(.*)\$/\1${next_patch_nr}\3/p" )

echo "$next_v" > version.txt

echo "Bumped version from $old_v to $next_v."

