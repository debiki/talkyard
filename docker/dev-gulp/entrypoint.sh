#!/bin/bash

cd /opt/debiki/server

# Create user 'owner' with the same id as the person who runs docker, so that file
# 'gulp build' creates will be owned by that person (otherwise they'll be owned by root
# on the host machine. Which makes them invisible & unusable, on the host machine).
id -u owner >> /dev/null 2>&1
if [ $? -eq 1 ] ; then
  # $? -eq 1 means that the last command failed, that is, user 'owner' not yet created.
  # So create it:
  # (--home-dir needs to be specified, because `npm install` and `bower install` write to
  #   cache dirs in the home dir.
  # `ls -adn | cut -f 3 -d ' '` finds the user id of the above-mentioned directory owner. )
  useradd --home-dir /opt/debiki/server/.docker-dev-gulp-home --uid `ls -adn | cut -f 3 -d " "` owner
fi

if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Try "gulp"?'
  echo 'The whole docker-compose command would then be:'
  echo '  docker-compose run --rm gulp gulp'
  echo '(the first "gulp" is the container name, the second is the gulp build command).'
else
  su -c "$*" owner
fi

