#!/usr/bin/env bash

# This script installs database and appserver stuff in a Vagrant VM.
# Don't run it on your desktop/laptop — you probably don't want a
# PostgreSQL installation that boots with your computer, always.
# Therefore this script isn't executable (for you, but it is for Vagrant).
#
# It installs:
# - PostgreSQL and databases and users
# - Java, Play Framework, Node.js, Grunt, Node modules


# Warning: This is the same address as in the Vagrantfile, this setting:
#   config.vm.network :private_network, ip: "192.168.33.101"
vm_ip=192.168.33.101  # should be a script argument somehow?
                      # or `grep | sed` from the Vagrantfile?

debiki_server_dir=/vagrant/server

if [ -f ~/vagrant-bootstrapped-db -a \
			-f ~/vagrant-bootstrapped-appserver ]; then
  echo 'VM already bootstrapped, fine.'
  cd $debiki_server_dir
  exit 0
fi

echo 'Bootstrapping VM, this will take some time...'


if [ ! -f ~/vagrant-bootstrapped-db ]; then
  /vagrant/server/scripts/setup-dev-env/setup-database-ubuntu-server-12.04-amd64.sh
  touch ~/vagrant-bootstrapped-db
fi


play_script_path=""
if [ ! -f ~/vagrant-bootstrapped-appserver ]; then

  play_dir=/opt/play
  /vagrant/server/scripts/setup-dev-env/setup-appserver-ubuntu-server-12.04-amd64.sh \
      $play_dir  ~/build/nodejs/  /usr/local  vagrant

  # Warning: Duplicated code.
  # This value ought to be returned from the above script, but
  # Bash scripts cannot return values :-(
  play_script_path=$play_dir/play-2.1.1/play

  touch ~/vagrant-bootstrapped-appserver
fi


# ==== Add helpful aliases

bashrc=/home/vagrant/.bashrc

if [ -n "$play_script_path" -a -z "`egrep 'alias play(-2.1.1)?=' $bashrc`" ]; then

  echo ''
  echo '===== Adding helpful aliases'

  chown root $bashrc
  aliases="
alias l='ls -CF'
alias lal='ls -al'
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
alias play-2.1.1='$play_script_path'
"
  echo "$aliases"
  echo "$aliases" >> $bashrc
  chown vagrant $bashrc
fi


cd $debiki_server_dir

cat <<EOF
===== All done: VM bootstrapped

The virtual machine (VM) folder /vagrant/ is synced with the source
code in your current working director (on your desktop/laptop).

You can now start Debiki like so:
  $ vagrant ssh
  $ # Then, in the VM:
  $ cd /vagrant/server/
  $ play-2.1.1
  [debiki] $ run

Then point your browser to:

  http://$vm_ip:9000/-/install/

And wait until the server has been compiled and started; then follow
the instructions:

  First, you'll click a certain "Apply this script now!" button,
  so that database tables are created (in the VM).

  Then you'll authenticate yourself.

  And after that you'll create an admin account for the 'debiki_dev'
  database.
EOF


