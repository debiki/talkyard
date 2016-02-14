Debiki Server
=============================

Debiki (now I've renamed it to EffectiveDiscussions though) is a
combined forum and question & answers platform.

See it live: http://www.effectivediscussions.org/forum/#/latest/  
Read about it: http://www.effectivediscussions.org/

Debiki is under development and there is currently no stable version or simple
installation instructions.


Getting Started
-----------------------------

*Warning:* I suggest that you contact me before you try to get started, right now, because I
haven't tested these getting-started instructions the last 6 months or so, so
they might no longer work.  Anyway, the instructions:

1. Install Docker-Compose, version 1.6.0+: https://docs.docker.com/compose/install/ (this might take a while).

    Tips:

    1) If you want to do everything in a Vagrant virtual machine, 
    you can use this one: `vagrant init phusion/ubuntu-14.04-amd64` (you can run Docker in it).
    And it seems you'll need to follow the _"Note: If your company is behind a filtering proxy"_ instructions
    on https://docs.docker.com/linux/step_one/

    2) On Linux the docker-compose installation instructions tell you to cURL and save docker-compose to `/usr/local/bin/docker-compose`, but that results in a permission-denied error. You can instead:<br>
   `sudo sh -c 'curl -L https://github.com/docker/compose/... > /usr/local/bin/docker-compose'` )

2. Clone another project, [debiki-site-seed](https://github.com/debiki/debiki-site-seed). In that project, this project is a submodule.

    `git clone https://github.com/debiki/debiki-site-seed.git`
    cd debiki-site-seed

3. Then fetch this project (debiki-server) to a subdirectory `server/`:

    git submodule update --init
    cd server/
    
4. Fetch the latest master branch version and fetch submodules:
    
    git checkout master
    git pull origin master
    git submodule update --init

5. Start everything: (this will take a while, the first time: some Docker images will be downloaded and built)

    docker-compose up

7. The -dev-gulp Docker container prints a message about what to do
   next, namely running both npm and Gulp `install`, and then `gulp watch`.

8. The -dev-server container tells you what to do next, namely starting Play
   Framework and the server. Note that you need to run `gulp watch` first (the
   previous step).

9. Once a green message "Server started ..." appears in the -dev-server
   container's shell, open your browser, go to http://localhost:9000/ and
   http://localhost:9000/-/admin/. It'll take a while before the pages load;
   some Scala files are being compiled.

10. Login as `admin@example.com`, password `password`.


A little problem: If you save two TypeScript/JavaScript files at the same time,
sometimes Gulp picks up the changes in only one of the files. What I do then,
once I've understood what has happened, is that I stop and restart `gulp
watch`.


Running tests
-----------------------------

This might work on Linux (and Mac?) only. Some things you'd need to do:

### End to end tests

1) If testing with a browser other than Chrome,
you need to add a `127.0.0.1  *.localhost` entry to `/etc/hosts`,
so that the end-to-end tests will be able to generate and resolve their own
local hostnames with random ids, e.g.  `e2e-test-site-random_id.localhost`. But
wildcard `/etc/hosts` entries are not allowed. Instead use dnsmasq, see
http://serverfault.com/a/118589/44112

*On Linux Mint (and Ubuntu?)*, Network Manager already runs its own instance of
dnsmasq. You can make `*.localhost` work like so: (do this only once)

    sudo sh -c 'echo "address=/localhost/127.0.0.1" >> /etc/NetworkManager/dnsmasq.d/wildcard.localhost.conf'

Then restart Network Manager:

    sudo service network-manager restart

Wait half a minute, then this should work: `ping whatever.localhost`.

2) Download Selenium to ./downloads/  (todo: explain in more details. See http://nightwatchjs.org )
and download Chrome Driver too.


### Performance tests

Append to `/etc/security/limits.conf`:

    your_login_name hard nofile 65535
    your_login_name soft nofile 65535


Technology
-----------------------------

Client: React.js, TypeScript, Bower, Gulp.

Server: Scala and Play Framework. We render HTML server side by running
React.js in Java 8's Nashorn Javascript engine.

Databases: PostgreSQL and ElasticSearch.


Contributing
-----------------------------

If you'd like to contribute, read more
[at the end of this page](http://www.effectivediscussions.org/-81n25/source-code) about contributing.

In the future, I suppose there will be a Contributor License Agreement (CLA), similar to
[Google's CLA](https://developers.google.com/open-source/cla/individual) — you'd open
source your code and grant me a copyrigt license.


Directories
-----------------------------

This project looks like so:


    server/
     |
     +-client/         <-- Javascript, CSS, React.js components
     | +-app/          <-- Client side code
     | +-server/       <-- React.js components rendered server side
     | +...
     |
     +-app/            <-- Scala code — a Play Framework 2 app
     | +-controllers/
     | +-debiki/
     | +-views/        <-- HTML (well, Play's Scala templates)
     |
     +-modules/
     | +-debiki-dao-rdb/    <-- A database access object (DAO), for PostgreSQL
     | +-debiki-tck-dao/    <-- Test suite for Database Access Object:s
     | +-debiki-core/       <-- Code shared by the DAO and by the ./app/ code
     | |
     | ...Third party modules
     |
     +-public/     <-- Some images and libs, plus JS and CSS that Gulp
     |                 has bundled and minified from the client/ dir above.
     |
     +-scripts/    <-- Utiity scripts
     |
     +-conf/       <-- Default config files that assume everything
       |               is installed on localohost
       |
       +-local/    <-- A softlink to a supposed parent Git repo (namely debiki-site-seed) with
                       website specific config files, which override the
                       default config files.

Old Code
-----------------------------

In January 2015 I squashed all old 4300+ commits into one single commit,
because in the past I did some mistakes, so it feels better to start over again
from commit number 1. The old commit history is available here:
https://github.com/debiki/debiki-server-old


Credits
-----------------------------

I sometimes copy ideas from [Discourse](http://www.discourse.org/), and look at
its database structure, HTTP requests, and avatar pixel width. Discourse is
forum software.


License
-----------------------------

Currently AGPL — please let me know if you want me to change to GPL, contact info here: http://www.effectivediscussions.org/about/


    Copyright (C) 2010-2015  Kaj Magnus Lindberg

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.


vim: list
