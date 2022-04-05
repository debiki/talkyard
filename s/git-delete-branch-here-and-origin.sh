#!/bin/bash

# Exit on error.
set -e

branch_name="$1"

git branch -D "$branch_name"
git push origin --delete "$branch_name"


# Delete many with the same name part:
#  for b in $(git branch -a | grep dependabot | sed s+remotes/origin/++ )  ;  do echo git push origin --delete $b  ;  done

# Delete all from a specific repository, say, tytest, locally only:  (flags  -d -r  deletes the remote branch, locally only)
#
#   for b in $(git branch -a  | grep tytest | sed 's#remotes/##') ; do  git branch -d -r $b  ; done


