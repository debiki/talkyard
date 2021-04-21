#!/bin/bash

# BUG this module no longer in use:
git_lock_file='.git/modules/modules/ed-versions/index.lock'
versions_file='version-tags.log'

promote_from_chan='tyse-v0-dev'
promote_to_chan='tyse-v0-regular'   #  [.must_be_dev_regular]

if [ -f $git_lock_file ]; then
  echo
  echo "Error: Git lock file exists: $git_lock_file"
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
cd relchans/$promote_from_chan
  git fetch origin $promote_from_chan
  git merge --ff-only origin/$promote_from_chan
  old_versions=$(cat $versions_file)
  wip_version_tag=$(echo "$old_versions" | tail -n1)
popd
next_version=$(cat version.txt)

if [ -z "$( echo "$wip_version_tag" | grep 'WIP-' )" ]; then
  echo "Not a WIP version tag: $wip_version_tag, no '-WIP-'."
  exit 1
fi

release_version_tag=$( echo "$wip_version_tag" | sed -r -e 's/WIP-//' )



# Sanity check version numbers

# version.txt should be newer than $wip_version_tag and
# $release_version_tag.

next_release_wip_sorted=$(echo \
"$next_version
$release_version_tag
$wip_version_tag" | sort -V)

# 'WIP' starts with uppercase, gets sorted before Git revision hashes.
# :-/ unless the rev starts with a number?  (9758964)
wip_release_next_expected=\
"$wip_version_tag
$release_version_tag
$next_version"

if [ "$next_release_wip_sorted" != "$wip_release_next_expected" ]; then
  echo "Is something amiss? When sorting versions, I get this:"
  echo
  echo "$next_release_wip_sorted"
  echo
  echo "But I expected:"
  echo
  echo "$wip_release_next_expected"
  echo
# exit 1  (9758964)
fi



echo "Promote latest version from: $promote_from_chan"
echo "                         to: $promote_to_chan ?  [y/n] — yes always, currently"
echo

echo "Latest version, to promote: $wip_version_tag   (in $promote_from_chan)"
echo "             Once promoted: $release_version_tag   (in $promote_to_chan)"
echo "    (Upcoming next version: $next_version)"
echo

# dupl code [bashutils]
read -p "Release WIP as debiki/talkyard-*:$release_version_tag? [y/n]  " choice
case "$choice" in
  y|Y|yes|Yes|YES ) echo "Ok, will do:"; echo ;;
  n|N|no|No|NO ) echo "Ok, doing nothing, bye."; exit 1;;
  * ) echo "What? Bye."; exit 1;;
esac



echo "Pulling debiki/talkyard-*:$wip_version_tag ..."
sudo docker pull debiki/talkyard-app:$wip_version_tag
sudo docker pull debiki/talkyard-web:$wip_version_tag
sudo docker pull debiki/talkyard-rdb:$wip_version_tag
sudo docker pull debiki/talkyard-cache:$wip_version_tag
sudo docker pull debiki/talkyard-search:$wip_version_tag
sudo docker pull debiki/talkyard-certgen:$wip_version_tag

echo "Done pulling."

# Here and below, Enter is enough, no need to confirm y/n again.
echo "Tag with debiki/talkyard-*:$release_version_tag?  Press Enter (or CTRL+C to exit)"
read -s -p ''

sudo docker tag debiki/talkyard-app:$wip_version_tag debiki/talkyard-app:$release_version_tag
sudo docker tag debiki/talkyard-web:$wip_version_tag debiki/talkyard-web:$release_version_tag
sudo docker tag debiki/talkyard-rdb:$wip_version_tag debiki/talkyard-rdb:$release_version_tag
sudo docker tag debiki/talkyard-cache:$wip_version_tag debiki/talkyard-cache:$release_version_tag
sudo docker tag debiki/talkyard-search:$wip_version_tag debiki/talkyard-search:$release_version_tag
sudo docker tag debiki/talkyard-certgen:$wip_version_tag debiki/talkyard-certgen:$release_version_tag


echo "Done. Publish to the official Docker image registry, debiki/talkyard-*:$release_version_tag?  Press Enter"
read -s -p ''

echo "Publishing..."

sudo docker push debiki/talkyard-app:$release_version_tag
sudo docker push debiki/talkyard-web:$release_version_tag
sudo docker push debiki/talkyard-rdb:$release_version_tag
sudo docker push debiki/talkyard-cache:$release_version_tag
sudo docker push debiki/talkyard-search:$release_version_tag
sudo docker push debiki/talkyard-certgen:$release_version_tag


echo "Lastly, publish version tag $release_version_tag to GitHub?  Press Enter"
read -s -p ''


echo "Publishing version tag $release_version_tag to GitHub..."

pushd .
cd relchans/$promote_to_chan
  git fetch origin $promote_to_chan
  git merge --ff-only origin/$promote_to_chan
  echo "$release_version_tag" >> $versions_file
  # The tag: edition (tyse), version and channel (regular).  [.must_be_dev_regular]
  release_version_tag_w_ed_chan="tyse-$release_version_tag-regular"
  git add $versions_file
  git commit -m "Release $release_version_tag_w_ed_chan."
  echo
  echo "DO THIS in relchans/$promote_to_chan/:"
  echo git branch -f $promote_to_chan
  echo git push origin $promote_to_chan
  # 'master' is for backw compat. Don't incl in v1. [ty_v1]
  if [ "$promote_to_chan" = 'tyse-v0-regular' ]; then
    git branch -f master
    echo git push origin master
  fi
popd

echo
echo "AND THIS in ./:"
# Future tag name:
# Need to include release channel in the Git tag, otherwise we'd try to push the
# same tag to different branches, e.g. push  tyse-v0.2021.04-abc123def
# to both the $promote_from_chan and $promote_to_chan branches — but then the last push
# would overwrite the first.  Instead, we push two different tags:
# tyse-v0.2021.04-abc123def-dev  and  tyse-v0.2021.04-abc123def-regular.
# [.must_be_dev_regular]
echo git tag $release_version_tag_w_ed_chan tyse-$wip_version_tag-dev

echo git push origin $release_version_tag_w_ed_chan

echo echo "Done, released $release_version_tag_w_ed_chan. Bye."
echo
