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

if [ -f ~/vagrant-bootstrapped-db -a \
			-f ~/vagrant-bootstrapped-appserver ]; then
  echo 'VM already bootstrapped, fine.'
  exit 0
fi

echo 'Bootstrapping VM, this will take some time...'


if [ ! -f ~/vagrant-bootstrapped-db ]; then
  /vagrant/scripts/setup-dev-env/setup-database-ubuntu-server-12.04-amd64.sh
  touch ~/vagrant-bootstrapped-db
fi


if [ ! -f ~/vagrant-bootstrapped-appserver ]; then

  echo SHOULD:
  echo /vagrant/scripts/setup-dev-env/setup-appserver-ubuntu-server-12.04-amd64.sh \
			/opt/play  ~/build/nodejs/  /usr/local  vagrant

  touch ~/vagrant-bootstrapped-appserver
fi


# ==== Add helpful aliases

bashrc=/home/vagrant/.bashrc

if [ -z "`grep 'alias play=' $bashrc`" ]; then

  echo '===== Adding helpful aliases'

  chown root $bashrc
  echo "
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
alias play='$play_parent/$play_dir_name/play'
" >> $bashrc
  chown vagrant $bashrc
fi


echo "===== All done

You can now start Debiki like so:
  $ vagrant ssh
  $ # Then, in the virtual machine (VM):
  $ cd /vagrant/
  $ play          # this takes a while, the first time
  [debiki] $ run  # this also takes a while, the first time

Then point your browser to http://$vm_ip/-/install/
and wait... until the server has been compiled and started,
then follow the instructions.

The VM folder /vagrant/ is synced with the source code on your
desktop machine.
"


