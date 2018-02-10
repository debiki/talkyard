#!/bin/bash

if [ `id -u` -eq 0 ]; then
  echo "You are root. Don't run the E2E tests as root please."
  exit 1
fi

# If we start running the tests too early, they will need to wait for Nashorn, and might then timeout and fail.
echo "Waiting for Nashorn to compile Javascript code..."
until $(curl --output /dev/null --silent --head --fail http://localhost/-/are-scripts-ready); do
  printf '.'
  sleep 1
done

function log_message {
  echo "`date --iso-8601=seconds --utc`: $1"
}

failfile=tests/e2e-failures.txt
echo "" >> $failfile
log_message "Running: $*" >> $failfile


function runEndToEndTest {
  site_nr=`printf '%d' $(($site_nr + 1))`
  cmd="$@ --deleteOldSite --localHostname=e2e-test-$site_nr"
  echo "—————————————————————————————————————————————————————————"
  echo "Next test: $cmd"
  # Sometimes, randomly?, there's some weird port conflict causing this to fail & hang forever.
  # So timeout after 3 minutes. The slow tests take about one minute.
  timeout --foreground 180 $cmd
  if [ $? -ne 0 ]; then
    log_message "Failed: $cmd" >> $failfile
    # Try again, so some harmless race condition I haven't thought about that breaks the test,
    # won't result in a false failures. Usually a race condition breaks the tests only very
    # infrequently, so it's "impossible" to reproduce manually, and thus hard to fix. However,
    # if the test breaks directly *again*, then apparently the failure / race-condition is easy
    # to reproduce, so I'll be able to fix it :-)
    echo
    echo "*** Test failed. Waiting a few seconds, then trying again ... [EdME2ETRYAGAIN] ***"
    echo
    sleep 7
    site_nr=`printf '%d' $(($site_nr + 1))`
    cmd="$@ --deleteOldSite --localHostname=e2e-test-$site_nr"
    echo "Again: $cmd"
    $cmd
    if [ $? -ne 0 ]; then
      log_message "Failed: $cmd" >> $failfile
      log_message "Test failed twice, aborting." >> $failfile
      cmd_with_debug=$(echo $@ | sed 's/wdio /wdio-debug-9101 /')
      echo
      echo "*** ERROR [EsE5KPY02] ***"
      echo
      echo "This end-to-end test failed twice: (The next line. You can copy-paste it and run it.)"
      # Later: use --localHostname=e2e-test-manual or just e2e-test, instead of -20, so won't overwrite test site nr 20.
      # (But first add a cname entry for -manual.)
      cmd_with_debug="$cmd_with_debug --deleteOldSite --localHostname=e2e-test-20 --nt --da"
      # We cannot use "$EUID" -ne 0 to find out if the user is originally root, because
      # root first su:s to another user. Check the --is-root command line flag instead.
      if [ -z "$is_root" ]; then
        echo "  $cmd_with_debug"
      else
        echo "  su $my_username -c '$cmd_with_debug'"
        echo
        echo "Note: you are root. Don't forget 'su $my_username' (included above already)."
      fi
      echo
      exit 1
    else
      echo "Ok, on the 2nd attempt. [EdM3BVP7]"
      echo
    fi
  else
    echo "Ok. [EdM4RZW0J]"
    echo
  fi
}

if [ "$1" = '--is-root' ]; then
  is_root=yes
  shift
fi

if [ "$1" = '--all' ]; then
  run_all=yes
  shift
fi


#------------------------------------------------------------
# dupl code (7UKTWC0)
# Start building the Gatsby blog, if needed.
if [ ! -d modules/gatsby-starter-blog/public/ ]; then
  echo "Building the Gatsby starter blog public html..."
  pushd .
  cd modules/gatsby-starter-blog/
  rm -fr .cache public
  (yarn && yarn build && echo 'yarn-build-1' ) &
  yarn_build_gatsby_pid=$(jobs -l | grep yarn-build-1 | awk '{ printf $2; }')
  echo "Background building the Gatsby blog in process id $yarn_build_gatsby_pid"
  popd
fi

# dupl code (7UKTWC0)
# Start building another version of the Gatsby blog, with an older ed-comments version.
if [ ! -d modules/gatsby-starter-blog-ed-comments-0.4.4/public/ ]; then
  echo "Building the Gatsby starter blog public html, for ed-comments 0.4.4..."
  pushd .
  cd modules/gatsby-starter-blog-ed-comments-0.4.4/
  rm -fr .cache public
  (yarn && yarn build && echo 'yarn-build-2' ) &
  yarn_build_gatsby_pid2=$(jobs -l | grep yarn-build-2 | awk '{ printf $2; }')
  echo "Background building the Gatsby blog, ed-comments 0.4.4, in process id $yarn_build_gatsby_pid2"
  popd
fi
#------------------------------------------------------------


args=$@
site_nr=0

function runAllEndToEndTests {
  browser=$1
  echo "Running all end-to-end tests in $browser..."

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only all-links $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only create-site-all-logins $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only create-site-admin-guide.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only oauth-signup-login $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only navigation-as-stranger $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only navigation-as-member $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only votes-and-best-first $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only editor-onebox $args

  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only direct-messages-notfs.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only basic-chat.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only categories-basic.3browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only categories-delete.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only private-chat.3browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only settings-toggle-login-required.3browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only password-login-reset.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only user-profile-access $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only user-profile-change-username $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only user-profile-change-email $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only user-profile-cannot-delete-openauth-email $args

  runEndToEndTest s/wdio target/e2e/wdio.3chrome.conf.js    --browser $browser --only custom-forms.3browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only authz-view-as-stranger $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only authz-basic-see-reply-create $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only impersonate.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only email-notfs-discussion $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only unsubscribe.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-user-review-ok.2browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-user-review-bad.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-member-allow-approve.2browsers $args
  #runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only new-member-allow-reject.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only spam-basic-local.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only flag-member-block-agree.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only flag-guest-block-agree.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only page-type-idea-statuses-comments $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only page-type-problem-statuses $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only page-type-question-closed.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only search-public-basic.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only search-private-chat.2browsers $args

  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only summary-emails.2browsers $args


  # Usability Testing Exchange
  # ------------

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only utx-all-logins $args


  # Embedded comments
  # ------------
  # Start a http server, for the embedding html pages, if needed.
  server_port_8080=$(netstat -nl | grep ':8080.*LISTEN')
  server_port_8080_pid=''
  if [ -z "$server_port_8080" ]; then
    echo "Starting a http server for embedded comments html pages..."
    ./node_modules/.bin/http-server -p8080 target/ &
    # Field 2 is the process id.
    server_port_8080_pid=$(jobs -l | grep p8080 | awk '{ printf $2; }')
  fi
  # else: the user has probably started the server henself already, do nothing.

  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only embedded-comments-create-site-no-verif-email.2browsers $args
  runEndToEndTest s/wdio target/e2e/wdio.2chrome.conf.js    --browser $browser --only embedded-comments-create-site-req-verif-email.2browsers $args
  # (no -old-name version, because the new name is always included in the server's genetarted html.)
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-discussion-id.test $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-discussion-id-old-name $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-all-logins.test $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-all-logins-old-name $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-edit-and-vote.test $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-edit-and-vote-old-name $args
  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-short-script-cache-time.test $args
  # (all names included in short-cache-time already)

  if [ -n "$server_port_8080_pid" ]; then
    kill $server_port_8080_pid
    echo "Stopped the http server for the embedded comments."
  fi


  #------------------------------------------------------------
  # dupl code (8BMFEW2)
  # Gatsby embedded comments
  # ------------
  if [ -n "$yarn_build_gatsby_pid" ]; then
    echo "Waiting for \$yarn_build_gatsby_pid $yarn_build_gatsby_pid to finish ..."
    wait $yarn_build_gatsby_pid
  fi
  # And then start a server, for the blog: (but let's do that here, if not started)
  server_port_8000=$(netstat -nl | grep ':8000.*LISTEN')
  if [ -z "$server_port_8000" ]; then
    echo "Starting a http server for the Gatsby blog..."
    ./node_modules/.bin/http-server -p8000 modules/gatsby-starter-blog/public/ &
    # Field 2 is the process id.
    server_port_8000_pid=$(jobs -l | grep p8000 | awk '{ printf $2; }')
  fi
  # else: the user has probably started the server henself already, do nothing.

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-gatsby $args

  if [ -n "$server_port_8000_pid" ]; then
    kill $server_port_8000_pid
    wait $server_port_8000_pid
    echo "Stopped the http server for the Gatsby blog, pid $server_port_8000_pid."
  fi


  # dupl code (8BMFEW2)
  # Gatsby embedded comments, old version 0.4.4
  # ------------
  if [ -n "$yarn_build_gatsby_pid2" ]; then
    echo "Waiting for \$yarn_build_gatsby_pid2 $yarn_build_gatsby_pid2 to finish, old ed-comments 0.4.4 ..."
    wait $yarn_build_gatsby_pid2
  fi
  # And then start a server, for the blog: (but let's do that here, if not started)
  server_port_8000=$(netstat -nl | grep ':8000.*LISTEN')
  if [ -z "$server_port_8000" ]; then
    echo "Starting a http server for the Gatsby blog, old ed-comments 0.4.4..."
    ./node_modules/.bin/http-server -p8000 modules/gatsby-starter-blog-ed-comments-0.4.4/public/ &
    # Field 2 is the process id.
    server_port_8000_pid2=$(jobs -l | grep p8000 | awk '{ printf $2; }')
    echo "Gatsby blog server running as pid $server_port_8000_pid2."
  fi
  # else: the user has probably started the server henself already, do nothing.

  runEndToEndTest s/wdio target/e2e/wdio.conf.js            --browser $browser --only embedded-comments-gatsby $args

  if [ -n "$server_port_8000_pid2" ]; then
    kill $server_port_8000_pid2
    wait $server_port_8000_pid2
    echo "Stopped the http server for the Gatsby blog, old ed-comments 0.4.4, pid $server_port_8000_pid2."
  fi
  #------------------------------------------------------------

  # wip:
  # settings-allow-local-signup
  # settings-allow-signup
}


runAllEndToEndTests chrome

if [ -n "$run_all" ]; then
  runAllEndToEndTests firefox
fi

log_message "Done." >> $failfile
echo "Done running end-to-end tests."

# vim: et ts=2 sw=2 tw=0
