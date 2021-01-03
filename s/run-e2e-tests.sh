#!/bin/bash

# You can try the whole test suite twice:
# (you need your own secrets file)
#
#  for x in 1 2 ; do  time  s/run-e2e-tests.sh --3 --secretsPath=../debiki-site-www.debiki.com/conf/e2e-secrets.json && break  ; done


# Delete this whole file — run tests via `s/tyd e2e ...` instead.  [rm_run_e2e_tests_sh]
echo "This script, run-e2e-tests.sh is DEPRECATED, but still in use."
echo "Soon, will use instead:  s/tyd e2e ..."


if [ `id -u` -eq 0 ]; then
  echo "You are root. Don't run the E2E tests as root please."
  exit 1
fi

# Make `command | tee -a logfile` preserve the command's exit status.
set -o pipefail

mkdir -p logs/

offset=0
every=1

positional_args=()
while [[ $# -gt 0 ]]; do
  arg_name="$1"
  case $arg_name in
    -o|--offset)
    offset="$2"
    shift  # past key
    shift  # past value
    ;;
    -e|--every)
    every="$2"
    shift  # past key
    shift  # past value
    ;;
    *)
    # Could:
    # positional_args+=("$1")  # add to array
    # shift
    # and wait until -- before passing the rest of the args to wdio.
    # For now though:
    break
    ;;
  esac
done



# If we start running the tests too early, they will need to wait for Nashorn, and might then timeout and fail.
echo "Waiting for Nashorn to compile Javascript code... (polling http://localhost/-/are-scripts-ready )"
until $(curl --output /dev/null --silent --head --fail http://localhost/-/are-scripts-ready); do
  printf '.'
  sleep 1
done

function log_message {
  echo "`date --iso-8601=seconds --utc`: $1"
}

failfile=logs/e2e-failures.txt
echo "" >> $failfile
log_message "Running: $*" >> $failfile

isoDate=$(date --iso-8601=seconds)
randAlnum=$(< /dev/urandom tr -cd 'a-z0-9' | head -c 10)

testStartId="$isoDate-$randAlnum"

function runE2eTest {
  site_nr=`printf '%d' $(($site_nr + 1))`

  # This hostname will avoid using the same hostname, for different tests at the same time,
  # if running many tests in parallel.
  local_hostname="e2e-test-e$every-o$offset-s$site_nr"  # dupl [5WAKEF02]

  # Later: Run only every $every test, starting at offset $offset.
  # Then, can run many tests in parallel. For example, run this script with
  # '-e 2 -o 0' and '-e 2 -o 1' at the same time.

  # Incl $testStartId so ps-grep-kill below kills only wdio processes we start here.
  test_log_file="logs/failed-e2e-test-$testStartId-nr-$site_nr.log"
  cmd="$@ --deleteOldSite --localHostname=$local_hostname --dummy-wdio-test $testStartId"

  echo "————————————————————————————————————————————————————————————————————"
  echo "Next test:  $cmd"
  echo

  # Sometimes, randomly?, there's some weird port conflict causing this to fail & hang forever.
  # So timeout after 3 minutes. The slow tests take about one minute, so 3 minutes is a lot.
  # Also, kill any wdio things that have failed to stop, and might block a/the port.
  wdio_ps=$(ps aux | grep node | egrep 'wdio(.[0-9a-z]+)?.conf.js' | grep "wdio-test $testStartId")
  if [ -n "$wdio_ps" ] ; then
    # Column 2 is the process id.
    wdio_ps_ids=$( echo "$wdio_ps" | awk '{ print $2 }' | tr '\n' ' ' )
    echo "Killing old wdio processes, ids: $wdio_ps_ids commands:"
    echo "$wdio_ps"
    kill $wdio_ps_ids
  fi

  timeout --foreground 180 $cmd  |& tee -a $test_log_file  # note: pipefail enabled

  if [ $? -ne 0 ]; then
    log_message "Failed: $cmd" >> $failfile
    log_message "See logs: $test_log_file" >> $failfile


    see_log_file="Log file:  $test_log_file"

    # Try again, so some harmless race condition I haven't thought about that breaks the test,
    # won't result in a false failures. Usually a race condition breaks the tests only very
    # infrequently, so it's "impossible" to reproduce manually, and thus hard to fix. However,
    # if the test breaks directly *again*, then apparently the failure / race-condition is easy
    # to reproduce, so I'll be able to fix it :-)
    echo
    echo "$see_log_file"
    echo
    echo "*** Test failed 1/3. Waiting a few seconds, then will retry ... [EdME2ETRY1] ***"
    echo
    sleep 7

    echo "Again:"
    echo "    $cmd"
    echo

    $cmd  |& tee -a $test_log_file  # note: pipefail enabled

    if [ $? -ne 0 ]; then
      # Eh. Well, try a 3rd time. Not so easy to make all e2e tests stable, and
      # sometimes they work 30 times in a row, when I'm there at the computer, trying to
      # find out why they fail ... And then I start building a new server and run the
      # tests "for real" as part of the build process ... And then they start failing!
      # But they won't do that 3 times in a row?
      #
      # B.t.w. if a test works 1 time out of 3 — then almost certainly, all is fine,
      # and any bug is in the test suite: a race condition. I don't remember any single
      # time when, if an e2e test work *sometimes*, the bug has been in the real
      # Talkyard app — instead it's "always" a race bug, in the e2e test suite.
      # So, trying many times, is ok. (We're not building the Space Shuttle)
      #
      log_message "Failed 2nd time: $cmd" >> $failfile
      echo
      echo "$see_log_file"
      echo
      echo "*** Test failed 2/3. Waiting a few seconds, then trying one last time ... [EdME2ETRY2] ***"
      echo
      sleep 7

      echo "Last attempt:"
      echo "    $cmd"
      echo

      $cmd  |& tee -a $test_log_file  # note: pipefail enabled

      if [ $? -ne 0 ]; then
        log_message "Failed: $cmd" >> $failfile
        log_message "Test failed trice, aborting." >> $failfile
        cmd_with_debug=$(echo $@)  # skip:  | sed 's/wdio /wdio-debug-9101 /')  doesn't work anyway
        echo
        echo
        echo "*** ERROR [TyEE2E] ***"
        echo
        echo "$see_log_file"
        echo
        echo "This end-to-end test failed trice:"
        echo
        echo "  $cmd"
        echo
        echo
        echo "Run it with debug flags, and try to fix it:"
        echo
        # Later: use --localHostname=e2e-test-manual or just e2e-test, instead of -20, so won't overwrite test site nr 20.
        # (But first add a cname entry for -manual.)
        cmd_with_debug="$cmd_with_debug --deleteOldSite --localHostname=e2e-test-e$every-o$offset-retry --nt --da"  # dupl [5WAKEF02]
        # We cannot use "$EUID" -ne 0 to find out if the user is originally root, because
        # root first su:s to another user. Check the --is-root command line flag instead.
        #if [ -z "$is_root" ]; then
          echo "  $cmd_with_debug"
        #else
        #  echo "  su $my_username -c '$cmd_with_debug'"
        #  echo
        #  echo "Note: you are root. Don't forget 'su $my_username' (included above already)."
        #fi
        echo
        echo
        echo "Once it works, run it 33 times, and if it's flaky and fails once, that's ok:"
        echo "(Because the likelihood that a tests fails twice, is then 1/33/33 ~= 1/1000,"
        echo "so, with 100 such e2e tests, it's 90% probability of no double failures.)"
        echo
        echo "  rm e2e.log ;  for x in {1..33}; do echo \$x: ; $cmd |& tee -a e2e.log ; done"
        echo "  egrep -i -C10 '^error' e2e.log | gvim -"
        echo
        echo
        echo
        exit 1
      else
        echo "Ok, on the 3rd attempt. [TyME2ERETRYOK3]"
        echo
      fi
    else
      echo "Ok, on the 2nd attempt. [TyME2ERETRYOK2]"
      echo
    fi
  else
    echo "Ok. [EdM4RZW0J]"
    echo
    # The log file is uninteresting, since all went fine.
    rm -f $test_log_file
  fi
}

if [ "$1" = '--is-root' ]; then
  is_root=yes
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
  # 'yarn' doesn't work, result in a "Gatsby may not be installed" error. 'npm install' works.
  (npm install && yarn build && echo 'yarn-build-1' ) &
  yarn_build_gatsby_pid=$(jobs -l | grep yarn-build-1 | awk '{ printf $2; }')
  # Could copy the generated files and change from http: to https:, so can test
  # Gatsby under https too? [GATSBYHTTPS]
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
  # 'yarn' doesn't work, result in a "Gatsby may not be installed" error. 'npm install' works.
  (npm install && yarn build && echo 'yarn-build-2' ) &
  yarn_build_gatsby_pid2=$(jobs -l | grep yarn-build-2 | awk '{ printf $2; }')
  echo "Background building the Gatsby blog, ed-comments 0.4.4, in process id $yarn_build_gatsby_pid2"
  popd
fi
#------------------------------------------------------------

http_server_port=''
http_server_pid=''

function start_http_server {
  port="$1"
  http_server_port=$(netstat -nl | grep ":$port.*LISTEN")
  http_server_pid=''
  if [ -z "$http_server_port" ]; then
    echo "Starting a http server for embedded comments html pages..."
    ./node_modules/.bin/http-server "-p$port" target/ &
    # Field 2 is the process id.
    http_server_pid=$(jobs -l | grep "p$port" | awk '{ printf $2; }')
  fi
  # else: the user has probably started the server henself already, do nothing.
}


args=$@
site_nr=0

function runAllE2eTests {
  echo "Running all end-to-end tests..."

  r=runE2eTest

  # If you want to skip the first tests, then move the end-if down wards.
  if [ -z "SKIP these tests" ]; then
    echo
  fi

  # Start and exit the manual testing tests, just to verify this works.
  $r s/wdio --only manual.2browsers $args
  #
  # To restart, reusing same test site: (not deleting and recreating)
  #
  #   s/wdio --only manual.2browsers --dt --da --reuse --localHostname e2e-test-something

  $r s/wdio --only all-links $args   # RENAME to test-import  ?
  $r s/wdio --only create-site-password-run-admin-intro-tours $args
  $r s/wdio --only create-site-gmail-and-email-notf.1br.extidp $args
  $r s/wdio --only create-site-facebook.1br.extidp $args
  $r s/wdio --only create-site-github-uppercase-email.1br.extidp $args
  $r s/wdio --only create-site-linkedin.1br.extidp $args
  $r s/wdio --only create-site-admin-guide.2browsers $args
  $r s/wdio --only oauth-signup-signin $args
  $r s/wdio --only login-expire-idle-after.2br.mtime $args

  $r s/wdio --only forum-sort-and-scroll.2browsers $args

  $r s/wdio --only navigation-as-admin $args
  $r s/wdio --only navigation-as-member $args
  $r s/wdio --only navigation-as-stranger $args
  # Also:  embedded-comments-navigation-as-guest  further below.


  $r s/wdio --only sanitize-posts.2browsers $args

  $r s/wdio --only votes-and-best-first $args

  # RENAME to internal-backlinks.2br? (but not link-previews)
  $r s/wdio --only links-internal.2browsers $args

  $r s/wdio --only link-previews-internal-may-see.2br $args
  $r s/wdio --only link-previews-internal-not-see-cat.2br $args
  $r s/wdio --only link-previews-http-to-https.1br $args
  $r s/wdio --only embed-images-mp4-youtube.1br.extln $args
  $r s/wdio --only embed-twitter-tweets-etc.1br.extln $args
  $r s/wdio --only link-previews-all-others.1br.extln $args


  $r s/wdio --only view-edit-history.2br.mtime $args
  $r s/wdio --only upload-images-and-files.2br $args

  $r s/wdio --only direct-messages-notfs.3browsers $args
  $r s/wdio --only direct-messages-delete.2browsers $args
  $r s/wdio --only chat-basic.2br.mtime $args  #  broken [DRAFTS_BUG]
  $r s/wdio --only chat-create-from-direct-message.2browsers $args
  $r s/wdio --only chat-create-from-profile-pages.2browsers $args

  $r s/wdio --only categories-basic.3browsers $args
  #$r s/wdio --only categories-delete.2browsers $args

  $r s/wdio --only private-chat.3browsers $args

  # Is named 'forum-' because there's another test with 'drafts-not-logged-in' in the name.
  $r s/wdio --only forum-drafts-not-logged-in.2browsers $args
  $r s/wdio --only drafts-new-topic.2br.mtime $args
  $r s/wdio --only drafts-new-topic-from-cats-page $args
  $r s/wdio --only drafts-reply-edit-dir-msg.2br.mtime $args
  $r s/wdio --only drafts-chat-adv-ed.2browsers $args
  $r s/wdio --only drafts-delete $args

  $r s/wdio --only move-posts-same-page.2browsers $args
  $r s/wdio --only move-posts-other-page.2browsers $args
  # + delete-posts

  $r s/wdio --only settings-allowed-email-domains.2browsers $args
  $r s/wdio --only settings-toggle-login-required.3browsers $args
  $r s/wdio --only login-required-ext-signup-login.1br.extidp $args
  $r s/wdio --only login-required-join-global-chat.2br $args

  # Moderation   # RENAME to  modn- ...  instead of  admin- ...and MOVE to (4862065) below?
  $r s/wdio --only settings-approve-members.2browsers $args
  $r s/wdio --only admin-user-approve-reject.2browsers $args
  $r s/wdio --only admin-user-staff.2browsers $args
  $r s/wdio --only admin-user-threat-mild.2br.mtime $args
  $r s/wdio --only admin-user-threat-moderate.2br.mtime $args
  $r s/wdio --only admin-user-suspend.2browsers $args
  $r s/wdio --only admin-review-invalidate-for-reply.2br.mtime $args
  $r s/wdio --only admin-review-invalidate-page-deld.2br.mtime $args
  $r s/wdio --only admin-review-cascade-approval.2br.mtime $args
  $r s/wdio --only modn-approve-before.2br.mtime $args
  $r s/wdio --only modn-review-after.2br.mtime $args   # + liked, marked as solution
  $r s/wdio --only modn-appr-bef-comb-w-revw-aftr.2br.mtime $args
  $r s/wdio --only mod-review.2br.mtime $args  # RENAME to modn-by-moderator-not-admin

  $r s/wdio --only modn-from-disc-page-appr-befr.2browsers $args
  $r s/wdio --only modn-from-disc-page-review-after.2browsers $args

  # TESTS_MISSING
  #$r s/wdio --only modn-appr-deleted-posts.2browsers $args   [apr_deld_post]
  #$r s/wdio --only mod-task-emails-approve-before.2browsers $args
  #$r s/wdio --only mod-task-emails-review-after.2browsers $args

  $r s/wdio --only promote-demote-by-staff-join-leave-chats.2br $args
  #$r s/wdio --only promote-demote-by-system-join-leave-chats.2br $args

  $r s/wdio --only admin-move-hostname.2browsers $args

  $r s/wdio --only password-login-reset.2browsers $args
  $r s/wdio --only user-profile-access $args
  $r s/wdio --only user-profile-change-username $args
  $r s/wdio --only user-profile-change-email.2browsers $args
  $r s/wdio --only user-profile-change-password.2br.mtime $args
  $r s/wdio --only user-profile-cannot-delete-idp-email.1br.extidp $args
  $r s/wdio --only user-profile-activity-private.2browsers $args
  $r s/wdio --only user-self-delete-upd-groups.2browsers $args

  $r s/wdio --only group-profile-change-things.2browsers $args

  $r s/wdio --only many-users-mention-list-join-group.2browsers $args
  #$r s/wdio --only many-users-large-group.2browsers $args
  #$r s/wdio --only many-groups.2browsers $args
  #$r s/wdio --only many-users-many-large-groups.2browsers $args

  $r s/wdio --only custom-forms.3browsers $args

  $r s/wdio --only authz-view-as-stranger $args
  $r s/wdio --only authz-basic-see-reply-create $args
  $r s/wdio --only impersonate-post-as-other.2browsers $args
  $r s/wdio --only impersonate-restricted-areas $args


  # There're email notfs and unsubscription tests for guests, further below, in:
  # embedded-comments-guest-login-email-notf-unsbscribe
  $r s/wdio --only unsubscribe.2browsers $args
  $r s/wdio --only notf-emails-discussion.2br.mtime $args
  $r s/wdio --only notfs-like-votes.2browsers $args
  $r s/wdio --only notfs-mark-all-as-read.2browsers $args  # REANME append -manually
  $r s/wdio --only notfs-snooze-talk.2br.mtime $args
  $r s/wdio --only notf-override-group-prefs.2browsers $args
  $r s/wdio --only notfs-prefs-inherit-own.2browsers $args
  $r s/wdio --only notfs-prefs-inherit-group.2browsers $args
  $r s/wdio --only notf-prefs-custom-groups.2browsers $args
  $r s/wdio --only notf-prefs-private-groups.2browsers $args
  $r s/wdio --only notf-prefs-pages-replied-to.2br $args

  $r s/wdio --only notfs-page-gone.2browsers $args
  # Later:
  # Move page from a staff only cat, to a publ cat, and verify people who have
  # subscr to the publ cat and haven't seen the topic before, get notified.

  # See: specs/notf-page-cats-site.2browsers.test.ts:
  #$r s/wdio --only notfs-for-whole-site.2browsers $args
  #$r s/wdio --only notfs-for-publ-cat.2browsers $args
  #$r s/wdio --only notfs-for-priv-cat.2browsers $args
  #$r s/wdio --only notfs-for-publ-page.2browsers $args
  #$r s/wdio --only notfs-for-priv-group-page.2browsers $args
  #$r s/wdio --only notfs-for-dir-message.2browsers $args

  $r s/wdio --only notfs-mark-seen-as-seen.2browsers $args  # RENAME append -automatically

  # RENAME these to  modn-... ,  and MOVE to (4862065) below?
  $r s/wdio --only new-user-review-ok.2br.mtime $args
  #$r s/wdio --only new-user-review-bad.2browsers $args
  $r s/wdio --only new-member-allow-approve.2br.mtime $args
  #$r s/wdio --only new-member-allow-reject.2browsers $args
  $r s/wdio --only review-edits-ninja-late.2br.mtime $args

  # MOVE to (4862065) below?
  $r s/wdio --only spam-basic-local.2browsers $args
  $r s/wdio --only spam-basic-local-ip-links-unblock.2br.mtime $args
  $r s/wdio --only spam-basic-safe-browsing-api-blocked.2br.mtime $args
  $r s/wdio --only spam-basic-akismet-blocked.2br.mtime $args
  $r s/wdio --only spam-basic-akismet-false-positives.2br.mtime $args
  $r s/wdio --only spam-basic-akismet-false-negatives.2br.mtime $args
  $r s/wdio --only flag-member-block-agree.2browsers $args
  $r s/wdio --only flag-guest-block-agree.2browsers $args

  $r s/wdio --only page-type-discussion-progress $args
  $r s/wdio --only page-type-idea-statuses-comments $args
  $r s/wdio --only page-type-problem-statuses $args
  $r s/wdio --only page-type-question-closed.2browsers $args
  $r s/wdio --only page-type-info-page $args

  $r s/wdio --only search-public-basic.2browsers $args
  $r s/wdio --only search-private-chat.2browsers $args

  # This test is flaky because missing feature: disabling email notfs for replies
  # one has seen.
  $r s/wdio --only summary-emails.2br.mtime $args

  $r s/wdio --only invites-by-adm-click-email-set-pwd-link.2browsers $args
  $r s/wdio --only invites-by-mod-try-signup-after.2browsers $args
  $r s/wdio --only invites-by-core-try-login-after.2browsers $args
  $r s/wdio --only invites-weird-email-addrs.2browsers $args
  $r s/wdio --only invites-many-retry.2browsers $args
  $r s/wdio --only invites-too-many.2browsers $args
  $r s/wdio --only invite-to-groups.2browsers $args

  $r s/wdio --only weird-usernames.2browsers $args

  $r s/wdio --only group-mentions-built-in-groups.2browsers $args
  $r s/wdio --only group-mentions-custom-groups.2browsers $args

  $r s/wdio --only group-permissions-similar-topics.2br.mtime $args
  $r s/wdio --only permissions-edit-wiki-posts.2browsers $args

  $r s/wdio --only slow-3g-navigate-edit-drafts.2browsers $args


  # Moderation   (4862065)
  # ------------


  # API
  # ------------

  $r s/wdio --only api-upsert-categories.2browsers $args
  $r s/wdio --only api-upsert-pages.2browsers $args
  $r s/wdio --only api-upsert-page-notfs.2browsers $args
  $r s/wdio --only api-upsert-posts.2browsers $args

  $r s/wdio --only api-search-full-text $args
  $r s/wdio --only api-list-query-for-topics $args
  $r s/wdio --only api-list-query-for-posts $args

  # wip:
  # settings-allow-local-signup
  # settings-allow-signup
  # settings-disable-openauth


  # Usability Testing Exchange
  # ------------

  $r s/wdio --only utx-all-logins.1br.extidp $args


  #------------------------------------------------------------
  # Start a http server, for the embedding html pages,
  # and the -w-logout-url test.
  start_http_server 8080


  # Single Sign-On
  # ------------

  $r s/wdio --only sso-test.2browsers $args
  $r s/wdio --only sso-login-member.2browsers $args
  $r s/wdio --only sso-login-new-members.2browsers $args
  $r s/wdio --only sso-login-required.2browsers $args
  $r s/wdio --only sso-login-required-w-logout-url.2browsers $args
  # unimpl:  s/wdio --only sso-approval-required.2browsers $args
  # unimpl:  s/wdio --only sso-login-and-approval-required.2browsers $args
  $r s/wdio --only sso-admin-extra-login $args
  $r s/wdio --only sso-all-ways-to-login.2browsers $args
  $r s/wdio --only sso-access-denied-login.2browsers $args
  $r s/wdio --only sso-one-time-key-errors.2browsers $args


  # API + SSO
  # ------------

  $r s/wdio --only api-w-sso-upsert-pages.2browsers $args
  $r s/wdio --only api-private-chat-two-pps-sso-extid.2browsers $args
  $r s/wdio --only api-private-chat-two-pps-list-use-usernames.2browsers $args


  # API: CORS
  # ------------

  # $r s/wdio --only api-search-cors.UNIMPL.2br


  # Embedded forum
  # ------------

  #$r s/wdio --b3c  --only embforum.b3c.login.1br  $args
  #$r s/wdio --b3c  --only embforum.b3c.sso-login.1br $args


  # Embedded comments
  # ------------

  # For testing manually. Just verify the test starts properly.
  # For now, not "manual" (with 'l' at the end) — that'd start manual.2browsers too  o.O
  $r s/wdio       --only embcom.manua.2br $args

  # Also see navigation-as-* above.
  $r s/wdio       --only embedded-comments-navigation-as-guest $args

  $r s/wdio       --only embedded-comments-create-site-no-verif-email-admin-area-tour.2browsers $args
  $r s/wdio       --only embedded-comments-create-site-req-verif-email.2browsers $args
  $r s/wdio       --only embedded-comments-create-site-forum-intro-tour $args
  $r s/wdio       --only embedded-comments-create-site-import-disqus.2br $args
  $r s/wdio       --only embedded-comments-drafts-not-logged-in $args
  $r s/wdio       --only embedded-comments-scroll-and-load-more.2browsers $args
  #$r s/wdio       --only embedded-comments-scroll-embedding-page $args
  # (no -old-name version, because the new name is always included in the server's genetarted html.)
  $r s/wdio       --only embedded-comments-different-disc-ids-same-page $args
  $r s/wdio       --only embedded-comments-discussion-id.test $args
  $r s/wdio       --only embedded-comments-discussion-id-old-name $args
  $r s/wdio       --only embedded-comments-guest-login-email-notf-unsbscribe $args
  $r s/wdio       --only embcom.all-idp-logins.1br.extidp $args
  $r s/wdio       --only embcom.all-idp-logins-old-name.1br.extidp $args
  $r s/wdio --b3c --only embcom.b3c.verif-email.1br $args
  $r s/wdio --b3c --only embcom.b3c.guest.1br $args
  $r s/wdio --b3c --only embcom.b3c.verif-gmail.1br.extidp $args
  $r s/wdio --b3c --only embcom.b3c.unverif-gmail.1br.extidp $args
  $r s/wdio       --only embedded-comments-edit-and-vote.test $args
  $r s/wdio       --only embedded-comments-edit-and-vote-old-name $args
  $r s/wdio       --only embedded-comments-vote-first $args
  $r s/wdio       --only embedded-comments-conf-notf-pref-first $args
  $r s/wdio       --only embedded-comments-sort-order-op-likes-btn-txt.2browsers $args
  $r s/wdio       --only embedded-comments-category-refs.2browsers $args
  $r s/wdio       --only embedded-comments-cat-refs-and-disc-ids.2browsers $args
  $r s/wdio       --only embedded-comments-uploads-origin $args
  $r s/wdio       --only embedded-comments-short-script-cache-time $args
  # (all names included in short-cache-time already)

  # Do last, easier to debug the tests above instead if there's a bug:
  $r s/wdio       --only embedded-comments-create-site-export-json.2browsers $args
  $r s/wdio       --only embedded-comments-import-json-create-new-site.2browsers $args
  #$r s/wdio       --only embedded-comments-import-json-to-existing-emb-cmts-site.2browsers $args
  $r s/wdio       --only embedded-comments-restore-overwrite-site-same-domain.2browsers $args
  $r s/wdio       --only embedded-comments-restore-overwrite-site-new-domain.2browsers $args


  if [ -n "$http_server_pid" ]; then
    kill $http_server_pid
    echo "Stopped the http server for the embedded comments, pid $http_server_pid."
    http_server_pid=''
  fi
  #------------------------------------------------------------


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

  $r s/wdio --only embedded-comments-gatsby $args

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

  $r s/wdio --only embedded-comments-gatsby $args

  if [ -n "$server_port_8000_pid2" ]; then
    kill $server_port_8000_pid2
    wait $server_port_8000_pid2
    echo "Stopped the http server for the Gatsby blog, old ed-comments 0.4.4, pid $server_port_8000_pid2."
  fi
  #------------------------------------------------------------
}


runAllE2eTests


log_message "Done." >> $failfile
echo "Done running end-to-end tests."

# vim: et ts=2 sw=2 tw=0
