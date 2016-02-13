#!/bin/bash


echo 'The most recent dumps:'
echo "`ls -hlt $1 | head -n5`"

latest_dump=`ls -t $1 | head -n1`

read -r -p "Shall I import $latest_dump? It'll probably drop any existing database. [y/N]" response
response=${response,,}    # tolower
if [[ $response =~ ^(yes|y)$ ]] ; then
  echo "Okay:"
else
  echo "I'll do nothing then, bye."
  exit 0
fi

psql="psql -h localhost postgres postgres"

echo "Dropping and importing: $latest_dump..."
zcat $1/$latest_dump | $psql

echo '... Done importing.'

# If we happened to import a prod database, rename it to debiki_dev; the config
# files expect that name.
any_prod_row=`$psql -c '\l' | grep debiki_prod`
if [ -n "$any_prod_row" ]; then
  read -r -p "Rename debiki_prod to debiki_dev, and drop any currend debiki_dev? [Y/n]" response
  response=${response,,}    # tolower
  if [[ $response =~ ^(no|n)$ ]] ; then
    echo "I won't rename it then. Bye."
    exit 0
  fi
  echo 'Renaming debiki_prod to debiki_dev...'
  $psql -c 'drop database if exists debiki_dev;'
  $psql -c 'drop user if exists debiki_dev;'
  $psql -c 'alter database debiki_prod rename to debiki_dev;'
  $psql -c 'alter user debiki_prod rename to debiki_dev;'
fi

