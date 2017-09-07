# ideas about what to do:  https://github.com/sbt/sbt-release

# Abort on any error
set -e

my_username=$(whoami)


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

echo 'Do in another shell:

  s/selenium-start-invisible

Press Enter to continue
'

read -s -p ''


# Derive version number
# ----------------------

version="`cat version.txt`"
version_tag="$version-`git rev-parse --short HEAD`"  # also in Build.scala [8GKB4W2]
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
./s/impl/release-as-root.sh $my_username $version_tag $@
echo "\$?" | tee ./target/build-exit-code

EOF_SUDO

build_exit_code=`cat ./target/build-exit-code`
echo "Build exit code: $build_exit_code"

if [ "$build_exit_code" != '0' ]; then
  echo
  echo Build failed. Aborting.
  echo
  die_if_in_script
fi

echo 'Buid completed.'



# Publish images to Docker repo
# ----------------------

echo 'Tag and publish to Docker? Press Enter to continue'

read -s -p ''


echo "Publishing to debiki/ed-*:$version_tag..."

sudo docker tag debiki/ed-app debiki/ed-app:$version_tag
sudo docker tag debiki/ed-web debiki/ed-web:$version_tag
sudo docker tag debiki/ed-rdb debiki/ed-rdb:$version_tag
sudo docker tag debiki/ed-cache debiki/ed-cache:$version_tag
sudo docker tag debiki/ed-search debiki/ed-search:$version_tag
sudo docker tag debiki/ed-certgen debiki/ed-certgen:$version_tag

sudo docker push debiki/ed-app:$version_tag
sudo docker push debiki/ed-web:$version_tag
sudo docker push debiki/ed-rdb:$version_tag
sudo docker push debiki/ed-cache:$version_tag
sudo docker push debiki/ed-search:$version_tag
sudo docker push debiki/ed-certgen:$version_tag


# Bump version number
# ----------------------

echo $version_tag >> modules/ed-versions/version-tags.log
pushd .
cd modules/ed-versions/
git checkout master
git add version-tags.log
git commit -m "Add $version_tag."
git push origin master
popd

git tag $version_tag
git push origin $version_tag
s/bump-versions.sh

# no: Custom Git log message
# todo: bump patch number in version.txt, add -SNAPSHOT
# vim: et ts=2 sw=2 tw=0 list
