#!/bin/bash

read -r -p "This drops debiki_dev, and debiki_test, from Postgres localhost:5432, okay? [y/N] " response
response=${response,,}    # tolower
if [[ $response =~ ^(yes|y)$ ]] ; then
  echo "Okay:"
else
  echo "Oh well, I'll do nothing, bye."
  exit 0
fi

psql="psql -h localhost postgres postgres"

echo 'Dropping dev and test databases...'

$psql -c 'drop database if exists debiki_test;'
$psql -c 'drop user if exists debiki_test;'

$psql -c 'drop database if exists debiki_dev;'
$psql -c 'drop user if exists debiki_dev;'

echo 'Creating a dev and a test database...'

$psql -c 'create user debiki_dev;'
$psql -c 'create database debiki_dev owner debiki_dev;'

$psql -c 'create user debiki_test;'
$psql -c 'create database debiki_test owner debiki_test;'

echo '...Done.'

