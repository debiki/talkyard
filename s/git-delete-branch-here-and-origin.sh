#!/bin/bash

# Exit on error.
set -e

branch_name="$1"

git branch -D "$branch_name"
git push origin --delete "$branch_name"


# Delete many with the same name part:
#  for b in $(git branch -a | grep dependabot | sed s+remotes/origin/++ )  ;  do echo git push origin --delete $b  ;  done

