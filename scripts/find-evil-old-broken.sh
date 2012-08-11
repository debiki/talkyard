#!/bin/bash

if [ $# = 0 ]; then
  echo "Usage: $0 dirs-to-search, e.g.: $0 */src/main"
  exit 1
fi

while [ -n "$1" ]; do
  find $1 -type f -iregex '.*\(scala\|js\|css\|html\|yml\|yaml\|conf\|messages\|routes\|sql\)' \
    -execdir egrep -C5 --with-filename --line-number --initial-tab 'XSS|SECURITY|XSRF' '{}' \;
  shift
done

