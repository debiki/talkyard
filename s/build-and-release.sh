# ideas about what to do:  https://github.com/sbt/sbt-release

# Abort on any error
set -e

if [ `id -u` -eq 0 ]; then
  echo "You are root. Don't run this as root please. Instead, you'll be asked for the root password only when needed."
  exit 1
fi

my_username=$(whoami)

push_to_repo=`sed -nr 's/DOCKER_PUSH_TO_REPOSITORY= *([^ \t\r\n#]*/\1/p' .env`
push_to_tag=`sed -nr 's/DOCKER_PUSH_TO_TAG= *([^ \t\r\n#]*/\1/p' .env`


# This'll make us call `exit 1` if there's an error, and we're running all this via a script.
is_in_script=true

# Won't exit if we're doing stuff manually on the command line (because it's annoying
# if the terminal suddenly disappears).
function die_if_in_script {
  if [ -n "$is_in_script" ]; then
    echo "Bye."
    exit 1
  fi
}


# Check preconditions
# ----------------------

# COULD: Check is in project root, & is git repository, & no outstanding changes.
# COULD: Check all required ports open: 80, 443, 900, 9443, 9999, 3333

if [ -n "`jobs`" ]; then
  echo 'Other jobs running:'
  jobs
  echo 'Please stop them.'
  die_if_in_script
fi



# Start Selenium server
# ----------------------

if [ -z "`which xvfb-run`" ]; then
  echo
  echo 'Note:'
  echo 'xvfb not installed, cannot run tests headlessly. To install it:'
  echo 'run:  sudo apt-get install xvfb'
  echo '(works on Linux only, perhaps Mac)'
  echo
fi

chromedrivers="$(ls -1 node_modules/selenium-standalone/.selenium/chromedriver/)"
if [ -z "$chromedrivers" ]; then
  echo 'You need to install browser drivers for End-to-End tests. Do in another shell:

  s/selenium-install
'
  die_if_in_script
fi


test_selenium_up='curl --output /dev/null --silent --head --fail http://127.0.0.1:4444'
if $($test_selenium_up) ; then
  echo 'Selenium already running, fine.'
else
  echo 'Do in another shell: (so I can run end-to-end tests)

  s/selenium-start-invisible
'
  printf 'Waiting for you'
  until $($test_selenium_up); do
    printf '.'
    sleep 2
  done
fi



# Derive version number
# ----------------------

version="`cat version.txt`"
if [ "$version" != 'latest' ]; then
  version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala and gulpfile.js [8GKB4W2]
fi
echo "Building and releasing $version_tag"

# COULD: verify version nr changed since last time
# COULD: verify version nr matches vX.YY.ZZ
# COULD: verify has git-pushed to origin
# COULD: verify is master branch?
# COULD ask confirm if major or minor bumped (but not if patch bumped)
# COULD ask confirm if version nr less than previous nr


# Build and run tests
# ----------------------

current_dir=`pwd`

sudo -i bash << EOF_SUDO

cd $current_dir
rm -f ./target/build-exit-status

./s/impl/release-as-root.sh $my_username $version_tag $@
echo "\$?" | tee ./target/build-exit-code

EOF_SUDO

build_exit_status=`cat ./target/build-exit-status`
#build_exit_code=`cat ./target/build-exit-code`

echo
echo "Build result: $build_exit_status, exit code: $build_exit_code"

if [ "$build_exit_status" != 'BUILD_OK' ]; then
  echo
  echo Build failed. Aborting.
  echo
  die_if_in_script
fi

echo 'Buid completed.'



# Publish images to Docker repo
# ----------------------

the_tag="$version_tag"

# Can set $push_to_tag = 'latest' when running a test repo on localhost.
if [ -n "$push_to_tag" ]; then
  the_tag="$push_to_tag"
fi

echo "Tag images with $push_to_repo/talkyard-*:$the_tag? Press Enter (or CTRL+C to exit)"
read -s -p ''

# The images we built have the 'latest' tag.
sudo docker tag debiki/talkyard-web:latest     $push_to_repo/talkyard-web:$the_tag
sudo docker tag debiki/talkyard-app:latest     $push_to_repo/talkyard-app:$the_tag
sudo docker tag debiki/talkyard-rdb:latest     $push_to_repo/talkyard-rdb:$the_tag
sudo docker tag debiki/talkyard-cache:latest   $push_to_repo/talkyard-cache:$the_tag
sudo docker tag debiki/talkyard-search:latest  $push_to_repo/talkyard-search:$the_tag
sudo docker tag debiki/talkyard-certgen:latest $push_to_repo/talkyard-certgen:$the_tag


echo "Done. Push to the '$push_to_repo' Docker image registry, tag '$the_tag'? Press Enter"
read -s -p ''

echo "Pushing to $push_to_repo/talkyard-*:$the_tag..."

# When the first part of the tag is a hostname and port, Docker interprets this as the
# location of a registry, when pushing. So, if $push_to_repo is 'localhost:5000',
# Docker will push to your repo presumably running on localhost at port 5000.
# (See: https://docs.docker.com/registry/deploying/#copy-an-image-from-docker-hub-to-your-registry)
sudo docker push $push_to_repo/talkyard-web:$the_tag
sudo docker push $push_to_repo/talkyard-app:$the_tag
sudo docker push $push_to_repo/talkyard-rdb:$the_tag
sudo docker push $push_to_repo/talkyard-cache:$the_tag
sudo docker push $push_to_repo/talkyard-search:$the_tag
sudo docker push $push_to_repo/talkyard-certgen:$the_tag

echo "Done pushing to repo: $push_to_repo, tag: $the_tag"


# Bump version number
# ----------------------

if [ -n "$push_to_tag" ]; then
  echo "Not bumping and publishing any version tag to GitHub — because this is a test build?"
  exit
fi


echo "Publishing version tag $version_tag to GitHub..."

pushd .
cd modules/ed-versions/
git fetch
git checkout master
git merge --ff-only origin master
echo $version_tag >> version-tags.log
git add version-tags.log
git commit -m "Add $version_tag."
git push origin master
popd

echo "Bumping version number..."

git tag $version_tag
git push origin $version_tag
s/bump-versions.sh

echo "Done. Bye."


# vim: et ts=2 sw=2 tw=0 list
