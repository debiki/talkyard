#!/bin/bash

retry_in_dir="$1"
shift

echo "Looking in $retry_in_dir:"

# Ok w dupl code — wdio6 will "soon" be gone.
#names_to_retry_all="$(find  $retry_in_dir -type f -regex '.*\.\(test.ts\|e2e.ts\)--ty-e2e-log.*' | sed -r 's#target/[^/]+/(.*)--ty-e2e-log.*#\1#' | sort | uniq)"
names_to_retry_wdio6="$(find $retry_in_dir -type f -regex '.*\.test.ts--ty-e2e-log.*' | sed -r 's#target/[^/]+/(.*)--ty-e2e-log.*#\1#' | sort | uniq)"
names_to_retry_wdio7="$(find $retry_in_dir -type f -regex  '.*\.e2e.ts--ty-e2e-log.*' | sed -r 's#target/[^/]+/(.*)--ty-e2e-log.*#\1#' | sort | uniq)"

echo
echo 'Retrying these e2e tests, with Webdriverio 6:'
echo
echo "$names_to_retry_wdio6"
echo
echo 'And these e2e tests, with Webdriverio 7:'
echo
echo "$names_to_retry_wdio7"
echo

bad=''

for to_retry in $names_to_retry_wdio6 ; do
  cmd="s/wdio --only $to_retry --3 --secretsPath /home/user/styd/e2e-secrets.json --skipFacebook $@"
  echo "$cmd"
  $cmd
  status=$?
  if [[ status -ne 0 ]]; then
    bad="$bad
    - $to_retry"
    echo
    echo "ERROR AGAIN:  $n"
    echo
  fi
done

for to_retry in $names_to_retry_wdio7 ; do
  cmd="s/tyd e7 $to_retry --3 --secretsPath /home/user/styd/e2e-secrets.json --skipFacebook --cd $@"
  echo "$cmd"
  $cmd
  status=$?
  if [[ status -ne 0 ]]; then
    bad="$bad
    - $to_retry"
    echo
    echo "ERROR AGAIN:  $n"
    echo
  fi
done

echo
echo "Done retrying."

if [ -n "$bad" ]; then
  echo
  echo "These tests failed again:  $bad"
  echo
fi

