#!/bin/bash

wip_version_tag=`tail -n1 modules/ed-versions/version-tags.log`

if [ -z "$( echo "$wip_version_tag" | grep 'WIP-' )" ]; then
  echo "Not a WIP version tag: $wip_version_tag, no '-WIP-'."
  exit 1
fi


echo "Release WIP version debiki/talkyard-*:$wip_version_tag? Press Enter (or CTRL+C to exit)"
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

echo "Tag with debiki/talkyard-*:$release_version_tag? Press Enter (or CTRL+C to exit)"
read -s -p ''

sudo docker tag debiki/talkyard-app:$wip_version_tag debiki/talkyard-app:$release_version_tag
sudo docker tag debiki/talkyard-web:$wip_version_tag debiki/talkyard-web:$release_version_tag
sudo docker tag debiki/talkyard-rdb:$wip_version_tag debiki/talkyard-rdb:$release_version_tag
sudo docker tag debiki/talkyard-cache:$wip_version_tag debiki/talkyard-cache:$release_version_tag
sudo docker tag debiki/talkyard-search:$wip_version_tag debiki/talkyard-search:$release_version_tag
sudo docker tag debiki/talkyard-certgen:$wip_version_tag debiki/talkyard-certgen:$release_version_tag


echo "Done. Publish to the official Docker image registry, debiki/talkyard-*:$release_version_tag? Press Enter"
read -s -p ''

echo "Publishing..."

sudo docker push debiki/talkyard-app:$release_version_tag
sudo docker push debiki/talkyard-web:$release_version_tag
sudo docker push debiki/talkyard-rdb:$release_version_tag
sudo docker push debiki/talkyard-cache:$release_version_tag
sudo docker push debiki/talkyard-search:$release_version_tag
sudo docker push debiki/talkyard-certgen:$release_version_tag


echo "Lastly, publish to GitHub? Press Enter"
read -s -p ''


echo "Publishing version tag $release_version_tag to GitHub..."

pushd .
cd modules/ed-versions/
git fetch
git checkout master
git merge --ff-only origin master
echo $release_version_tag >> version-tags.log
git add version-tags.log
git commit -m "Add $release_version_tag = the prev WIP, release tagged."
git push origin master
popd

git tag $release_version_tag $wip_version_tag
git push origin $release_version_tag

echo "Done. Bye."
