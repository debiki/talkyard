Debiki Server
=============================

Debiki (now I've renamed it to EffectiveDiscussions though) is a
combined forum and question & answers platform.

See it live: http://www.effectivediscussions.org/forum/latest<br>
Read about it: http://www.effectivediscussions.org/

Debiki is under development and there is currently no stable version or simple
installation instructions.


Getting Started
-----------------------------

This not so very tested. You might run into problems.

If this is the master branch, something might be very broken because I don't test if this readme works after each commit. You might be better of checking out a stable branch or tag instead. Currently there is none.

#### Before you start

You'll need some GB memory; 4GB might be enough, not sure. And you need a somewhat fast internet connection — you'll be downloading like 0.5 (?) GB Docker images (in total).

Install Docker-Compose, version 1.7.0+: https://docs.docker.com/compose/install/

#### Tips

A tips about Vagrant and Linux (just ignore, if you're not familiar with Vagrant or Linux):

- As of now, don't use Vagrant because then I think you cannot run any end-to-end tests (or at least it would be complicated).
  <!-- If you want to run the server in a Vagrant virtual machine, you can use this one: `vagrant init phusion/ubuntu-14.04-amd64` — it supports Docker, but you still need to install Docker-Compose (inside the vm). And it seems you'll need to follow the _"Note: If your company is behind a filtering proxy"_ instructions on https://docs.docker.com/linux/step_one/. -->

#### The instructions

Now, let's get started for real:

1. Clone **another** project, [debiki-site-seed](https://github.com/debiki/debiki-site-seed). In that project, this project is a submodule.

        git clone https://github.com/debiki/debiki-site-seed.git
        cd debiki-site-seed

1. Then fetch this project (debiki-server) to a subdirectory `server/`, checkout the master branch and fetch submodules:

        git submodule update --init
        cd server/
        git checkout master
        git submodule update --init

1. Start everything: (this will take a while, the first time: some Docker images will be downloaded and built)

        docker-compose up   # use 'sudo' if needed

1. Create an empty database:

        docker/drop-database-create-empty.sh

1. Specify your email address in the config file:

        vi ../conf/dev-test-localhost.conf
        # edit this config value:
        # debiki.becomeOwnerEmailAddress=""  # fill in your email address

1. Restart Play Framework so the config values will be reloaded:

        docker-compose restart play

1. Point your browser to http://localhost/ and follow the instructions, namely to sign up
   as admin, with the email address you just specified. Create a password account —
   Gmail login won't work because you haven't configured any OpenAuth credentials.

   However when you're asked to confirm your email address by clicking a link in an email
   that was sent to you — in fact the email couldn't be sent, because you haven't configured
   any email server.

   Instead look in the Play log file: `docker-compose logs play`. There you'll find
   the email — it's written to the log files, in development mode. Copy the
   confirmation link from the `<a href=...>` and paste it in the browser's address bar.


Tests
-----------------------------

#### End-to-end tests

See the [End-to-end tests Readme](./docs/e2e-tests-readme.md)
And, if you want to test in a browser other than Chrome, see [Making *.localhost addresses work](./docs/wildcard-dot-localhost.md).


#### Security tests

... Soon ...


#### Unit tests

... Soon ...


#### Performance tests

Append to `/etc/security/limits.conf` ... hmm but now with Docker-Compose, which container?

    your_login_name hard nofile 65535
    your_login_name soft nofile 65535


Technology
-----------------------------

Client: React.js, TypeScript. Gulp. Webdriver.io.
Server: Scala and Play Framework. Nginx and Nchan. React.js in Java 8's Nashorn Javascript engine.
Databases: PostgreSQL, Redis, ElasticSearch (soon).


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
     +-docker-compose.yml   <-- tells Docker how to run EffectiveDiscussions
     +-docker-compose.override.yml  <-- development config
     |
     +-client/         <-- Javascript, CSS, React.js components
     | +-app/          <-- Client side code
     | +-server/       <-- React.js components rendered server side
     | +-test/         <-- End-to-end tests and Javascript unit tests
     |
     +-app/            <-- Scala code — a Play Framework 2 app
     |
     +-modules/
     | +-debiki-dao-rdb/    <-- A database access object (DAO), for PostgreSQL
     | +-debiki-core/       <-- Code shared by the DAO and by the ./app/ code
     | |
     | ...Third party modules
     |
     +-public/     <-- Some images and libs, plus JS and CSS that Gulp
     |                 has bundled and minified from the client/ dir above.
     |
     +-docker/     <-- Dockerfiles for all docker-compose containers
     | +-compose-prod-2g.yml  <-- production config, one server 2G memory
     | +-compose-prod-8g.yml  <-- production config, one server 8G memory
     | +-...
     | |
     | +-nginx/    <-- Docker build stuff for the Nginx container
     | +-...       <-- More containers...
     |
     +-scripts/    <-- Utility scripts
     |
     +-conf/       <-- Default config files that assume everything
                       is installed on localohost, and dev mode

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


    Copyright (c) 2010-2016  Kaj Magnus Lindberg

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


vim: list et ts=2 sw=2 tw=0 fo=r
