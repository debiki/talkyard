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
docker_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala [8GKB4W2]

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr


# Build Docker images
# ----------------------

docker-compose down
docker-compose build

# Run tests and build the 'play' container.
# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
s/s.sh clean test
gulp release
s/s.sh dist
docker/build-play-prod.sh


# Test the images
# ----------------------

test_containers="docker-compose -f modules/ed-prod-one-test/docker-compose.yml -f modules/ed-prod-one-test-override.yml"
$test_containers down
$test_containers up -d
# todo: wait until everything up and running
scripts/wdio target/e2e/wdio.conf.js --skip3
$test_containers down


# All fine, so publish images and new version number.
# ----------------------

# todo: don't do this if WIP version

docker tag debiki/ed-play debiki/ed-play:$docker_tag
docker tag debiki/ed-nginx debiki/ed-nginx:$docker_tag
docker tag debiki/ed-postgres debiki/ed-postgres:$docker_tag

docker push debiki/ed-play:$docker_tag
docker push debiki/ed-nginx:$docker_tag
docker push debiki/ed-postgres:$docker_tag

echo $docker_tag >> modules/ed-versions/versions.log
pushd .
cd modules/ed-versions/
git add --update
git commit -m "Adding verrsion $docker_tag."
git push origin master
popd


# no: Custom Git log message
# todo: bump patch number in version.txt, add -SNAPSHOT
