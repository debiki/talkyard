#!/bin/bash

# *** Dupl code *** see gulp/entrypoint.sh too [7GY8F2]
# (Cannot fix, Docker doesn't support symlinks in build dirs.)

cd /opt/talkyard/app

# Create user 'owner' with the same id as the person who runs docker, so that files
# sbt and Ivy creates/downloads, will be owned by hen. Otherwise they'll be owned by root
# on the host machine. Which makes them invisible & unusable, on the host machine.
# But skip this if we're root already (perhaps we're root in a virtual machine).
file_owner_id=`ls -adn | awk '{ print $3 }'`

#
# Often the host OS user has id 1000, as of Ubuntu 24.04, there's a user 'ubuntu'
# in the container with id 1000. Then we'll just reuse it. (Ids >= 1000 are typically meant
# for end users, I mean humans.)
#
#if [ -n "$(getent passwd ubuntu)" -a "$(id -u ubuntu)" = $file_owner_id ]; then
#  usermod -l owner ubuntu
#  groupmod -n owner ubuntu
#  usermod -d /home/ubuntu -m owner
#  usermod -c "[full name (new)]" [newname]
#fi

if getent passwd $file_owner_id > /dev/null; then
  owner_username=$(id -u -n $file_owner_id)
  echo "User with id $file_owner_id exists, need not create. Name: '$owner_username'"
else
  # There's no user with the same id as the files. Let's create such a user,
  # and call it 'owner':
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

# The Postgres password at /tmp/postgres_password should already be readable — in
# dev builds, there's just a public test password in
# ../../tests/secrets/test_postgres_password.txt. [appuser_id_1000]

# Below this dir, sbt and Ivy will cache their files. [SBTHOME]
# mkdir -p /home/owner/ — Already created by `adduser` above.

if [ -z "$*" ] ; then
  echo 'No command specified. What do you want to do? Exiting.'
  exit 0
fi

if [ $file_owner_id -ne 0 ] ; then
  # Prevent a file-not-found exception in case ~/.ivy2 and ~/.sbt didn't exist, so Docker
  # created them resulting in them being owned by root:  (needs CAP_CHOWN, right)
  # (/home/owner/.ivy2, .sbt and .coursier are mounted in docker-compose.yml [SBTHOME])
  echo "Making 'owner:owner' the owner of /home/owner/{.ivy2,.sbt,.cache} ..."
  chown owner:owner /home/owner
  chown -R owner:owner /home/owner/.ivy2
  chown -R owner:owner /home/owner/.sbt
  chown -R owner:owner /home/owner/.cache
  # Let the app user, 'owner', save uploads and sitemaps. [pub_files_volume]
  # (In the Dockerfile.dev, we don't know the id of 'owner', but now, here, we do.)
  echo "Making 'owner:owner' owner of /var/talkyard/v1/{pub-files,priv-files} ..."
  chown -R owner:owner /var/talkyard/v1/pub-files/
  chown -R owner:owner /var/talkyard/v1/priv-files/

  # Here, 'exec gosu owner $*' will:
  # 1) run $* as user owner, which has the same user id as the file owner on the Docker host
  # 2) use our current process id, namely 1. Then the Scala app will receive any shutdown signal,
  #    see: https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/#entrypoint
  # However! 'gosu' doesn't work with "cd ... &&", and we need to have 'owner' cd to /opt/talkyard/app/.  [su_or_gosu]
  # So instead use 'exec su -c ...'
  # exec gosu owner $*
  echo "Starting Play as user 'owner', user id $file_owner_id":
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

