#!/bin/bash

# BUG this module no longer in use:
git_lock_file='.git/modules/modules/ed-versions/index.lock'
git_lock_file2='.git/modules/relchans/tyse-v0-regular/index.lock'
versions_file='version-tags.log'

promote_from_branch='tyse-v0-dev'
promote_to_branch='tyse-v0-regular'   #  [.must_be_dev_regular]

if [ -f $git_lock_file2 ]; then
  echo
  echo "Error: Git lock file exists: $git_lock_file2"
  echo
  echo "Some Git tool running, or crashed?"
  exit 1
fi


echo
echo "Before running this script:"
echo "   type  git push whatever"
echo "   and   sudo docker login"
echo "so you're logged in."
echo
echo "Done already?  Then hit enter. Otherise CTRL+C to exit and login."
echo
read -s -p ''

# Exit on any error. That's important, so we don't push a tag to Git,
# although some image wasn't uploaded / tagged properly.
set -e

# (Don't use <root>/version.txt — that's the *next* version, not yet released.)
pushd .
cd relchans/$promote_from_branch
  git fetch origin $promote_from_branch
  git merge --ff-only origin/$promote_from_branch
  old_versions=$(cat $versions_file)
  release_version_tag=$(echo "$old_versions" | tail -n1)
popd
next_version=$(cat version.txt)


# Sanity check version numbers

# $next_version (which is the next version, from version.txt) should be newer than
# $release_version_tag (which we're promoting now) — it should appear after,
# when sorted:

versions_sorted=$(echo \
"$next_version
$release_version_tag" | sort -V)

versions_expected=\
"$release_version_tag
$next_version"

if [ "$versions_sorted" != "$versions_expected" ]; then
  echo "Is something amiss? When sorting versions, I get this:"
  echo
  echo "$versions_sorted"
  echo
  echo "But I expected:"
  echo
  echo "$versions_expected"
  echo
  exit 1
fi



echo "  Do you want to promote:  $release_version_tag"
echo "     from release branch:  $promote_from_branch"
echo "       to release branch:  $promote_to_branch"
echo "  (Upcoming next version:  $next_version)"
echo

# dupl code [bashutils]
read -p "Promote? [y/n]  " choice
case "$choice" in
  y|Y|yes|Yes|YES ) echo "Ok, will do:"; echo ;;
  n|N|no|No|NO ) echo "Ok, doing nothing, bye."; exit 1;;
  * ) echo "What? Bye."; exit 1;;
esac



echo
echo "First, let's verify that all debiki/talkyard-*:$release_version_tag images exist:"
echo

set -x
sudo docker pull debiki/talkyard-app:$release_version_tag
sudo docker pull debiki/talkyard-web:$release_version_tag
sudo docker pull debiki/talkyard-rdb:$release_version_tag
sudo docker pull debiki/talkyard-cache:$release_version_tag
sudo docker pull debiki/talkyard-search:$release_version_tag
sudo docker pull debiki/talkyard-certgen:$release_version_tag
set +x

echo
echo "All images found, fine."

pushd .
cd relchans/$promote_to_branch

  # `git remote -v` prints e.g.:  (with tabs as first separator)
  #   origin	https://github.com/debiki/talkyard-versions.git (fetch)
  #   origin	https://github.com/debiki/talkyard-versions.git (push)
  # Let's store the URL in $push_dest:
  push_dest="$(git remote -v | grep push | sed -nr 's/\S+\s+(\S+)\s+.*/\1/p')"

  # dupl code [bashutils]
  read -p "Publish version tag $release_version_tag to branch: $promote_to_branch, repo: $push_dest? [y/n]  " choice
  case "$choice" in
    y|Y|yes|Yes|YES ) echo "Ok, will do:"; echo ;;
    n|N|no|No|NO ) echo "Ok, doing nothing, bye."; exit 1;;
    * ) echo "What? Bye."; exit 1;;
  esac

  echo
  echo "Publishing $release_version_tag ..."
  echo

  set -x
  git fetch origin $promote_to_branch
  git checkout $promote_to_branch
  git merge --ff-only origin/$promote_to_branch
  echo "$release_version_tag" >> $versions_file
  # The tag: edition (tyse), version and channel (regular).  [.must_be_dev_regular]
  release_version_tag_w_branch="tyse-$release_version_tag-regular"
  git add $versions_file
  git commit -m "Release $release_version_tag_w_branch."
  set +x
  echo
  echo "In $(pwd):"
  echo
  set -x
  git push origin $promote_to_branch
  # 'master' is for backw compat. Don't incl in v1. [ty_v1]
  if [ "$promote_to_branch" = 'tyse-v0-regular' ]; then
    git branch -f master
    git push origin master
  fi
popd

# Future tag name:
# Need to include release channel in the Git tag, otherwise we'd try to push the
# same tag to different branches, e.g. push  tyse-v0.2021.04-abc123def
# to both the $promote_from_branch and $promote_to_branch branches — but then the last push
# would overwrite the first.  Instead, we push two different tags:
# tyse-v0.2021.04-abc123def-dev  and  tyse-v0.2021.04-abc123def-regular.
# [.must_be_dev_regular]
git tag $release_version_tag_w_branch tyse-$release_version_tag-dev

git push origin $release_version_tag_w_branch

set +x
echo
echo "Done, released $release_version_tag_w_branch. Bye."
echo
