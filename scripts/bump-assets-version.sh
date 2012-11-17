#!/bin/bash

# This script makes it possible to instruct browsers and proxy servers to cache
# JS and CSS forever. It bumps a certain version number that is included in the
# URL path to Javascript and CSS.  I include this version number, via a Play
# config value, in my Scala templates, as part of the URL path to Javascript
# and CSS. And in the `routes` file, I accept any value for this part of the
# URL.

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true


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

