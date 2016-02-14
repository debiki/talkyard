#!/bin/bash

# *** Dupl code *** see dev-gulp/entrypoint.sh too [7GY8F2]
# (Cannot fix, Docker doesn't support symlinks in build dirs.)

cd /opt/debiki/server

# Create user 'owner' with the same id as the person who runs docker, so that file
# 'gulp build' creates will be owned by that person (otherwise they'll be owned by root
# on the host machine. Which makes them invisible & unusable, on the host machine).
id -u owner >> /dev/null 2>&1
if [ $? -eq 1 ] ; then
  # $? -eq 1 means that the last command failed, that is, user 'owner' not yet created.
  # So create it:
  # `ls -adn | cut -f 3 -d ' '` finds the user id of the above-mentioned directory owner. )
  useradd --uid `ls -adn | cut -f 3 -d " "` owner
  # We'll map /home/owner/.ivy and .m2 to the host user's .ivy and .m2.
  mkdir /home/owner
  chown -R owner:owner /home/owner
fi


if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Exiting.'
  exit 0
fi

echo Running the Play CMD:
set -x

# Without exec, Docker wouldn't be able to stop the container normally.
# See: https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/#entrypoint
# """uses the exec Bash command so final running application becomes container’s PID 1"""
# — they use 'gosu' instead of 'su':  exec gosu postgres "$@"
# but for me 'su' works fine.
exec su -c "$*" owner

