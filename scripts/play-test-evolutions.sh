#!/bin/bash

# This is a test script for the Play database evolution scripts.
#
# It empties (drops and recreates) a schema meant for testing evolutions.
# The starts the Debiki server and runs some tests.
#
# The user and schema are hardcoded to "debiki_test_evolutions", and the
# password to "warning--this-schema-is-auto-dropped", so this script
# should be unable to drop the wrong schema.
# (You thus have to use that password when you create the related database user.)


set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
        # — otherwise we might not notice if some part of this test fails.
set -o pipefail  # exit on false | true


# ===== Load config values

function read_config_value {
  # Local values override the default ones (which are checked into the Git repo).
  # A row looks like so:
  #   some.config.key="some-config-value"
  cat conf/test-evolutions-local.conf conf/test-evolutions.conf \
      | grep "$1" \
      | head -n1 \
      | sed -r 's/^[a-z.]+="?([^"]+)"?$/\1/'
}

# Get database connection string, e.g. "jdbc:postgresql://192.168.0.123/debiki_test_evolutions"
db_url=`read_config_value "db.default.url"`

# Get database address and name
db_address=`echo "$db_url" | sed -r 's/jdbc:postgresql:\/\/([^/]+)\/.*$/\1/'`
db_name=`echo "$db_url" | sed -r 's/jdbc:postgresql:\/\/[^/]+\/(.*)$/\1/'`

# User and password are hardcoded so that this script is unable to connect as the wrong
# user and possibly drop the wrong schema.
db_user='debiki_test_evolutions'
db_password='warning--this-schema-is-auto-dropped'
db_schema="$db_user"


# ===== Drop and recreate schema.

drop_recreate_schema="
  drop schema $db_schema cascade;
  create schema $db_schema;
  "
psql -h "$db_address" "$db_name" "$db_user" -c "$drop_recreate_schema"


# ===== Apply evolutions

# For now, since evolutions are handled by debiki-app-play, not debiki-dao-pgsql,
# start a server, wait for a while, then kill it.

# COULD have debiki-dao-pgsql use Play's JDBC module, then this wouldn't be needed.

echo "
**********************************************************************
Please press CTRL-C when evolutions have been applied.
That is, after the '[info] play - Listening for HTTP on ...' message.
Then this script will continue to run some database tests.
**********************************************************************
"

scripts/play-2.1.1.sh \
  -Dconfig.file=conf/test-evolutions.conf \
  -DapplyEvolutions.default=true \
  start

# ... Wait until human hits CTRL-C
# Oops! That kills this script, not just the server.
# So right now one needs to run the tests manually:
# ... (see below)
# Solution: Either have debiki-dao-pgsql apply evolutions itself,
# or send some flag to the Debiki server that it should die after having
# applied the evolutions.


# ===== Run database related tests.

scripts/play -Dconfig.file=conf/test-evolutions.conf "project debiki-dao-pgsql" "test"

