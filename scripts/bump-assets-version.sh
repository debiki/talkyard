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

config_file=conf/assets-version.conf

# Find current assets version number.
current_assets_version=""
if [ -f $config_file ] ; then
  current_assets_version=`sed -nr 's/^assets.version="([0-9]+)"$/\1/p' < $config_file`
fi

# In case $config_file does not yet exist.
if [ -z "$current_assets_version" ] ; then
  current_assets_version=0
fi

# Bumb version number.
next_assets_version=`printf '%d' $(($current_assets_version + 1))`

# Update Play Framework config value with new version.
cat > $config_file <<EOF
# *** Generated file. It will be overwritten. ***
# See scripts/bump-assets-version.sh.
assets.version="$next_assets_version"
EOF

echo "Bumbed assets version from $current_assets_version to $next_assets_version."

