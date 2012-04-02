#!/bin/bash

play=/mnt/data/dev/play/github/play

set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true

# Don't deploy unless everything has been committed.
if [ ! -z "`git status --porcelain`" ]; then
  echo 'There are dirty files. Please run git status, and add and commit.'
  # exit 1
fi

# Build distribution.
# First, obfuscate debiki.js:
./yui.sh compress
$play dist
# Restore original debiki.js
./yui.sh undo
unzip -d dist/ dist/debiki-app-play-1.0-SNAPSHOT.zip

ssh_ec2_user="ssh -i /home/kajmagnus/debiki/hosting/amazon/debiki-az-ec2-keypair-1.pem"
ssh_play_user="ssh -i /home/kajmagnus/debiki/hosting/amazon/debiki-play-user.pem"
host=dw0azirdbpv11danny
basedir=/opt/debiki/debiki.se

rsync -avz \
  -e "$ssh_ec2_user"  \
  ./dist/debiki-app-play-1.0-SNAPSHOT/* \
  ec2-user@$host:$basedir/app1/

# Allow user `play' to run `start'.
$ssh_ec2_user \
  ec2-user@$host \
  "cd $basedir; chmod o+x app1/start"

$ssh_play_user \
  play@$host \
  "cd $basedir; ./restart1.sh"


