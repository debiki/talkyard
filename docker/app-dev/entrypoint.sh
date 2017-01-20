#!/bin/bash

# *** Dupl code *** see dev-gulp/entrypoint.sh too [7GY8F2]
# (Cannot fix, Docker doesn't support symlinks in build dirs.)

cd /opt/ed/app

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
  adduser -u $file_owner_id -h /home/owner/ -D owner   # [5RZ4HA9]
fi


if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Exiting.'
  exit 0
fi

echo Running the Play CMD:

if [ $file_owner_id -ne 0 ] ; then
  # Prevent a file-not-found exception in case ~/.ivy2 and ~/.sbt didn't exist, so Docker
  # created them resulting in them being owned by root:
  # (/home/owner/.ivy2 and .sbt are mounted in docker-compose.yml)
  chown owner /home/owner/.ivy2
  chown owner /home/owner/.sbt

  set -x
  # Here, 'exec gosu owner $*' will:
  # 1) run $* as user owner, which has the same user id as the file owner on the Docker host
  # 2) use our current process id, namely 1. Then the Scala app will receive any shutdown signal,
  #    see: https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/#entrypoint
  # However! 'gosu' doesn't work with "cd ... &&", and we need to have 'owner' cd to /opt/ed/app/.
  # So instead use 'exec su -c ...'
  # exec gosu owner $*
  exec su -c "$*" owner
else
  # We're root (user id 0), both on the Docker host and here in the container.
  # `exec su ...` is the only way I've found that makes Yarn and Gulp respond to CTRL-C,
  # so using `su` here although we're root already.
  set -x
  exec su -c "$*" root
fi

