#!/bin/bash

# (Place  yuicompressor-2.4.6.jar  in scratch/, for this script to work.)

set -eu

debikijs=modules/debiki-core/src/main/resources/toserve/js/debiki.js
debikifull=modules/debiki-core/src/debiki.full.js

function usageExit {
  echo "Usage: $0 {compress|undo}"
  exit 1
}

if [ "$#" -ne 1 ]; then
  usageExit
fi

if [ "$1" = "undo" ]; then
  mv "$debikifull" "$debikijs"
  exit 0
elif [ "$1" = "compress" ]; then
  # Copy debiki.js to .full.js, and overwrite debiki.js with a compressed version.
  cp "$debikijs" "$debikifull"
  java -jar scratch/yuicompressor-2.4.6.jar --line-break 180 --charset utf8 -o "$debikijs" "$debikifull"
else
  usageExit
fi

