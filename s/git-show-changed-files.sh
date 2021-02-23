#!/bin/bash

# Shows which files changed, in each commit  from-commit  to-commit.
# But not what changed inside those files.
# — Nice when cleaning up a private branch, so can place related commits
# next to each other, and squash.


if [ "$#" -ne "2" ]; then
  echo "Usage: $0 from-commit to-commit"
  exit 1
fi

for commit_hash in $(git log --oneline $1...$2 | awk '{ print $1 }') ; do
  git show --stat --oneline $commit_hash
done

