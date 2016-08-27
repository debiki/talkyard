#!/bin/bash

# If we start running the tests too early, they will need to wait for Nashorn, and might then timeout and fail.
echo "Waiting for Nashorn to compile Javascript code..."
until $(curl --output /dev/null --silent --head --fail http://localhost/-/are-scripts-ready); do
  printf '.'
  sleep 1
done


function runEndToEndTest {
  cmd="$@"
  echo "—————————————————————————————————————————————————————————"
  echo "Next test: $cmd"
  $cmd
  if [ $? -ne 0 ]; then
    echo
    echo "***ERROR*** [EsE5KPY02]"
    echo
    echo "This end-to-end test failed: (the whole next line)"
    echo "  $cmd"
    exit 1
  fi
}

if [ "$1" = "--all" ]; then
  run_all=yes
  shift
fi

args=$@

function runAllEndToEndTests {
  browser=$1
  echo "Running all end-to-end tests in $browser..."
  runEndToEndTest scripts/wdio target/e2e/wdio.conf.js          --browser $browser --only all-links $args
  runEndToEndTest scripts/wdio target/e2e/wdio.conf.js          --browser $browser --only create-site $args
  runEndToEndTest scripts/wdio target/e2e/wdio.2chrome.conf.js  --browser $browser --only chat.2browsers $args
  runEndToEndTest scripts/wdio target/e2e/wdio.3chrome.conf.js  --browser $browser --only categories.3browsers $args
}


runAllEndToEndTests chrome

if [ -n "$run_all" ]; then
  runAllEndToEndTests firefox
fi

