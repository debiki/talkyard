About the Talkyard Docker images
================================

Here're the Talkyar images, located in [`../images/<image-name>`](../images/), and what they do:


### [web](../images/web/)

This is a HTTP server, currently Nginx with Lua.
Planning to change to OpenResty, with automatic HTTPS via
https://github.com/GUI/lua-resty-auto-ssl (currently one
needs to run LetsEncryp's `certbot` manually).

Nginx serves uploaded files and transpiled Javascript and CSS directly
from the file system. Also does some request rate limiting.
And outgoing bandwith limiting, see `images/web/ed-lua/lua-limit-bandwidth`,
to reduce? elliminate? the risk that you get a surprise bill from your cloud provider
for high bandwidth costs.

Currently includes a certain Nchan Nginx module, for long polling.
However, I think Nchan isn't needed. The plan is instead to use HTTP2 and
Server Sent Events, directly from Play Framework, in the `app` container.


### [app](../images/app/)

The application server. It's a Scala app, built on the Play Framework web framework.
This is where all server side features are implemented, incl authentication and authorization.
And even more request rate limiting, different, for different endpoints.

In dev mode (that's when you type `make up`), a development build of the app server image gets
built. It'll `-jvm-debug` listen on port 9999 so you can connect to that port,
with IntelliJ IDEA's Scala plugin.

When you instead type `make prod-images`, a different Dockerfile, namely
`images/app/Dockerfile.prod`, gets used. It builds a smaller image that
runs Play Framework in production mode.


### [cache](../images/cache/)

This is Redis, an in-memory cache that remembers things accross server restart
(although currently most in-memory cached things are cached in the *app* container
and forgotten on restart).


### [search](../images/search/)

ElasticSearch, for full text search and faceted search.
Uses rather much memory, because runs on the JVM.
Maybe can be replaced, later on, with https://github.com/toshi-search/Toshi
— a work-in-progress full text search engine, written in Rust.


### [rdb](../images/rdb/)

A relational database, namely PostgreSQL. Here's where all discussion topics and comments and
users and everything is saved — except for uploaded files. Those might be large, like
5 or 50 or 500 MB and are instead stored in the file system (or maybe, later on,
optionally in an object storage like Google Cloud Storage or Amazon S3).


### [fakemail](../images/fakemail/) (dev only)

A dummy SMTP mail server, for testing email sending functionality. Not included in
production deployments.


### [gulp](../images/gulp/) (dev only)

Node.js with Gulp. Transpiles Talkyard's React.js webb app, written in Typescript and Stylus,
to minified Javascript and CSS. Not included in production deployments.


### [certgen](../images/certgen/) (not needed)

The plan was to use this image, for generating automatic HTTPS certs via LetsEncrypt.
Turns out, can use https://github.com/GUI/lua-resty-auto-ssl instead, so this image
is no longer needed.


### backup (planned)
<!-- ### [backup](../images/backup/) (planned) -->

There's already a backup script for the *talkyard-prod-one* production installation 
([here](https://github.com/debiki/talkyard-prod-one/blob/master/scripts/backup.sh)),
but not for *talkyard-prod-swarm* https://github.com/debiki/talkyard-prod-swarm.
I (KajMagnus) think it'd be good with a backup container,
which would run Bash scripts regularly to backup everything to a backup Docker volume,
which you can then `rsync` to an off-site safe place.
