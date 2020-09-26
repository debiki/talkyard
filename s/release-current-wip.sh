#!/bin/bash

git_lock_file='.git/modules/modules/ed-versions/index.lock'
versions_file='modules/ed-versions/version-tags.log'


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
old_versions=$(cat $versions_file)
wip_version_tag=$(echo "$old_versions" | tail -n1)
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
wip_release_next_expected=\
"$wip_version_tag
$release_version_tag
$next_version"

if [ "$next_release_wip_sorted" != "$wip_release_next_expected" ]; then
  echo "Error, something is amiss! When sorting versions, I get this:"
  echo
  echo "$next_release_wip_sorted"
  echo
  echo "But I expected:"
  echo
  echo "$wip_release_next_expected"
  echo
  exit 1
fi



echo "WIP version, canary released: $wip_version_tag"
echo "WIP once production released: $release_version_tag"
echo "      (Upcoming next version: $next_version)"
echo
# dupl code [bashutils]
read -p "Release WIP as debiki/talkyard-*:$release_version_tag? [y/n]  " choice
case "$choice" in
  y|Y|yes|Yes|YES ) echo "Ok, will do:"; echo ;;
  n|N|no|No|NO ) echo "Ok, doing nothing, bye."; exit 1;;
  * ) echo "What? Bye."; exit 1;;
esac

echo "Step through the below manually once now ..."
exit 1

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
cd modules/ed-versions/
git fetch
git checkout master
git merge --ff-only origin/master
echo $release_version_tag >> version-tags.log
git add version-tags.log
git commit -m "Release $release_version_tag."
git push origin master
popd

git tag $release_version_tag $wip_version_tag
git push origin $release_version_tag

echo "Done. Bye."
echo
