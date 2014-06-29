#!/bin/bash

# Call this script e.g. like so:
# scripts/run-embedded-comments-tests.sh  -Dtestserver.port=19003  -Dtest.e2e.chrome.driverPath=/mnt/tmp/dev/chromedriver

if [ -z "$play" ]; then
  export play=scripts/play-2.2.3
fi

# Testing embedded comments requires another server running on port 8080 that serves
# embedding pages. Start such a server:
pushd .
cd test/resources/embedding-pages/
http-server &
popd

$play  "$@"  "test-only test.e2e.EndToEndSuiteForEmbeddedComments"

# Kill the embedding pages server. Apparently, since we've started a new Bash shell,
# the embedded server always gets id 1.
kill %1

