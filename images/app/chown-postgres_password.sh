#!/bin/bash

# Let 'appuser' access the Postgres password secret file.
# (This is a Docker Compose startup hook, should run as root.)
#
# Update: Now, we run this from the entrypoint instead, since maaaaybe
# 'post_start' isn't supported everywhere.
# Here's how the hook looks. Add back in [ty_v2]? Then also remove `cap_add`.
# app:
#   ...
#   post_start:
#     # We run Talkyard as 'appuser', see Dockerfile.prod, therefore:  [appuser_id_1000]
#     # `sh -x` runs `set -x` so we'll see what happens.
#     - command: sh -x /ty/chown-postgres_password.sh
#       user: root
#       privileged: true # otherwise can't change file owner

pw_src=/run/secrets/postgres_password

# The appserver always looks at this exact path. [postgres_pw_path]
pw_copy=/tmp/postgres_password

if [ -f "$pw_src" ]; then
  echo "Copying Postgres password from $pw_src to $pw_copy..."
  cp $pw_src $pw_copy
  chown 1000:1000 $pw_copy  # 'appuser' and 'appgroup' have id 1000. [appuser_id_1000]
  chmod 0400 $pw_copy       # read-only

  echo "Done copying Postgres password."
else
  echo "No Postgres password $pw_src found! Not copying to $pw_copy."
fi

