#!/bin/bash

# Usage:  s/git-range-stats.sh FROM_EXCL TO_INCL

# Shows files changed, and num lines, for each revision from but not including
# FROM_EXCL up to and including TO_INCL.

echo
echo "Here's stats for all commits"
echo "from excl     $(git log --oneline -n1 $1)"
echo "up to incl    $(git log --oneline -n1 $2)"
echo

for r in $(git rev-list $1..$2); do
  echo
  git log --oneline -n1 $r
  git diff --stat $r^ $r
done


