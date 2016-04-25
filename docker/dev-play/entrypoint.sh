#!/bin/bash

# *** Dupl code *** see dev-gulp/entrypoint.sh too [7GY8F2]
# (Cannot fix, Docker doesn't support symlinks in build dirs.)

cd /opt/debiki/server

# Create user 'owner' with the same id as the person who runs docker, so that file
# 'gulp build' creates will be owned by that person (otherwise they'll be owned by root
# on the host machine. Which makes them invisible & unusable, on the host machine).
# But skip this if we're root already (perhaps we're root in a virtual machine).
file_owner_id=`ls -adn | awk '{ print $3 }'`
id -u owner >> /dev/null 2>&1
if [ $? -eq 1 -a $file_owner_id -ne 0 ] ; then
  # $? -eq 1 means that the last command failed, that is, user 'owner' not yet created.
  # So create it:
  # We map /home/owner/.ivy and .m2 to the host user's .ivy and .m2 (in the Dockerfile).
  # -D = don't assign password (would block Docker waiting for input).
  adduser -u $file_owner_id -h /home/owner/ -D owner
fi


if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Exiting.'
  exit 0
fi

echo Running the Play CMD:

# Without exec, Docker wouldn't be able to stop the container normally.
# See: https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/#entrypoint
# """uses the exec Bash command so final running application becomes container’s PID 1"""
# — they use 'gosu' instead of 'su':  exec gosu postgres "$@"
# but for me 'su' works fine.
if [ $file_owner_id -ne 0 ] ; then
  # Use user owner, which has the same user id as the file owner on the Docker host.
  set -x
  exec su -c "$*" owner
else
  # We're root (user id 0), both on the Docker host and here in the container.
  set -x
  exec "$*"
fi

