#!/usr/bin/env bash

# This script installs database stuff in a Vagrant VM.
# Don't run it on your desktop/laptop — you don't want a
# PostgreSQL installation that boots with your computer, always?
# Therefore this script isn't executable.


set -u  # exit on unset variable
set -e  # exit on non-zero command exit code
set -o pipefail  # exit on false | true



echo '===== Installing PostgreSQL 9.1'

sudo apt-get update
apt-get -y install postgresql-9.1 postgresql-contrib-9.1 tree
# `tree` is not needed but I like it.


echo '===== Configuring PostgreSQL to trust *everyone*'

# For now:
# Trust everyone, this is a dev/test machine only.
# First disable old `host` rules.

pg_hba=/etc/postgresql/9.1/main/pg_hba.conf
pg_hba_orig=/etc/postgresql/9.1/main/pg_hba.conf.orig

# Backup original pg_hba.conf.
if [ ! -f $pg_hba_orig ]; then
  mv $pg_hba $pg_hba_orig
fi

# Create new pg_hba.conf that trusts localhost.
if [ ! -f $pg_hba ]; then
  # Comment out old rules.
  cat $pg_hba_orig | sed 's/^host  /#host /' > $pg_hba
  # Add new rules.
  echo '
host    all             postgres         127.0.0.1/32         trust
host    debiki_dev      debiki_dev       0.0.0.0/0            trust
host    debiki_test     debiki_test      0.0.0.0/0            trust
host    debiki_test_evolutions debiki_test_evolutions 0.0.0.0/0 trust
' >> $pg_hba

  service postgresql reload
fi



echo '===== Configuring PostgreSQL to listen on all interfaces'

# read -r -d '' pgsql_cmd <<'EOF'
pgsql_conf=/etc/postgresql/9.1/main/postgresql.conf
if [ ! -f $pgsql_conf.orig ]; then
  mv $pgsql_conf $pgsql_conf.orig
fi

if [ ! -f $pgsql_conf ]; then
  cat $pgsql_conf.orig \
    | sed -r "s/^#(listen_addresses = )'localhost'/\1'*'\t/" \
    > $pgsql_conf
fi
#EOF
#sudo sh -c "$pgsql_cmd"  # if want to test as non-root user



echo '===== Creating PostgreSQL databases and users'

# COULD avoid this if users already created, so that this
# script won't fail with an error.

psql -h 127.0.0.1 --username postgres -c "
  create user debiki_dev password 't0psecr3t';
  create user debiki_test password 'warning--tables-are-auto-deleted';
  create user debiki_test_evolutions password 'warning--this-schema-is-auto-dropped';
  alter user debiki_dev set search_path to '\$user';
  alter user debiki_test set search_path to '\$user';
  alter user debiki_test_evolutions set search_path to '\$user';
  "

function create_database_and_schema {
  # Databases cannot be created via multi command strings.
  # Let user 'postgres' drop schema 'public'; 'postgres' is the owner.
  psql -h 127.0.0.1 --username postgres -c "create database $1 owner $1 encoding 'UTF8';"
  psql -h 127.0.0.1 --username postgres --dbname $1 -c "
    drop schema public;
    create schema authorization $1;
    "
}

create_database_and_schema "debiki_dev"
create_database_and_schema "debiki_test"
create_database_and_schema "debiki_test_evolutions"


