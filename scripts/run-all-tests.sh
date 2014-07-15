#!/bin/bash

# Call this script e.g. like so:
# scripts/run-all-tests.sh  [timeout] -Dtestserver.port=19003  -Dtest.e2e.chrome.driverPath=/mnt/tmp/dev/chromedriver
# The 'timeout' flag causes the script to abort if the tests take too long HOWEVER then CTRL-C won't work;
# you'd have to kill the processes with `kill` if you don't want to wait for the timeout.

# The `play` command should be provided either as a softlink in scripts/, or as an env variable
# (define the env variable e.g. like so  $ export play=/mnt/tmp/dev/play-2.2.3/play  ).
if [ -z "$play" ]; then
  export play=scripts/play-2.2.3
fi

if [ "$1" = "timeout" ]; then
  shift
  echo "Using timeouts, which includes running each test suite in its own process group; CTRL-C won't work."
  timeout="timeout"
  setsid=setsid
else
  echo "Not using timeouts, tests will run until completed or forever if they don't terminate."
  setsid=''
fi

function set_timeout {
  if [ -n "$timeout" ]; then
    timeout_args="--timeout $1"
  fi
}

mkdir -p target/
rm -f target/tests-failed
rm -f target/tests-timed-out


make compile_javascript
npm install
bower install
gulp


# Although these debiki-core tests take only perhaps 15 seconds (starting Java takes long),
# set a long timeout in case we need to compile and build everything.
set_timeout 300
$setsid  scripts/run-test-suite.sh  $timeout_args  "$@"  "project debiki-core"  test

# In debiki-dao-rdb there're two test suites but usually they break if I run them via "test",
# but "test-only" works:
set_timeout 180
$setsid  scripts/run-test-suite.sh  $timeout_args  "$@"  "project debiki-dao-rdb" \
  "test-only com.debiki.dao.rdb.RdbDaoSuite" \
  "test-only com.debiki.dao.rdb.RdbDaoSpecOld"

# Currently ScalaTest's @DoNotDiscover attribute doesn't seem to work proberly so I need to
# list exactly which tests in debiki-server to run:
# (And run QuotaChargerSpecRunner last, it takes rather long.)
set_timeout 600
$setsid  scripts/run-test-suite.sh  $timeout_args  "$@" \
  "test-only debiki.BrowserPagePatcherSpec" \
  "test-only debiki.AutoApproverSpec" \
  "test-only test.e2e.EndToEndSuite" \
  "test-only debiki.QuotaChargerSpecRunner"

$setsid  scripts/run-embedded-comments-tests.sh  $timeout  "$@"


exit_status=0

if [ -f target/tests-failed ]; then
  echo
  echo -e "\e[00;31mTest suites failed:"
  cat target/tests-failed
  echo -e "\e[00m"
  exit_status=1
fi

if [ -f target/tests-timed-out ]; then
  echo -e "\e[00;31mTest suites timed out:"
  cat target/tests-timed-out
  echo -e "\e[00m"
  exit_status=1
fi

exit $exit_status
