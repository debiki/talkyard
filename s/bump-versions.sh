#!/bin/bash

# Bump from v0.2020.X to v0.2020.X+1:

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true

old_v=$(cat version.txt)

old_nr=$(  \
    echo $old_v | sed -nr 's/^v[0-9]+\.[0-9]+\.([0-9]+).*$/\1/p')

# Remove any leading 0 or Bash thinks 08 is base 8  (not base 10).
# No quotes needed in [[ =~ ]].
if [[ $old_nr =~ ^0[0-9]$ ]]; then
  old_nr="$(echo "$old_nr" | sed 's/^0//')"
fi

next_nr=`printf '%d' $(($old_nr + 1))`

# Pad N to 0N, since the in-year release nr should always be 2 digits, e.g. 07 not 7.
# No quotes needed in [[ =~ ]].
if [[ $next_nr =~ ^.$ ]]; then
  next_nr="0$next_nr"
fi

next_v=$(echo $old_v  \
    | sed -nr "s/^(v[0-9]+\.[0-9]+\.)([0-9]+)(.*)\$/\1${next_nr}\3/p" )

echo "$next_v" > version.txt

echo "Bumped version from $old_v to $next_v."

