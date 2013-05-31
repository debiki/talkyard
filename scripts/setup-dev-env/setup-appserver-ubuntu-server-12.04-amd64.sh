#!/usr/bin/env bash

help_text="
This script installs Java 7, Play Framework, Node.js, Grunt and
Node.js modules.

It is used by a certain Vagrant bootstrap script, but you can
probably run it yourself on your own Ubuntu 12.04 desktop/laptop,
if you want to run Play directly on your desktop/laptop,
rather than from inside a Vagrant VM (since a VM is rather slow).
(No warranties through!)

Usage:
  $0  play-framework-installation-dir  nodejs-build-dir  nodejs-installation-dir

For example:
  $0 ~/dev/play ~/dev/nodejs /usr/local
"

# The script's parent directory. See:
# http://stackoverflow.com/questions/59895/can-a-bash-script-tell-what-directory-its-stored-in
# (Must do this before cd:ing to other directories.)
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"


set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true


# Parse input.

if [ "$#" -ne "3" -a "$#" -ne "4" ]; then
  echo "$help_text"
  exit 1
fi

# This 'play_owner' block only runs when this script is run via
# a certain Vagrant bootstrap script.
play_owner=""
if [ "$#" = "4" ]; then
  # Remember to make the 'vagrant' user able to run Play, later on.
  play_owner="$4"
  if [ "$play_owner" != "vagrant" ]; then
    echo "$help_text"
    exit 1
  fi
fi

play_framework_installation_dir="$1"
node_build_dir="$2"
node_installation_dir="$3"



echo '===== Installing Java 7 JDK and `unzip`'

sudo apt-get update
sudo apt-get -y install openjdk-7-jdk unzip



echo '===== Installing Play Framework 2.1.1'

play_parent=$play_framework_installation_dir
play_zip_file=play-2.1.1.zip
play_dir_name=play-2.1.1
# Warning: Also defined in: vagrant-bootstrap-ubuntu-server-12.04-amd64.sh
play_script_path=$play_parent/$play_dir_name/play

if [ ! -f $play_script_path ]; then
  mkdir -p $play_parent
  cd $play_parent
  if [ ! -f $play_zip_file ]; then
    wget -nv http://downloads.typesafe.com/play/2.1.1/$play_zip_file
  fi
  rm -fr $play_dir_name
  unzip -q $play_zip_file
  chmod a+x $play_dir_name/play

  # If we're executing this script as root, give ownership of
  # the Play installation to the Vagrant user. (The user that runs Play
  # needs write access to the Play installation, so SBT can download JARs.)
  if [ -n "$play_owner" ]; then
    chown --recursive $play_owner:$play_owner $play_parent
  fi
fi



node_version=v0.10.5
echo "===== Installing Node.js $node_version and Grunt CLI"

# COULD avoid installing Node if a newer version is already installed? Check `npm --version`?

node_dir_name=node-$node_version
node_zip_file=node-$node_version.tar.gz

if [ -z "`which node`" ] || [ "$node_version" \> "`node --version`" ]; then
  sudo apt-get -y install build-essential python
  mkdir -p "$node_build_dir"
  cd "$node_build_dir"
  if [ ! -f $node_zip_file ]; then
    wget -nv http://nodejs.org/dist/$node_version/$node_zip_file
  fi
  # In case any previous build is only somewhat completed, perhaps
  # better start from scratch? So remove directory.
  rm -fr $node_dir_name
  tar -xzf $node_zip_file
  cd $node_dir_name
  ./configure --prefix=$node_installation_dir
  make
  sudo make install
fi

if [ -z `which grunt` ]; then
  sudo npm install -g grunt-cli
fi



echo '===== Installing local NPM modules'

# Move to the base directory (the one with .git in, and a package.js Node.js file).

echo "This script is located in: $script_dir"
echo cd $script_dir/../..
cd $script_dir/../..
echo 'Running `npm install` in:' `pwd`

npm install



cat <<EOF

===== Installation done

- Java installed: \`java\` and \`javac\` now available.

- Node.js and Grunt installed: \`npm\` and \`grunt\` now available.
  Installed here: $node_installation_dir/
  Build dir: $node_build_dir/

- Play Framework installed, find the startup script here:
    $play_script_path
EOF

# Only show this help message if running this script manually, i.e.
# when it's not run by Vagrant.
if [ -z "$play_owner" ]; then
  cat <<-EOF
		
		You could add an alias or a softlink to the Play Framework startup script
		so that you can easily start Play. For example, add to your .bashrc:
		
		  alias play-2.1.1='$play_script_path'
		
		Alternatively, add an \`export\` to your .bashrc:
		
		  export PATH=\$PATH:$play_parent/$play_dir_name/
		
		  Then \`play\` (but not \`play-2.1.1\`) will be available on your \$PATH.
		  (See http://www.playframework.com/documentation/2.1.1/Installing )
		
		Afterwards, you can run \`play-2.1.1\` (or \`play\`) in this directory.
		EOF
fi


# vim: list ts=2 sw=2
