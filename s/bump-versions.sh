#!/bin/bash

# If the current version in version.txt is a WIP (work in progress
# version), this script bumps the WIP version from say WIP-123 to WIP-124.

# Now, 2020, 'WIP' isn't work in progress, it can be the real prod
# version too.

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true


# Bump version.txt
# ---------------------

current_version_nr=`sed -nr 's/^.*-WIP-([0-9]+)/\1/p' < version.txt`

# Skip this, bump the minor version always instead.
#if [ -n "$current_version_nr" ]; then
#  # Bump v00.00.00-WIP-100 to v00.00.00-WIP-101
#  next_version_nr=`printf '%d' $(($current_version_nr + 1))`
#  new_version=`sed -r "s/^(.*)-WIP-([0-9]+).*\$/\1-WIP-$next_version_nr/" < version.txt`
#else

  # Bump v00.00.00 to v00.00.01-WIP-1
  current_version_nr=`sed -nr 's/^v[0-9]+\.[0-9]+\.([0-9]+)(.*)$/\1/p' < version.txt`
  next_version_nr=`printf '%d' $(($current_version_nr + 1))`
  new_version=`sed -nr "s/^(v[0-9]+\.[0-9]+)\.([0-9]+)(.*)\$/\1\.$next_version_nr-WIP-1\3/p" < version.txt`

#fi

echo "$new_version" > version.txt

