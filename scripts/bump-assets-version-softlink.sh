#!/bin/bash

# This script makes it possible to instruct browsers and proxy servers to cache
# JS and CSS forever. It bumps the name of a certain softlink to a certain
# assets folder (with Javascript, CSS etc).  The softlink is included in the
# generated HTML <link> and <script> tags.

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true

# Create assets softlink folder, in case this script is run for the first time.
link_dir=public/assets-softlinks/
mkdir -p $link_dir

# Find the current version.
# In public/a/, there are softlinks named like "000f8", which is the version
# number of that particular softlink to /public/assets/.
# The current softlink is the one with the highest number.
current_assets_link=`ls $link_dir | sort | tail -n1`

# In case this script is run for the first time.
if [ -z $current_assets_link ] ; then
  current_assets_link=00000
fi

# Bumb version number.
# `%05x` tells `printf` to output a hex number and pad with up to 5 '0'.
# `16#$current_assets_link` tells Bash that $current_assets_link is a hex
# number.  (In case you wonder: We won't run out of 5 digit hex values until
# after 287 years, if we deploy 10 times every day.)
next_assets_link=`printf '%05x' $((16#$current_assets_link + 1))`

# Create softlink.
pushd .  >> /dev/null
cd $link_dir
ln -s ../res $next_assets_link
popd >> /dev/null

# Update Play config value with name of current softlink.
# I include this config value in my Scala templates, as part of the URL
# path to Javascript and CSS and other assets.
cat > conf/debiki-assets-softlink.conf <<EOF
# See $0.
debiki.assets.softlink="$next_assets_link"
EOF

echo "Bumbed assets softlink from $current_assets_link to $next_assets_link."

