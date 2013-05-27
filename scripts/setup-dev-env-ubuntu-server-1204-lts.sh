# This script sets up a develotment environment on Ubuntu Server 12.04 LTS.
# Run this script on a Ubuntu Server 12.04 LTS virtual machine.
# Do *not* run it directly in your laptop/desktop however, because it installs
# e.g. PostgreSQL and configures it to start at boot, and you don't want that.


# 1. Install and start PostgreSQL
# -----------------------------

# Unless repo data is up to date, some programs might not be found.
apt-get update

aptitude -y install postgresql-9.1 postgresql-contrib-9.1

# (PostgreSQL starts automatically.)


# 2. Create PostgreSQL users
# -----------------------------

su - postgres

psql -c "
  create user debiki_dev password 't0psecr3t';
  create user debiki_test password 'warning--tables-are-auto-deleted';
  create user debiki_test_evolutions password 'warning--this-schema-is-auto-dropped';
  alter user debiki_dev set search_path to '\$user';
  alter user debiki_test set search_path to '\$user';
  alter user debiki_test_evolutions set search_path to '\$user';
  "

function create_database_and_schema {
  # Databases cannot be created via multi command strings.
  psql -c "create database $1 owner $1 encoding 'UTF8';"
  psql --dbname $1 -c "
    drop schema public;
    create schema authorization $1;
    "
}

create_database_and_schema "debiki_dev"
create_database_and_schema "debiki_test"
create_database_and_schema "debiki_test_evolutions"

exit


# 3. Install Java and Play Framework 2.1, Make and Nodejs
# -----------------------------

# See: http://www.playframework.com/documentation/2.1.0/Installing

aptitude -y install openjdk-7-jdk unzip


# Install Play:

cd ~
mkdir -p dev/play/
cd dev/play/
wget http://downloads.typesafe.com/play/2.1.1/play-2.1.1.zip
unzip play-2.1.1.zip
chmod a+x play-2.1.1/play
cd ~
mkdir bin
cd bin
ln -s ~/dev/play/play-2.1.1/play ./

# Now you can test start Play like so:
#
# $ ~/bin/play help


# Install Nodejs:

apt-get -y install build-essential python
mkdir -p ~/dev/nodejs/
cd ~/dev/nodejs/
wget http://nodejs.org/dist/v0.10.5/node-v0.10.5.tar.gz
tar -xzvf node-v0.10.5.tar.gz
cd node-v0.10.5/
./configure --prefix=/usr/local/
make
make install
npm install -g grunt-cli



# 4. Download Debiki to your local desktop machine:
# -----------------------------

aptitude -y install git
mkdir -p ~/dev/debiki
cd ~/dev/debiki
git clone ...
cd debiki-app-play/
git submodule init
git submodule update

# Download Node modules:
npm install

# For now, compile JS manually: (Sorry!)
# $ grunt


# 5. Start Debiki and create the first website
# -----------------------------

cd ~/dev/debiki/debiki-app-play/
~/bin/play

# Then type `run` and Enter.
# Then go to http(s)://serveradress/-/install/ and follow the instructions.
#
# (If you're curious: The instructions tells you to find a password in the server
# log files, and then to input that password, so the server knows that you are
# you (in case other people also have access to the web pages, over the
# internet).  After this, you're asked to create an admin account. That is,
# specify a username and a password, or login via e.g. Gmail.)
#
# Once you've installed everything, visit 
#   http(s)://serveradress/-/admin/
#
# and create a forum or a blog or something.

