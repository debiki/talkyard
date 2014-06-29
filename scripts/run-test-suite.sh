#!/bin/bash

if [ -z "$play" ]; then
  play=scripts/play-2.2.3
fi

timeout_play="$play"
if [ "$1" = "--timeout" ]; then
  shift
  timeout_play="scripts/timeout.sh -t $1 -d 10 $play"
  shift
fi

$timeout_play "$@"
if [ $? -ne 0 ]; then
  echo "$@" >> target/tests-failed
fi
