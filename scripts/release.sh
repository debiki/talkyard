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
# COULD: Check all required ports open


# Derive version number
# ----------------------

version="`cat version.txt`"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala [8GKB4W2]

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr


# Build Docker images
# ----------------------

sudo docker-compose down
sudo docker-compose build

# Optimize assets, run unit & integration tests and build the Play Framework image
# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
gulp release
scripts/cli.sh clean test dist
sudo docker-compose down
docker/build-play-prod.sh


# Test the images
# ----------------------

# Run the 'latest' tag — it's for the images we just built above.
# '-p edt' = EffectiveDiscussions Test project.
test_containers="VERSION_TAG=latest docker-compose -p edt -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test/debug.yml -f modules/ed-prod-one-test-override.yml"
sudo $test_containers down
# TODO move data stuff to data/whatever/ instead of whatever-data/?
sudo rm -fr modules/ed-prod-one-test/postgres-data
sudo rm -fr modules/ed-prod-one-test/redis-data
sudo rm -fr modules/ed-prod-one-test/uploads
sudo $test_containers up -d

# todo: wait until everything up and running
node_modules/selenium-standalone/bin/selenium-standalone start &
selenium_pid=$!

gulp build-e2e
# hmm this fails the first time — seems the Play container is too slow, directly
# after startup. Needs some kind of warmup?
scripts/wdio target/e2e/wdio.conf.js --skip3

kill $selenium_pid
sudo $test_containers down


# All fine, so publish images and new version number.
# ----------------------

# todo: don't do this if WIP version

sudo docker tag debiki/ed-play debiki/ed-play:$version_tag
sudo docker tag debiki/ed-nginx debiki/ed-nginx:$version_tag
sudo docker tag debiki/ed-postgres debiki/ed-postgres:$version_tag

sudo docker push debiki/ed-play:$version_tag
sudo docker push debiki/ed-nginx:$version_tag
sudo docker push debiki/ed-postgres:$version_tag

echo $version_tag >> modules/ed-versions/version-tags.log
pushd .
cd modules/ed-versions/
git checkout master
git add --update
git commit -m "Add $version_tag."
git push origin master
popd

git tag $version_tag
scripts/bump-assets-version.sh

# no: Custom Git log message
# todo: bump patch number in version.txt, add -SNAPSHOT
