<!--
Old GitHub one-line description:
- Discussion forums with Question & Answers and Team Chat features. Plus embedded comments for your blog.

Current:
- Open source StackOverflow, Slack, Discourse, Reddit, Disqus hybrid — for your online community.

Other alternatives?:
- Community software, brings together the best from StackOverflow + Slack + Reddit + Discourse.
- Online community software. Find ideas and answers together, and pick the right things
to do, to change society, or grow your startup.
-->


Talkyard
=============================

Create a community, where your users can suggest ideas and get questions answered. And have friendly open-ended discussions and chat. Place it at `community.yourwebsite.org`.

People in your community need different types of discussions for different things?
Talkyard supports all discussion types:

 - Question-answers, like StackOverflow (best answers first).
 - Team chat, like Slack.
 - Discussing news and ideas, Reddit and Hacker news style.
 - Solving problems, step by step: flat chronological comments (coming soon).

(You configure the default topic type just once: it's a per category setting.)

There's a Discourse inspired topic list.
And Disqus like embedded comments for your blog — or your open source software API docs?

Our vision is to build a tool that [people who change the world or their neighborood] can use
to find ideas and solutions, and pick the right things to do. That's why we have
Q&A (question-answers) and HackerNews & Reddit type topics, where good ideas and
solutions rise to the top.

<!--
Talkyard (formerly EffectiveDiscussions) is discussion forum software, with chat and question-answers features.
And embedded comments for static websites / blogs.
Inspired by Discourse, Slack, StackOverflow, Reddit and Hacker News, Disqus. -->

Screenshots below.<br>
See it live: https://www.talkyard.io/forum/latest<br>
Read about it, and demo forums: https://www.talkyard.io


### How install?

_This_ repository is for writing Talkyard source code.
To _install_ Talkyard, instead go to: https://github.com/debiki/talkyard-prod-one
("-prod-one" means "production installation on one server").

Docker based installation. Automatic upgrades.
One installation can host many sites.
There's [hosting](https://www.talkyard.io/pricing), if you don't want to install it yourself.

This is beta software; there might be bugs. You can report problems and suggest ideas here: https://www.talkyard.io/forum/latest/support


### Screenshots

Forum index:

![ed-demo-forum-index](https://cloud.githubusercontent.com/assets/7477359/19650764/bb3a1450-9a0a-11e6-884d-d23c93476db3.jpg)

Chat:

![ed-e2e-chat-owen-maria](https://cloud.githubusercontent.com/assets/7477359/19674424/608c49aa-9a88-11e6-8ccd-c2e7ceebd0c2.jpg)

Hacker News / Reddit style discussion:

![ed-discussion-semantics-of-upvote-2013](https://cloud.githubusercontent.com/assets/7477359/19650769/bea906aa-9a0a-11e6-8ea2-9ad771981f46.jpg)

Good user experience (at least we're trying) — for example there's an admin-getting-started guide
for you, if you create a forum:

![ed-admin-intro-guide](https://cloud.githubusercontent.com/assets/7477359/19679591/99a12098-9aa2-11e6-8b65-705c2548cbea.jpg)

Users online:

![ed-online-users](https://cloud.githubusercontent.com/assets/7477359/19680424/f0353f86-9aa5-11e6-84d9-94d46f228b93.jpg)


Getting Started
-----------------------------

#### Before you start

You need about 4 GB RAM for the development environment (whereas the production environment needs about 2 GB).
And a somewhat fast internet connection — you'll be downloading perhaps 0.5 (?) GB Docker images.

Install Docker-Compose, version 1.7.0+: https://docs.docker.com/compose/install/

Read [A brief intro to Docker-Compose](docs/intro-to-docker-compose.md) — unless you know
how to use docker-compose already.

#### The instructions

1. Clone this repository, `cd` into it. Then update submodules:

        git clone https://github.com/debiki/talkyard.git talkyard
        cd talkyard
        git submodule update --init

1. Append some settings to the system config so that ElasticSearch will work:
   (run this as one single command, not one line at a time)

        sudo tee -a /etc/sysctl.conf <<EOF

        ###################################################################
        # Talkyard settings
        #
        # Up the max backlog queue size (num connections per port), default = 128
        net.core.somaxconn=8192
        # ElasticSearch requires (at least) this, default = 65530
        # Docs: https://www.kernel.org/doc/Documentation/sysctl/vm.txt
        vm.max_map_count=262144
        EOF

    Reload the system config:

        sudo sysctl --system

1. Compile and SBT `publish-local` a logging library.

        sudo s/d-cli
        project ed-logging
        publish-local
        # then CTRL+D to exit


1. Build and start all Docker containers: (this will take a while: some Docker images will be downloaded and built)

        sudo docker-compose up -d

        # And tail the logs:
        sudo docker-compose logs -f

  This log message might take 10 - 20 minutes: (lots of stuff is being downloaded — we'll try to
  include all that in the Docker image directly instead, later)

        Loading project definition from /opt/talkyard/app/project

   Wait until this appears in the logs:

        app_1     |
        app_1     | --- (Running the application, auto-reloading is enabled) ---
        app_1     |
        app_1     | [info] p.c.s.NettyServer - Listening for HTTP on /0:0:0:0:0:0:0:0:9000
        app_1     | [info] p.c.s.NettyServer - Listening for HTTPS on /0:0:0:0:0:0:0:0:9443
        app_1     |
        app_1     | (Server started, use Ctrl+D to stop and go back to the console...)
        app_1     |


1. Compile all Scala files, start the server, as follows:

   Point your browser to http://localhost/. This sends a request to the Docker container
   named 'web', in which Nginx listens on port 80. Nginx sends the request to Play Framework
   in the 'app' container, port 9000. Play Framework then starts compiling Scala files; this
   takes a while — so the browser will show a 502 Bad Gateway error message (because Play
   didn't reply because it's busy compiling stuff).

   Eventually, when done compiling, Play Framework will start. Then this message will get logged:

        app_1  | [info] application - Starting... [EsM200HELLO]

   But it's easy to miss, because after that, the server logs even more messages. You can
   continue with the next step just below anyway — just keep reloading the browser page until
   any "is starting" message disappears.


1. Create a forum

   Reload the browser at http://localhost/. Now eventually a page should be shown.
   Sign up as admin with this email: `admin@example.com` (must be that email).
   As username and password you can type `admin` and `public1234`.

   You'll be asked to confirm your email address, by clicking a link in an email
   that was sent to you — but in fact the email couldn't be sent, because you haven't configured
   any email server, and `admin@example.com` isn't your address anyway.

   Instead look at the log messages. (Run `sudo docker-compose logs app` if you've closed
   the terminal with log messages.) There you'll find
   the email — it's written to the log files, in development mode. Copy the
   confirmation link from the `<a href=...>` and paste it in the browser's address bar.


Troubleshooting
-----------------------------

See [tips.mnd](./docs/tips.md).


Tests
-----------------------------

#### End-to-end tests

The end-to-end tests are written in TypeScript and uses Selenium and Webdriver.io.
See the [end-to-end tests readme](./docs/e2e-tests-readme.md).
And, if you want to test in a browser other than Chrome, see [Making *.localhost addresses work](./docs/wildcard-dot-localhost.md).


#### Security tests

The security tests are written in TypeScript and use Tape = test-anything-protocol for Node.js.
See the [security tests readme](./docs/security-tests-readme.md).


#### Unit tests

Stop everything: `sudo docker-compose down` and then: `s/cli` then type `test` + hit Enter.


#### Performance tests

Install Scala SBT, see http://www.scala-sbt.org/download.html. On Linux:

```
echo "deb https://dl.bintray.com/sbt/debian /" | sudo tee -a /etc/apt/sources.list.d/sbt.list
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2EE0EA64E40A89B84B2DF73499E82A75642AC823
sudo apt-get update
sudo apt-get install sbt
```

Append to `/etc/security/limits.conf` ... hmm but now with Docker-Compose, which container?

    your_login_name hard nofile 65535
    your_login_name soft nofile 65535

Configure very high max-requests-per-ip-per-second etc Nginx limits — otherwise during the performance
test Nginx will start to rate limit stuff and reply 503 Service Not Available:

```
sudo docker-compose  -f docker-compose.yml  -f docker-compose-no-limits.yml  up -d
```


Technology
-----------------------------

- Client: React.js, TypeScript, Webdriver.io.
- Server: Scala and Play Framework. Nginx, Nchan, some Lua. React.js in Java's Nashorn Javascript engine.
- Databases: PostgreSQL, Redis, ElasticSearch.


Contributing
-----------------------------

If you'd like to contribute, read more
[at the end of this page](https://www.talkyard.io/dev/-81n25/technical-information) about contributing.

In the future, I suppose there will be a Contributor License Agreement (CLA), similar to
[Google's CLA](https://developers.google.com/open-source/cla/individual) — you'd open
source your code and grant me a copyrigt license.

### Hen and henbirds

Source code comments should be concise, but writing "he or she" everywhere, when referring
to e.g. a user, becomes a bit verbose (because "he or she" is three words). However, there's
a short Swedish word that means "he or she", namely "hen". Let's start using it in English too.

So: "hen" = either "he or she", or "him or her", depending on context.
And "hens" = "his or her", and "hen's" = "he or she is".

If you need to refer to many hen = many-he-or-she, write "people". "Hens" however
means "his or her", just like "its" means, well, "its" (but not "things").

What about the bird previously called "hen"? Let's call it "henbird" instead.

So, hereafter, the word "hen" means "he or she". And the henbird, which I cannot
remember having mentioned or even thought about the past year, no longer gets
to occupy the short and useful word "hen".


Directories
-----------------------------

This project looks like so:


    server/
     |
     +-docker-compose.yml   <-- tells Docker how to run Talkyard
     |
     +-client/         <-- Javascript, CSS, React.js components
     | +-app/          <-- Client side code
     | +-server/       <-- React.js components rendered server side
     |
     +-app/            <-- Scala code — a Play Framework 2 application
     |
     +-tests/
     | +-app/          <-- Unit tests and functional tests, for the app server
     | +-e2e/          <-- End-to-end tests
     | +-security/     <-- Security tests
     |
     +-modules/
     | +-ed-dao-rdb/        <-- A database access object (DAO), for PostgreSQL
     | +-ed-core/           <-- Code shared by the DAO and by the ./app/ code
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
     | |   +-luajit/   <-- Lua
     | |   ...
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
     +-s/         <-- Utility scripts (typing "scripts/" is too long, boring)
     |
     +-conf/      <-- Default config files that assume everything
                      is installed on localohost, and dev mode

Naming style
-----------------------------

### CSS classes and ids

*Example*: `s_P_By_FN-Gst`. Here, `s_` is a prefix used for all classes, and
it means "some". For ids we use `t_` instead, means "the". `P` means Post. `By` means
who-was-it-written-By. `FN` means Full Name. `Gst` means Guest.

So, this is BEM (Block Element Modifier) with a few tweaks: Blocks/elements are separated with
only one underscore, and modifiers with only one dash. Blocks, elems and modifiers always
start with uppercase — because then it's easy to tell if we're dealing with an _abbreviation_
or not. For example, `FN` (full name) is an abbreviation. But `By` is not (since it continues with
lowercase letters).

For stuff with otherwise no class or id, and that should be clicked in end-to-end tests,
we use classes only, and the prefix `e_` (instead of `s_` or `t_`).


Custom third party builds
-----------------------------

We're building & using a smaller version of Lodash, like so:
(this makes slim-bundle.min.js.gz 8kb = 4% smaller, as of September 2016)

    node_modules/lodash-cli/bin/lodash  include=assign,assignIn,before,bind,chain,clone,compact,concat,create,debounce,defaults,defer,delay,each,escape,every,filter,find,findLast,flatten,flattenDeep,forEach,forOwn,has,head,includes,identity,indexOf,isArguments,isArray,isBoolean,isDate,isEmpty,isEqual,isFinite,isFunction,isNaN,isNull,isNumber,isObject,isRegExp,isString,isUndefined,iteratee,keys,last,map,matches,max,min,mixin,negate,noConflict,noop,once,pick,reduce,remove,result,size,slice,some,sortBy,sumBy,take,tap,throttle,thru,toArray,uniq,uniqBy,uniqueId,value,values \
      --output client/third-party/lodash-custom.js

- For security reasons, we checkin only the resulting `.js` file (but not the `.min.js`) file
into source control (so that you can read the source code and see what it does).
- There are some Gulp plugins that builds Lodash but one seems abandonend (gulp-lodash-builder)
and the other (gulp-lodash-custom) analyzes all .js files, I guess that'd slow down the build
rather much + won't immediately work with Typescript?


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

Currently AGPL — please let me know if you want me to change to GPL, contact info here: https://www.talkyard.io/contact


    Copyright (c) 2010-2018  Kaj Magnus Lindberg

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
