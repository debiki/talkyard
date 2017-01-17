#!/bin/bash

# 1) This script makes it possible to instruct browsers and proxy servers to cache
# JS and CSS forever. It bumps a certain version number that is included in the
# URL path to Javascript and CSS.  I include this version number, via a Play
# config value, in my Scala templates, as part of the URL path to Javascript
# and CSS. And in the `routes` file, I accept any value for this part of the
# URL.
# 2) And, if the current version in version.txt is a WIP (work in progress
# version), this script bumps the WIP version from say WIP-123 to WIP-124.


set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true


# Bump assets version
# ---------------------

# Find current assets version number.

find_version_regex='s#^GET.*/-/assets/([0-9]+)/\*file\s+controllers.Assets.at.*$#\1#p'
current_version=`sed -nr "$find_version_regex" < conf/routes`

if [ -z "$current_version" ] ; then
  echo "Assets version number not found in conf/routes; regex matched nothing:"
  echo "$find_version_regex"
  exit 1
fi

# Bump version number.

next_version=`printf '%d' $(($current_version + 1))`
new_routes=`sed -r "s#(^.*/-/assets/)([0-9]+)(/.*$)#\1$next_version\3#" < conf/routes`
echo "$new_routes" > conf/routes

echo "Bumped assets version number from $current_version to $next_version."


# Bump version.txt
# ---------------------

current_version_nr=`sed -nr 's/^.*-WIP-([0-9]+)/\1/p' < version.txt`
if [ -n "$current_version_nr" ]; then
  # Bump v00.00.00-WIP-100 to v00.00.00-WIP-101
  next_version_nr=`printf '%d' $(($current_version_nr + 1))`
  new_version=`sed -r "s/^(.*)-WIP-([0-9]+).*\$/\1-WIP-$next_version_nr/" < version.txt`
else
  # Bump v00.00.00 to v00.00.01-WIP-1
  current_version_nr=`sed -nr 's/^v[0-9]+\.[0-9]+\.([0-9]+)(.*)$/\1/p' < version.txt`
  next_version_nr=`printf '%d' $(($current_version_nr + 1))`
  new_version=`sed -nr "s/^(v[0-9]+\.[0-9]+)\.([0-9]+)(.*)\$/\1\.$next_version_nr-WIP-1\3/p" < version.txt`
fi
echo "$new_version" > version.txt

