# ideas about what to do:  https://github.com/sbt/sbt-release

# finish writing:
#   /home/kajmagnus/Dropbox/debiki/docs/deploy-docker-todo-and-blog-post.txt

# Abort on any error
set -e

echo "Not so very tested. Do manually instead. Bye"
exit 1


# Check preconditions
# ----------------------

# COULD: Check is in project root, & is git repository, & no outstanding changes.
# COULD: Check all required ports open: 80, 443, 900, 9443, 9999, 3333


# Derive version number
# ----------------------

version="`cat version.txt`"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala [8GKB4W2]

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD: verify has git-pushed to origin
# COULD: verify is master branch?
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr


# Build Docker images
# ----------------------

sudo docker-compose down
sudo docker-compose build

# Optimize assets, run unit & integration tests and build the Play Framework image
# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
gulp release
# Delete unminified files, so Docker diffs a few MB smaller.
find public/res/ -type f -name '*\.js' -not -name '*\.min\.js' -not -name 'zxcvbn\.js' | xargs rm
find public/res/ -type f -name '*\.css' -not -name '*\.min\.css' | xargs rm
# COULD add tests that verifies the wrong css & js haven't been deleted?
# One at a time, or out-of-memory:
scripts/cli.sh clean compile
scripts/cli.sh test dist
sudo docker-compose down
docker/build-app-prod.sh


# Test the images
# ----------------------

# Run the 'latest' tag — it's for the images we just built above.
# '-p edt' = EffectiveDiscussions Test project.
test_containers="VERSION_TAG=latest docker-compose -p edt -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test/debug.yml -f modules/ed-prod-one-test-override.yml"
sudo $test_containers down
sudo rm -fr modules/ed-prod-one-test/data
sudo $test_containers up -d

# todo: wait until everything up and running
node_modules/selenium-standalone/bin/selenium-standalone start &
selenium_pid=$!

gulp build-e2e
# hmm this fails the first time — seems the app container is too slow, directly
# after startup. Needs some kind of warmup?
scripts/wdio target/e2e/wdio.conf.js --skip3 --only all-links
scripts/wdio target/e2e/wdio.conf.js --skip3 --only create-site
scripts/wdio target/e2e/wdio.2chrome.conf.js --skip3 --only chat.2browsers
scripts/wdio target/e2e/wdio.3chrome.conf.js --skip3 --only categories.3browsers

kill $selenium_pid
sudo $test_containers down


# All fine, so publish images and new version number.
# ----------------------

# todo: don't do this if WIP version

sudo docker tag debiki/ed-app debiki/ed-app:$version_tag
sudo docker tag debiki/ed-web debiki/ed-web:$version_tag
sudo docker tag debiki/ed-rdb debiki/ed-rdb:$version_tag

sudo docker push debiki/ed-app:$version_tag
sudo docker push debiki/ed-web:$version_tag
sudo docker push debiki/ed-rdb:$version_tag

echo $version_tag >> modules/ed-versions/version-tags.log
pushd .
cd modules/ed-versions/
git checkout master
git add version-tags.log
git commit -m "Add $version_tag."
git push origin master
popd

git tag $version_tag
scripts/bump-versions.sh

# no: Custom Git log message
# todo: bump patch number in version.txt, add -SNAPSHOT
