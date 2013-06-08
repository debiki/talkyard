<a href="http://www.debiki.com/">![Logo](http://www.debiki.com/-/img/logo-128x120.png) Debiki</a>
=============================

Debiki is an open source (AGPL) discussion platform for forums, blogs
and simple websites.

It intends to:

- Save time, by showing the interesting comments first,
  and solving the off-topic problem, and other things

- Promote fruitful discussions

- Help people better understand others with different points of view

Read more at http://www.debiki.com/ and have a look at
[this DEMO](http://www.debiki.com/demo/-71cs1-demo-page-1).

A good alternative to Debiki could be [Discourse](http://www.discourse.org/) —
it has a different focus: a "flattened, endlessly scrolling discussion" and it
does not intend to show the most interesting comments first.  I think that
Discourse is more like a combined forum + chat, and Debiki is more like a
combined forum/blog + Question/Answers site.

Debiki is under development and there is currently no stable version or simple
installation instructions.



Getting Started
-----------------------------

This Git repo holds all source code. However, don't clone it directly.
Instead, use this skeleton project for a Debiki site:

>  [debiki-site-seed](https://github.com/debiki/debiki-site-seed)

That project includes a Vagrantfile so you can get started quickly.
— When you checkout that project, you'll also checkout this project, as a
submodule.



Contributing
-----------------------------

Debiki is written in Scala, Javascript, LiveScript, HTML, CSS and SQL.
It uses Play Framework 2.1, PostgreSQL, jQuery, AngularJS and Node.js Grunt.

If you'd like to contribute any source code, then perhaps you could to send me
an email, or a GitHub pull request. And please sign this Contributor License
Agreement (CLA) (oops! it does not yet exist. But it'll be similar to [Google's
CLA](https://developers.google.com/open-source/cla/individual) — you'd open
source your code and grant me a copyrigt license).

(Please wrap lines if longer than 100 characters.
And, for Scala code, please use [the official style guide](http://docs.scala-lang.org/style/).
For Javascript, use [Google's style guide](http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml).)



Directory Layout
-----------------------------

This project looks like so:


    server/
     |
     +-client/         <-- Javascript, CSS, Livescript
     |
     +-app/            <-- Scala code -- a Play Framework 2.1 app
     | +-controllers/
     | +-debiki/
     | +-views/        <-- HTML (well, Play's Scala templates)
     |   +-themes/     <-- A softlink to a supposed parent Git repo with
     |                     website specifec HTML and CSS
     +-modules/
     | +-debiki-dao-pgsql/  <-- A database access object (DAO), for PostgreSQL
     | +-debiki-tck-dao/    <-- Test suite for Database Access Object:s
     | +-debiki-core/       <-- Code shared by the DAO and by the ./app/ code
     | |
     | ...Third party modules
     |
     +-public/     <-- Some images and libs, plus JS and CSS that Grunt
     |                 has bundled and minified.
     |
     +-scripts/         <-- Utiity scripts
     +-scripts-client/  <-- Broken scripts, not in use
     |
     +-conf/       <-- Default config files that assume everything
     | |               is installed on localohost
     | |
     | +-local/    <-- A softlink to a supposed parent Git repo with
     |                 website specific config files, which override the
     |                 default config files.
     |
     +-conf-cient/ <-- Broken config files, not in use



License (AGPL)
-----------------------------

    Copyright (C) 2010-2013  Kaj Magnus Lindberg (born 1979)

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


