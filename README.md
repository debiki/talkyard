Debiki Server
=============================

Debiki is an open source discussion platform for forums, blogs, embedded comments
and simple websites. Read more, and see it live, at http://www.debiki.com/.

Debiki is under development and there is currently no stable version or simple
installation instructions.


Getting Started
-----------------------------

You'll need to install Docker (see below), clone a Git repo, and run some scripts.

1. Clone another project, [debiki-site-seed](https://github.com/debiki/debiki-site-seed). In that project, this project is a submodule.

    `git clone https://github.com/debiki/debiki-site-seed.git`

2. In the cloned repo: `git submodule update --init --recursive`  
    (This clones this project (`debiki-server`) to a subdirectory `server/` in `debiki-site-seed`.)

3. Create a branch and fetch the latest changes in the `debiki-server` module:

        cd server
        git checkout master
        git pull origin master

4. Install [Docker](https://www.docker.com/).

5. Create a Docker database container and import some contents. In `server/`:

        ./docker-create-dev-database.sh `pwd`/../db-dumps/tiny-forum/


6. Start the database, Gulp and the server. In three separate shells, in `server/`:

        ./docker-start-dev-database.sh
        ./docker-start-dev-gulp.sh
        ./docker-start-dev-server.sh

7. The -dev-gulp and -dev-server Docker containers print messages about what you are to do next.
(Namely running npm and Gulp `install` and `gulp watch`, and start Play Framework and the server.)

8. Once a green message "Server started ..." appears in the -dev-server
   container's shell, open your browser, go to http://localhost:9000/ and
   http://localhost:9000/-/admin/. It'll take a while before the pages load;
   some Scala files are being compiled.

9. Login as `admin@example.com`, password `password`.


A little problem: If you save two TypeScript/JavaScript files at the same time,
sometimes Gulp picks up the changes in only one of the files. What I do then,
once I've understood what has happened, is that I stop and restart `gulp
watch`.


Technology
-----------------------------

Client: React.js, TypeScript, Bower, Gulp. Some old code uses LiveScript and
AngularJS and jQuery.

Server: Scala and Play Framework. We render HTML server side by running
React.js in Java 8's Nashorn Javascript engine.

Databases: PostgreSQL and ElasticSearch.


Contributing
-----------------------------

If you'd like to contribute, read more
[at the end of this page](http://www.debiki.com/-81n25/source-code) about contributing.

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
     | +-admin-app/    <-- The admin pages
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


License (AGPL)
-----------------------------

Please let me know if you want me to change from AGPL to GPL, contact info here: http://www.debiki.com/about/


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
