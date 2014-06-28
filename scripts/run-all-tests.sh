#!/bin/bash
set -x

# Call this script e.g. like so:
# scripts/run-all-tests.sh  -Dtestserver.port=19003  -Dtest.e2e.chrome.driverPath=/mnt/tmp/dev/chromedriver

# The `play` command should be provided either as a softlink in scripts/, or as an env variable
# (define the env variable e.g. like so  $ export play=/mnt/tmp/dev/play-2.2.3/play  ).
if [ -z "$play" ]; then
  play=scripts/play-2.2.3
fi

$play  "$@" "project debiki-core" test

# In debiki-dao-rdb there're two test suites but usually they break if I run them via "test",
# but "test-only" works:
$play  "$@" "project debiki-dao-rdb" \
  "test-only com.debiki.dao.rdb.RdbDaoSuite" \
  "test-only com.debiki.dao.rdb.RdbDaoSpecOld"

# Currently ScalaTest's @DoNotDiscover attribute doesn't seem to work proberly so I need to
# list exactly which tests in debiki-server to run:
# (And run QuotaChargerSpecRunner last, it takes rather long.)
$play  "$@" \
  "test-only debiki.BrowserPagePatcherSpec" \
  "test-only debiki.AutoApproverSpec" \
  "test-only test.e2e.EndToEndSuite" \
  "test-only debiki.QuotaChargerSpecRunner"

