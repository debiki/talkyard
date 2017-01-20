#!/bin/bash

# If we start running the tests too early, they will need to wait for Nashorn, and might then timeout and fail.
echo "Waiting for Nashorn to compile Javascript code..."
until $(curl --output /dev/null --silent --head --fail http://localhost/-/are-scripts-ready); do
  printf '.'
  sleep 1
done


function runEndToEndTest {
  site_nr=`printf '%d' $(($site_nr + 1))`
  cmd="$@ --deleteOldSite --localHostname=e2e-test-$site_nr"
  echo "—————————————————————————————————————————————————————————"
  echo "Next test: $cmd"
  $cmd
  if [ $? -ne 0 ]; then
    echo
    echo "***ERROR*** [EsE5KPY02]"
    echo
    echo "This end-to-end test failed: (The whole next line. You can copy-paste it and run it.)"
    # Later: use --localHostname=e2e-test-manual or just e2e-test, instead of -20, so won't overwrite test site nr 20.
    # (But first add a cname entry for -manual.)
    echo "  $@ --deleteOldSite --localHostname=e2e-test-20"
    exit 1
  fi
}

if [ "$1" = "--all" ]; then
  run_all=yes
  shift
fi

args=$@
site_nr=0

function runAllEndToEndTests {
  browser=$1
  echo "Running all end-to-end tests in $browser..."
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only all-links $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only create-site-all-logins $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only create-site-admin-guide.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only editor-onebox $args
  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only formal-private-messages.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only basic-chat.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only categories-basic.3browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only categories-delete.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only private-chat.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only settings-toggle-login-required.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only password-login-reset.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only user-profile-access $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only user-profile-change-username $args
  ###runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js --browser $browser --only custom-forms.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only view-as-stranger $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only impersonate.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only unsubscribe.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-user-review-ok.2browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-user-review-bad.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-member-allow-approve.2browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-member-allow-reject.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only spam-basic-local.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only flag-member-block-agree.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only flag-guest-block-agree.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only search-public-basic.2browsers $args
}


runAllEndToEndTests chrome

if [ -n "$run_all" ]; then
  runAllEndToEndTests firefox
fi

echo "Done running end-to-end tests."

