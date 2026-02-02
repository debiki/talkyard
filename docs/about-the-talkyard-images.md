About the Talkyard Docker images
================================

Here're the Talkyar images, located in [`../images/<image-name>`](../images/), and what they do:


### [web](../images/web/)

This is a HTTP server: OpenResty, an Nginx distribution with Lua.

Nginx serves uploaded files and transpiled Javascript and CSS directly
from the file system. Also does some request rate limiting.
And outgoing bandwith limiting, see `images/web/ty-lua/lua-limit-bandwidth`,
to reduce? elliminate? the risk that you get a surprise bill from your cloud provider
for high bandwidth costs.


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


### [rendr](../images/rendr/)

Not in use. Later, will run React.js server side for server side rendering,
when we can't use Nashorn any longer (it was removed in Java 17).


### [cache](../images/cache/)

This is Redis, an in-memory cache that remembers things accross server restart,
e.g. HTTPS certificates and number of users online.
Maybe it'd been better to use something else / do in some other way.
Not used much — most in-memory cached things are instead cached in the *app* container
and forgotten on restart.


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


### [egressp](../images/egressp/)

An egress proxy — for making outbound connections to external things, e.g. for sending
webhooks. Stops Server Side Request Forgery (SSRF).


### [nodejs](../images/nodejs/) (dev only)

Node.js with Gulp. Transpiles Talkyard's React.js webb app, written in Typescript and Stylus,
to minified Javascript and CSS. Not included in production deployments.


### [backup](../images/backup/)

Runs a daily backup script, and deletes old backups,
for a *talkyard-prod-one* production installation.
Started by a wrapper scripts in  *talkyard-prod-one*, 
[here](https://github.com/debiki/talkyard-prod-one/blob/master/scripts/backup.sh),
which are scheduled as cron jobs, if you follow the installation instructions.


### [fakeweb](../images/fakeweb/) (dev only)

A dummy web server, for testing embedded commens and embedded forums.
Not included in production deployments.


### [fakemail](../images/fakemail/) (dev only)

A dummy SMTP mail server, for testing email sending functionality. Not included in
production deployments.

