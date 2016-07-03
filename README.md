Debiki Server
=============================

Debiki (now I've renamed it to EffectiveDiscussions (ED) though) is a
combined forum, chat and question & answers platform.

See it live: http://www.effectivediscussions.org/forum/latest<br>
Read about it: http://www.effectivediscussions.org/

This repository is for writing ED source code, but not for installing
ED on a production server. For the latter, instead see:
https://github.com/debiki/ed-prod-one
(production installation on one single server).


Getting Started
-----------------------------

This not so very tested. You might run into problems.

If this is the master branch, something might be very broken because I don't test if this readme works after each commit. You might be better of checking out a stable branch or tag instead. Currently there is none.

#### Before you start

You'll need some GB memory; 4GB might be enough, not sure. And you need a somewhat fast internet connection — you'll be downloading like 0.5 (?) GB Docker images (in total).

Install Docker-Compose, version 1.7.0+: https://docs.docker.com/compose/install/

#### The instructions

1. Clone this repository, `cd` into it. Then update submodules:

        git submodule update --init

1. Make ElasticSearch work:

        sudo sysctl -w vm.max_map_count=262144

    (`max_map_count` docs: https://www.kernel.org/doc/Documentation/sysctl/vm.txt)

1. Start everything: (this will take a while, the first time: some Docker images will be downloaded and built)

        docker-compose up web  # use 'sudo' if needed

1. Create an empty database:

        docker/drop-database-create-empty.sh  # 'sudo' if needed

1. Point your browser to http://localhost/ and follow the instructions, namely to sign up
   as admin, with the email address `admin@example.com`. Create a password account.

   You'll be asked to confirm your email address, by clicking a link in an email
   that was sent to you — but in fact the email couldn't be sent, because you haven't configured
   any email server. (And `admin@example.com` isn't your address anyway.)

   Instead look in the app server log file: `docker-compose logs app`. There you'll find
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
     | +-ed-prod-one-test/  <-- A production installation, for automatic tests
     | |
     | +-local/        <-- Ignored by .gitignore. Here you can override the
     | |                   default config values. If you want to, turn it into
     | |                   a Git repo.
     | |
     | ...Third party modules
     |
     +-public/         <-- Some images and libs, plus JS and CSS that Gulp
     |                     has bundled and minified from the client/ dir above.
     |
     +-docker/         <-- Dockerfiles for all docker-compose containers
     | +-web/          <-- Docker build stuff for the Nginx container
     | | +-modules/
     | |   +-nchan/    <-- WebSocket and PubSub for Nginx (a Git submodule)
     | |
     | +-gulp/         <-- Container that runs Node.js and bundles JS and CSS
     | +-gulp-home/    <-- Mounted as Gulp container home-dir = disk cache
     | |
     | +-...           <-- More containers...
     | |
     | +-data/
     |   +-rdb         <-- Mounted as a volume in the Postgres container
     |   +-cache       <-- Mounted in the Redis container
     |   +-uploads     <-- Mounted read-write in the Play container, but
     |   |                 read-only in Nginx (to serve static files)
     |   ...
     |
     +-scripts/        <-- Utility scripts
     |
     +-conf/           <-- Default config files that assume everything
                           is installed on localohost, and dev mode

Naming style
-----------------------------

CSS classes: Example: `esP_By_FN-Gst`. Here, `es` is a prefix used everywhere, namely
the first and last letters in EffectiveDiscussions. `P` means Post. `By` means
who-was-it-written-By. `FN` means Full Name. `Gst` means Guest.

So, this is BEM (Block Element Modifier) with a few tweaks: 1) Blocks/elements are separated with
only one underscore. 2) And modifiers with only one dash. 3) Blocks, elems and modifiers always
start with uppercase — because then it's easy to tell if we're dealing with an _abbreviation_
or not. For example, `FN` is an abbreviation. But `By` is not (since it continues with
lowercase letters).


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
