#!/bin/bash

git_lock_file='.git/modules/modules/ed-versions/index.lock'


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
wip_version_tag=`tail -n1 modules/ed-versions/version-tags.log`

if [ -z "$( echo "$wip_version_tag" | grep 'WIP-' )" ]; then
  echo "Not a WIP version tag: $wip_version_tag, no '-WIP-'."
  exit 1
fi


echo "Release WIP version debiki/talkyard-*:$wip_version_tag?  Press Enter (or CTRL+C to exit)"
read -s -p ''


echo "Pulling debiki/talkyard-*:$wip_version_tag ..."
sudo docker pull debiki/talkyard-app:$wip_version_tag
sudo docker pull debiki/talkyard-web:$wip_version_tag
sudo docker pull debiki/talkyard-rdb:$wip_version_tag
sudo docker pull debiki/talkyard-cache:$wip_version_tag
sudo docker pull debiki/talkyard-search:$wip_version_tag
sudo docker pull debiki/talkyard-certgen:$wip_version_tag

echo "Done pulling."

release_version_tag=$( echo "$wip_version_tag" | sed -r -e 's/WIP-[0-9]+-//' )

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
git commit -m "Add $release_version_tag = the prev WIP, release tagged."
git push origin master
popd

git tag $release_version_tag $wip_version_tag
git push origin $release_version_tag

echo "Done. Bye."
