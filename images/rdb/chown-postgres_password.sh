#!/bin/bash

pw_src=/run/secrets/postgres_password
pw_copy=/tmp/postgres_password  # [same_pg_pw]

if [ -f "$pw_src" ]; then
  echo "Copying Postgres password from $pw_src to $pw_copy, chown to postgres..."
  cp $pw_src $pw_copy
  chown postgres:postgres $pw_copy
  chmod 0400 $pw_copy  # read-only
  echo "Done copying Postgres password."
else
  echo "No Postgres password $pw_src found, not copying to $pw_copy."
fi

