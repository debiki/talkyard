#!/bin/bash

# *** Dupl code *** see gulp/entrypoint.sh too [7GY8F2]
# (Cannot fix, Docker doesn't support symlinks in build dirs.)

cd /opt/talkyard/app

# Create user 'owner' with the same id as the person who runs docker, so that files
# sbt and Ivy creates/downloads, will be owned by hen. Otherwise they'll be owned by root
# on the host machine. Which makes them invisible & unusable, on the host machine.
# But skip this if we're root already (perhaps we're root in a virtual machine).
file_owner_id=`ls -adn | awk '{ print $3 }'`
id -u owner >> /dev/null 2>&1
if [ $? -eq 1 -a $file_owner_id -ne 0 ] ; then
  # $? -eq 1 means that the last command failed, that is, user 'owner' not yet created.
  # So create it:
  # We map /home/owner/.ivy and .sbt to the host user's .ivy and .sbt, in docker-compose.yml. [SBTHOME]
  # -D = don't assign password (would block Docker waiting for input).
  echo "Creating user 'owner' with id $file_owner_id..."
  ## Alpine:
  #adduser -u $file_owner_id -h /home/owner/ -D owner
  ## Debian:
  adduser \
      --uid $file_owner_id  \
      --home /home/owner  \
      --disabled-password  \
      --gecos ""  \
      owner   # [5RZ4HA9]
fi

# Below this dir, sbt and Ivy will cache their files. [SBTHOME]
mkdir -p /home/owner/

if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Exiting.'
  exit 0
fi

if [ $file_owner_id -ne 0 ] ; then
  # Prevent a file-not-found exception in case ~/.ivy2 and ~/.sbt didn't exist, so Docker
  # created them resulting in them being owned by root:
  # (/home/owner/.ivy2, .sbt and .coursier are mounted in docker-compose.yml [SBTHOME])
  chown owner.owner /home/owner
  chown -R owner.owner /home/owner/.ivy2
  chown -R owner.owner /home/owner/.sbt
  chown -R owner.owner /home/owner/.cache
  # Make saving-uploads work (this dir, mounted in docker-compose.yml, shouldn't be owned by root).
  chown -R owner.owner /opt/talkyard/uploads
  chown -R owner.owner /var/log/talkyard

  # Here, 'exec gosu owner $*' will:
  # 1) run $* as user owner, which has the same user id as the file owner on the Docker host
  # 2) use our current process id, namely 1. Then the Scala app will receive any shutdown signal,
  #    see: https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/#entrypoint
  # However! 'gosu' doesn't work with "cd ... &&", and we need to have 'owner' cd to /opt/talkyard/app/.  [su_or_gosu]
  # So instead use 'exec su -c ...'
  # exec gosu owner $*
  echo "Starting Play as user 'owner', should be id $file_owner_id":
  set -x
  exec su -c "$*" owner
else
  # We're root (user id 0), both on the Docker host and here in the container.
  # `exec su ...` is the only way I've found that makes Yarn and Gulp respond to CTRL-C,
  # so using `su` here although we're root already.
  # Set HOME to /home/owner so sbt and Ivy will cache things there [SBTHOME] — that dir
  # is mounted on the host; will persist across container recreations.
  # Otherwise /root/.ivy2 and /root/.sbt would get used, and disappear with the contaner.
  echo "Starting Play as root":
  set -x
  exec su -c "HOME=/home/owner _JAVA_OPTIONS='-Duser.home=/home/owner' $*" root
fi

