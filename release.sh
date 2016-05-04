# ideas about what to do:  https://github.com/sbt/sbt-release

# finish writing:
#   /home/kajmagnus/Dropbox/debiki/docs/deploy-docker-todo-and-blog-post.txt

# Abort on any error
set -e

# COULD: Check is in project root, & is git repository, & no outstanding changes.
# COULD: Check all required ports open

docker_tag="`cat version.txt`-`git rev-parse --short HEAD`"

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr

docker-compose down
docker-compose build

s/s.sh clean
s/s.sh test  # SHOULD test other projects too (i.e. debiki-core)
# (We'll run e2e tests later, against the modules/ed-prod-one-tests containers.)
gulp release
s/s.sh dist
sudo docker/build-play-prod.sh


pushd .
cd modules/ed-prod-one-test/
docker-compose down
docker-compose up -d
popd

# todo: wait until everything up and running

# run system tests against ed-prod-one-tests
wdio ...
pushd .
cd modules/ed-prod-one-test/
docker-compose down
popd


# All fine, so publish images and new version number.

echo $docker_tag >> modules/ed-versions/versions.log
pushd .
cd modules/ed-versions/
git add --update
git commit -m "Adding verrsion $docker_tag."
git push origin master
popd

sudo docker tag debiki/ed-play debiki/ed-play:$docker_tag
sudo docker tag debiki/ed-nginx debiki/ed-nginx:$docker_tag
sudo docker tag debiki/ed-postgres debiki/ed-postgres:$docker_tag

sudo docker push debiki/ed-play:$docker_tag
sudo docker push debiki/ed-nginx:$docker_tag
sudo docker push debiki/ed-postgres:$docker_tag


# no: Custom Git log message
# todo: bump patch number in version.txt, add -SNAPSHOT
