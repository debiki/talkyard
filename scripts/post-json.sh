#!/bin/bash

# To get a session cookie and an xsrf token, open a browser and login to Debiki,
# and open Chrome's Dev Tools or Firebug, copy dwCoSid and dwCoXsrf.

url=$1
session_cookie=$2
xsrf_token=$3
data=$4

set -x

curl \
  --verbose \
  --header "Content-type: application/json" \
  --header "X-XSRF-TOKEN: $xsrf_token" \
  --cookie "dwCoSid=$session_cookie" \
  --request POST \
  --data "$data" \
  "$url"

