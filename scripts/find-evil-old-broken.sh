#!/bin/bash

help_text="
This script finds magic markers I've added to some source code,
e.g. 'XSS' or 'XSRF'. Such markers mean I should check the related
code for security issues.

I've been stupid though and written 'XSS' sometimes in ordinary comments
and sometimes as magic danger marks. I could change the magic marks to
'XSS_' and 'XSRF_'? Hmm.

Usage:  $0  dirs-to-search

For example:  $0 client/ app/ modules/*/src/main
"

if [ $# = 0 ]; then
  echo "$help_text"
  exit 1
fi

while [ -n "$1" ]; do
  echo "========== $1:"
  find $1 -type f -iregex '.*\(scala\|js\|ls\|coffee\|css\|html\|yml\|yaml\|conf\|messages\|routes\|sql\)' \
    -execdir egrep -C5 --with-filename --line-number --initial-tab 'XSS|SECURITY|XSRF' '{}' \;
  shift
done

