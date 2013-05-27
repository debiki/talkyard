#!/usr/bin/env bash


if [ -f ~/vagrant-bootstrap-done ]; then
  echo 'VM already bootstrapped, fine.'
  exit 0;
fi

echo 'Bootstrapping VM, this will take some time...'



echo '===== Updating the APT repository'

apt-get update



echo '===== Installing PostgreSQL 9.1'

apt-get -y install postgresql-9.1 postgresql-contrib-9.1



echo '===== Configure PostgreSQL to trust *everyone*'

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
  cat $pg_hba_orig | sed 's/^host  /#host /' > $pg_hba
  echo 'host    all             all              127.0.0.1/32           trust' >> $pg_hba
  service postgresql reload
fi



echo '===== Creating PostgreSQL databases and users'

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
  psql -h 127.0.0.1 --username postgres -c "create database $1 owner $1 encoding 'UTF8';"
  psql -h 127.0.0.1 --username postgres --dbname $1 -c "
    drop schema public;
    create schema authorization $1;
    "
}

create_database_and_schema "debiki_dev"
create_database_and_schema "debiki_test"
create_database_and_schema "debiki_test_evolutions"




echo '===== Installing Java 7 JDK and `unzip`'

apt-get -y install openjdk-7-jdk unzip



echo '===== Installing Play Framework 2.1.1'

play_parent=/opt/play
play_zip_file=play-2.1.1.zip
play_dir_name=play-2.1.1

if [ ! -f $play_parent/play-2.1.1/play ]; then
  mkdir -p $play_parent
  cd $play_parent
  rm $play_zip_file
  rm -fr $play_dir_name
  wget http://downloads.typesafe.com/play/2.1.1/$play_zip_file
  unzip $play_zip_file
  chmod a+x $play_dir_name/play
  chown --recursive vagrant:vagrant $play_parent
fi


echo '===== Installing Node.js v0.10.5 and Grunt'

node_dir_name=node-v0.10.5
node_zip_file=node-v0.10.5.tar.gz

if [ -z `which grunt` ]; then
  apt-get -y install build-essential python
  mkdir -p ~/dev/nodejs/
  cd ~/dev/nodejs/
  if [ ! -f $node_zip_file ]; then
    wget http://nodejs.org/dist/v0.10.5/$node_zip_file
  fi
  # In case any previous build is only somewhat completed, perhaps
  # better start from scratch? So remove directory.
  rm -fr $node_dir_name
  tar -xzf $node_zip_file
  cd $node_dir_name
  ./configure --prefix=/usr/local/
  make
  make install
  npm install -g grunt-cli
fi


echo '===== Installing NPM modules'

cd /vagrant
npm install



echo '===== Adding helpful aliases'

if [ -z "`grep 'alias play=' ~/.bashrc`" ]; then
  chown root /home/vagrant/.bashrc
  echo "
alias l='ls -CF'
alias l1='l -1'
alias c='cat'
alias v='view'
alias m='less -S'
alias t='tree'
alias ft='tree -f'
alias ..='cd ..'
alias ...='cd ../..' 
alias ....='cd ../../..' 
alias .....='cd ../../../..' 
alias ......='cd ../../../../..' 
alias .......='cd ../../../../../..' 
alias ........='cd ../../../../../../..' 
alias .........='cd ../../../../../../../..' 
alias ..........='cd ../../../../../../../../..' 
alias ...........='cd ../../../../../../../../../..' 
alias play='$play_parent/$play_dir_name/play'
" >> /home/vagrant/.bashrc
  chown vagrant /home/vagrant/.bashrc
fi


echo '===== All done

You can now start Debiki like so:
  $ cd /vagrant/
  $ play
  [play]$ run

And point your browser to http://serveradress/-/install/
and follow the instructions.

The virtual machine folder /vagrant/ is synced with the source code
on your desktop machine.
'


# All done; skip this script the next time.
touch ~/vagrant-bootstrap-done

